const { generatePuzzleParallel } = require('./games/sudoku_generator_service');
const ENABLE_STORM = true;
const gracefulDisconnects = {};
// ======================================================
// --- 模組級輔助函式 ---
// ======================================================

function isBoardFull(board) {
  if (!board || board.length !== 9) return false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!board[r] || board[r][c] === 0) {
        return false;
      }
    }
  }
  return true;
}

function isBoardCorrect(board, solution) {
  if (!board || !solution) return false;
  return JSON.stringify(board) === JSON.stringify(solution);
}

function calculateProgress(puzzle, initialPuzzle) {
    if (!puzzle || !initialPuzzle) return 0;
    const totalCells = 81;
    const initialFilled = initialPuzzle.flat().filter(num => num !== 0).length;
    const currentFilled = puzzle.flat().filter(num => num !== 0).length;
    const totalToFill = totalCells - initialFilled;
    if (totalToFill <= 0) return 100;
    const playerFilled = currentFilled - initialFilled;
    const percentage = Math.floor((playerFilled / totalToFill) * 100);
    return Math.max(0, Math.min(100, percentage));
}

function broadcastFullPlayerState(io, room) {
    if (!room) return;
    const fullState = room.players.map(p => {
        let progress = 0;
        if (p.currentPuzzle && room.gameState.puzzle) {
            if (isBoardFull(p.currentPuzzle)) {
                progress = isBoardCorrect(p.currentPuzzle, room.gameState.solution) ? 100 : 99;
            } else {
                progress = calculateProgress(p.currentPuzzle, room.gameState.puzzle);
            }
        }
        return {
            playerId: p.id,
            playerName: p.name,
            progress: p.status === 'playing' ? progress : (p.status === 'finished' ? 100 : -1),
            status: p.status || 'playing',
            finishTime: p.finishTime || null,
            hintCount: p.hintCount,
            validateCount: p.validateCount,
            pauseUses: p.pauseUses,
        };
    });
    io.to(room.id).emit('sudoku_full_state_update', fullState);
}

/**
 * 統一處理數獨遊戲的設定與啟動流程
 * @param {object} io - Socket.IO 伺服器實例
 * @param {object} rooms - 全域的房間狀態物件
 * @param {object} activeSudokuGames - 儲存活躍遊戲解答的物件
 * @param {object} room - 當前要設定的房間物件
 * @param {object} puzzleResult - 包含 puzzle, solution, holes, difficulty 的謎題結果物件
 */
function setupSudokuGame(io, rooms, activeSudokuGames, room, puzzleResult) {
  // --- 安全檢查 ---
  if (!io || !room || !puzzleResult || !puzzleResult.puzzle || !puzzleResult.solution) {
    console.error(`[伺服器錯誤] setupSudokuGame 缺少必要參數，無法啟動遊戲。房間ID: ${room?.id}`);
    // 可以考慮向該房間發送一個錯誤通知
    if (room) {
      io.to(room.id).emit('game_creation_error', { message: '伺服器內部錯誤，建立遊戲失敗。' });
    }
    return;
  }

  const { puzzle, solution, holes, difficulty } = puzzleResult;

  // --- 1. 更新房間狀態 ---
  room.status = 'playing'; // 將房間狀態從 'waiting' 改為 'playing'
  // 通知大廳，這個房間已經滿員或開始遊戲，應從可加入列表中移除
  io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay(rooms)); 

  // --- 2. 儲存遊戲核心數據 ---
  // 將完整解和初始盤面儲存在一個專門的地方，避免在房間物件中暴露完整解
  activeSudokuGames[room.id] = { 
    solution: solution, 
    initialPuzzle: puzzle 
  };
  
  // 更新房間內的遊戲狀態物件 (gameState)，這部分是會傳遞給玩家的
  room.gameState = { 
    puzzle: puzzle,
    solution: null, // ✨ 重要：絕對不要把完整解(solution)放在會傳給前端的物件裡！
    holes: holes, 
    difficulty: difficulty, 
    seconds: 0 
  };

  // --- 3. 初始化所有玩家的狀態 ---
  // 根據難度設定初始的提示和檢查次數
  let initialHints = 0;
  let initialValidates = 0;
  switch (difficulty) {
    case 'easy':    initialHints = 5; initialValidates = 5; break;
    case 'medium':  initialHints = 3; initialValidates = 3; break;
    case 'hard':    initialHints = 1; initialValidates = 1; break;
    case 'extreme': initialHints = 0; initialValidates = 0; break;
  }

  room.players.forEach(p => {
    p.status = 'playing';
    p.currentPuzzle = puzzle.map(row => [...row]); // 為每個玩家建立獨立的盤面副本
    p.pencilMarks = Array(9).fill().map(() => Array(9).fill().map(() => [])); // 初始化筆記
    p.finishTime = null;
    p.hintCount = initialHints;
    p.validateCount = initialValidates;
    p.pauseUses = room.isSinglePlayer ? 99 : 1; // 單人模式有無限暫停，多人只有一次
  });
  
  console.log(`[伺服器] 房間 ${room.id} 遊戲設定完成，準備廣播開始信號。`);

  // --- 4. 廣播遊戲開始事件 ---
  // 向房間內所有玩家廣播，遊戲正式開始，並附上謎題資料
  io.to(room.id).emit('sudoku_timerStart', { 
    puzzle: puzzle, 
    difficulty: difficulty, 
    holes: holes 
  });
  
  // --- 5. 啟動伺服器計時器 (僅限多人模式) ---
  // 單人模式的計時器由玩家做出第一個動作後，由前端通知伺服器才啟動
  if (!room.isSinglePlayer && !room.timerInterval) {
    room.timerInterval = setInterval(() => {
      const currentRoom = rooms[room.id];
      // 確保房間還存在、遊戲還在進行、且未暫停
      if (currentRoom && currentRoom.status === 'playing' && !currentRoom.isPaused) {
        currentRoom.gameState.seconds++;
        io.to(room.id).emit('sudoku_timeUpdate', { seconds: currentRoom.gameState.seconds });
      } else if (!currentRoom || currentRoom.status !== 'playing') {
        // 如果房間不存在或遊戲已結束，就清除計時器
        clearInterval(room.timerInterval);
        delete room.timerInterval;
      }
    }, 1000);
  }
}

// ======================================================
// --- 主匯出函式 ---
// ======================================================

module.exports = function(io, game1A2B, sudokuGame, rooms, pendingJoinRequests, activeSudokuGames) {

  function getTimestamp() { return `[${new Date().toLocaleString("sv")}]`; }

  function generateRoomId() {
    let id;
    do { id = Math.random().toString(36).substring(2, 6).toUpperCase(); } while (rooms[id]);
    return id;
  }

  const getAvailableRoomsForDisplay = () => {
    return Object.values(rooms)
      .filter((r) => {
        if (r.isSinglePlayer || r.status !== "waiting" || !r.players[0] || !io.sockets.sockets.has(r.players[0].id)) {
          return false;
        }
        const gameTypeUpper = r.gameType.toUpperCase();
        if (gameTypeUpper === "1A2B") return r.players.length === 1;
        if (gameTypeUpper === "SUDOKU") return r.players.length < 10;
        return r.players.length < 2;
      })
      .map((r) => ({
        roomId: r.id,
        hostName: r.players[0].name,
        gameType: r.gameType,
      }));
  };
  
  const JOIN_REQUEST_TIMEOUT = 30000;

  io.on("connection", (socket) => {
    console.log(`${getTimestamp()} [通訊中心] 新使用者連線: ${socket.id}`);
    io.emit("onlineUsersUpdate", io.sockets.sockets.size);

    socket.on('playerEnteredLobby', (playerName) => {
        const trimmedName = playerName ? String(playerName).trim() : '';
        const MAX_NICKNAME_LENGTH = 12;
        if (!trimmedName || trimmedName.length > MAX_NICKNAME_LENGTH) {
            socket.emit('invalidNickname', `暱稱不符合規則 (1-${MAX_NICKNAME_LENGTH}個字)`);
            return;
        }
        socket.playerName = trimmedName;
        console.log(`${getTimestamp()} [通訊中心] 玩家 "${trimmedName}" (${socket.id}) 進入了大廳`);
    });

    socket.on('sudoku_client_ready_for_countdown', ({ roomId }) => {
    const room = rooms[roomId];
    // 確保房間存在且狀態正確
    if (!room || room.status !== 'playing') {
        return;
    }

    console.log(`[遊戲流程] 房間 ${roomId} 的前端已準備好，開始倒數...`);

    io.to(roomId).emit('sudoku_countdown_started');
    broadcastFullPlayerState(io, room);

    setTimeout(() => {
        const currentRoom = rooms[roomId];
        if (currentRoom && currentRoom.status === 'playing') {
            const dataToSend = {
                puzzle: currentRoom.gameState.puzzle,
                difficulty: currentRoom.gameState.difficulty,
                holes: currentRoom.gameState.holes,
                blackoutNumbers: currentRoom.gameState.blackoutNumbers,
                specialMode: currentRoom.gameState.specialMode 
            };
            io.to(roomId).emit('sudoku_timerStart', dataToSend);
            console.log(`[遊戲流程] 房間 ${roomId} 倒數結束，已發送棋盤資料。`);

            if (currentRoom.gameState.specialMode === 'storm' && ENABLE_STORM) {
                startStormTimer(currentRoom, io);
            }
            
            if (!currentRoom.isSinglePlayer) {
                console.log(`[計時器] 多人房間 ${roomId} 自動啟動計時器。`);
                currentRoom.timerInterval = setInterval(() => {
                    const roomForInterval = rooms[roomId];
                    if (roomForInterval && roomForInterval.status === 'playing' && !roomForInterval.isPaused) {
                        roomForInterval.gameState.seconds++;
                        io.to(roomId).emit('sudoku_timeUpdate', { seconds: roomForInterval.gameState.seconds });
                    } else if (!roomForInterval) {
                        clearInterval(currentRoom.timerInterval);
                    }
                }, 1000);
            }
        }
    }, 4000);
});


    socket.on("createRoom", ({ playerName, gameType, isSinglePlayer }) => {
        // ▼▼▼ 【核心修正】在這裡加入清理邏輯 ▼▼▼
        // 在創建新房間之前，先尋找並清理該玩家可能存在的舊單人房間
        console.log(`--- 🕵️‍ [伺服器] 收到 createRoom 請求 from ${playerName} ---`);
        for (const roomId in rooms) {
            const oldRoom = rooms[roomId];
            // 條件：是單人房 && 裡面有這個玩家的 ID
            if (oldRoom.isSinglePlayer && oldRoom.players.some(p => p.id === socket.id)) {
                console.log(`[清理] 發現玩家 ${socket.id} 的舊單人房間 ${roomId}，正在清理...`);
                // 清理舊房間的所有計時器
                if (oldRoom.timerInterval) clearInterval(oldRoom.timerInterval);
                if (oldRoom.stormInterval) clearInterval(oldRoom.stormInterval);
                // 從列表刪除舊房間
                delete rooms[roomId];
            }
        }
        // ▲▲▲ 修正結束 ▲▲▲

        // --- 後續的房間創建邏輯維持不變 ---
        const roomId = generateRoomId();
        const newPlayer = { id: socket.id, name: playerName, isHost: true, isReady: false };
        rooms[roomId] = {
            id: roomId, players: [newPlayer], status: "waiting", gameType: gameType,
            isSinglePlayer: !!isSinglePlayer, gameState: {}, rematchRequests: new Set(), readyForSetup: new Set(),
        };
        socket.join(roomId);
        console.log(`🕵️‍ [伺服器] 房間 ${roomId} 已建立 (單人模式: ${isSinglePlayer})，準備發送 roomCreated`);
        socket.emit("roomCreated", {
            roomId: roomId,
            gameType: gameType,
            players: rooms[roomId].players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
        });
        if (!isSinglePlayer) {
            io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
        }
    });

    socket.on('playerReconnected', ({ playerId, roomId }) => {
        const reconnectionData = gracefulDisconnects[playerId];
        
        if (reconnectionData && reconnectionData.roomId === roomId) {
            console.log(`[斷線保護] 玩家 ${playerId} 在時間內成功重連！`);

            clearTimeout(reconnectionData.timer);

            const room = rooms[roomId];
            if (room) {
                const player = room.players.find(p => p.id === playerId);
                if (player) {
                    player.id = socket.id;
                    socket.playerName = player.name;
                    player.status = 'playing';
                    socket.join(roomId);

                    const gameTypeUpper = room.gameType.toUpperCase();
                    if (gameTypeUpper === 'SUDOKU') {
                        broadcastFullPlayerState(io, room);
                    }

                    socket.emit('reconnectionSuccess', {
                        gameType: room.gameType,
                        gameState: room.gameState,
                    });
                }
            }
            delete gracefulDisconnects[playerId];
        }
    });

    socket.on("requestJoinRoom", ({ roomId, playerName }) => {
        console.log(`--- 🕵️‍ [伺服器] 收到 requestJoinRoom 請求 from ${playerName}，想加入 ${roomId} ---`);
        const room = rooms[roomId];
        if (!room || room.status !== "waiting") return socket.emit("joinRequestFeedback", { success: false, message: "無法加入房間（可能已開始或不存在）。" });
        const host = room.players.find((p) => p.isHost);
        if (!host || !io.sockets.sockets.has(host.id)) return socket.emit("joinRequestFeedback", { success: false, message: "房主已離線，無法加入。" });
        
        socket.emit("joinRequestFeedback", { success: true, roomId });
        const timeoutId = setTimeout(() => {
            const request = pendingJoinRequests[socket.id];
            if (request) {
                socket.emit("joinRoomResult", { success: false, message: `加入請求因房主無回應而逾時。` });
                io.to(request.hostSocketId).emit("playerJoinRequest", { requesterId: socket.id, status: "timedout" });
                delete pendingJoinRequests[socket.id];
            }
        }, JOIN_REQUEST_TIMEOUT);
        pendingJoinRequests[socket.id] = { roomId, hostSocketId: host.id, timeoutId, playerName };
        console.log(`🕵️‍ [伺服器] 轉發 playerJoinRequest 給房主 ${host.id}`);
        io.to(host.id).emit("playerJoinRequest", { requesterId: socket.id, playerName, timeout: JOIN_REQUEST_TIMEOUT });
    });

    socket.on("respondToJoinRequest", ({ requesterId, action }) => {
    const request = pendingJoinRequests[requesterId];
    if (!request || request.hostSocketId !== socket.id) return;

    clearTimeout(request.timeoutId);

    const { roomId, playerName } = request;
    const room = rooms[roomId];
    const requesterSocket = io.sockets.sockets.get(requesterId);

    delete pendingJoinRequests[requesterId];

    if (action === "accept" && room && requesterSocket) {
        // --- 這部分不變，一樣是處理玩家加入的通用邏輯 ---
        room.players.push({ id: requesterId, name: playerName, isHost: false, isReady: false });
        requesterSocket.join(roomId);
        
        requesterSocket.emit("joinRoomResult", {
            success: true,
            message: `成功加入房間 ${roomId}！`,
            roomId,
            gameType: room.gameType,
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
            isHost: false
        });
        
        // 更新房間內的玩家列表給所有人
        io.to(roomId).emit('updateRoomPlayers', {
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
            requesterId: requesterId
        });
        
        io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
        io.to(roomId).emit("chatMessage", { type: 'system', message: `${playerName} 進入了房間。` });

        // ⭐⭐⭐ 關鍵的「交通警察」來了！ ⭐⭐⭐
        // 在這裡檢查遊戲類型，確保只有 1A2B 會自動開始！
        if (room.gameType === '1a2b' && room.players.length === 2) {
            // 看到是 1A2B 的牌子，而且剛好兩個人，就指揮開始！
            console.log(`[伺服器日誌] 1A2B 房間 ${roomId} 人數已滿，由伺服器主動開始遊戲！`);
            game1A2B.handleGameSetup(io, room);
        }
        // 如果是數獨或其他遊戲，就不會進入這個 if，伺服器只會更新玩家列表，然後靜靜等待房主手動開始遊戲。

    } else if (requesterSocket) {
        requesterSocket.emit("joinRoomResult", { success: false, message: "房主拒絕了您的請求。" });
    }
});

    socket.on("cancelRoom", (roomId) => {
        const room = rooms[roomId];
        if (room && room.players[0]?.id === socket.id && room.players.length === 1) {
            for (const requesterId in pendingJoinRequests) {
                if (pendingJoinRequests[requesterId].roomId === roomId) {
                    const request = pendingJoinRequests[requesterId];
                    const requesterSocket = io.sockets.sockets.get(requesterId);
                    if (requesterSocket) {
                        clearTimeout(request.timeoutId);
                        requesterSocket.emit("joinRoomResult", { success: false, message: "加入失敗：房主已取消該房間。" });
                    }
                    delete pendingJoinRequests[requesterId];
                }
            }
            socket.emit("roomCancelledFeedback");
            delete rooms[roomId];
            io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
        }
    });

    socket.on("requestAvailableRooms", () => socket.emit("availableRoomsUpdate", getAvailableRoomsForDisplay()));
    
    socket.on("sendChatMessage", ({ roomId, message }) => {
        if (!socket.rooms.has(roomId)) return;
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);
        if (player && room) {
            const trimmedMessage = message ? String(message).trim() : '';
            if (trimmedMessage) {
                io.to(roomId).emit("chatMessage", {
                    senderId: socket.id,
                    senderName: player.name,
                    message: trimmedMessage
                });
            }
        }
    });

    socket.on("clientReadyForGameSetup", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    console.log(`--- 🕵️‍ [伺服器] 收到 clientReadyForGameSetup from socket ${socket.id} ---`);
    room.readyForSetup.add(socket.id);
    console.log(`🕵️‍ [伺服器] 目前房間 ${roomId} 的準備列表:`, Array.from(room.readyForSetup));


    const gameTypeUpper = room.gameType.toUpperCase();

    // ⭐ 1A2B 的判斷邏輯 (包含單人與雙人) ⭐
    if (gameTypeUpper === "1A2B") {
        const isReadyToStart =
            (room.isSinglePlayer && room.players.length === 1 && room.readyForSetup.has(room.players[0].id)) ||
            (!room.isSinglePlayer && room.players.length >= 2 && room.readyForSetup.size === room.players.length);
            console.log(`🕵️‍ [伺服器] 1A2B 遊戲開始條件檢查結果: ${isReadyToStart}`);

        if (isReadyToStart) {
            console.log("🕵️‍ [伺服器] 條件滿足！準備呼叫 handleGameSetup 推進遊戲！");
            game1A2B.handleGameSetup(io, room);
            room.readyForSetup.clear(); // 清理準備狀態
        }
    } 
    // ⭐ 數獨的判斷邏輯 (維持原樣，沒有刪掉！) ⭐
    else if (gameTypeUpper === "SUDOKU") {
        // 這裡我們維持數獨原本的邏輯：所有人都到齊且都準備好了，才提示房主選難度
        if (room.players.length > 0 && room.readyForSetup.size === room.players.length) {
            const host = room.players.find(p => p.isHost);
            if (host) {
                io.to(host.id).emit("sudoku_promptSelectDifficulty");
            }
            room.readyForSetup.clear(); // 清理準備狀態
        }
    }
});

function startStormTimer(room, io) {
  if (!room || room.stormInterval) return; // 如果已經啟動，就不要重複啟動
  console.log(`[次元風暴] 已為房間 ${room.id} 啟動風暴計時器。`);

  room.stormInterval = setInterval(() => {
    // 檢查房間或玩家是否存在，不存在就清除計時器
    if (!rooms[room.id] || room.players.length === 0) {
        clearInterval(room.stormInterval);
        delete room.stormInterval;
        return;
    }

    // 遊戲暫停時，風暴也跟著暫停
    if (room.isPaused) {
        return;
    }

    // --- 隨機交換邏輯 ---
    const swapPlan = []; 
    const swapTypes = ['band_swap', 'stack_swap']; // 可選的交換類型：'band_swap'是交換橫排, 'stack_swap'是交換直排

    for (let i = 0; i < 5; i++) {
        // a. 每次都隨機決定要交換「行組(band)」還是「列組(stack)」
        const type = swapTypes[Math.floor(Math.random() * 2)];
        
        // b. 隨機挑選兩個不同的組來交換 (編號 0, 1, 2)
        const groupA = Math.floor(Math.random() * 3);
        let groupB;
        do {
            groupB = Math.floor(Math.random() * 3);
        } while (groupA === groupB);
        
        swapPlan.push({ type, groupA, groupB });
    }

    

    // c. 把完整的三次交換計畫一次性廣播給前端
    io.to(room.id).emit('sudoku_dimensional_storm_hit', {
      plan: swapPlan
    });

  }, 300000); 
}


   socket.on('sudoku_startGame', async ({ roomId, difficulty }) => {
    try {
        console.log(`[生成器] 收到 startGame 請求。難度: ${difficulty}`);
        const room = rooms[roomId];
        if (!room || !room.players.find(p => p.id === socket.id)?.isHost || room.status === 'playing') {
            return;
        }

        room.status = 'playing';
        io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());

        let specialMode = null;
        let availableModes = [];
        /* <-- 從這裡開始註解
        if (room.isSinglePlayer) {
            let availableModes = [];
            switch (difficulty) {
                case 'easy':    availableModes = ['telescope']; break;
                case 'medium':  availableModes = ['telescope']; break;
                case 'hard':    availableModes = ['telescope', 'storm']; break;
                case 'extreme': availableModes = ['telescope', 'storm']; break;
            }

            if (availableModes.length > 0) {
                specialMode = availableModes[Math.floor(Math.random() * availableModes.length)];
                room.gameState.specialMode = specialMode;
                console.log(`[特殊模式] 單人房間 ${roomId} (難度: ${difficulty}) 抽中了特殊模式: ${specialMode}`);
            }
        }
        */ // <-- 在這裡結束註解
        
        // --- ⭐ 核心修正：將所有邏輯統一處理，不再分流 ⭐ ---
        
        // 1. 無論什麼模式，先生成謎題
        //    (這裡可以移除多餘的 await 呼叫，因為 generatePuzzleParallel 已經會等待了)
        const onProgress = (progressData) => { io.to(roomId).emit('sudoku_generation_progress', progressData); };
        const onDispatch = (dispatchData) => { io.to(roomId).emit('sudoku_dispatch_progress', dispatchData); };
        
        // 只有極限模式需要傳入 onProgress 和 onDispatch
        const result = await generatePuzzleParallel(difficulty, (difficulty === 'extreme' ? onProgress : () => {}), (difficulty === 'extreme' ? onDispatch : () => {}), specialMode);
        
        const { puzzle, solution, holes, blackoutNumbers } = result;
        
        activeSudokuGames[roomId] = { solution, initialPuzzle: puzzle };
        room.gameState.puzzle = puzzle;
        room.gameState.solution = solution;
        room.gameState.holes = holes;
        room.gameState.difficulty = difficulty;
        room.gameState.blackoutNumbers = blackoutNumbers || [];

        let initialHints = 0, initialValidates = 0;
        switch (difficulty) {
            case 'easy':    initialHints = 5; initialValidates = 5; break;
            case 'medium':  initialHints = 3; initialValidates = 3; break;
            case 'hard':    initialHints = 1; initialValidates = 1; break;
            case 'extreme': initialHints = 0; initialValidates = 0; break;
        }

        room.gameState.seconds = 0;
        room.spectatorMap = {}; 

        room.players.forEach(p => {
            p.currentPuzzle = puzzle.map(row => [...row]);
            p.status = 'playing';
            p.finishTime = null;
            p.hintCount = initialHints;
            p.validateCount = initialValidates;
            p.pauseUses = room.isSinglePlayer ? 99 : 1; 
        });
        
        // 2. 廣播「生成開始」事件給前端，並傳遞抽獎結果。
        //    讓前端自己決定是否要播放拉霸機。
        io.to(roomId).emit('sudoku_generation_started', { 
            message: `正在生成 ${difficulty} 謎題...`, 
            lotteryResult: specialMode 
        });

        // 3. 移除舊的 setTimeout。我們現在將等待前端回覆！

    } catch (err) {
        console.error(`[錯誤] 'sudoku_startGame' 處理過程中發生錯誤:`, err);
        io.to(roomId).emit('game_creation_error', { message: '開始遊戲失敗，請返回大廳重試。' });
    }
});



    socket.on('sudoku_player_first_move', ({ roomId }) => {
      const room = rooms[roomId];
      // 確保是單人房、遊戲正在進行、且計時器還沒啟動
      if (room && room.isSinglePlayer && room.status === 'playing' && !room.timerInterval) {
        console.log(`[計時器] 單人房間 ${roomId} 因玩家首次移動，正式啟動計時器。`);

        // (這裡的計時器邏輯和上面多人模式的是一樣的)
        room.timerInterval = setInterval(() => {
            const roomForInterval = rooms[roomId];
            if (roomForInterval && roomForInterval.status === 'playing' && !roomForInterval.isPaused) {
                roomForInterval.gameState.seconds++;
                io.to(roomId).emit('sudoku_timeUpdate', { seconds: roomForInterval.gameState.seconds });
            } else if (!roomForInterval) {
                clearInterval(room.timerInterval);
            }
        }, 1000);
      }
    });

    socket.on('sudoku_useHint', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.hintCount > 0) { player.hintCount--; }
    });

    socket.on('sudoku_useValidate', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.validateCount > 0) { player.validateCount--; }
    });

    socket.on('sudoku_playerSelectCell', ({ roomId, coords }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;
        const playerState = room.players.find(p => p.id === socket.id);
        if (playerState) {
            playerState.selectedCoords = coords;
        }
        room.players.forEach(p => {
            if (p.spectating === socket.id) {
                const spectatorSocket = io.sockets.sockets.get(p.id);
                if (spectatorSocket) {
                    spectatorSocket.emit('sudoku_spectateSelectionUpdate', {
                        playerId: socket.id,
                        selectedCoords: coords
                    });
                }
            }
        });
    });
        
    socket.on('sudoku_playerAction', ({ roomId, puzzle, pencilMarks }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing') return;
        const playerState = room.players.find(p => p.id === socket.id);
        if (!playerState || playerState.status !== 'playing') return;

        playerState.currentPuzzle = puzzle;
        playerState.pencilMarks = pencilMarks;

        room.players.forEach(p => {
            if (p.spectating === playerState.id) {
                const spectatorSocket = io.sockets.sockets.get(p.id);
                if (spectatorSocket) {
                    spectatorSocket.emit('sudoku_spectateUpdate', {
                        puzzle: playerState.currentPuzzle,
                        initialPuzzle: room.gameState.puzzle,
                        playerName: playerState.name,
                        pencilMarks: playerState.pencilMarks,
                        hintCount: playerState.hintCount,
                        validateCount: playerState.validateCount
                    });
                }
            }
        });

        if (isBoardFull(puzzle) && isBoardCorrect(puzzle, room.gameState.solution)) {
            playerState.status = 'finished';
            playerState.finishTime = room.gameState.seconds;

            // ▼▼▼ 【核心修改 2】在這裡加入日誌回報 ▼▼▼
            const difficulty = room.gameState.difficulty || '未知';
            const finishTime = playerState.finishTime;

            // 根據難度再次獲取初始次數，用來計算「已使用」次數
            let initialHints = 0;
            let initialValidates = 0;
            switch (difficulty) {
              case 'easy':    initialHints = 5; initialValidates = 5; break;
              case 'medium':  initialHints = 3; initialValidates = 3; break;
              case 'hard':    initialHints = 1; initialValidates = 1; break;
              case 'extreme': initialHints = 0; initialValidates = 0; break;
            }

            // 初始次數 - 剩餘次數 = 已使用次數
            const hintsUsed = initialHints - (playerState.hintCount || 0);
            const validatesUsed = initialValidates - (playerState.validateCount || 0);

            if (room.isSinglePlayer || room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status))) {
                if (room.stormInterval) {
                clearInterval(room.stormInterval);
                console.log(`[風暴] 房間 ${room.id} 的風暴計時器已清除。`);
                delete room.stormInterval;
            }
        }

            console.log(`[遊戲完成] 玩家: ${playerState.name} | 難度: ${difficulty} | 花費時間: ${finishTime}秒 | 使用提示: ${hintsUsed}次 | 使用檢查: ${validatesUsed}次`);
            // ▲▲▲ 修改結束 ▲▲▲

            io.to(roomId).emit("chatMessage", { type: 'system', message: `🎉 ${playerState.name} 已完成！` });
        }

        broadcastFullPlayerState(io, room);

        const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
        if (allPlayersDone && !room.isSinglePlayer) { 
            if (room.timerInterval) clearInterval(room.timerInterval);
            if (room.stormInterval) clearInterval(room.stormInterval);
            
            room.status = 'gameOver';
            const finalRanking = room.players
                .filter(p => p.status === 'finished')
                .sort((a, b) => a.finishTime - b.finishTime)
                .map(p => ({ playerName: p.name, finishTime: p.finishTime }));
            io.to(roomId).emit('sudoku_gameOver', { finalRanking });
        }
    });
    
    socket.on('sudoku_requestSpectate', ({ roomId, targetPlayerId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const requesterPlayer = room.players.find(p => p.id === socket.id);
        if (requesterPlayer) {
            requesterPlayer.spectating = (targetPlayerId === socket.id) ? null : targetPlayerId;
        }

        const targetPlayer = room.players.find(p => p.id === targetPlayerId);
        if (targetPlayer && targetPlayer.status === 'playing' && targetPlayer.currentPuzzle) {
            const dataToSend = {
                puzzle: targetPlayer.currentPuzzle,
                initialPuzzle: room.gameState.puzzle, 
                playerName: targetPlayer.name,
                pencilMarks: targetPlayer.pencilMarks,
                hintCount: targetPlayer.hintCount,
                validateCount: targetPlayer.validateCount
            };
            socket.emit('sudoku_spectateUpdate', dataToSend);
        }
    });

    socket.on('sudoku_surrender', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player && player.status === 'playing') {
            player.status = 'surrendered';
            io.to(roomId).emit("chatMessage", { type: 'system', message: `🏳️ ${player.name} 已投降。` });
            broadcastFullPlayerState(io, room);
            
            const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
            if (allPlayersDone) {
                if (room.timerInterval) clearInterval(room.timerInterval);
                if (room.stormInterval) clearInterval(room.stormInterval);
            
                room.status = 'gameOver';
                const finalRanking = room.players
                    .filter(p => p.status === 'finished')
                    .sort((a, b) => a.finishTime - b.finishTime)
                    .map(p => ({ playerName: p.name, finishTime: p.finishTime }));
                io.to(roomId).emit('sudoku_gameOver', { finalRanking });
            }
        }
    });

    socket.on('sudoku_requestPause', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing' || room.isPaused) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // 【⭐核心修正⭐】
        // 我們用一個 if/else 來區分單人跟多人的邏輯
        if (room.isSinglePlayer) {
            // 單人模式：不需要檢查次數，直接暫停
            room.isPaused = true;
            room.pausedBy = socket.id;
            io.to(roomId).emit('sudoku_gamePaused', { requesterId: socket.id, playerName: player.name });
        } else {
            // 多人模式：維持原本的次數檢查邏輯
            if (player.pauseUses > 0) {
                player.pauseUses = 0; // 將次數設為0，代表已用過
                room.isPaused = true;
                room.pausedBy = socket.id;
                io.to(roomId).emit('sudoku_gamePaused', { requesterId: socket.id, playerName: player.name });
            }
        }
    });

    socket.on('sudoku_resumeGame', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.isPaused) return;
        if (room.pausedBy === socket.id) {
            room.isPaused = false;
            room.pausedBy = null;
            io.to(roomId).emit('sudoku_gameResumed');
        }
    });
    
    socket.on("disconnect", () => {
        const playerName = socket.playerName || socket.id;
        console.log(`${getTimestamp()} [通訊中心] 玩家 "${playerName}" (${socket.id}) 連線中斷...`);
        io.emit("onlineUsersUpdate", io.sockets.sockets.size);

        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex((p) => p.id === socket.id);

            if (playerIndex > -1) {
                const disconnectedPlayer = room.players[playerIndex];

                // 【⭐核心修正：啟動黃金救援⭐】
                if (room.status === 'playing' && !room.isSinglePlayer) {
                    
                    disconnectedPlayer.status = 'reconnecting'; // 更新狀態為「重連中」
                    console.log(`[斷線保護] 玩家 ${disconnectedPlayer.name} (${socket.id}) 進入30秒重連等待期。`);

                    // 根據遊戲類型決定是否廣播狀態
                    const gameTypeUpper = room.gameType.toUpperCase();
                    if (gameTypeUpper === 'SUDOKU') {
                        broadcastFullPlayerState(io, room);
                    }

                    const timerId = setTimeout(() => {
                        if (gracefulDisconnects[disconnectedPlayer.id]) {
                            console.log(`[斷線保護] 玩家 ${disconnectedPlayer.name} 重連逾時，正式判定為離線。`);
                            
                            // 30秒到還沒回來，執行真正的離線邏輯
                            disconnectedPlayer.status = 'disconnected';
                            
                            io.to(roomId).emit("chatMessage", { type: 'system', message: `🔌 玩家 ${disconnectedPlayer.name} 已離線。` });
                            
                            // 根據遊戲類型，執行不同的後續處理
                            if (gameTypeUpper === 'SUDOKU') {
                                disconnectedPlayer.currentPuzzle = null;
                                broadcastFullPlayerState(io, room);
                                
                                const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
                                if (allPlayersDone) {
                                    if (room.stormInterval) clearInterval(room.stormInterval);
                                    if (room.timerInterval) clearInterval(room.timerInterval);
                                    room.status = 'gameOver';
                                    const finalRanking = room.players
                                        .filter(p => p.status === 'finished')
                                        .sort((a, b) => a.finishTime - b.finishTime)
                                        .map(p => ({ playerName: p.name, finishTime: p.finishTime }));
                                    io.to(roomId).emit('sudoku_gameOver', { finalRanking });
                                }
                            } else if (gameTypeUpper === '1A2B') {
                                game1A2B.handleDisconnect(io, room, disconnectedPlayer);
                            }
                            
                            delete gracefulDisconnects[disconnectedPlayer.id];
                        }
                    }, 30000);

                    gracefulDisconnects[disconnectedPlayer.id] = { timer: timerId, roomId: roomId, socketId: socket.id };

                } else { 
                    // 在遊戲大廳、單人模式，或遊戲結束時斷線，直接移除
                    if (room.status !== 'waiting') {
                        const gameTypeUpper = room.gameType.toUpperCase();
                        if (gameTypeUpper === "1A2B") {
                            game1A2B.handleDisconnect(io, room, disconnectedPlayer);
                        }
                    }
                    
                    room.players.splice(playerIndex, 1);
                    io.to(roomId).emit("chatMessage", { type: 'system', message: `${disconnectedPlayer.name} 離開了房間。` });
                    if (room.players.length === 0) {
                        delete rooms[roomId];
                    } else if (disconnectedPlayer.isHost) {
                        room.players[0].isHost = true;
                        io.to(roomId).emit("chatMessage", { type: 'system', message: `${room.players[0].name} 已被提升為新房主。` });
                    }
                    io.to(roomId).emit('updateRoomPlayers', { players: room.players.map(p => ({id: p.id, name: p.name, isHost: p.isHost})) });
                }

                io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
                break;
            }
        }
        
        if (pendingJoinRequests && pendingJoinRequests[socket.id]) {
            const request = pendingJoinRequests[socket.id];
            clearTimeout(request.timeoutId);
            io.to(request.hostSocketId).emit("playerJoinRequest", { requesterId: socket.id, status: "disconnected" });
            delete pendingJoinRequests[socket.id];
        }
    });

  });
};