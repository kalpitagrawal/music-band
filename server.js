const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

// roomId -> { hostId, currentTime, isPlaying, audioUrl, lastUpdatedAt, users: Set, chat: [], createdAt }
const sessions = new Map();

const ROOM_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Generate a secure random room ID server-side
app.get("/create-room-id", (req, res) => {
  res.json({ roomId: crypto.randomBytes(6).toString("hex") });
});

// Clean up expired rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, session] of sessions.entries()) {
    if (now - session.lastUpdatedAt > ROOM_EXPIRY_MS) {
      io.to(roomId).emit("room-expired");
      sessions.delete(roomId);
      console.log(`Room ${roomId} expired after inactivity.`);
    }
  }
}, 5 * 60 * 1000);

function broadcastUserCount(roomId) {
  const session = sessions.get(roomId);
  if (session) {
    io.to(roomId).emit("user-count", session.users.size);
  }
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create-room", (roomId, audioUrl, callback) => {
    if (typeof callback !== "function") return;
    if (sessions.has(roomId)) {
      return callback({ success: false, error: "Room already exists" });
    }
    socket.join(roomId);
    const users = new Set();
    users.add(socket.id);
    sessions.set(roomId, {
      hostId: socket.id,
      currentTime: 0,
      isPlaying: false,
      audioUrl: audioUrl,
      lastUpdatedAt: Date.now(),
      users: users,
      chat: [],
      createdAt: Date.now(),
    });
    callback({ success: true, roomId });
    broadcastUserCount(roomId);
  });

  socket.on("join-room", (roomId, callback) => {
    if (typeof callback !== "function") return;
    const session = sessions.get(roomId);
    if (!session) return callback({ success: false, error: "Room not found" });

    socket.join(roomId);
    session.users.add(socket.id);

    const serverNow = Date.now();
    const elapsed = session.isPlaying
      ? (serverNow - session.lastUpdatedAt) / 1000
      : 0;

    socket.emit("sync-state", {
      isPlaying: session.isPlaying,
      currentTime: session.currentTime + elapsed,
      audioUrl: session.audioUrl,
      serverTimestamp: serverNow,
    });

    // Send recent chat history (last 50 messages)
    socket.emit("chat-history", session.chat.slice(-50));

    callback({ success: true });
    broadcastUserCount(roomId);
  });

  // Host sends playback update
  socket.on("playback-update", (roomId, data) => {
    const session = sessions.get(roomId);
    if (!session || session.hostId !== socket.id) return;

    const serverNow = Date.now();
    session.isPlaying = data.isPlaying;
    session.currentTime = data.currentTime;
    session.lastUpdatedAt = serverNow;

    socket.to(roomId).emit("sync-state", {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      audioUrl: session.audioUrl,
      serverTimestamp: serverNow,
    });
  });

  // Chat messages
  socket.on("chat-message", (roomId, message) => {
    const session = sessions.get(roomId);
    if (!session || !session.users.has(socket.id)) return;

    const isHost = session.hostId === socket.id;
    const chatMsg = {
      id: crypto.randomBytes(4).toString("hex"),
      sender: socket.id.slice(0, 6),
      isHost: isHost,
      text: message.slice(0, 500), // limit message length
      timestamp: Date.now(),
    };

    session.chat.push(chatMsg);
    // Keep only last 100 messages
    if (session.chat.length > 100) {
      session.chat = session.chat.slice(-100);
    }

    io.to(roomId).emit("chat-message", chatMsg);
    session.lastUpdatedAt = Date.now();
  });

  socket.on("disconnect", () => {
    for (const [roomId, session] of sessions.entries()) {
      if (session.hostId === socket.id) {
        io.to(roomId).emit("host-disconnected");
        sessions.delete(roomId);
        console.log(`Host left, room ${roomId} destroyed.`);
        break;
      }
      if (session.users.has(socket.id)) {
        session.users.delete(socket.id);
        broadcastUserCount(roomId);
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
