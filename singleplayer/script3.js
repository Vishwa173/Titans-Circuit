const board = document.getElementById("board");

const RING_SPACING = 100;

window.addEventListener('resize', () => {
  location.reload();
});

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
let gameEnded = false;
let lastBotMove = null;
let lastBotPieceId = null; 
let swapModeActive = false;
let firstSwapNode = null;
let secondSwapNode = null;
let redSwapUsed = false;
let blueSwapUsed = false;

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

let selectedTitan = null;

const placementSound = new Audio("../audio/placement-audio.wav");
const movementSound = new Audio("../audio/movement-audio.wav");
const surroundSound = new Audio("../audio/surround-audio.wav");
const clickSound = new Audio("../audio/click-audio.wav");

window.addEventListener("DOMContentLoaded", () => {
  const bgm = document.getElementById("bgm");
  bgm.volume = 0.4;
  bgm.play().catch(err => {
    console.warn("BGM autoplay failed:", err);
  });
});

document.getElementById("watchReplayBtn").addEventListener("click", async () => {
  clickSound.currentTime = 0;
  clickSound.play();
  document.getElementById("watchReplayBtn").disabled = true; 
  document.getElementById("gameEndPopup").style.display = "none";

  clearBoard();

  await new Promise(resolve => setTimeout(resolve, 200));

  await replayMoves(moveStack); 
});

document.getElementById("pauseToggleBtn").addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
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
  clickSound.currentTime = 0;
  clickSound.play();
  location.reload(); 
});

document.querySelector('#historyBtn').addEventListener('click', () => {
  clickSound.currentTime = 0;
  clickSound.play();
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
  clickSound.currentTime = 0;
  clickSound.play();
  document.getElementById('history-popup').classList.add('hidden');
});

document.getElementById("swapPowerupRedBtn").addEventListener("click", () => {
  if (currentPlayer !== "red" || redSwapUsed) return;

  swapModeActive = !swapModeActive;

  if (swapModeActive) {
    firstSwapNode = null;
    secondSwapNode = null;
    alert("Red swap mode activated! Click your titan, then opponent's.");
  } else {
    alert("Red swap mode cancelled.");
  }
});

document.getElementById("undoBtn").addEventListener("click", undoMove);
document.getElementById("redoBtn").addEventListener("click", redoMove);

function getOpponent(player) {
  return player === "red" ? "blue" : "red";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

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

function recalculateScores() {
  playerScores.red = 0;
  playerScores.blue = 0;

  for (const key in edgeMap) {
    const edge = edgeMap[key];
    const [n1, n2] = edge.nodes;
    const p1 = nodeMap[n1].occupiedBy;
    const p2 = nodeMap[n2].occupiedBy;

    if (p1 && p1 === p2) {
      playerScores[p1] += edge.weight;
    }
  }

  updateScoreDisplay();
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

function botTurn() {
    const botTitanCount = playerPieces["blue"].length;

    if (botTitanCount < maxTitans) {
        performBotPlacement();
    } else {
        performBotMove();
    }
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
  if (gameEnded) return;

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

function evaluatePlacementScore(node, player) {
  const neighbors = getAdjacentNodes(node);
  let score = 0;

  neighbors.forEach(adj => {
    const nodeId = node.dataset.nodeId;
    const adjId = adj.dataset.nodeId;
    const key = [nodeId, adjId].sort().join("-");

    if (adj.classList.contains("occupied") && adj.classList.contains(player)) {
      const edge = edgeMap[key];
      if (edge) score += edge.weight;
    }
  });

  return score;
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

  neighbors.forEach(neighbor => {
    if (neighbor.classList.contains("occupied") && neighbor.classList.contains(opponent)) {
      const surrounding = getAdjacentNodes(neighbor);
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

            selectedTitan = null;
            nodeMap[neighbor.dataset.nodeId].occupiedBy = null;

            moveText = `${opponent} was eliminated from ${neighbor.dataset.nodeId}`;
            moveHistory.push(moveText);
            moveStack.push([2, neighbor.dataset.nodeId, 0, opponent,0]); 
            undoStack.length = 0;

            surroundSound.currentTime = 0;
            surroundSound.play();

            playerPieces[opponent].pop();
            selectedTitan = null;
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
        node.classList.remove("occupied", playerToPop);
        node.innerHTML = "";
        node.classList.remove("red", "blue"); 
        
        nodeMap[node.dataset.nodeId].occupiedBy = null;
 
        moveText = `${playerToPop} was eliminated from ${node.dataset.nodeId}`;
        moveHistory.push(moveText);
        moveStack.push([2, node.dataset.nodeId, 0, playerToPop,0]);
        undoStack.length = 0;

        surroundSound.currentTime = 0;
        surroundSound.play();

        playerPieces[playerToPop].pop();
        selectedTitan = null;
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

function performBotPlacement(botPlayer) {
  if (gameEnded) return;

  if (playerPieces[currentPlayer].length >= maxTitans) performBotMove();
  const availableNodes = Array.from(document.querySelectorAll(`.node[data-ring="${unlockedRingIndex}"]:not(.occupied)`));
  let bestNode = null;
  let bestScore = -Infinity;

  availableNodes.forEach(node => {
    const tempScore = evaluatePlacementScore(node, botPlayer);
    if (tempScore > bestScore) {
      bestScore = tempScore;
      bestNode = node;
    }
  });

  if (bestNode) {
    handlePlacement(bestNode);
  }
}

function handlePlacement(node) {
  const ring = parseInt(node.dataset.ring);
  if (ring < unlockedRingIndex) return;
  if (node.classList.contains("occupied")) return;
  if (playerPieces[currentPlayer].length >= maxTitans) return;
  if (isPaused) return;

  node.classList.add("occupied", currentPlayer);
  playerPieces[currentPlayer].push(node);

  const titanImg = document.createElement("img");
  titanImg.src = `../images2/${currentPlayer}Titan.png`;
  titanImg.classList.add("titan-image");
  node.appendChild(titanImg);

  const nodeId = node.dataset.nodeId;
  const neighbors = getAdjacentNodes(node);

  let dScore = 0;

  neighbors.forEach(adj => {
    const adjId = adj.dataset.nodeId;

      if (adj.classList.contains("occupied") && adj.classList.contains(currentPlayer)) {
      const key = [nodeId, adjId].sort().join("-");
      const edge = edgeMap[key];
      dScore = edge.weight;

      if (edge) {
          playerScores[currentPlayer] += edge.weight;
          updateScoreDisplay();
      }
    }
  });

  const index = node.dataset.nodeId;
  nodeMap[index].occupiedBy = currentPlayer;

  moveText = `${currentPlayer} was placed on ${node.dataset.nodeId}`;
  moveHistory.push(moveText);
  if (dScore){
    moveStack.push([0, 0, node.dataset.nodeId, currentPlayer,dScore, playerScores[currentPlayer]]);
  }else {
    moveStack.push([0, 0, node.dataset.nodeId, currentPlayer,0, playerScores[currentPlayer]]);
  }
  //console.log(moveStack);
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

  if (currentPlayer === "blue") {
  setTimeout(botTurn, 300);
}
  
  updateCurrentTurnDisplay();
  updateCurrentTurnDisplay();
  moveTimer = moveTime;     
  startTimers();   
}

function performBotMove() {
  if (gameEnded) return;

  const botColor = "blue";
  let bestMove = null;
  let maxScoreGain = -Infinity;
  const fallbackMoves = [];

  const botNodes = Array.from(document.querySelectorAll(".node.occupied.blue"));

  botNodes.forEach(fromNode => {
    const fromId = fromNode.dataset.nodeId;

    const validMoves = getAdjacentNodes(fromNode).filter(n =>
      !n.classList.contains("occupied") &&
      parseInt(n.dataset.ring) >= unlockedRingIndex
    );

    validMoves.forEach(toNode => {
      const toId = toNode.dataset.nodeId;

      if (
        lastBotMove &&
        lastBotMove.from === fromId &&
        lastBotMove.to === toId
      ) return;

      let gain = 0;
      const adj = getAdjacentNodes(toNode);
      adj.forEach(adjNode => {
        const adjId = adjNode.dataset.nodeId;
        const key = [toId, adjId].sort().join("-");
        const edge = edgeMap[key];
        if (
          edge &&
          adjNode.classList.contains("occupied") &&
          adjNode.classList.contains(botColor)
        ) {
          gain += edge.weight;
        }
      });

      const ringBonus = (RINGS - parseInt(toNode.dataset.ring)) * 0.1;
      gain += ringBonus;

      const isSamePiece = (fromId === lastBotPieceId);

      if (
        gain > maxScoreGain ||
        (gain === maxScoreGain && !isSamePiece)
      ) {
        maxScoreGain = gain;
        bestMove = { fromNode, toNode };
      }

      fallbackMoves.push({ fromNode, toNode });
    });
  });

  let chosenMove = null;

  if (bestMove && maxScoreGain > 0) {
    chosenMove = bestMove;
  } else if (fallbackMoves.length > 0) {
    const filtered = fallbackMoves.filter(m =>
      (!lastBotMove ||
        m.fromNode.dataset.nodeId !== lastBotMove.from ||
        m.toNode.dataset.nodeId !== lastBotMove.to) &&
      m.fromNode.dataset.nodeId !== lastBotPieceId
    );

    chosenMove = filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)];
  }

  if (chosenMove) {
    selectedTitan = chosenMove.fromNode;
    lastBotMove = {
      from: chosenMove.fromNode.dataset.nodeId,
      to: chosenMove.toNode.dataset.nodeId
    };
    lastBotPieceId = chosenMove.fromNode.dataset.nodeId;

    const fromNodeId = selectedTitan.dataset.nodeId;
    const adjNodes = getAdjacentNodes(selectedTitan);
    adjNodes.forEach(adj => {
      const adjId = adj.dataset.nodeId;
      const key = [fromNodeId, adjId].sort().join("-");
      const edge = edgeMap[key];
      if (
        edge &&
        adj.classList.contains("occupied") &&
        adj.classList.contains(botColor)
      ) {
        playerScores[botColor] -= edge.weight;
      }
    });
    updateScoreDisplay();

    handleMoveEnd(chosenMove.toNode);
  }
}

function handleMoveStart(node) {
  if (isPaused) return;

  if (swapModeActive) {
    if (!firstSwapNode) {
      if (node.classList.contains("occupied") && node.classList.contains(currentPlayer)) {
        firstSwapNode = node;
        node.classList.add("selected");
      } else {
        alert("Select your own titan first.");
      }
    } else if (!secondSwapNode) {
      if (node.classList.contains("occupied") && !node.classList.contains(currentPlayer)) {
        secondSwapNode = node;
  
        const firstId = firstSwapNode.dataset.nodeId;
        const secondId = secondSwapNode.dataset.nodeId;
  
        const firstImg = firstSwapNode.querySelector("img");
        const secondImg = secondSwapNode.querySelector("img");
  
        if (!firstImg || !secondImg) {
          alert("Swap failed: one of the titans is missing.");
          return;
        }
  
        const opponent = currentPlayer === "red" ? "blue" : "red";
  
        const firstClone = firstImg.cloneNode(true);
        const secondClone = secondImg.cloneNode(true);
  
        const fromRect = firstSwapNode.getBoundingClientRect();
        const toRect = secondSwapNode.getBoundingClientRect();
  
        firstImg.style.visibility = "hidden";
        secondImg.style.visibility = "hidden";
  
        document.body.appendChild(firstClone);
        document.body.appendChild(secondClone);
  
        Object.assign(firstClone.style, {
          position: "absolute",
          top: `${fromRect.top + window.scrollY}px`,
          left: `${fromRect.left + window.scrollX}px`,
          width: `${firstImg.width}px`,
          height: `${firstImg.height}px`,
          pointerEvents: "none",
          transition: "top 1s ease-in-out, left 1s ease-in-out",
          zIndex: 1000
        });
  
        Object.assign(secondClone.style, {
          position: "absolute",
          top: `${toRect.top + window.scrollY}px`,
          left: `${toRect.left + window.scrollX}px`,
          width: `${secondImg.width}px`,
          height: `${secondImg.height}px`,
          pointerEvents: "none",
          transition: "top 1s ease-in-out, left 1s ease-in-out",
          zIndex: 1000
        });
  
        requestAnimationFrame(() => {
          firstClone.style.top = `${toRect.top + window.scrollY}px`;
          firstClone.style.left = `${toRect.left + window.scrollX}px`;
  
          secondClone.style.top = `${fromRect.top + window.scrollY}px`;
          secondClone.style.left = `${fromRect.left + window.scrollX}px`;
        });
  
        firstClone.addEventListener("transitionend", () => {
          firstClone.remove();
          secondClone.remove();
  
          firstImg.style.visibility = "visible";
          secondImg.style.visibility = "visible";
  
          firstSwapNode.innerHTML = "";
          secondSwapNode.innerHTML = "";
          firstSwapNode.appendChild(secondImg);
          secondSwapNode.appendChild(firstImg);
  
          firstSwapNode.classList.remove(currentPlayer);
          firstSwapNode.classList.add(opponent);
  
          secondSwapNode.classList.remove(opponent);
          secondSwapNode.classList.add(currentPlayer);
  
          nodeMap[firstId].occupiedBy = opponent;
          nodeMap[secondId].occupiedBy = currentPlayer;
  
          const oldScore = playerScores[currentPlayer];
          recalculateScores();
          const newScore = playerScores[currentPlayer];
          const dscore = newScore - oldScore;
  
          moveHistory.push(`${currentPlayer} used swap powerup on ${firstId} and ${secondId}`);
          moveStack.push([3, firstId, secondId, currentPlayer, dscore, newScore]);
          undoStack.length = 0;
  
          const originalPlayer = currentPlayer;
          const opponents = currentPlayer === "red" ? "blue" : "red";
  
          currentPlayer = opponents;
          checkForSurroundedOpponents(firstSwapNode);
  
          currentPlayer = originalPlayer;
          checkForSurroundedOpponents(secondSwapNode);
  
          currentPlayer = originalPlayer;
  
          firstSwapNode.classList.remove("selected");
          firstSwapNode = null;
          secondSwapNode = null;
          swapModeActive = false;
  
          if (currentPlayer === "red") {
            redSwapUsed = true;
            const redBtn = document.getElementById("swapPowerupRedBtn");
            redBtn.disabled = true;
            redBtn.classList.add("disabled-btn");
          } else {
            blueSwapUsed = true;
            const blueBtn = document.getElementById("swapPowerupBlueBtn");
            blueBtn.disabled = true;
            blueBtn.classList.add("disabled-btn");
          }          
  
          updateScoreDisplay();
          switchCurrentPlayer();
          updateCurrentTurnDisplay();

          if (currentPlayer === "blue") {
            setTimeout(botTurn, 300);
          }

        });
      } else {
        alert("Now select opponent's titan to swap.");
      }
    }
  
    return;
  }  

  if (node.classList.contains("occupied") && node.classList.contains(currentPlayer) && !selectedTitan) {
    selectedTitan = node;
    node.classList.add("selected");
    highlightValidMoves(node);

    const nodeId = node.dataset.nodeId;
    const neighbors = getAdjacentNodes(node);

    dScore = 0;

    subtractedEdges = [];
    neighbors.forEach(adj => {
    const adjId = adj.dataset.nodeId;

      if (adj.classList.contains("occupied") && adj.classList.contains(currentPlayer)) {
        const key = [nodeId, adjId].sort().join("-");
        const edge = edgeMap[key];

        if (edge) {
          playerScores[currentPlayer] -= edge.weight;
          subtractedEdges.push(edge);
          dScore -= edge.weight;
          updateScoreDisplay();
        }
     }
    });
  }else{
    subtractedEdges.forEach(edge => {
      playerScores[currentPlayer] += edge.weight;
    });
    subtractedEdges = [];
    dScore = 0;
  
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
    //console.log(selectedTitan);
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
          //dScore = edge.weight;

          if (edge) {
            dScore += edge.weight;
            playerScores[currentPlayer] += edge.weight;
            updateScoreDisplay();
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
      moveStack.push([1, selectedTitan.dataset.nodeId, node.dataset.nodeId, currentPlayer, dScore, playerScores[currentPlayer]]);
      }else {
        moveStack.push([1, selectedTitan.dataset.nodeId, node.dataset.nodeId, currentPlayer, 0, playerScores[currentPlayer]]);
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
      }

      selectedTitan = null;
      clearHighlights();
      currentPlayer = currentPlayer === "red" ? "blue" : "red";

      if (currentPlayer === "blue") {
        setTimeout(botTurn, 300);
      }
      
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

  
  if (winnerPlayer === "draw") {
    popupText.textContent = "The game ended in a draw!";
    popupImage.src = `../images/drawTitan.png`;
  } else {
    popupText.textContent = `Player ${winnerPlayer} WON THE GAME!`;
    popupImage.src = winnerPlayer === "red"
      ? `../images2/redTitan.png`
      : `../images2/blueTitan.png`;

    const leaderboard = JSON.parse(localStorage.getItem("titanLeaderboard")) || { red: 0, blue: 0 };
    leaderboard[winnerPlayer]++;
    localStorage.setItem("titanLeaderboard", JSON.stringify(leaderboard));
  }

  popup.style.display = "flex";

  const gameOverAudio = new Audio("../audio/gameover-audio.mp3");
  gameOverAudio.play();

  gameEnded = true;

  playerScores.red = 0;
  playerScores.blue = 0;

  updateScoreDisplay();

  clearInterval(totalInterval);
  clearInterval(moveInterval);

  //console.log(moveStack);
}

function undoMove() {
  clickSound.currentTime = 0;
  clickSound.play();
  if (moveStack.length === 0) return;

  const [action, from, to, player, dScore, score] = moveStack.pop();
  undoStack.push([action, from, to, player, dScore, score]);
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

    case 3: {
      const firstNode = document.querySelector(`[data-node-id="${from}"]`);
      const secondNode = document.querySelector(`[data-node-id="${to}"]`);

      const firstImg = firstNode.querySelector("img");
      const secondImg = secondNode.querySelector("img");

      const opponent = player === "red" ? "blue" : "red";

      firstNode.classList.remove(opponent);
      firstNode.classList.add(player);

      secondNode.classList.remove(player);
      secondNode.classList.add(opponent);

      const firstClone = firstImg.cloneNode(true);
      const secondClone = secondImg.cloneNode(true);

      firstNode.innerHTML = "";
      secondNode.innerHTML = "";

      firstNode.appendChild(secondClone);
      secondNode.appendChild(firstClone); 

      nodeMap[from].occupiedBy = player;
      nodeMap[to].occupiedBy = opponent;

      if (player === "red") redSwapUsed = false;
      else blueSwapUsed = false;

      break;
    }
  }

  //console.log(playerScores);
  updateScoreDisplay();
}

function redoMove() {
  clickSound.currentTime = 0;
  clickSound.play();
  if (undoStack.length === 0) return;

  const [action, from, to, player, dScore, score] = undoStack.pop();
  moveStack.push([action, from, to, player, dScore,score]);

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

    case 3: {
      const firstNode = document.querySelector(`[data-node-id="${from}"]`);
      const secondNode = document.querySelector(`[data-node-id="${to}"]`);
      const opponent = player === "red" ? "blue" : "red";

      const firstImg = firstNode.querySelector("img");
      const secondImg = secondNode.querySelector("img");

      firstNode.classList.remove(opponent);
      secondNode.classList.remove(player);
      firstNode.classList.add(player);
      secondNode.classList.add(opponent);

      const firstClone = firstImg.cloneNode(true);
      const secondClone = secondImg.cloneNode(true);
      firstNode.innerHTML = "";
      secondNode.innerHTML = "";
      firstNode.appendChild(secondClone);
      secondNode.appendChild(firstClone);

      nodeMap[from].occupiedBy = player;
      nodeMap[to].occupiedBy = opponent;

      break;
    }
  }

  playerScores[player] += dScore;

  currentPlayer = currentPlayer === "red" ? "blue" : "red";
  updateCurrentTurnDisplay();
  updateScoreDisplay();
}

for (let ringNum = 1; ringNum <= RINGS; ringNum++) {
  const ring = document.createElement("div");
  ring.classList.add("ring");

  const radius = (ringNum / RINGS) * radiusBase;
  const nodes = [];
  const weight = baseWeight - (ringNum - baseWeight) * increment;

  for (let i = 0; i < NODES_PER_RING; i++) {

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

    const nodeId = node.dataset.nodeId;

    nodeMap[nodeId] = {
      ring : ringNum - 1,
      index : i,
      occupiedBy : null
    };

    node.addEventListener("click", () => {
      if (swapModeActive) {
        handleMoveStart(node); 
        return;
      }

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

    const mpX = ((cur.x + next.x)) / 2;
    const mpY = ((cur.y + next.y)) / 2; 

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

  const [actionType, fromNodeId, toNodeId, player,dScore, score] = moveStack[index];
  currentPlayer = player;
  const fromNode = document.querySelector(`[data-node-id="${fromNodeId}"]`);
  const toNode = document.querySelector(`[data-node-id="${toNodeId}"]`);     

  if (actionType === 0) {
    const img = document.createElement("img");
    img.src = currentPlayer === "red" ? `../images2/redTitan.png` : `../images2/blueTitan.png`; 
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

  if (actionType === 3) {
    const firstImg = fromNode.querySelector("img");
    const secondImg = toNode.querySelector("img");

    const firstClone = firstImg.cloneNode(true);
    const secondClone = secondImg.cloneNode(true);

    const fromRect = fromNode.getBoundingClientRect();
    const toRect = toNode.getBoundingClientRect();

    firstImg.style.visibility = "hidden";
    secondImg.style.visibility = "hidden";

    document.body.appendChild(firstClone);
    document.body.appendChild(secondClone);

    Object.assign(firstClone.style, {
      position: "absolute",
      top: `${fromRect.top + window.scrollY}px`,
      left: `${fromRect.left + window.scrollX}px`,
      width: `${firstImg.width}px`,
      height: `${firstImg.height}px`,
      pointerEvents: "none",
      transition: "top 1s ease-in-out, left 1s ease-in-out",
      zIndex: 1000
    });

    Object.assign(secondClone.style, {
      position: "absolute",
      top: `${toRect.top + window.scrollY}px`,
      left: `${toRect.left + window.scrollX}px`,
      width: `${secondImg.width}px`,
      height: `${secondImg.height}px`,
      pointerEvents: "none",
      transition: "top 1s ease-in-out, left 1s ease-in-out",
      zIndex: 1000
    });

    requestAnimationFrame(() => {
      firstClone.style.top = `${toRect.top + window.scrollY}px`;
      firstClone.style.left = `${toRect.left + window.scrollX}px`;

      secondClone.style.top = `${fromRect.top + window.scrollY}px`;
      secondClone.style.left = `${fromRect.left + window.scrollX}px`;
    });

    await new Promise((resolve) => {
      firstClone.addEventListener("transitionend", () => {
        firstClone.remove();
        secondClone.remove();

        fromNode.innerHTML = "";
        toNode.innerHTML = "";

        fromNode.appendChild(secondImg);
        toNode.appendChild(firstImg);

        firstImg.style.visibility = "visible";
        secondImg.style.visibility = "visible";

        const firstPlayer = nodeMap[fromNodeId].occupiedBy;
        const secondPlayer = nodeMap[toNodeId].occupiedBy;

        fromNode.classList.remove(firstPlayer, secondPlayer);
        toNode.classList.remove(firstPlayer, secondPlayer);

        fromNode.classList.add(secondPlayer);
        toNode.classList.add(firstPlayer);

        nodeMap[fromNodeId].occupiedBy = secondPlayer;
        nodeMap[toNodeId].occupiedBy = firstPlayer;

        resolve();
      });
    });
  }

  playerScores[player] = score;

  updateScoreDisplay();

  setTimeout(() => {
    replayMoves(moveStack, index + 1);
  }, 500);
}

window.addEventListener("DOMContentLoaded", () => {
  startTimers();
});