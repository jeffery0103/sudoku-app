// server/main_server.js

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

// --- 引用模組 ---
const game1A2B = require("./games/1a2b_server.js");
const sudokuGame = require("./games/sudoku_server.js");
const initializeSocketHandler = require("./socket_handler.js");
const sudokuApiRoutes = require("./routes/sudoku_api.js");
const tetrisGame = require("./games/tetris_server.js");
const tetrisApiRoutes = require("./routes/tetris_api.js");

// --- 伺服器與 App 初始化 ---
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

// --- 狀態管理 ---
// 狀態依然由主伺服器統一管理，並傳遞給需要的模組
const rooms = {};
const pendingJoinRequests = {};
const activeSudokuGames = {};
const activeTetrisGames = {};


// --- Express 中介軟體 ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));


// --- 路由設定 ---
// 主頁路由
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
// 掛載所有數獨 API 路由，並傳入需要的模組和狀態

app.use('/api', sudokuApiRoutes(sudokuGame, activeSudokuGames, io));
app.use('/api', tetrisApiRoutes(tetrisGame, activeTetrisGames));


// --- 初始化 Socket.IO 處理邏輯 ---
// 傳入需要的模組和狀態
initializeSocketHandler(io, game1A2B, sudokuGame, rooms, pendingJoinRequests, activeSudokuGames);
// --- 啟動伺服器 ---
server.listen(PORT, () =>
  console.log(`伺服器正在 http://localhost:${PORT} 上運行`)
);