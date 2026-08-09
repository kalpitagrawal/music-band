# 🎧 MusicBand

> Listen to music in perfect sync with friends — real-time, zero-latency collaborative listening.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎵 **Sync Playback** | Host controls playback — all guests hear the same audio at the same time |
| 💬 **Real-Time Chat** | Chat with everyone in the room while listening |
| 🎨 **Waveform Visualizer** | Live frequency visualizer powered by Web Audio API |
| 📋 **One-Click Invite** | Copy invite link to clipboard instantly |
| 🔧 **Manual Offset** | Guests can fine-tune sync with ±500ms offset slider |
| 👥 **Live Listener Count** | See how many people are tuned in |
| 🔊 **Volume Control** | Independent volume for each listener |
| ⏭️ **Skip Controls** | Host can skip forward/back 10 seconds |
| 🔔 **Toast Notifications** | Elegant notifications for room events |
| 📱 **Responsive** | Works on desktop and mobile |
| ⏰ **Auto-Expiry** | Rooms auto-clean after 1 hour of inactivity |

## 🏗️ Architecture

```
┌─────────────┐        WebSocket        ┌──────────────────┐
│   Browser    │ ◄──────────────────────► │   Node.js Server │
│  (Host/Guest)│   Socket.IO events      │   Express + S.IO │
│              │                          │                  │
│  - Audio API │   • create-room         │  Sessions Map:   │
│  - Canvas    │   • join-room           │  - host ID       │
│  - Web Audio │   • playback-update     │  - playback pos  │
│              │   • sync-state          │  - chat history  │
│              │   • chat-message        │  - user tracking │
└─────────────┘                          └──────────────────┘
```

### Sync Strategy

1. **Server-stamped events** — every playback update includes `serverTimestamp`
2. **Latency compensation** — guests add `(Date.now() - serverTimestamp)` to seek position
3. **Smooth drift correction** — small drifts (<500ms) nudge playback rate (1.02x/0.98x); large drifts hard-seek
4. **Manual offset** — guests can fine-tune ±500ms for their setup

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/music-band.git
cd music-band

# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Or start production server
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## 📁 Project Structure

```
music-band/
├── server.js           # Express + Socket.IO server
├── package.json        # Dependencies & scripts
└── public/
    ├── index.html      # Single-page app (host + guest)
    ├── guest.html      # Redirect → index.html with room param
    └── style.css       # Premium glassmorphism design system
```

## 🎮 How to Use

### As a Host
1. Open the app
2. Paste an MP3 URL (any publicly accessible audio file)
3. Click **Create Room**
4. Share the invite link with friends
5. Control playback — guests sync automatically

### As a Guest
1. Click the invite link (or paste a room ID)
2. Audio syncs automatically with the host
3. Use the offset slider if you need to fine-tune timing
4. Chat with everyone in the room

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Server**: Express 5
- **Real-time**: Socket.IO 4
- **Audio**: Web Audio API + HTMLAudioElement
- **Visualizer**: Canvas 2D with frequency analysis
- **Styling**: Vanilla CSS with custom properties (glassmorphism design)
- **Font**: Inter (Google Fonts)

## 📝 License

ISC
