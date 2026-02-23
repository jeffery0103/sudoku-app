// server/main_server.js

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

// --- 引用模組 (只保留數獨) ---
const sudokuGame = require("./games/sudoku_server.js");
const initializeSocketHandler = require("./socket_handler.js");
const sudokuApiRoutes = require("./routes/sudoku_api.js");

// --- 伺服器與 App 初始化 ---
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

// --- 狀態管理 (移除 tetris) ---
const rooms = {};
const pendingJoinRequests = {};
const activeSudokuGames = {};

// --- Express 中介軟體 ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- 路由設定 ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// 掛載數獨 API 路由
app.use('/api', sudokuApiRoutes(sudokuGame, activeSudokuGames, io));

// --- 初始化 Socket.IO 處理邏輯 (移除 game1A2B) ---
initializeSocketHandler(io, sudokuGame, rooms, pendingJoinRequests, activeSudokuGames);

// --- 啟動伺服器 ---
server.listen(PORT, () =>
  console.log(`伺服器正在 http://localhost:${PORT} 上運行`)
);