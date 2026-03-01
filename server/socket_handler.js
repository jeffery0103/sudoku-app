const { generatePuzzleParallel } = require('./games/sudoku_generator_service');
const ENABLE_STORM = true;
const gracefulDisconnects = {};

// ======================================================
// --- 模組級輔助函式 ---
// ======================================================

// ✨ 統一生成包含詳細資訊的排行榜
function generateFinalRanking(room) {
    // ✨ 核心修正：從內部保險箱讀取解答，不要讀取被設為 null 的 gameState
    const solution = room.secretSolution;
    const initial = room.gameState.puzzle;
    const difficulty = room.gameState.difficulty || 'medium';
    let totalHoles = 0;

    let initialHints = 0;
    let initialValidates = 0;
    switch (difficulty) {
        case 'easy':    initialHints = 5; initialValidates = 5; break;
        case 'medium':  initialHints = 3; initialValidates = 3; break;
        case 'hard':    initialHints = 1; initialValidates = 1; break;
        case 'extreme': initialHints = 0; initialValidates = 0; break;
    }

    if (initial) {
        totalHoles = initial.flat().filter(n => n == 0).length;
    }

    return room.players.map(p => {
        let correctCount = 0;
        let filledCount = 0;

        if (p.currentPuzzle && initial && solution) {
            const flatInitial = initial.flat();
            const flatCurrent = p.currentPuzzle.flat();
            const flatSolution = solution.flat();

            for (let i = 0; i < 81; i++) {
                if (flatInitial[i] == 0 && flatCurrent[i] != 0) {
                    filledCount++;
                    if (flatCurrent[i] == flatSolution[i]) {
                        correctCount++;
                    }
                }
            }
        }

        const fillRate = totalHoles > 0 ? Math.floor((filledCount / totalHoles) * 100) : 0;
        const accuracy = filledCount > 0 ? Math.floor((correctCount / filledCount) * 100) : 0;
        const progress = p.status === 'finished' ? 100 : (totalHoles > 0 ? Math.floor((correctCount / totalHoles) * 100) : 0);

        return {
            playerName: p.name,
            finishTime: p.finishTime !== null ? p.finishTime : 999999,
            progress: progress,
            accuracy: accuracy,
            fillRate: fillRate,
            status: p.status,
            hintCount: initialHints - (p.hintCount || 0),
            validateCount: initialValidates - (p.validateCount || 0)
        };
    }).sort((a, b) => {
        if (a.progress === b.progress) return a.finishTime - b.finishTime;
        return b.progress - a.progress;
    });
}


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
    
    // 【核心修正】後端的基礎進度也改為乘上 99
    const percentage = Math.floor((playerFilled / totalToFill) * 99);
    // 確保最多只回傳 99，100% 會由 broadcastFullPlayerState 裡的 isBoardCorrect 判斷給予
    return Math.max(0, Math.min(99, percentage));
}

function broadcastFullPlayerState(io, room) {
    if (!room) return;
    // ✨ 同步修正：使用 secretSolution 進行 100% 完成度判定
    const solution = room.secretSolution; 
    const fullState = room.players.map(p => {
        let progress = 0;
        if (p.currentPuzzle && room.gameState.puzzle) {
            if (isBoardFull(p.currentPuzzle)) {
                progress = isBoardCorrect(p.currentPuzzle, solution) ? 100 : 99;
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

function setupSudokuGame(io, rooms, activeSudokuGames, room, puzzleResult) {
  if (!io || !room || !puzzleResult || !puzzleResult.puzzle || !puzzleResult.solution) {
    console.error(`[伺服器錯誤] setupSudokuGame 缺少必要參數，無法啟動遊戲。房間ID: ${room?.id}`);
    if (room) {
      io.to(room.id).emit('game_creation_error', { message: '伺服器內部錯誤，建立遊戲失敗。' });
    }
    return;
  }

  const { puzzle, solution, holes, difficulty } = puzzleResult;

  room.status = 'playing'; 
  room.secretSolution = solution; // ✨ 核心修正：將正確答案安全地存入房間內部實例中

  activeSudokuGames[room.id] = { 
    solution: solution, 
    initialPuzzle: puzzle 
  };
  
  room.gameState = { 
    puzzle: puzzle,
    solution: null, // 這裡保持 null，確保傳給前端時絕對安全
    holes: holes, 
    difficulty: difficulty, 
    seconds: 0 
  };

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
    p.currentPuzzle = puzzle.map(row => [...row]); 
    p.pencilMarks = Array(9).fill().map(() => Array(9).fill().map(() => []));
    p.finishTime = null;
    p.hintCount = initialHints;
    p.validateCount = initialValidates;
    p.pauseUses = room.isSinglePlayer ? 99 : 2; 
  });
  
  console.log(`[伺服器] 房間 ${room.id} 遊戲設定完成，準備廣播開始信號。`);

  io.to(room.id).emit('sudoku_timerStart', { 
    puzzle: puzzle, 
    difficulty: difficulty, 
    holes: holes 
  });
  
  if (!room.isSinglePlayer && !room.timerInterval) {
    room.timerInterval = setInterval(() => {
      const currentRoom = rooms[room.id];
      if (currentRoom && currentRoom.status === 'playing' && !currentRoom.isPaused) {
        currentRoom.gameState.seconds++;
        io.to(room.id).emit('sudoku_timeUpdate', { seconds: currentRoom.gameState.seconds });
      } else if (!currentRoom || currentRoom.status !== 'playing') {
        clearInterval(room.timerInterval);
        delete room.timerInterval;
      }
    }, 1000);
  }
}

// ======================================================
// --- 主匯出函式 (移除 game1A2B) ---
// ======================================================
module.exports = function(io, sudokuGame, rooms, pendingJoinRequests, activeSudokuGames) {

  function getTimestamp() { return `[${new Date().toLocaleString("sv")}]`; }

  function generateRoomId() {
    let id;
    do { id = Math.random().toString(36).substring(2, 6).toUpperCase(); } while (rooms[id]);
    return id;
  }

  // 將 getAvailableRoomsForDisplay 移到這裡並修正
  function getAvailableRoomsForDisplay() {
    return Object.values(rooms)
      .filter((r) => {
        if (r.isSinglePlayer || r.status !== "waiting" || !r.players[0] || !io.sockets.sockets.has(r.players[0].id)) {
          return false;
        }
        const gameTypeUpper = r.gameType.toUpperCase();
        if (gameTypeUpper === "SUDOKU") return r.players.length < 10;
        return false;
      })
      .map((r) => ({
        roomId: r.id,
        hostName: r.players[0].name,
        gameType: r.gameType,
      }));
  }
  
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

   

    socket.on("createRoom", ({ playerName, gameType, isSinglePlayer }) => {
        console.log(`--- 🕵️‍ [伺服器] 收到 createRoom 請求 from ${playerName} ---`);
        for (const roomId in rooms) {
            const oldRoom = rooms[roomId];
            if (oldRoom.isSinglePlayer && oldRoom.players.some(p => p.id === socket.id)) {
                console.log(`[清理] 發現玩家 ${socket.id} 的舊單人房間 ${roomId}，正在清理...`);
                if (oldRoom.timerInterval) clearInterval(oldRoom.timerInterval);
                if (oldRoom.stormInterval) clearInterval(oldRoom.stormInterval);
                delete rooms[roomId];
            }
        }

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
            clearTimeout(reconnectionData.timer);

            const room = rooms[roomId];
            if (room) {
                const player = room.players.find(p => p.id === playerId);
                if (player) {
                    // ✨ 升級版後台日誌：印出完整的身分替換過程
                    console.log(`[斷線保護] ⚡ 玩家 "${player.name}" 成功重連至房間 ${roomId}！`);
                    console.log(`          舊 ID: ${playerId}  -->  新 ID: ${socket.id}`);

                    player.id = socket.id;
                    socket.playerName = player.name;
                    player.status = 'playing';
                    socket.join(roomId);

                    if (room.gameType.toUpperCase() === 'SUDOKU') {
                        broadcastFullPlayerState(io, room);
                    }

                    socket.emit('reconnectionSuccess', {
                        gameType: room.gameType,
                        gameState: room.gameState,
                        roomId: roomId // 順便把 roomId 傳給前端印日誌
                    });
                }
            }
            delete gracefulDisconnects[playerId];
        } else {
            console.log(`[斷線保護] ⚠️ 收到無效的重連請求。玩家 ID: ${playerId}, 房號: ${roomId}`);
        }
    });

    // ✨ 直接讓玩家加入房間，免房主同意
    socket.on("requestJoinRoom", (data) => {
        const { roomId, playerName } = data;
        console.log(`--- 🕵️‍ [伺服器] 收到直接加入請求 from ${playerName}，想加入 ${roomId} ---`);
        
        const room = rooms[roomId];

        // 1. 檢查房間是否存在
        if (!room) {
            return socket.emit('joinRoomResult', { success: false, message: '找不到此房間，請確認房號是否正確' });
        }
        // 2. 檢查房間狀態
        if (room.status !== "waiting") {
            return socket.emit('joinRoomResult', { success: false, message: '此房間遊戲已經開始或不存在。' });
        }
        // 3. 檢查人數上限 (假設最多 4 人，可自行修改)
        if (room.players.length >= 4) {
            return socket.emit('joinRoomResult', { success: false, message: '此房間已滿' });
        }

        // 4. 建立新玩家資料並直接加入房間！
        const newPlayer = { 
            id: socket.id, 
            name: playerName || "匿名玩家", 
            isHost: false, 
            isReady: false 
        };
        
        room.players.push(newPlayer);
        socket.join(roomId);

        // 5. 通知加入者成功進入
        socket.emit("joinRoomResult", {
            success: true,
            message: `成功加入房間 ${roomId}！`,
            roomId,
            gameType: room.gameType,
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
            isHost: false
        });

        // 6. 廣播給房間所有人更新玩家名單 (這會讓所有人的按鈕跟進度條同步)
        io.to(roomId).emit('updateRoomPlayers', {
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
        });

        // 7. 更新大廳清單與聊天室公告
        io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
        io.to(roomId).emit("chatMessage", { type: 'system', message: `${newPlayer.name} 進入了房間。` });
        
        console.log(`[連線] 玩家 ${newPlayer.name} 直接加入了房間 ${roomId}`);
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

    // 房主發起再來一局
    socket.on('sudoku_request_rematch', ({ roomId }) => {
        const room = rooms[roomId];
        if (room && room.players[0].id === socket.id) {
            room.status = 'waiting';
            room.players.forEach(p => {
                p.status = 'waiting';
                p.currentPuzzle = null;
                p.isReady = false;
            });
            // 通知其他人房主邀請重玩
            socket.to(roomId).emit('sudoku_rematch_requested');
            io.to(roomId).emit('updateRoomPlayers', { players: room.players.map(p => ({id: p.id, name: p.name, isHost: p.isHost})) });
        }
    });

    // 玩家接受再來一局
    socket.on('sudoku_accept_rematch', ({ roomId }) => {
        const room = rooms[roomId];
        if (room) {
            io.to(roomId).emit('updateRoomPlayers', { players: room.players.map(p => ({id: p.id, name: p.name, isHost: p.isHost})) });
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
        if (gameTypeUpper === "SUDOKU") {
            if (room.players.length > 0 && room.readyForSetup.size === room.players.length) {
                const host = room.players.find(p => p.isHost);
                if (host) {
                    io.to(host.id).emit("sudoku_promptSelectDifficulty");
                }
                room.readyForSetup.clear();
            }
        }
    });

    function startStormTimer(room, io) {
      if (!room || room.stormInterval) return; 
      console.log(`[次元風暴] 已為房間 ${room.id} 啟動風暴計時器。`);

      room.stormInterval = setInterval(() => {
        if (!rooms[room.id] || room.players.length === 0) {
            clearInterval(room.stormInterval);
            delete room.stormInterval;
            return;
        }

        if (room.isPaused) return;

        const swapPlan = []; 
        const swapTypes = ['band_swap', 'stack_swap']; 

        for (let i = 0; i < 5; i++) {
            const type = swapTypes[Math.floor(Math.random() * 2)];
            const groupA = Math.floor(Math.random() * 3);
            let groupB;
            do {
                groupB = Math.floor(Math.random() * 3);
            } while (groupA === groupB);
            
            swapPlan.push({ type, groupA, groupB });
        }

        io.to(room.id).emit('sudoku_dimensional_storm_hit', {
          plan: swapPlan
        });

      }, 300000); 
    }

    // ✨ 統籌生成、倒數與開始的全新流程 (具備防重複觸發鎖)
    socket.on('sudoku_startGame', async ({ roomId, difficulty, holes }) => { 
      try {
        const room = rooms[roomId];
        const player = room?.players.find(p => p.id === socket.id);

        // 🛑 核心修復：加入 'generating' 狀態判斷，擋下所有重複發送的請求！
        if (!room || !player?.isHost || room.status === 'playing' || room.status === 'generating') {
            return;
        }

        // 🔒 立刻把房間上鎖，標示為正在生成中
        room.status = 'generating';

        console.log(`[伺服器] 開始為房間 ${roomId} 產生謎題 (難度: ${difficulty}, 洞數: ${holes || '預設'})...`);
        
        // 1. 廣播給所有人，切換成生成中畫面
        io.to(roomId).emit('sudoku_generation_started', { difficulty, holes });
        
        // 2. 開始運算
        const result = await generatePuzzleParallel(
            difficulty, 
            holes,
            (progressData) => {
                io.to(roomId).emit('sudoku_generation_progress', progressData);
            }
        );
        
        result.difficulty = difficulty;

        // 3. 運算完成，通知前端切換成 3, 2, 1 倒數畫面
        io.to(roomId).emit('sudoku_countdown_started');
        broadcastFullPlayerState(io, room);

        // 4. 延遲 3.5 秒等待前端倒數動畫播完，再正式發送棋盤並開始計時
        setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom) {
                // setupSudokuGame 內部會自動將狀態轉為 'playing'
                setupSudokuGame(io, rooms, activeSudokuGames, currentRoom, result);
                if (currentRoom.gameState.specialMode === 'storm' && ENABLE_STORM) {
                    startStormTimer(currentRoom, io);
                }
            }
        }, 3500);

      } catch (err) {
        console.error(`[錯誤] 'sudoku_startGame' 處理過程中發生錯誤:`, err);
        // 🔓 如果出錯，把房間解鎖回等待狀態，允許玩家重新按按鈕試一次
        if (rooms[roomId]) rooms[roomId].status = 'waiting';
        io.to(socket.id).emit('game_creation_error', { message: '開始遊戲失敗，請重試。' });
      }
    });

    socket.on('sudoku_player_first_move', ({ roomId }) => {
      const room = rooms[roomId];
      if (room && room.isSinglePlayer && room.status === 'playing' && !room.timerInterval) {
        console.log(`[計時器] 單人房間 ${roomId} 因玩家首次移動，正式啟動計時器。`);
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

            const difficulty = room.gameState.difficulty || '未知';
            const finishTime = playerState.finishTime;

            let initialHints = 0;
            let initialValidates = 0;
            switch (difficulty) {
              case 'easy':    initialHints = 5; initialValidates = 5; break;
              case 'medium':  initialHints = 3; initialValidates = 3; break;
              case 'hard':    initialHints = 1; initialValidates = 1; break;
              case 'extreme': initialHints = 0; initialValidates = 0; break;
            }

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
            io.to(roomId).emit("chatMessage", { type: 'system', message: `🎉 ${playerState.name} 已完成！` });
        }

        broadcastFullPlayerState(io, room);

        const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
        if (allPlayersDone && !room.isSinglePlayer) { 
            if (room.timerInterval) clearInterval(room.timerInterval);
            room.status = 'gameOver';
            
            // ✨ 結算排行：直接呼叫我們剛剛寫好的統一排行函式！
            const finalRanking = generateFinalRanking(room);
            
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
            // ✨ 核心修正：直接讀取遊戲已經進行的秒數！
            player.finishTime = room.gameState ? room.gameState.seconds : 0; 
            
            io.to(roomId).emit("chatMessage", { type: 'system', message: `🏳️ ${player.name} 已投降。` });
            broadcastFullPlayerState(io, room);
            
            const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
            if (allPlayersDone) {
                if (room.timerInterval) clearInterval(room.timerInterval);
                if (room.stormInterval) clearInterval(room.stormInterval);
            
                room.status = 'gameOver';
                const finalRanking = generateFinalRanking(room);
                io.to(roomId).emit('sudoku_gameOver', { finalRanking });
            }
        }
    });

    socket.on('sudoku_requestPause', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'playing' || room.isPaused) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (room.isSinglePlayer) {
            room.isPaused = true;
            room.pausedBy = socket.id;
            io.to(roomId).emit('sudoku_gamePaused', { requesterId: socket.id, playerName: player.name });
        } else {
            if (player.pauseUses > 0) {
                player.pauseUses--; 
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
            // ✨ 加上 resumerId，廣播給所有人「是誰解除暫停的」
            io.to(roomId).emit('sudoku_gameResumed', { resumerId: socket.id });
        }
    });

    // ✨ 處理玩家主動退出房間的邏輯
    socket.on("leaveRoom", ({ roomId }) => {
        const room = rooms[roomId];
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex > -1) {
                const playerName = room.players[playerIndex].name;
                // 1. 從房間名單中移除
                room.players.splice(playerIndex, 1);
                // 2. 離開 Socket 通訊群組
                socket.leave(roomId);
                
                // 3. 通知剩下的玩家
                io.to(roomId).emit("chatMessage", { type: 'system', message: `${playerName} 已退出房間。` });
                
                if (room.players.length === 0) {
                    // 如果沒人了，刪除房間
                    delete rooms[roomId];
                } else if (!room.players.some(p => p.isHost)) {
                    // 如果走的是房主，移交權限
                    room.players[0].isHost = true;
                    io.to(roomId).emit("chatMessage", { type: 'system', message: `${room.players[0].name} 已被提升為新房主。` });
                }
                
                // 4. 更新剩餘玩家的畫面
                if (rooms[roomId]) {
                    io.to(roomId).emit('updateRoomPlayers', { 
                        players: room.players.map(p => ({id: p.id, name: p.name, isHost: p.isHost})) 
                    });
                }
                io.emit("availableRoomsUpdate", getAvailableRoomsForDisplay());
            }
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

                if (room.status === 'playing' && !room.isSinglePlayer) {
                    disconnectedPlayer.status = 'reconnecting'; 
                    console.log(`[斷線保護] 玩家 ${disconnectedPlayer.name} (${socket.id}) 進入30秒重連等待期。`);

                    if (room.gameType.toUpperCase() === 'SUDOKU') {
                        broadcastFullPlayerState(io, room);
                    }

                    const timerId = setTimeout(() => {
                        if (gracefulDisconnects[disconnectedPlayer.id]) {
                            console.log(`[斷線保護] 玩家 ${disconnectedPlayer.name} 重連逾時，正式判定為離線。`);
                            disconnectedPlayer.status = 'disconnected';
                            disconnectedPlayer.finishTime = room.gameState ? room.gameState.seconds : 0;
                            io.to(roomId).emit("chatMessage", { type: 'system', message: `🔌 玩家 ${disconnectedPlayer.name} 已離線。` });
                            
                            if (room.gameType.toUpperCase() === 'SUDOKU') {
                                disconnectedPlayer.currentPuzzle = null;
                                broadcastFullPlayerState(io, room);
                                
                                const allPlayersDone = room.players.every(p => ['finished', 'surrendered', 'disconnected'].includes(p.status));
                                if (allPlayersDone) {
                                    if (room.stormInterval) clearInterval(room.stormInterval);
                                    if (room.timerInterval) clearInterval(room.timerInterval);
                                    room.status = 'gameOver';
                                    const finalRanking = generateFinalRanking(room);
                                    io.to(roomId).emit('sudoku_gameOver', { finalRanking });
                                }
                            } 
                            delete gracefulDisconnects[disconnectedPlayer.id];
                        }
                    }, 30000);

                    gracefulDisconnects[disconnectedPlayer.id] = { timer: timerId, roomId: roomId, socketId: socket.id };

                } else { 
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