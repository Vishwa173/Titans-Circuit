const clickSound = new Audio("../audio/click-audio.wav");

document.getElementById("multiplayerBtn").addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
    const circuits = document.getElementById("circuits").value;
    const nodes = document.getElementById("nodes").value;
    if (!circuits || !nodes) {
      alert("Please enter both values!");
      return;
    }

    window.location.href = `../index1.html?circuits=${encodeURIComponent(circuits)}&nodes=${encodeURIComponent(nodes)}`;
});

document.getElementById("singlePlayerBtn").addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
  const circuits = document.getElementById("circuits").value;
  const nodes = document.getElementById("nodes").value;
  if (!circuits || !nodes) {
    alert("Please enter both values!");
    return;
  }

  window.location.href = `../singleplayer/index3.html?circuits=${circuits}&nodes=${nodes}`;
});
let mouseMoved = false;
let bgmStarted = false;

window.addEventListener("load", () => {
  let lastX = null, lastY = null;

  document.addEventListener("mousemove", (e) => {
    if (bgmStarted) return;

    if (lastX === null || lastY === null) {
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    const dx = Math.abs(e.clientX - lastX);
    const dy = Math.abs(e.clientY - lastY);

    if (dx > 10 || dy > 10) {
      const bgm = document.getElementById("bgm");
      bgm.play().then(() => {
        bgmStarted = true;
        console.log("BGM started via mousemove");
      }).catch(err => {
        console.log("Failed to play:", err);
      });
    }
  });
});

  
document.getElementById("leaderboardBtn").addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
  const leaderboardPopup = document.getElementById("leaderboardPopup");
  const leaderboardList = document.getElementById("leaderboardList");

  leaderboardList.innerHTML = "";

  let leaderboard = JSON.parse(localStorage.getItem("titanLeaderboard"));

  if (
    !leaderboard ||
    typeof leaderboard.red !== "number" ||
    typeof leaderboard.blue !== "number"
  ) {
    leaderboard = { red: 0, blue: 0 };
    localStorage.setItem("titanLeaderboard", JSON.stringify(leaderboard));
  }

  const sorted = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
  const [first, second] = sorted;

  if (first) {
    const firstPlace = document.createElement("li");
    firstPlace.textContent = `1st Place: Player ${first[0].toUpperCase()} - ${first[1]} wins`;
    leaderboardList.appendChild(firstPlace);
  }

  if (second) {
    const secondPlace = document.createElement("li");
    secondPlace.textContent = `2nd Place: Player ${second[0].toUpperCase()} - ${second[1]} wins`;
    leaderboardList.appendChild(secondPlace);
  } else {
    const secondPlace = document.createElement("li");
    secondPlace.textContent = `2nd Place: N/A`;
    leaderboardList.appendChild(secondPlace);
  }

  leaderboardPopup.style.display = "flex";
});
  
document.getElementById("closeLeaderboardBtn").addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
  document.getElementById("leaderboardPopup").style.display = "none";
});

const instructionsBtn = document.getElementById("instructions-btn");
const instructionsPopup = document.getElementById("instructionsPopup");
const closeInstructions = document.getElementById("closeInstructions");

instructionsBtn.addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
  instructionsPopup.style.display = "flex";
});

closeInstructions.addEventListener("click", () => {
  clickSound.currentTime = 0;
  clickSound.play();
  instructionsPopup.style.display = "none";
});

