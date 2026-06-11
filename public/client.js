const socket = io();

// Audio element
let audio = new Audio();
let roomId = null;
let isHost = false;

// Get room from URL query
const urlParams = new URLSearchParams(window.location.search);
roomId = urlParams.get("room");
const role = urlParams.get("role"); // 'host' or 'guest'

// Manual offset (ms)
let manualOffset = 0;
let lastSyncTime = 0;

function applySync(state) {
  if (state.audioUrl && audio.src !== state.audioUrl) {
    audio.src = state.audioUrl;
    audio.load();
  }
  if (state.isPlaying !== audio.paused) {
    if (state.isPlaying) {
      // Seek to the correct position with offset
      let targetTime = state.currentTime + (Date.now() - lastSyncTime) / 1000;
      targetTime += manualOffset / 1000;
      if (Math.abs(audio.currentTime - targetTime) > 0.5) {
        audio.currentTime = targetTime;
      }
      audio.play().catch((e) => console.log("Play failed:", e));
    } else {
      audio.pause();
    }
  } else if (state.isPlaying) {
    // Already playing, correct drift
    let targetTime =
      state.currentTime +
      (Date.now() - lastSyncTime) / 1000 +
      manualOffset / 1000;
    if (Math.abs(audio.currentTime - targetTime) > 0.2) {
      audio.currentTime = targetTime;
    }
  }
  lastSyncTime = Date.now();
}

// Host: send updates every 100ms while playing
if (role === "host") {
  const audioUrl = prompt(
    "Enter audio file URL (MP3) or leave blank for demo:",
  );
  socket.emit(
    "create-room",
    roomId,
    audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    (resp) => {
      if (!resp.success) alert("Failed to create room");
    },
  );
  isHost = true;

  let interval = null;
  audio.addEventListener("play", () => {
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      socket.emit("playback-update", roomId, {
        isPlaying: !audio.paused,
        currentTime: audio.currentTime,
      });
    }, 100);
  });
  audio.addEventListener("pause", () => {
    if (interval) clearInterval(interval);
    socket.emit("playback-update", roomId, {
      isPlaying: false,
      currentTime: audio.currentTime,
    });
  });
  audio.addEventListener("seeked", () => {
    socket.emit("playback-update", roomId, {
      isPlaying: !audio.paused,
      currentTime: audio.currentTime,
    });
  });
} else if (role === "guest") {
  socket.emit("join-room", roomId, (resp) => {
    if (!resp.success) alert("Room not found. Redirecting...");
  });
  socket.on("sync-state", (state) => {
    applySync(state);
  });
  socket.on("host-disconnected", () => {
    alert("Host left the party");
    audio.pause();
  });
}

// Manual offset UI (for guests)
if (role === "guest") {
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = -500;
  slider.max = 500;
  slider.value = 0;
  slider.step = 10;
  slider.style.position = "fixed";
  slider.style.bottom = "20px";
  slider.style.right = "20px";
  slider.style.zIndex = 9999;
  slider.addEventListener("input", (e) => {
    manualOffset = parseInt(e.target.value);
    document.getElementById("offsetValue").innerText = manualOffset + "ms";
  });
  const label = document.createElement("div");
  label.id = "offsetValue";
  label.innerText = "0ms";
  label.style.position = "fixed";
  label.style.bottom = "60px";
  label.style.right = "20px";
  label.style.background = "white";
  label.style.padding = "4px 8px";
  label.style.borderRadius = "4px";
  document.body.appendChild(slider);
  document.body.appendChild(label);
}
