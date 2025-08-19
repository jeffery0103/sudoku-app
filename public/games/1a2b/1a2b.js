function initializeGame(socket, initialState, showCustomAlert, showCustomConfirm) {
  console.log("--- 🕵️‍ 1A2B 遊戲初始化開始 ---");
  console.log("🕵️‍ [初始狀態 initialState]:", JSON.parse(JSON.stringify(initialState)));
  const { returnToLobby } = initialState;
  const alertToShow = (message) => showCustomAlert(message, '1A2B 遊戲提示');

  // --- 1. 元素獲取 ---
  const modeSelectionArea = document.getElementById("mode-selection-area");
  const playVsPlayerBtn = document.getElementById("play-vs-player-btn");
  const playVsComputerBtn = document.getElementById("play-vs-computer-btn");
  const returnToLobbyFromModeSelectBtn = document.getElementById("return-to-lobby-from-mode-select");
  const joinRequestOverlay = document.getElementById("join-request-overlay");

  const roomInfoDiv = document.getElementById("room-info");
  const mainGameContentDiv = document.getElementById("main-game-content");
  const gameOverScreen = document.getElementById("game-over-screen");
  const roomIdDisplay = document.getElementById("room-id-display");
  const roomStatusMessage = document.getElementById("room-status-message");
  const cancelRoomButton = document.getElementById("cancel-room-button");
  const setSecretAreaDiv = document.getElementById("set-secret-area");
  const secretNumberInput = document.getElementById("secret-number-input");
  const setSecretButton = document.getElementById("set-secret-button");
  const opponentGuessHistoryUl = document.getElementById("opponent-guess-history");
  const mySecretDisplayArea = document.getElementById("my-secret-display-area");
  const mySecretNumberIsSpan = document.getElementById("my-secret-number-is");
  const gameTurnTitle = document.getElementById("game-turn-title");
  const guessInput = document.getElementById("guess-input");
  const submitGuessButton = document.getElementById("submit-guess-button");
  const myGuessHistoryUl = document.getElementById("my-guess-history");
  const chatMessagesDiv = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendChatButton = document.getElementById("send-chat-button");
  const winnerMessage = document.getElementById("winner-message");
  const myFinalSecretReveal = document.getElementById("my-final-secret-reveal");
  const opponentFinalSecretReveal = document.getElementById("opponent-final-secret-reveal");
  const playAgainButton = document.getElementById("play-again-button");
  const returnToMenuButton = document.getElementById("return-to-menu-button");
  const rematchStatus = document.getElementById("rematch-status");
  const joinRequestsArea = document.getElementById("join-requests-area");
  const joinRequestsListUl = document.getElementById("join-requests-list");

  // --- 2. 遊戲狀態變數 ---
  const myPlayerId = socket.id;
  let currentRoomId = initialState.roomId || null;
  let myPlayerName = initialState.playerName;
  let iAmHost = initialState.isHost;
  console.log(`🕵️‍ [身分判斷] iAmHost 的值是: ${iAmHost} (類型: ${typeof iAmHost})`);
  let myOwnSecretNumber = null;
  const joinRequestTimers = {};

  // --- 3. UI 更新與輔助函式 ---
  function showGameScreen(screenName) {
    const screens = {
      mode: modeSelectionArea,
      room: roomInfoDiv,
      game: mainGameContentDiv,
      over: gameOverScreen,
    };
    Object.values(screens).forEach(screen => {
      if (screen) screen.classList.add("hidden");
    });
    if (screens[screenName]) {
      screens[screenName].classList.remove("hidden");
    }
  }

  function addGuessToHistory(guesserId, guesserName, guess, result) {
    const li = document.createElement("li");
    li.textContent = `${guesserName} 猜: ${guess} -> ${result}`;
    const targetUl = guesserId === myPlayerId ? myGuessHistoryUl : opponentGuessHistoryUl;
    if (guesserId === myPlayerId && guessInput) guessInput.value = "";
    if (targetUl) {
      targetUl.appendChild(li);
      targetUl.scrollTop = targetUl.scrollHeight;
    }
  }

  function appendChatMessage(senderName, message, isMe) {
    if (!chatMessagesDiv) return;
    const p = document.createElement("p");
    p.classList.add("chat-message", isMe ? "my-message" : "opponent-message");
    p.textContent = message;
    chatMessagesDiv.appendChild(p);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  }

  function addJoinRequestToUI(requesterId, playerName, timeout) {
    if (joinRequestOverlay) joinRequestOverlay.classList.remove("hidden");

    const li = document.createElement("li");
    li.id = `join-request-${requesterId}`;
    const textNode = document.createElement('span');
    textNode.textContent = `玩家 ${playerName} 請求加入`;
    li.appendChild(textNode);

    const timerSpan = document.createElement('span');
    timerSpan.className = 'countdown-timer';
    li.appendChild(timerSpan);
    if (timeout) {
      const endTime = Date.now() + timeout;
      const timerId = setInterval(() => {
        const remaining = Math.max(0, endTime - Date.now());
        const remainingSeconds = Math.round(remaining / 1000);
        timerSpan.textContent = `(剩餘 ${remainingSeconds} 秒)`;
        if (remaining === 0) clearInterval(timerId);
      }, 1000);
      joinRequestTimers[requesterId] = timerId;
    }

    const btnContainer = document.createElement("div");
    btnContainer.className = 'join-request-actions';
    ["accept", "reject"].forEach((action) => {
      const btn = document.createElement("button");
      btn.textContent = action === "accept" ? "同意" : "拒絕";
      btn.className = action === 'accept' ? 'accept-join-btn' : 'reject-join-btn';
      btn.onclick = () => {
        console.log(`🕵️‍ [房主端] 點擊了 ${action} 按鈕，請求者ID: ${requesterId}`);
        socket.emit("respondToJoinRequest", { requesterId, roomId: currentRoomId, action });
        removeJoinRequestFromUI(requesterId);
      };
      btnContainer.appendChild(btn);
    });
    li.appendChild(btnContainer);
    joinRequestsListUl.appendChild(li);
  }

  function removeJoinRequestFromUI(requesterId) {
    if (joinRequestTimers[requesterId]) {
      clearInterval(joinRequestTimers[requesterId]);
      delete joinRequestTimers[requesterId];
    }
    const requestLi = document.getElementById(`join-request-${requesterId}`);
    if (requestLi) requestLi.remove();
    
    if (joinRequestsListUl && !joinRequestsListUl.hasChildNodes()) {
      if (joinRequestOverlay) joinRequestOverlay.classList.add("hidden");
    }
  }

  // --- 4. Socket.IO 遊戲事件監聽 ---
  socket.on("roomCreated", (data) => {
    console.log("🕵️‍ [房主端] 收到 roomCreated 事件", data);
    currentRoomId = data.roomId;
    iAmHost = true;
    if (roomIdDisplay) roomIdDisplay.textContent = currentRoomId;

    if (data.isSinglePlayer) {
      // 單人模式邏輯不變
      if (roomStatusMessage) roomStatusMessage.textContent = "與電腦對戰，請設定您的祕密數字";
      showGameScreen("room");
      console.log("🕵️‍ [房主端] (單人模式) 準備就緒，通知伺服器 clientReadyForGameSetup");
      socket.emit("clientReadyForGameSetup", { roomId: currentRoomId });
    } else {
      // ⭐⭐ 修正點：多人模式下，房主也要回報「我準備好了」 ⭐⭐

      if (roomStatusMessage) roomStatusMessage.textContent = `房間已建立！等待另一位玩家加入...`;
      if (cancelRoomButton) cancelRoomButton.classList.remove("hidden");
      showGameScreen("room");
      // 加上這一行，讓伺服器知道房主已經就位！
      console.log("🕵️‍ [房主端] (單人模式) 準備就緒，通知伺服器 clientReadyForGameSetup");
      socket.emit("clientReadyForGameSetup", { roomId: currentRoomId }); 
    }
});

  socket.on("roomCancelledFeedback", () => {
    alertToShow("您已取消房間，即將返回大廳。").then(() => {
      if (typeof returnToLobby === "function") returnToLobby();
      else window.location.reload();
    });
  });

  socket.on("playerJoinRequest", (data) => {
    console.log("🕵️‍ [房主端] 收到玩家的加入請求", data);
    if (data.status) {
      removeJoinRequestFromUI(data.requesterId);
    } else if (iAmHost) {
      addJoinRequestToUI(data.requesterId, data.playerName, data.timeout);
    }
  });

  socket.on("promptSetSecret", (message) => {
    console.log("🕵️‍ [全員] 收到 promptSetSecret 事件！準備進入設定數字環節！");
    if (joinRequestOverlay) joinRequestOverlay.classList.add("hidden");
    showGameScreen("room");
    if (roomStatusMessage) roomStatusMessage.textContent = message;
    if (setSecretAreaDiv) setSecretAreaDiv.classList.remove("hidden");
    if (secretNumberInput) { secretNumberInput.value = ""; secretNumberInput.disabled = false; }
    if (setSecretButton) { setSecretButton.disabled = false; setSecretButton.textContent = "設定祕密數字並準備"; }
    if (cancelRoomButton) cancelRoomButton.classList.add("hidden");
  });

  socket.on("secretSet", (message) => {
    if (roomStatusMessage) roomStatusMessage.textContent = message;
  });

  socket.on("gameStart", (data) => {
    alertToShow("遊戲開始！");
    showGameScreen("game");
    if (gameTurnTitle) gameTurnTitle.textContent = data.turnPlayerId === myPlayerId ? "輪到你猜了！" : `輪到 ${data.turnPlayerName} 猜了！`;
    if (submitGuessButton) submitGuessButton.disabled = data.turnPlayerId !== myPlayerId;
    if (guessInput) {
      guessInput.disabled = false;
      if (data.turnPlayerId === myPlayerId) guessInput.focus();
    }
    if (chatInput) chatInput.disabled = false;
    if (sendChatButton) sendChatButton.disabled = false;
  });

  socket.on("turnChange", (data) => {
    if (gameTurnTitle) gameTurnTitle.textContent = data.turnPlayerId === myPlayerId ? "輪到你猜了！" : `輪到 ${data.turnPlayerName} 猜了！`;
    if (submitGuessButton) submitGuessButton.disabled = data.turnPlayerId !== myPlayerId;
    if (guessInput) {
      guessInput.disabled = data.turnPlayerId !== myPlayerId;
      if (data.turnPlayerId === myPlayerId) guessInput.focus();
    }
  });

  socket.on("guessResult", (data) => {
    if (data.error) {
      alertToShow(data.error);
      return;
    }
    addGuessToHistory(data.guesserId, data.guesserName, data.guess, data.result);
  });
  
  socket.on("gameOver", (data) => {
    showGameScreen("over");
    if (winnerMessage) {
      winnerMessage.textContent = data.isDraw ? data.message : `恭喜 ${data.winnerName} 獲勝！`;
      winnerMessage.style.color = '#78c850';
    }
    if (data.revealedSecrets) {
      if (myFinalSecretReveal) myFinalSecretReveal.textContent = `您的祕密數字：${data.revealedSecrets[myPlayerId] || '未設定'}`;
      const opponentId = Object.keys(data.revealedSecrets).find(id => id !== myPlayerId);
      if (opponentId && opponentFinalSecretReveal) {
        let opponentName = "對手";
        if (data.playersInfo && Array.isArray(data.playersInfo)) {
          const opponent = data.playersInfo.find(p => p.id === opponentId);
          if (opponent) opponentName = opponent.name;
        }
        opponentFinalSecretReveal.textContent = `${opponentName} 的祕密數字：${data.revealedSecrets[opponentId]}`;
      } else if (opponentFinalSecretReveal) {
        opponentFinalSecretReveal.textContent = '';
      }
    }
    if (playAgainButton) playAgainButton.disabled = false;
  });

  socket.on("opponentDisconnected", (data) => {
    showGameScreen("over");
    if (winnerMessage) {
      winnerMessage.textContent = data.message;
      winnerMessage.style.color = '#f08030';
    }
    if (myFinalSecretReveal && myOwnSecretNumber) myFinalSecretReveal.textContent = `您的祕密數字：${myOwnSecretNumber}`;
    if (opponentFinalSecretReveal) opponentFinalSecretReveal.textContent = `對手的祕密數字：${data.revealedSecret || '未設定'}`;
    if (playAgainButton) {
      playAgainButton.disabled = true;
      playAgainButton.textContent = "對手已離線";
    }
  });

  socket.on("chatMessage", (data) => {
    const isMe = data.senderId === myPlayerId;
    appendChatMessage(data.senderName, data.message, isMe);
  });

  socket.on("opponentRequestedRematch", (data) => {
    if (rematchStatus) {
      rematchStatus.textContent = `${data.opponentName} 請求再玩一局！`;
      rematchStatus.classList.remove("hidden");
    }
    if (playAgainButton) {
      playAgainButton.textContent = "同意再玩";
      playAgainButton.disabled = false;
    }
    if (returnToMenuButton) returnToMenuButton.textContent = "拒絕並返回";
  });

  socket.on("rematchWasDeclined", (data) => {
    if (rematchStatus) {
      rematchStatus.textContent = `對方 (${data.declinerName}) 已拒絕再玩並離開房間。`;
      rematchStatus.classList.remove("hidden");
    }
    if (playAgainButton) {
      playAgainButton.disabled = true;
      playAgainButton.textContent = "無法再玩";
    }
  });

  socket.on("rematchAcceptedAndNewGame", () => {
    alertToShow("雙方同意再玩一局！");
    myOwnSecretNumber = null;
    if (myGuessHistoryUl) myGuessHistoryUl.innerHTML = "";
    if (opponentGuessHistoryUl) opponentGuessHistoryUl.innerHTML = "";
    if (secretNumberInput) { secretNumberInput.value = ""; secretNumberInput.disabled = false; }
    if (guessInput) guessInput.value = "";
    if (setSecretButton) { setSecretButton.disabled = false; setSecretButton.textContent = "設定祕密數字並準備"; }
    if (playAgainButton) { playAgainButton.disabled = false; playAgainButton.textContent = "再玩一局"; }
    if (returnToMenuButton) returnToMenuButton.textContent = "返回主選單";
    if (rematchStatus) rematchStatus.classList.add("hidden");
    if (mySecretDisplayArea) mySecretDisplayArea.classList.add("hidden");
    showGameScreen("room");
    if (roomStatusMessage) roomStatusMessage.textContent = "請重新設定您的祕密數字";
    if (setSecretAreaDiv) setSecretAreaDiv.classList.remove("hidden");
  });

  socket.on("finalTurn", (data) => {
    alertToShow(data.message);
    if (gameTurnTitle) gameTurnTitle.textContent = data.turnPlayerId === myPlayerId ? "輪到你猜了！" : `輪到 ${data.turnPlayerName} 猜了！`;
    if (submitGuessButton) submitGuessButton.disabled = data.turnPlayerId !== myPlayerId;
  });

  // --- 5. 遊戲內按鈕事件綁定 ---
  if (playVsPlayerBtn) playVsPlayerBtn.addEventListener("click", () => socket.emit("createRoom", { playerName: myPlayerName, gameType: '1a2b', isSinglePlayer: false }));
  if (playVsComputerBtn) playVsComputerBtn.addEventListener("click", () => socket.emit("createRoom", { playerName: myPlayerName, gameType: '1a2b', isSinglePlayer: true }));
  if (returnToLobbyFromModeSelectBtn) returnToLobbyFromModeSelectBtn.addEventListener("click", () => { if (typeof returnToLobby === "function") returnToLobby(); });
  
  if (setSecretButton)
    setSecretButton.addEventListener("click", () => {
      const secret = secretNumberInput.value;
      const isValid = /^\d{4}$/.test(secret) && new Set(secret).size === 4;
      if (isValid) {
        myOwnSecretNumber = secret;
        socket.emit("setSecretAndReady", { roomId: currentRoomId, secretNumber: secret });
        secretNumberInput.disabled = true;
        setSecretButton.disabled = true;
        setSecretButton.textContent = "✅ 已準備 (等待對手)";
        if (mySecretDisplayArea && mySecretNumberIsSpan) {
          mySecretDisplayArea.classList.remove("hidden");
          mySecretNumberIsSpan.textContent = myOwnSecretNumber;
        }
      } else {
        secretNumberInput.classList.add('input-error');
        setTimeout(() => secretNumberInput.classList.remove('input-error'), 500);
      }
    });

  if (submitGuessButton)
    submitGuessButton.addEventListener("click", () => {
      const guess = guessInput.value;
      const isValid = /^\d{4}$/.test(guess) && new Set(guess).size === 4;
      if (isValid) {
        socket.emit("submitGuess", { roomId: currentRoomId, guess });
      } else {
        guessInput.classList.add('input-error');
        setTimeout(() => guessInput.classList.remove('input-error'), 500);
      }
    });

  if (cancelRoomButton)
    cancelRoomButton.addEventListener("click", () => {
      if (currentRoomId && iAmHost) {
        socket.emit("cancelRoom", currentRoomId);
      }
    });

  if (sendChatButton)
    sendChatButton.addEventListener("click", () => {
      const msg = chatInput.value.trim();
      if (msg) {
        socket.emit("sendChatMessage", { roomId: currentRoomId, message: msg });
        chatInput.value = "";
      }
    });

  if (playAgainButton)
    playAgainButton.addEventListener("click", () => {
      if (currentRoomId) {
        socket.emit("requestRematch", { roomId: currentRoomId });
        playAgainButton.disabled = true;
        rematchStatus.textContent = "已發送再玩請求...";
        rematchStatus.classList.remove("hidden");
      }
    });

  if (returnToMenuButton)
    returnToMenuButton.addEventListener("click", () => {
      socket.emit("leaveRoomAfterGame", { roomId: currentRoomId });
      if (typeof returnToLobby === "function") returnToLobby();
      else window.location.reload();
    });

  [secretNumberInput, guessInput, chatInput].forEach((input) => {
    if (input)
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && e.target.nextElementSibling && !e.target.nextElementSibling.disabled)
          e.target.nextElementSibling.click();
      });
  });

  // --- 6. 初始化函式入口 ---
  function initialize() {
    // 狀況一：我是「加入房間的人」(isHost 會是 false)
    if (iAmHost === false) {
      console.log("偵測到是加入者，直接進入等待畫面。");
      console.log("🕵️‍ [流程判斷] 判斷為「加入方」，準備直接顯示房間畫面...");
      if (roomStatusMessage) roomStatusMessage.textContent = `您已加入房間！等待遊戲開始...`;
      if(roomIdDisplay) roomIdDisplay.textContent = currentRoomId;
      showGameScreen("room");
      console.log("🕵️‍ [加入方] 已顯示房間畫面，通知伺服器 clientReadyForGameSetup");
      socket.emit("clientReadyForGameSetup", { roomId: currentRoomId });
      return;
    }
    // 狀況二：我是「房主」，但還沒建立房間
    console.log("🕵️‍ [流程判斷] 判斷為「房主」，準備顯示模式選擇畫面...");
    showGameScreen("mode");
  }

  initialize();
}