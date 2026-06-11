// const express = require("express");
// const http = require("http");
// const socketIo = require("socket.io");
// const path = require("path");

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server);

// app.use(express.static("public"));

// // Store active sessions
// const sessions = new Map(); // roomId -> { hostId, currentTime, isPlaying, audioUrl }

// io.on("connection", (socket) => {
//   console.log("New client:", socket.id);

//   // Host creates a room
//   socket.on("create-room", (roomId, audioUrl, callback) => {
//     socket.join(roomId);
//     sessions.set(roomId, {
//       hostId: socket.id,
//       currentTime: 0,
//       isPlaying: false,
//       audioUrl: audioUrl,
//     });
//     callback({ success: true });
//   });

//   // Guest joins a room
//   socket.on("join-room", (roomId, callback) => {
//     const session = sessions.get(roomId);
//     if (!session) {
//       callback({ success: false, error: "Room not found" });
//       return;
//     }
//     socket.join(roomId);
//     // Send current state to the new guest
//     socket.emit("sync-state", {
//       isPlaying: session.isPlaying,
//       currentTime: session.currentTime,
//       audioUrl: session.audioUrl,
//     });
//     callback({ success: true });
//   });

//   // Host sends playback updates
//   socket.on("playback-update", (roomId, data) => {
//     const session = sessions.get(roomId);
//     if (session && session.hostId === socket.id) {
//       session.isPlaying = data.isPlaying;
//       session.currentTime = data.currentTime;
//       // Broadcast to all guests in the room
//       socket.to(roomId).emit("sync-state", {
//         isPlaying: data.isPlaying,
//         currentTime: data.currentTime,
//         audioUrl: session.audioUrl,
//       });
//     }
//   });

//   // Guest requests a seek (optional)
//   socket.on("request-seek", (roomId, time) => {
//     const session = sessions.get(roomId);
//     if (session && session.hostId !== socket.id) {
//       // You could allow guests to suggest, but for MVP only host controls
//       socket.emit("sync-state", { ...session, currentTime: time });
//     }
//   });

//   socket.on("disconnect", () => {
//     // If host disconnects, clean up room
//     for (let [roomId, session] of sessions.entries()) {
//       if (session.hostId === socket.id) {
//         io.to(roomId).emit("host-disconnected");
//         sessions.delete(roomId);
//         break;
//       }
//     }
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () =>
//   console.log(`Server running on http://localhost:${PORT}`),
// );

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

// roomId -> { hostId, currentTime, isPlaying, audioUrl, lastUpdatedAt }
const sessions = new Map();

// Generate a secure random room ID server-side (fix: no guessable IDs)
app.get("/create-room-id", (req, res) => {
  res.json({ roomId: crypto.randomBytes(6).toString("hex") });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create-room", (roomId, audioUrl, callback) => {
    if (sessions.has(roomId)) {
      return callback({ success: false, error: "Room already exists" });
    }
    socket.join(roomId);
    sessions.set(roomId, {
      hostId: socket.id,
      currentTime: 0,
      isPlaying: false,
      audioUrl: audioUrl,
      lastUpdatedAt: Date.now(),
    });
    callback({ success: true, roomId });
  });

  socket.on("join-room", (roomId, callback) => {
    const session = sessions.get(roomId);
    if (!session) return callback({ success: false, error: "Room not found" });

    socket.join(roomId);

    // FIX #2: Send serverTimestamp so guest can compute latency compensation
    const serverNow = Date.now();
    const elapsed = session.isPlaying
      ? (serverNow - session.lastUpdatedAt) / 1000
      : 0;

    socket.emit("sync-state", {
      isPlaying: session.isPlaying,
      currentTime: session.currentTime + elapsed, // fast-forward by time elapsed since last update
      audioUrl: session.audioUrl,
      serverTimestamp: serverNow,
    });

    callback({ success: true });
  });

  // FIX #4: Host sends playback-update; server stamps time so late-joining guests get correct position
  socket.on("playback-update", (roomId, data) => {
    const session = sessions.get(roomId);
    if (!session || session.hostId !== socket.id) return; // FIX #3: strict host-only guard

    const serverNow = Date.now();
    session.isPlaying = data.isPlaying;
    session.currentTime = data.currentTime;
    session.lastUpdatedAt = serverNow;

    // Broadcast with server timestamp — guests use this to correct for their own RTT
    socket.to(roomId).emit("sync-state", {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      audioUrl: session.audioUrl,
      serverTimestamp: serverNow,
    });
  });

  // FIX #5: request-seek removed (was broken dead code). Guests can't control host.

  socket.on("disconnect", () => {
    for (let [roomId, session] of sessions.entries()) {
      if (session.hostId === socket.id) {
        io.to(roomId).emit("host-disconnected");
        sessions.delete(roomId);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
