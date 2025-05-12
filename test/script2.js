const board = document.getElementById("board");
const RINGS = 3;
const NODES_PER_RING = 6;
const RING_SPACING = 100;

const boardWidth = board.clientWidth;
const boardHeight = board.clientHeight;
const radiusBase = Math.min(boardWidth, boardHeight) / 2.5;

const baseWeight = RINGS;
const increment = 2;

let allRings = [];


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

    }
  }
}