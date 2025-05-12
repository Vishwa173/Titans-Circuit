const board = document.getElementById("board");

const RING_SPACING = 100;

/*window.addEventListener('resize', () => {
  location.reload();
});*/

const urlParams = new URLSearchParams(window.location.search);
const RINGS = parseInt(urlParams.get("circuits")) ;  
const NODES_PER_RING = parseInt(urlParams.get("nodes")) ;

const boardWidth = board.clientWidth;
const boardHeight = board.clientHeight;
const radiusBase = Math.min(boardWidth, boardHeight) / 2.5;

const baseWeight = RINGS;
const increment = 2;

let allRings = [];
const edgeMap = {};
const nodeMap = {};
let subtractedEdges = [];
const moveHistory = [];
const moveStack = []; 
const undoStack = [];

let currentPlayer = "red";
let unlockedRingIndex = RINGS - 1;
const maxTitans = 4;
let bufferScore = 0;
let moveText;
let dScore;

const playerPieces = {
  red: [],
  blue: []
};

const playerScores = {
  red: 0,
  blue: 0
};

let totalTimes = {
  red: 600,
  blue: 600
};

let moveTime = 30;
let moveTimer = moveTime;

let moveInterval = null;
let totalInterval = null;
let moveTextTimeElement, currentTotalTimeElement;
let isPaused = false;

//let movementPhase = false;
let selectedTitan = null;

const placementSound = new Audio("./audio/placement-audio.wav");
const movementSound = new Audio("./audio/movement-audio.wav");
movementSound.volume = 1;
const surroundSound = new Audio("./audio/surround-audio.wav");

/*function updateUI() {
  document.getElementById("turn").innerText = `Current Turn: ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}`;
}*/

window.addEventListener("DOMContentLoaded", () => {
  const bgm = document.getElementById("bgm");
  bgm.volume = 0.4;
  bgm.play().catch(err => {
    console.warn("BGM autoplay failed:", err);
  });
});

document.getElementById("watchReplayBtn").addEventListener("click", async () => {
  document.getElementById("watchReplayBtn").disabled = true; 
  document.getElementById("gameEndPopup").style.display = "none";

  clearBoard();

  await new Promise(resolve => setTimeout(resolve, 200));

  await replayMoves(moveStack); 
});

document.getElementById("pauseToggleBtn").addEventListener("click", () => {
  //console.log("Pause toggle clicked");
  isPaused = !isPaused;
  document.getElementById("pauseToggleBtn").textContent = isPaused ? "Resume" : "Pause";
  if (isPaused){
    document.getElementById("pauseOverlay").style.display = "block";
  }
  else{
    document.getElementById("pauseOverlay").style.display = "none";
  }
});

document.getElementById("resetBtn").addEventListener("click", () => {
  location.reload(); 
});

document.querySelector('#historyBtn').addEventListener('click', () => {
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = ''; 
  moveHistory.forEach(move => {
    const li = document.createElement('li');
    li.textContent = move;
    historyList.appendChild(li);
  });
  document.getElementById('history-popup').classList.remove('hidden');
});

document.getElementById('close-history').addEventListener('click', () => {
  document.getElementById('history-popup').classList.add('hidden');
});

document.getElementById("undoBtn").addEventListener("click", undoMove);
document.getElementById("redoBtn").addEventListener("click", redoMove);

function clearBoard() {
  const occupiedNodes = document.querySelectorAll(".occupied");
  occupiedNodes.forEach(node => {
    node.innerHTML = ""; 
    node.classList.remove("occupied", "red", "blue"); 
  });

  for (const nodeId in nodeMap) {
    nodeMap[nodeId].occupiedBy = null;
  }
}

function updateNodeOccupancy(nodeId, playerColor) {
  if (nodeMap[nodeId]) {
    nodeMap[nodeId].occupiedBy = playerColor;
  }
}

function isInnermostRingFull() {
  return Object.values(nodeMap)
    .filter(node => node.ring === 0)
    .every(node => node.occupiedBy !== null);
}

function getScoreWinner() {
  if (playerScores.red > playerScores.blue) return "red";
  else if (playerScores.blue >playerScores.red) return "blue";
  else return "draw"; 
}

function updateCurrentTurnDisplay() {
  const turnEl = document.getElementById("currentTurn");
  if (turnEl) {
    turnEl.textContent = `Current Turn: ${currentPlayer.toUpperCase()}`;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function checkTimerEnd() {
  if (totalTimes.red <= 0) {
    endGame("blue"); 
  } else if (totalTimes.blue <= 0) {
    endGame("red"); 
  }
}

function updateTimerDisplays() {
  document.getElementById("redTotalTime").textContent = formatTime(totalTimes.red);
  document.getElementById("blueTotalTime").textContent = formatTime(totalTimes.blue);
  document.getElementById("redMoveTime").textContent = currentPlayer === "red" ? moveTimer : "30";
  document.getElementById("blueMoveTime").textContent = currentPlayer === "blue" ? moveTimer : "30";
}

function switchCurrentPlayer() {
  currentPlayer = currentPlayer === "red" ? "blue" : "red";

  moveTimer = moveTime;
  updateTimerDisplays();

  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }

  moveInterval = setInterval(() => {
    if (!isPaused) {
      moveTimer--;
      if (moveTimer <= 0) {
        clearInterval(moveInterval);
        alert(`${currentPlayer.toUpperCase()} ran out of move time!`);
        switchCurrentPlayer(); 
      }
      updateTimerDisplays();
    }
  }, 1000);

  updateCurrentTurnDisplay();
}

function startTimers() {
  clearInterval(moveInterval);
  clearInterval(totalInterval);

  moveTimer = moveTime;
  updateTimerDisplays();

  moveInterval = setInterval(() => {
    if (!isPaused) {
      moveTimer--;

      if (moveTimer <= 0) {
        clearInterval(moveInterval);
        alert(`${currentPlayer.toUpperCase()} ran out of move time!`);
        switchCurrentPlayer(); 
        moveTimer = moveTime;
        startTimers(); 
        return;
      }

      updateTimerDisplays();
    }
  }, 1000);

  totalInterval = setInterval(() => {
    if (!isPaused) {
      totalTimes[currentPlayer]--;

      if (totalTimes[currentPlayer] <= 0) {
        clearInterval(totalInterval);
        clearInterval(moveInterval);
        alert(`${currentPlayer.toUpperCase()} ran out of total time!`);
        return;
      }

      updateTimerDisplays();
    }
  }, 1000);
}

function getAdjacentNodes(node) {
  const ring = parseInt(node.dataset.ring);
  const index = parseInt(node.dataset.index);
  const neighbors = [];

  const ringNodes = Array.from(document.querySelectorAll(`.node[data-ring="${ring}"]`));
  const prevIndex = (index - 1 + NODES_PER_RING) % NODES_PER_RING;
  const nextIndex = (index + 1) % NODES_PER_RING;
  neighbors.push(ringNodes[prevIndex], ringNodes[nextIndex]);

  if (ring > 0 && ((ring % 2 != 0 && index % 2 == 0) || (ring % 2 == 0 && index % 2 != 0))) {
    const innerNode = document.querySelector(`.node[data-ring="${ring - 1}"][data-index="${index % NODES_PER_RING}"]`);
    if (innerNode) neighbors.push(innerNode);
  }
  if (ring < RINGS - 1 && ((ring % 2 == 0 && index % 2 == 0) || (ring % 2 != 0 && index % 2 != 0))) {
    const outerNode = document.querySelector(`.node[data-ring="${ring + 1}"][data-index="${index % NODES_PER_RING}"]`);
    if (outerNode) neighbors.push(outerNode);
  }

  return neighbors;
}

function checkForSurroundedOpponents(node) {

  const opponent = currentPlayer === "red" ? "blue" : "red";
  const neighbors = getAdjacentNodes(node);
  //console.log(neighbors);

  neighbors.forEach(neighbor => {
    if (neighbor.classList.contains("occupied") && neighbor.classList.contains(opponent)) {
      const surrounding = getAdjacentNodes(neighbor);
      //console.log(surrounding);
      const isSurrounded = surrounding.every(n =>
        n.classList.contains("occupied") && n.classList.contains(currentPlayer)
      );

      if (isSurrounded) {
        const img = neighbor.querySelector("img");
        if (img) {
          img.classList.add("fade-out");
          img.addEventListener("animationend", () => {
            neighbor.classList.remove("occupied", opponent);
            neighbor.innerHTML = "";
            neighbor.classList.remove("red", "blue"); 

            //console.log(selectedTitan);
            selectedTitan = null;
            nodeMap[neighbor.dataset.nodeId].occupiedBy = null;

            moveText = `${opponent} was eliminated from ${neighbor.dataset.nodeId}`;
            moveHistory.push(moveText);
            moveStack.push([2, neighbor.dataset.nodeId, 0, opponent,0]); 
            undoStack.length = 0;

            surroundSound.currentTime = 0;
            surroundSound.play();

            playerPieces[opponent].pop();

            console.log(playerPieces);
            
          });
        } else {
          neighbor.classList.remove("occupied", opponent);
          neighbor.innerHTML = "";
        }
      }
    }
  });

  const surroundingSelf = getAdjacentNodes(node);
  const isCurrentSurrounded = surroundingSelf.every(n =>
    n.classList.contains("occupied") && n.classList.contains(opponent)
  );

  if (isCurrentSurrounded) {
    const img = node.querySelector("img");
    if (img) {
      const playerToPop = currentPlayer
      img.classList.add("fade-out");
      img.addEventListener("animationend", () => {
        //console.log(node.classList);
        node.classList.remove("occupied", playerToPop);
        node.innerHTML = "";
        node.classList.remove("red", "blue"); 

        //console.log(playerToPop);
        selectedTitan = null;
        //console.log(node.classList);
        //console.log(selectedTitan);
        nodeMap[node.dataset.nodeId].occupiedBy = null;
 
        moveText = `${playerToPop} was eliminated from ${node.dataset.nodeId}`;
        moveHistory.push(moveText);
        moveStack.push([2, node.dataset.nodeId, 0, playerToPop,0]);
        undoStack.length = 0;

        surroundSound.currentTime = 0;
        surroundSound.play();

        playerPieces[playerToPop].pop();
      });
    } else {
      node.classList.remove("occupied", currentPlayer);
      node.innerHTML = "";
    }
  }
}

function clearHighlights() {
  document.querySelectorAll(".node").forEach(node => node.classList.remove("highlight"));
}

function highlightValidMoves(node) {
  clearHighlights();
  const validMoves = getAdjacentNodes(node).filter(n => {
    const ring = parseInt(n.dataset.ring);
    return !n.classList.contains("occupied") && ring >= unlockedRingIndex;
  });
  validMoves.forEach(n => n.classList.add("highlight"));
}

function updateScoreDisplay() {
  const redEl = document.getElementById("redScore");
  const blueEl = document.getElementById("blueScore");

  if (redEl && blueEl) {
    redEl.textContent = playerScores.red;
    blueEl.textContent = playerScores.blue;
  }
}

function handlePlacement(node) {
  const ring = parseInt(node.dataset.ring);
  if (ring != unlockedRingIndex) return;
  if (node.classList.contains("occupied")) return;
  if (playerPieces[currentPlayer].length >= maxTitans) return;
  if (isPaused) return;

  node.classList.add("occupied", currentPlayer);
  playerPieces[currentPlayer].push(node);

  const titanImg = document.createElement("img");
  titanImg.src = `./images/${currentPlayer}Titan.png`;
  titanImg.classList.add("titan-image");
  node.appendChild(titanImg);

  const nodeId = node.dataset.nodeId;
  const neighbors = getAdjacentNodes(node);

  neighbors.forEach(adj => {
    const adjId = adj.dataset.nodeId;

      if (adj.classList.contains("occupied") && adj.classList.contains(currentPlayer)) {
      const key = [nodeId, adjId].sort().join("-");
      const edge = edgeMap[key];
      dScore = edge.weight;

      if (edge) {
          playerScores[currentPlayer] += edge.weight;
          updateScoreDisplay();
          //console.log(playerScores);
      }
    }
  });

  const index = node.dataset.nodeId;
  nodeMap[index].occupiedBy = currentPlayer;

  moveText = `${currentPlayer} was placed on ${node.dataset.nodeId}`;
  moveHistory.push(moveText);
  if (dScore){
    moveStack.push([0, 0, node.dataset.nodeId, currentPlayer,dScore]);
  }else {
    moveStack.push([0, 0, node.dataset.nodeId, currentPlayer,0]);
  }
  console.log(moveStack);
  undoStack.length = 0;

  checkForSurroundedOpponents(node);

  placementSound.currentTime = 0;
  placementSound.play();

  if (isInnermostRingFull()) {
    const winner = getScoreWinner();
    endGame(winner);
  }

  const totalInRing = allRings[ring].length;
  const occupiedCount = Array.from(document.querySelectorAll(`.node[data-ring="${ring}"].occupied`)).length;

  if (occupiedCount === totalInRing && unlockedRingIndex > 0) {
    unlockedRingIndex--;
  }

  currentPlayer = currentPlayer == "red" ? "blue" : "red";
  updateCurrentTurnDisplay();
  updateCurrentTurnDisplay();
  moveTimer = moveTime;     
  startTimers();   
}

function handleMoveStart(node) {
  if (isPaused) return;

  if (node.classList.contains("occupied") && node.classList.contains(currentPlayer) && !selectedTitan) {
    selectedTitan = node;
    //console.log(selectedTitan);
    node.classList.add("selected");
    highlightValidMoves(node);

    const nodeId = node.dataset.nodeId;
    const neighbors = getAdjacentNodes(node);

    subtractedEdges = [];
    neighbors.forEach(adj => {
    const adjId = adj.dataset.nodeId;

      if (adj.classList.contains("occupied") && adj.classList.contains(currentPlayer)) {
        const key = [nodeId, adjId].sort().join("-");
        const edge = edgeMap[key];
        dScore = -(edge.weight);

        if (edge) {
          playerScores[currentPlayer] -= edge.weight;
          subtractedEdges.push(edge);
          updateScoreDisplay();
          //console.log(playerScores);
        }
     }
    });

    /*for (let key in edgeMap) {
      const edge = edgeMap[key];
      if (edge.nodes.includes(nodeId)) {
        const [n1, n2] = edge.nodes;
        const otherNodeId = n1 === nodeId ? n2 : n1;

        const otherNode = document.querySelector(`[data-node-id='${otherNodeId}']`);
        if (
          otherNode &&
          otherNode.classList.contains("occupied") &&
          otherNode.classList.contains(currentPlayer)
        ) {
          playerScores[currentPlayer] -= edge.weight;
          updateScoreDisplay(currentPlayer);
        }
      }
    }*/
  }else{
    subtractedEdges.forEach(edge => {
      playerScores[currentPlayer] += edge.weight;
    });
    subtractedEdges = [];
  
    selectedTitan.classList.remove("selected");
    selectedTitan = null;
    clearHighlights();
    updateScoreDisplay();
  }
}

function handleMoveEnd(node) {
  if (isPaused) return;

  const validMoves = getAdjacentNodes(selectedTitan).filter(n => {
    const ring = parseInt(n.dataset.ring);
    return !n.classList.contains("occupied") && ring >= unlockedRingIndex;
  });

  if (validMoves.includes(node)) {
    const img = selectedTitan.querySelector("img");
    const startRect = selectedTitan.getBoundingClientRect();
    const endRect = node.getBoundingClientRect();

    const animImg = img.cloneNode(true);
    img.style.visibility = "hidden";
    document.body.appendChild(animImg);

    Object.assign(animImg.style, {
      position: "absolute",
      top: `${startRect.top}px`,
      left: `${startRect.left}px`,
      width: `${img.width}px`,
      height: `${img.height}px`,
      pointerEvents: "none",
      transition: "transform 0.5s ease",
      zIndex: 1000
    });

    requestAnimationFrame(() => {
      const deltaX = endRect.left - startRect.left;
      const deltaY = endRect.top - startRect.top;
      animImg.style.transform = `translate(${deltaX - 25}px, ${deltaY - 30}px)`;
    });

    animImg.addEventListener("transitionend", () => {
      
      animImg.remove();
      const fromNode = selectedTitan.closest(".node");

      fromNode.classList.remove("occupied", currentPlayer, "selected");
      fromNode.innerHTML = "";
      nodeMap[fromNode.dataset.nodeId].occupiedBy = null;
      //selectedTitan.classList.remove("occupied", currentPlayer, "selected");
      //selectedTitan.innerHTML = "";

      node.classList.add("occupied", currentPlayer);
      node.appendChild(img);
      img.style.visibility = "visible";
      
      const nodeId = node.dataset.nodeId;
      const neighbors = getAdjacentNodes(node);

      neighbors.forEach(adj => {
        const adjId = adj.dataset.nodeId;

        if (adj.classList.contains("occupied") && adj.classList.contains(currentPlayer)) {
          const key = [nodeId, adjId].sort().join("-");
          const edge = edgeMap[key];
          dScore = edge.weight;

          if (edge) {
            playerScores[currentPlayer] += edge.weight;
            updateScoreDisplay();
            //console.log(playerScores);
          }
        }
      });

      node.classList.add("occupied", currentPlayer);
      node.appendChild(img);

      movementSound.currentTime = 0;
      movementSound.play();
      nodeMap[nodeId].occupiedBy = currentPlayer;

      moveText = `${currentPlayer} moved from ${selectedTitan.dataset.nodeId} to ${node.dataset.nodeId}`;
      moveHistory.push(moveText);
      if (Math.abs(dScore)){
      moveStack.push([1, selectedTitan.dataset.nodeId, node.dataset.nodeId, currentPlayer, dScore]);
      }else {
        moveStack.push([1, selectedTitan.dataset.nodeId, node.dataset.nodeId, currentPlayer, 0]);
      }
      undoStack.length = 0;

      if (isInnermostRingFull()) {
        const winner = getScoreWinner();
        endGame(winner);
      }      

      checkForSurroundedOpponents(node);

      const currentRingNodes = document.querySelectorAll(`.node[data-ring="${unlockedRingIndex}"]`);
      const isFull = Array.from(currentRingNodes).every(n => n.classList.contains("occupied"));
      if (isFull && unlockedRingIndex > 0) {
        unlockedRingIndex--;
        //console.log(`Unlocked inner ring: ${unlockedRingIndex}`);
      }

      selectedTitan = null;
      clearHighlights();
      currentPlayer = currentPlayer === "red" ? "blue" : "red";
      updateCurrentTurnDisplay();
      updateCurrentTurnDisplay();
      moveTimer = moveTime;     
      startTimers();   
    });
  } else {
    selectedTitan.classList.remove("selected");
    selectedTitan = null;
    clearHighlights();
  }
}

function endGame(winnerPlayer) {
  const popup = document.getElementById("gameEndPopup");
  const popupText = document.getElementById("gameEndText");
  const popupImage = document.getElementById("gameEndImage");

  popupText.textContent = `Player ${winnerPlayer} WON THE GAME!`;

  popupImage.src = winnerPlayer === "red"
    ? "images/redTitan.png"
    : "images/blueTitan.png";

  popup.style.display = "flex";

  const gameOverAudio = new Audio("./audio/gameover-audio.mp3");
  gameOverAudio.play();

  const leaderboard = JSON.parse(localStorage.getItem("titanLeaderboard")) || { red: 0, blue: 0 };
  leaderboard[winnerPlayer]++;
  localStorage.setItem("titanLeaderboard", JSON.stringify(leaderboard));

  gameEnded = true;

  playerScores[red] = 0;
  playerScores[blue] = 0;

  updateScoreDisplay();

  clearInterval(currentTotalTimeElement);
  console.log(moveStack);
  //console.log([data-nodeID= moveStack[0][2]]);
}

function undoMove() {
  if (moveStack.length === 0) return;

  const [action, from, to, player, dScore] = moveStack.pop();
  undoStack.push([action, from, to, player, dScore]);
  playerScores[player] -= dScore;

  currentPlayer = player;
  moveTimer = moveTime;
  startTimers();
  updateCurrentTurnDisplay();

  switch (action) {
    case 0: {
      const node = document.querySelector(`[data-node-id="${to}"]`);
      node.classList.remove("occupied", player);
      node.innerHTML = "";
      nodeMap[to].occupiedBy = null;
      playerPieces[player].pop();
      break;
    }

    case 1: { 
      const fromNode = document.querySelector(`[data-node-id="${from}"]`);
      const toNode = document.querySelector(`[data-node-id="${to}"]`);
      const img = toNode.querySelector("img");

      toNode.classList.remove("occupied", player);
      toNode.innerHTML = "";
      nodeMap[to].occupiedBy = null;

      fromNode.classList.add("occupied", player);
      fromNode.innerHTML = "";
      fromNode.appendChild(img);
      nodeMap[from].occupiedBy = player;

      break;
    }

    case 2: { 
      const node = document.querySelector(`[data-node-id="${from}"]`);
      node.classList.add("occupied", player);
      const titanImg = document.createElement("img");
      titanImg.src = `./images/${player}Titan.png`;
      titanImg.classList.add("titan-image");
      node.appendChild(titanImg);
      nodeMap[from].occupiedBy = player;
      playerPieces[player].push(node);
      break;
    }
  }
  console.log('Undoing move by', player, 'Score delta:', dScore);

  console.log(playerScores);
  updateScoreDisplay();
}

function redoMove() {
  if (undoStack.length === 0) return;

  const [action, from, to, player, dScore] = undoStack.pop();
  moveStack.push([action, from, to, player, dScore]);

  currentPlayer = player;
  moveTimer = moveTime;
  startTimers();
  updateCurrentTurnDisplay();

  switch (action) {
    case 0: { 
      const node = document.querySelector(`[data-node-id="${to}"]`);
      node.classList.add("occupied", player);
      const titanImg = document.createElement("img");
      titanImg.src = `./images/${player}Titan.png`;
      titanImg.classList.add("titan-image");
      node.appendChild(titanImg);
      nodeMap[to].occupiedBy = player;
      playerPieces[player].push(node);
      break;
    }

    case 1: { 
      const fromNode = document.querySelector(`[data-node-id="${from}"]`);
      const toNode = document.querySelector(`[data-node-id="${to}"]`);
      const img = fromNode.querySelector("img");

      fromNode.classList.remove("occupied", player);
      fromNode.innerHTML = "";
      nodeMap[from].occupiedBy = null;

      toNode.classList.add("occupied", player);
      toNode.innerHTML = "";
      toNode.appendChild(img);
      nodeMap[to].occupiedBy = player;
      break;
    }

    case 2: { 
      const node = document.querySelector(`[data-node-id="${from}"]`);
      node.classList.remove("occupied", player);
      node.innerHTML = "";
      nodeMap[from].occupiedBy = null;
      playerPieces[player].pop();
      break;
    }
  }

  playerScores[player] += dScore;

  currentPlayer = currentPlayer === "red" ? "blue" : "red";
  updateCurrentTurnDisplay();
  updateScoreDisplay();
}

/*const gameBoard = document.querySelector(".board");
const boardSize = gameBoard.offsetWidth; 
const center = 50;
const maxRadius = 40;*/

for (let ringNum = 1; ringNum <= RINGS; ringNum++) {
  const ring = document.createElement("div");
  ring.classList.add("ring");

  //const radiusPercent = (ringNum / RINGS) * maxRadius;
  const radius = (ringNum / RINGS) * radiusBase;
  const nodes = [];
  const weight = baseWeight - (ringNum - baseWeight) * increment;

  for (let i = 0; i < NODES_PER_RING; i++) {
    /*const angleDeg = (360 / NODES_PER_RING) * i;
    const angleRad = angleDeg * (Math.PI / 180);

    const x = center + radiusPercent * Math.cos(angleRad);
    const y = center + radiusPercent * Math.sin(angleRad);

    const node = document.createElement("div");
    node.classList.add("node");
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.dataset.ring = ringNum - 1;
    node.dataset.index = i;

    ring.appendChild(node);
    console.log("running");*/ //bugs

    const offset = (NODES_PER_RING % 2 === 0) ? 0: -90 + (360 / NODES_PER_RING);
    const angleDeg = (360 / NODES_PER_RING) * i + offset;
    const angleRad = angleDeg * (Math.PI / 180);
    const x = radius * Math.cos(angleRad);
    const y = radius * Math.sin(angleRad);

    const node = document.createElement("div");
    node.classList.add("node");
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.dataset.ring = ringNum - 1;
    node.dataset.index = i;
    node.dataset.nodeId = `r${ringNum-1}n${i}`;
    //console.log(node.dataset.nodeId);
    const nodeId = node.dataset.nodeId;

    nodeMap[nodeId] = {
      ring : ringNum - 1,
      index : i,
      occupiedBy : null
    };

    node.addEventListener("click", () => {
      if (node.classList.contains("occupied") && node.classList.contains(currentPlayer)) {
        handleMoveStart(node);  
      }
      else if (!node.classList.contains("occupied")) {
        if (selectedTitan) {
          handleMoveEnd(node);
        } else {
          handlePlacement(node);
        }
      }
    });
    

    ring.appendChild(node);
    nodes.push({ x, y });
  }

  const svg = document.getElementById("edge-layer");
  /*const board = document.querySelector(".board");
  const boardRect = board.getBoundingClientRect();

  const nodeElems = document.querySelectorAll(".node");

  const nodeCenters = Array.from(nodeElems).map(el => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - boardRect.left,
      y: rect.top + rect.height / 2 - boardRect.top
    };
  });*/

  const boardWidth = board.clientWidth;
  const boardHeight = board.clientHeight;


  for (let i = 0; i < nodes.length; i++) {

    const cur = nodes[i];
    const next = nodes[(i + 1) % nodes.length];

    const x1 = ((cur.x - boardWidth / 2) / boardWidth) * 100 + 100;
    const y1 = ((cur.y - boardHeight / 2) / boardHeight) * 100 + 100;
    const x2 = ((next.x - boardWidth / 2) / boardWidth) * 100 +100;
    const y2 = ((next.y - boardHeight / 2) / boardHeight) * 100 + 100;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#00ffff");
    line.setAttribute("class", "circuit-line");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("filter", "drop-shadow(0 0 3px #00ffff)");

    svg.appendChild(line);

    /*const cur = nodes[i];
    const next = nodes[(i + 1) % nodes.length];
  
    const x1 = cur.x + 500;
    const y1 = cur.y+360;
    const x2 = next.x + 500;
    const y2 = next.y+360;
  
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "green");
    line.setAttribute("stroke-width", "5");
  
    svg.appendChild(line);*/
    const mpX = ((cur.x + next.x)) / 2;
    const mpY = ((cur.y + next.y)) / 2; //not responsive

    /*const dx = next.x - cur.x;
    const dy = next.y - cur.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    edge.style.width = `${length}px`;
    edge.style.left = `${mpX}px`;
    edge.style.top = `${mpY}px`;
    edge.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

    ring.appendChild(edge);*/

    const label = document.createElement("div");
    label.classList.add("weight-label");
    label.innerText = weight;
    label.style.left = `${mpX + 13}px`;
    label.style.top = `${mpY - 17}px`;
    ring.appendChild(label);

    const curId = `r${ringNum-1}n${i}`;
    const nextId = `r${ringNum-1}n${(i + 1) % nodes.length}`;
    const key = [curId, nextId].sort().join("-");

    edgeMap[key] = {
      weight: weight,
      ring: ringNum-1,
      nodes: [curId, nextId]
    };
  }

  board.appendChild(ring);
  allRings.push(nodes);
}

for (let i = 0; i < RINGS - 1; i++) {
  const inner = allRings[i];
  const outer = allRings[i + 1];
  const innerRing = board.children[i+1];
  const weight = baseWeight - (i - 1) * increment;

  const svg = document.getElementById("edge-layer");

  const boardWidth = board.clientWidth;
  const boardHeight = board.clientHeight;

  for (let j = 0; j < NODES_PER_RING; j++) {
    if ((i % 2 === 0 && j % 2 === 0) || (i % 2 !== 0 && j % 2 !== 0)) {
      const cur = inner[j];
      const next = outer[j % outer.length];

      const mpX = (cur.x + next.x) / 2;
      const mpY = (cur.y + next.y) / 2;
      //if ( i== 1){console.log(mpX,mpY)};
      const x1 = ((cur.x - boardWidth / 2) / boardWidth) * 100 + 100;
      const y1 = ((cur.y - boardHeight / 2) / boardHeight) * 100 + 100;
      const x2 = ((next.x - boardWidth / 2) / boardWidth) * 100 +100;
      const y2 = ((next.y - boardHeight / 2) / boardHeight) * 100 + 100;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#00ffff"); 
    line.setAttribute("stroke-width", "1");
    line.setAttribute("filter", "drop-shadow(0 0 3px #00ffff)");
    line.setAttribute("class", "circuit-line");

    svg.appendChild(line);

      const label = document.createElement("div");
      label.classList.add("weight-label");
      label.innerText = weight;
      label.style.position = "absolute";
      /*const boardRect = board.getBoundingClientRect();
      label.style.left = `${boardRect.left + mpX + 15}px`;
      label.style.top = `${boardRect.top + mpY - 15}px`; */     

      label.style.left = `${mpX}px`;
      label.style.top = `${mpY}px`;
      innerRing.appendChild(label);

      const nodeId1 = `r${i+1}n${j}`;
      const nodeId2 = `r${i}n${j}`;
      const key = [nodeId1, nodeId2].sort().join("-");
    
      edgeMap[key] = {
        weight: weight,
        ring: [i+1,i],
        nodes: [nodeId2, nodeId1]
      };
    }
  }
}

async function replayMoves(moveStack, index = 0) {
  if (index >= moveStack.length) {
    document.getElementById("watchReplayBtn").disabled = false; 
    return;
  }

  const [actionType, fromNodeId, toNodeId, player, score] = moveStack[index];
  currentPlayer = player;
  const fromNode = document.querySelector(`[data-node-id="${fromNodeId}"]`);
  const toNode = document.querySelector(`[data-node-id="${toNodeId}"]`);     

  if (actionType === 0) {
    const img = document.createElement("img");
    img.src = currentPlayer === "red" ? `./images/redTitan.png` : `./images/blueTitan.png`; 
    img.classList.add("titan-image");
    toNode.appendChild(img);
    toNode.classList.add("occupied", currentPlayer);
    nodeMap[toNodeId].occupiedBy = currentPlayer;
  }

  if (actionType === 1) {
    const img = fromNode.querySelector("img");
    const clone = img.cloneNode(true);
    const startRect = fromNode.getBoundingClientRect();
    const endRect = toNode.getBoundingClientRect();

    img.style.visibility = "hidden";
    document.body.appendChild(clone);

    Object.assign(clone.style, {
      position: "absolute",
      top: `${startRect.top + window.scrollY}px`,
      left: `${startRect.left + window.scrollX}px`,
      width: `${img.width}px`,
      height: `${img.height}px`,
      pointerEvents: "none",
      transition: "top 1s ease-in-out, left 1s ease-in-out",
      zIndex: 1000
    });

    requestAnimationFrame(() => {
      clone.style.top = `${endRect.top + window.scrollY}px`;
      clone.style.left = `${endRect.left + window.scrollX}px`;
    });

    await new Promise((resolve) => {
      clone.addEventListener("transitionend", () => {
        clone.remove();
        img.style.visibility = "visible";
        fromNode.innerHTML = "";
        fromNode.classList.remove("occupied", currentPlayer);
        nodeMap[fromNodeId].occupiedBy = null;

        toNode.appendChild(img);
        toNode.classList.add("occupied", currentPlayer);
        nodeMap[toNodeId].occupiedBy = currentPlayer;
        resolve();
      });
    });
  }

  if (actionType === 2) {
    const node = document.querySelector(`[data-node-id="${fromNodeId}"]`);
    node.innerHTML = "";
    node.classList.remove("occupied", "red", "blue");
    nodeMap[fromNodeId].occupiedBy = null;
  }

  playerScores[player] += score;

  updateScoreDisplay();

  setTimeout(() => {
    replayMoves(moveStack, index + 1);
  }, 500);
}

window.addEventListener("DOMContentLoaded", () => {
  startTimers();
});

//console.log(moveHistory);
//console.log(edgeMap);
//console.log(nodeMap);


