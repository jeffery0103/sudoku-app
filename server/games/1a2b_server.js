function calculateResult(guess, secret) {
  let A = 0, B = 0;
  const sArr = secret.split(""), gArr = guess.split("");
  for (let i = 0; i < 4; i++) {
    if (gArr[i] === sArr[i]) {
      A++;
      sArr[i] = gArr[i] = null;
    }
  }
  for (const digit of gArr) {
    if (digit && sArr.includes(digit)) {
      B++;
      sArr[sArr.indexOf(digit)] = null;
    }
  }
  return `${A}A${B}B`;
}

function handleSetSecret(io, socket, room, secretNumber) {
  const player = room.players.find((p) => p.id === socket.id);
  if (!player || !room.gameState) return;

  room.gameState.secrets[socket.id] = secretNumber;
  player.isReady = true;

  socket.emit("secretSet", "您的數字已設定，等待對手...");

  const allPlayersReady = room.players.every((p) => p.isReady);

  if (allPlayersReady) {
    room.status = "playing";
    console.log(`[遊戲開始] 1A2B 房間 ${room.id}`);

    const turnPlayer = room.players[Math.floor(Math.random() * 2)];
    room.gameState.firstPlayerId = turnPlayer.id;
    room.gameState.turnPlayerId = turnPlayer.id;

    io.to(room.id).emit("gameStart", {
      turnPlayerId: turnPlayer.id,
      turnPlayerName: turnPlayer.name,
    });
  }
}

function handleSubmitGuess(io, socket, room, guess) {
  if (
    (room.status !== "playing" && room.status !== "lastTurn") ||
    !room.gameState ||
    socket.id !== room.gameState.turnPlayerId
  )
    return;

  const currentPlayer = room.players.find((p) => p.id === socket.id);
  const opponent = room.players.find((p) => p.id !== socket.id);
  const result = calculateResult(guess, room.gameState.secrets[opponent.id]);

  io.to(room.id).emit("guessResult", {
    guesserId: socket.id,
    guesserName: currentPlayer.name,
    guess,
    result,
  });

  const revealedSecrets = room.gameState.secrets;

  if (result !== "4A0B") {
    if (room.status === "lastTurn") {
      const winner = room.players.find(
        (p) => p.id === room.gameState.firstPlayerId
      );
      room.status = "gameOver";
      io.to(room.id).emit("gameOver", {
        winnerName: winner.name,
        revealedSecrets,
        playersInfo: room.players,
      });
    } else {
      room.gameState.turnPlayerId = opponent.id;
      io.to(room.id).emit("turnChange", {
        turnPlayerId: opponent.id,
        turnPlayerName: opponent.name,
      });
    }
  } else {
    if (room.status === "lastTurn") {
      room.status = "gameOver";
      io.to(room.id).emit("gameOver", {
        isDraw: true,
        message: "雙方都猜對了，本局平手！",
        revealedSecrets,
        playersInfo: room.players,
      });
    } else if (socket.id !== room.gameState.firstPlayerId) {
      room.status = "gameOver";
      io.to(room.id).emit("gameOver", {
        winnerName: currentPlayer.name,
        revealedSecrets,
        playersInfo: room.players,
      });
    } else {
      room.status = "lastTurn";
      room.gameState.turnPlayerId = opponent.id;
      io.to(room.id).emit("finalTurn", {
        message: `${currentPlayer.name} 已猜中答案！輪到 ${opponent.name} 的最後一回合！`,
        turnPlayerId: opponent.id,
        turnPlayerName: opponent.name,
      });
    }
  }
}

// ✨ 新增 #1：處理「遊戲準備好要開始」的函式 ✨
function handleGameSetup(io, room) {
    console.log(`[1A2B] 房間 ${room.id} 玩家皆已準備，提示設定祕密數字。`);
    
    // 初始化 1A2B 遊戲需要的 gameState
    room.gameState = { secrets: {}, guessHistory: [] };
    room.status = "settingSecrets"; // 設定一個新狀態，表示正在設定祕密數字

    // 執行原本在主伺服器中的 1A2B 專屬邏輯
    io.to(room.id).emit(
        "promptSetSecret",
        "雙方玩家已到齊！請設定您的祕密數字。"
    );
}

// ✨ 新增 #2：處理「玩家斷線」的函式 ✨
function handleDisconnect(io, room, disconnectedPlayer) {
  // 如果房間內還有其他玩家，就通知他
  if (room.players.length >= 2) { // 確保房間裡至少還有兩個人（斷線者和留存者）
    const remainingPlayer = room.players.find(
      (p) => p.id !== disconnectedPlayer.id
    );
    if (remainingPlayer && io.sockets.sockets.get(remainingPlayer.id)) {
      // 檢查斷線玩家是否已設定祕密數字
      const revealedSecret =
        room.gameState &&
        room.gameState.secrets &&
        room.gameState.secrets[disconnectedPlayer.id]
          ? room.gameState.secrets[disconnectedPlayer.id]
          : null;

      // 發送帶有詳細資訊的事件給留下的玩家
      io.to(remainingPlayer.id).emit("opponentDisconnected", {
        message: `對手 ${disconnectedPlayer.name} 已離線，遊戲結束。`,
        revealedSecret: revealedSecret,
      });
    }
  }
}

// ✨ 新增 #3：處理「再玩一局」的函式 ✨
function handleRematch(io, room) {
    console.log(`[1A2B] 房間 ${room.id} 同意再玩一局，重置遊戲。`);

    // 重置房間狀態
    room.status = "settingSecrets";
    room.players.forEach((p) => {
        p.isReady = false;
        p.wantsRematch = false;
    });
    
    // 重置 1A2B 遊戲狀態
    room.gameState = { secrets: {}, guessHistory: [] };

    // 通知客戶端，遊戲已重置
    io.to(room.id).emit("rematchAcceptedAndNewGame");
}

// ✨ 修正 #4：確保所有新增的函式都被正確地匯出 ✨
module.exports = {
  handleSetSecret,
  handleSubmitGuess,
  handleDisconnect,
  handleGameSetup,
  handleRematch,
};