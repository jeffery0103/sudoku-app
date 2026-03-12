// ======================================================
// Sudoku 遊戲主腳本 (最終完整版 - 無省略)
// ======================================================
function initializeGame(
  socket, // 我們直接使用這個傳進來的 socket，不再需要全域變數
  initialState,
  showCustomAlert,
  showCustomConfirm
) {
  console.log("initializeGame function started.");

  // ======================================================
  // --- 1. 變數宣告區 ---
  // ======================================================
  let boardElement,
    timerValueElement,
    paletteElement,
    pencilToggleCheckbox,
    highlightHelperCheckbox,
    winModalOverlay,
    winModalNewGameBtn,
    sudokuModeModalOverlay,
    singlePlayerBtn,
    multiplayerBtn,
    difficultyModalOverlay,
    difficultyButtons,
    appContainer,
    validateBtn,
    hintBtn,
    pauseBtn,
    controlsWrapper,
    solutionView,
    solutionBoard,
    infoHintCount,
    infoValidateCount,
    progressBarFill,
    progressPercentage,
    difficultyDisplay,
    helpersDisplay,
    gameMenuBtn,
    gameMenuModalOverlay,
    menuResumeBtn,
    menuRestartBtn,
    menuNewGameBtn,
    sudokuJoinRequestsArea,
    sudokuJoinRequestsList,
    inGameControls,
    multiplayerWaitingPanel,
    chatMessages,
    chatInput,
    chatSendBtn,
    singlePlayerInfoPanel, 
    multiplayerInfoPanel, 
    opponentProgressContainer,
    inGameChatMessages, 
    inGameChatInput, 
    inGameChatSendBtn,
    multiplayerGameInfoContent,
    playerNameDisplay,
    infoPanelTitle;
    
    let multiplayerJoinModalOverlay, roomIdInput, joinRoomBtn, createMultiplayerRoomBtn, cancelMultiplayerBtn;

  let selectedCell = null,
    puzzle = [],
    isFirstPencilMarkMade = false,
    currentlySpectatingId = null,
    iHaveFinished = false,
    initialPuzzle = [],
    currentGameId = null,
    hintCount = 3,
    validateCount = 5,
    timerInterval = null,
    seconds = 0,
    isTimerRunning = false,
    isPaused = false,
    isInSolutionView = false,
    iHaveSurrendered = false,
    lastSelectedCoords = null,
    gameMode = null,
    isModalOpen = false,
    myCurrentStatus = 'playing',
    unreadChatMessages = 0,
    unreadInGameMessages = 0,
    inGameChatNotificationBadge,
    isTimerStartedByFirstMove = false,
    undoBtn,
    puzzleHoles = 0,
    opponentStates = [],
    chatNotificationBadge;

  let lotteryHasBeenTriggered = false;
  let currentLotteryResult = null;
  let lotteryTimeoutId = null;
  let history = []; // 用於儲存所有歷史狀態快照
  let historyIndex = -1;
  let iAmHost = initialState.isHost || false;
  const myPlayerName = initialState.playerName;
  
  
  // ✨【核心修正 1】改為 let，並優先讀取 socket.id，保證身分與伺服器完全吻合
  let myPlayerId = socket.id || initialState.playerId; 
  
  // ✨ 終極防護：全場唯一的連線監聽器 (結合初始化與雙重斷線重連)
  socket.on('connect', () => {
      console.log('[斷線保護] Socket 連線成功！正在檢查連線狀態...');
      
      // ✨ 客觀防呆 1：每次連線成功，都要確保拿到最新的身分證字號
      const newSocketId = socket.id; 
      
      // ✨ 客觀防呆 2：雙重防護機制 (App閃斷 vs 電腦F5)
      // 在 App 裡變數還活著就用 currentGameId，如果網頁重整過就去 sessionStorage 拿
      const reconnectGameId = currentGameId || sessionStorage.getItem('sudoku_reconnect_gameId');
      const oldPlayerId = sessionStorage.getItem('sudoku_reconnect_playerId');

      if (reconnectGameId && oldPlayerId) {
          console.log(`[斷線保護] 發現舊的遊戲紀錄，向伺服器申請重連至房間 ${reconnectGameId}...`);
          
          // ✨ 關鍵動作：拿著舊的 ID 去跟伺服器相認，並告訴它我們的新 Socket ID
          socket.emit('playerReconnected', {
              roomId: reconnectGameId,
              playerId: oldPlayerId,     // 讓伺服器知道「我是誰」
              newSocketId: newSocketId,  // 讓伺服器更新「要傳訊息給哪個新連線」
              gameType: 'sudoku'
          });
      } else {
          // 如果沒有紀錄，代表是第一次載入遊戲，正常賦予 ID 即可
          myPlayerId = newSocketId;
          if (!currentViewedPlayerId) currentViewedPlayerId = myPlayerId;
      }
  });

  let loadingAnimationTimeout = null;
  let gameSettings = {
    difficulty: "medium",
    allowConflictHighlight: false,
    allowNumberHighlight: true,
    allowNumberCounter: true,
  };
  
  let pencilMarksData = Array(9)
    .fill()
    .map(() =>
      Array(9)
        .fill()
        .map(() => new Set())
    );
  const joinRequestTimers = {};
  let currentViewedPlayerId = myPlayerId; // 新增變數來追蹤目前觀看的是誰的棋盤

  if (typeof require !== 'undefined' && require('electron')) {
    socket.emit('client-identity', 'electron-app');
  }

  // ======================================================
  // --- 2. 輔助函式定義區 ---
  // ======================================================
function isBoardFull() {
    if (!puzzle || puzzle.length !== 9) return false;
    for (let i = 0; i < 9; i++) {
      if (!puzzle[i] || puzzle[i].length !== 9) return false;
      for (let j = 0; j < 9; j++) {
        if (puzzle[i][j].value === 0 || puzzle[i][j].value === null) {
          return false;
        }
      }
    }
    return true;
  }

  function isBoardCorrect(board, solution) {
    if (!board || !solution) return false;
    const flatBoardValues = board.flat().map(cell => cell.value);
    const flatSolutionValues = solution.flat();
    return JSON.stringify(flatBoardValues) === JSON.stringify(flatSolutionValues);
  }

  function setUIState(state) {
    if (!inGameControls) inGameControls = document.getElementById('in-game-controls');
    if (!multiplayerWaitingPanel) multiplayerWaitingPanel = document.getElementById('multiplayer-waiting-panel');
    
    // 1. 先把所有面板隱藏
    inGameControls?.classList.add('hidden');
    multiplayerWaitingPanel?.classList.add('hidden');
    if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.add('hidden');
    if (multiplayerInfoPanel) multiplayerInfoPanel.classList.add('hidden');

    // 2. 暴力重置大頭貼：預設一律隱藏，壓制所有 CSS 權重
    const mobileFloatingChatBtn = document.getElementById('mobile-floating-chat-btn');
    if (mobileFloatingChatBtn) {
      mobileFloatingChatBtn.style.setProperty('display', 'none', 'important');
    }

    // 3. 根據狀態顯示對應內容
    if (state === 'waiting_multiplayer') {
      multiplayerWaitingPanel?.classList.remove('hidden');
    } else if (state === 'playing_single') {
      inGameControls?.classList.remove('hidden');
      singlePlayerInfoPanel?.classList.remove('hidden');
    } else if (state === 'playing_multiplayer') {
      inGameControls?.classList.remove('hidden');
      multiplayerInfoPanel?.classList.remove('hidden');
      // ✨ 只有在「多人遊戲進行中」才顯示大頭貼
      if (mobileFloatingChatBtn) {
        mobileFloatingChatBtn.style.setProperty('display', 'flex', 'important');
      }
    } else if (state === 'gameOver_multiplayer') {
      inGameControls?.classList.remove('hidden');
      multiplayerInfoPanel?.classList.remove('hidden');
      // 結算畫面自動隱藏大頭貼，確保不遮擋排行榜
    }
    
    // 4. 更新選單按鈕文字與顯示邏輯
    const isMultiplayerPlaying = (state === 'playing_multiplayer');
    const isMultiplayerGameOver = (state === 'gameOver_multiplayer');

    if (menuRestartBtn) {
      if (isMultiplayerGameOver) {
        menuRestartBtn.textContent = "返回大廳";
      } else {
        menuRestartBtn.textContent = isMultiplayerPlaying ? "投降" : "重新開始本局";
      }
    }
    if (menuNewGameBtn) {
      menuNewGameBtn.style.display = (isMultiplayerPlaying || isMultiplayerGameOver) ? 'none' : 'block';
    }
  }

  function initializeTabs() {
    const tabButtons = document.querySelectorAll("#multiplayer-waiting-panel .tab-button");
    const tabContents = document.querySelectorAll("#multiplayer-waiting-panel .tab-content");
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.tab === "lobby-chat") {
          unreadChatMessages = 0;
          updateChatBadge();
        }
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));
        button.classList.add("active");
        const targetContent = document.getElementById(`tab-content-${button.dataset.tab}`);
        if (targetContent) targetContent.classList.add("active");
      });
    });
  }

  function initializeInGameTabs() {
    const tabButtons = document.querySelectorAll('.in-game-tab-button');
    const tabContents = document.querySelectorAll('.in-game-tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.tab === 'ingame-chat') {
          unreadInGameMessages = 0;
          updateInGameChatBadge();
        }
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const targetContentId = `tab-content-${button.dataset.tab}`;
        const targetContent = document.getElementById(targetContentId);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  function addJoinRequestToUI(requesterId, playerName, timeout) {
    if (!sudokuJoinRequestsArea || !sudokuJoinRequestsList) return;
    sudokuJoinRequestsArea.classList.remove("hidden");
    const li = document.createElement("li");
    li.id = `join-request-${requesterId}`;
    const textNode = document.createElement("span");
    textNode.textContent = `玩家 ${playerName} 請求加入`;
    li.appendChild(textNode);
    const timerSpan = document.createElement("span");
    timerSpan.className = "countdown-timer";
    li.appendChild(timerSpan);
    if (timeout) {
      const endTime = Date.now() + timeout;
      const updateTimer = () => {
        const remaining = Math.max(0, endTime - Date.now());
        const remainingSeconds = Math.round(remaining / 1000);
        timerSpan.textContent = `(剩餘 ${remainingSeconds} 秒)`;
        if (remaining === 0) {
          clearInterval(joinRequestTimers[requesterId]);
          removeJoinRequestFromUI(requesterId);
        }
      };
      joinRequestTimers[requesterId] = setInterval(updateTimer, 1000);
      updateTimer();
    }
    const btnContainer = document.createElement("div");
    btnContainer.className = "join-request-actions";
    ["accept", "reject"].forEach((action) => {
      const btn = document.createElement("button");
      btn.textContent = action === "accept" ? "同意" : "拒絕";
      btn.className = action === "accept" ? "accept-join-btn" : "reject-join-btn";
      btn.onclick = () => {
        socket.emit("respondToJoinRequest", {
          requesterId,
          roomId: currentGameId,
          action,
        });
        removeJoinRequestFromUI(requesterId);
      };
      btnContainer.appendChild(btn);
    });
    li.appendChild(btnContainer);
    sudokuJoinRequestsList.appendChild(li);
  }

  function removeJoinRequestFromUI(requesterId) {
    if (joinRequestTimers[requesterId]) {
      clearInterval(joinRequestTimers[requesterId]);
      delete joinRequestTimers[requesterId];
    }
    document.getElementById(`join-request-${requesterId}`)?.remove();
    if (sudokuJoinRequestsList && sudokuJoinRequestsList.children.length === 0) {
      sudokuJoinRequestsArea.classList.add("hidden");
    }
  }

  function updatePlayerListUI(players) {
    const playerListContainer = document.querySelector("#multiplayer-waiting-panel .player-list-container");
    if (!playerListContainer || !players || !myPlayerId) return;

    const wasHost = iAmHost; 
    const meInNewList = players.find((p) => p.id === myPlayerId);
    iAmHost = meInNewList ? meInNewList.isHost : false;

    const waitingPanel = document.getElementById('multiplayer-waiting-panel');
    const isLobby = waitingPanel && !waitingPanel.classList.contains('hidden');
    
    if (!wasHost && iAmHost && currentGameId && isLobby) {
        showWaitingScreen(currentGameId);
    }

    // ✨ 計算目前「真正準備好」的玩家人數 (如果伺服器沒傳 isReady，就寬容當作 true)
    const readyPlayersCount = players.filter(p => p.isReady !== false).length;

    const startGameBtn = document.getElementById("sudoku-start-game-btn");
    if (startGameBtn) {
      if (iAmHost) {
        startGameBtn.classList.remove("hidden");
        // 必須大於等於2個「已就緒」的人才能按
        startGameBtn.disabled = readyPlayersCount < 2; 
      } else {
        startGameBtn.classList.add("hidden");
      }
    }

    const boardStartBtn = document.getElementById("board-start-game-btn");
    if (boardStartBtn) {
        if (readyPlayersCount < 2) {
            boardStartBtn.disabled = true;
            boardStartBtn.style.backgroundColor = "#95a5a6"; // 灰色
            boardStartBtn.style.borderColor = "#7f8c8d";
            boardStartBtn.style.cursor = "not-allowed";
            boardStartBtn.textContent = "等待對手確認...";
        } else {
            boardStartBtn.disabled = false;
            boardStartBtn.style.backgroundColor = "#aa8b19"; // 恢復大地色
            boardStartBtn.style.borderColor = "#aa8b19";
            boardStartBtn.style.cursor = "pointer";
            boardStartBtn.textContent = "開始遊戲";
        }
    }

    playerListContainer.innerHTML = "";
    let host = null;
    let challengers = [];
    players.forEach((player) => {
      if (player.isHost) host = player;
      else challengers.push(player);
    });
    const sortedPlayers = [];
    if (host) sortedPlayers.push(host);
    sortedPlayers.push(...challengers);

    sortedPlayers.forEach((player) => {
      const playerItem = document.createElement("div");
      playerItem.className = "player-list-item";
      const playerNameSpan = document.createElement("span");
      playerNameSpan.textContent = player.name + (player.id === myPlayerId ? " (你)" : "");
      
      const playerStatusSpan = document.createElement("span");
      playerStatusSpan.className = "player-status";
      
      // ✨ 根據 isReady 狀態給予房主明確的視覺回饋
      let statusText = player.isHost ? "(房主)" : "(挑戰者)";
      if (player.isReady === false) {
          statusText += " - ⏳ 考慮中...";
          playerStatusSpan.style.color = "#e67e22"; // 橘黃色警告
      } else {
          statusText += " - ✅ 已就緒";
          playerStatusSpan.style.color = "#27ae60"; // 綠色通行
      }
      
      playerStatusSpan.textContent = statusText;
      playerItem.appendChild(playerNameSpan);
      playerItem.appendChild(playerStatusSpan);
      playerListContainer.appendChild(playerItem);
    });
  }

  function resetControlPanel() {
    if (gameMode === 'single') {
      if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.remove('hidden');
      if (multiplayerInfoPanel) multiplayerInfoPanel.classList.add('hidden');
    } else { // multiplayer
      if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.add('hidden');
      if (multiplayerInfoPanel) multiplayerInfoPanel.classList.remove('hidden');
    }

    if (difficultyDisplay) difficultyDisplay.textContent = '生成中...';
    if (helpersDisplay) helpersDisplay.textContent = '-';
    if (infoHintCount) infoHintCount.textContent = '-';
    if (infoValidateCount) infoValidateCount.textContent = '-';
    if (progressBarFill) progressBarFill.style.width = '0%';
    if (progressPercentage) progressPercentage.textContent = '0%';
    if (opponentProgressContainer) opponentProgressContainer.innerHTML = '';
  }

  function resetUIForNewGame() {
    if (winModalOverlay) winModalOverlay.classList.add("hidden");
    console.log('[流程] 正在重置 UI 以準備新遊戲...');
    hideWaitingScreen();
    resetTimer();
    history = [];
    historyIndex = -1;
    iHaveFinished = false;
    iHaveSurrendered = false;
    selectedCell = null;
    lastSelectedCoords = null;
    currentViewedPlayerId = myPlayerId;
    currentlySpectatingId = null;

    restorePlayerView(); 

    // ✨ 核心修復 1：強制重置聊天大頭貼與對話紀錄
    const mobileFloatingChatBtn = document.getElementById('mobile-floating-chat-btn');
    if (mobileFloatingChatBtn) {
      mobileFloatingChatBtn.style.setProperty('display', 'none', 'important');
    }
    const inGameChatTabContent = document.getElementById('tab-content-ingame-chat');
    if (inGameChatTabContent) {
      inGameChatTabContent.classList.remove('show-floating');
    }
    const badge = document.getElementById('mobile-chat-badge');
    if (badge) {
      badge.textContent = '0';
      badge.style.setProperty('display', 'none', 'important');
    }
    
    // --- 原本就有的：清空遊戲內聊天 ---
    unreadInGameMessages = 0;
    if (inGameChatNotificationBadge) inGameChatNotificationBadge.classList.add('hidden');
    if (inGameChatMessages) inGameChatMessages.innerHTML = ''; 

    // ▼▼▼ ✨ 補上這段：強制清空大廳等待室的聊天紀錄與紅點 ▼▼▼
    unreadChatMessages = 0;
    if (chatNotificationBadge) chatNotificationBadge.classList.add('hidden');
    if (chatMessages) chatMessages.innerHTML = '';
    // ▲▲▲ 補上這段結束 ▲▲▲

    if (boardElement) {
      boardElement.innerHTML = '';
      boardElement.classList.remove("is-loading");
    }
    clearAllHighlights();
    clearAllErrors();

    if (inGameControls) inGameControls.classList.add('hidden');
    if (solutionView) solutionView.classList.add('hidden');
    if (progressBarFill) progressBarFill.style.width = "0%";
    if (progressPercentage) progressPercentage.textContent = "0%";
    if (difficultyDisplay) difficultyDisplay.textContent = "-";
    if (helpersDisplay) helpersDisplay.textContent = "-";
    if (infoHintCount) infoHintCount.textContent = "0";
    if (infoValidateCount) infoValidateCount.textContent = "0";
    if (opponentProgressContainer) opponentProgressContainer.innerHTML = '';
    if (multiplayerGameInfoContent) multiplayerGameInfoContent.innerHTML = '';

    updateUndoButtonState();
    updateRedoButtonState();
    updatePauseButtonState();
  }

  function showWaitingScreen(roomIdOrText) {
    setUIState("waiting_multiplayer");
    if (appContainer) appContainer.classList.remove("hidden");

    if (boardElement) {
      boardElement.classList.remove("hidden");
      
      // ✨ 關鍵修改 1：加上這行，強制棋盤變成彈性佈局，解除 9x9 網格封印
      boardElement.classList.add("is-loading"); 

      // ✨ 關鍵修改 2：在下方 div 的 style 中，加上了 grid-column: 1 / -1; grid-row: 1 / -1; 確保填滿空間
      let waitingHtml = `
        <div class="board-waiting-screen" style="position: relative; width: 100%; height: 100%; background-color: #faf8f5; box-sizing: border-box; grid-column: 1 / -1; grid-row: 1 / -1;">

          <h2 style="position: absolute; top: 15%; left: 0; width: 100%; margin: 0; color: #2c3e50; font-weight: bold; font-size: clamp(1.2rem, 4vw, 1.5rem); text-align: center;">
            等待其他玩家加入
          </h2>

          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%;">
            ${(roomIdOrText && roomIdOrText.length <= 6 && !roomIdOrText.includes("正在")) 
              ? `<h1 style="font-size: clamp(3rem, 12vw, 4.5rem); letter-spacing: 5px; color: #e74c3c; margin: 0; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); line-height: 1;">${roomIdOrText}</h1>` 
              : `<p style="font-size: 1.2em; color: #555; margin: 0; font-weight: bold;">${roomIdOrText || "請稍候..."}</p>`}
          </div>

          <div id="board-action-area" style="position: absolute; bottom: 15%; left: 0; width: 100%; display: flex; justify-content: center; padding: 0 15px; box-sizing: border-box;">
            ${iAmHost ? `
              <button id="board-start-game-btn" disabled style="padding: 12px 0; width: 80%; max-width: 250px; font-size: clamp(1rem, 3vw, 1.1rem); font-weight: bold; background-color: #95a5a6; color: white; border: none; border-radius: 10px; cursor: not-allowed; transition: all 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  等待對手加入...
              </button>
            ` : `
              <p style="font-size: clamp(1rem, 3vw, 1.1rem); color: #7f8c8d; font-weight: bold; margin: 0; text-align: center;">等待房主開始遊戲...</p>
            `}
          </div>

        </div>
      `;
      boardElement.innerHTML = waitingHtml;

      const boardStartBtn = document.getElementById("board-start-game-btn");
      if (boardStartBtn) {
        boardStartBtn.addEventListener("mouseover", () => {
             if(!boardStartBtn.disabled) boardStartBtn.style.backgroundColor = "#c4ac57";
        });
        boardStartBtn.addEventListener("mouseout", () => {
             if(!boardStartBtn.disabled) boardStartBtn.style.backgroundColor = "#aa8b19";
        });
        boardStartBtn.addEventListener("mousedown", () => boardStartBtn.style.transform = "scale(0.95)");
        boardStartBtn.addEventListener("mouseup", () => boardStartBtn.style.transform = "scale(1)");
        
        boardStartBtn.addEventListener("click", async () => {
          const userConfirmed = await showCustomConfirm("開始遊戲？開始後無法再加入新玩家", "確認開始");
          if (userConfirmed) {
            if (appContainer) appContainer.classList.add("hidden"); 
            if (difficultyModalOverlay) difficultyModalOverlay.classList.remove("hidden");
          }
        });
      }
    }

    const waitingView = document.getElementById("waiting-view");
    if (waitingView) waitingView.classList.add("hidden");
  }

  function hideWaitingScreen() {
    if (waitingView) waitingView.classList.add("hidden");
    if (multiplayerWaitingPanel) multiplayerWaitingPanel.classList.add('hidden');
    if (boardElement) boardElement.classList.remove("hidden");
  }

  async function pauseGame(isAutoPause = false) {
    if (isPaused || (pauseBtn && pauseBtn.disabled)) return;

    let userConfirmed = true; 

    if (!isAutoPause) {
      const message = (gameMode === 'single') 
        ? "您確定要暫停遊戲嗎？"
        : "您確定要使用本局唯一的一次暫停機會嗎？<br>所有玩家的遊戲都將會暫停。";
      
      userConfirmed = await showCustomConfirm(message, "確認暫停");
    }

    if (userConfirmed) {
      socket.emit("sudoku_requestPause", { roomId: currentGameId });
    }
  }

  function resumeGame() {
    if (!isPaused) return;
    socket.emit('sudoku_resumeGame', { roomId: currentGameId });
  }

  function resetTimer() {
    stopTimer();
    seconds = 0;
    if (timerValueElement) {
      timerValueElement.textContent = "00:00:00";
    }
  }

  function stopTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
  }

  function recordHistoryState(coords) {
    const currentState = {
        puzzle: JSON.parse(JSON.stringify(puzzle)),
        pencilMarks: pencilMarksData.map(row => row.map(cellSet => new Set(cellSet)))
    };

    const historyEntry = {
        state: currentState,
        actionCoords: coords
    };

    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(historyEntry);
    historyIndex++;

    updateUndoButtonState();
    updateRedoButtonState();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    loadStateFromHistory();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    loadStateFromHistory();
  }

  function loadStateFromHistory() {
    const historyEntry = history[historyIndex];
    if (!historyEntry) return;

    const stateToLoad = historyEntry.state;
    if (!stateToLoad) return;

    puzzle = JSON.parse(JSON.stringify(stateToLoad.puzzle));
    pencilMarksData = stateToLoad.pencilMarks.map(row => row.map(cellSet => new Set(cellSet)));

    drawBoard();
    updateProgress();
    updateNumberCounter();
    updateUndoButtonState();
    updateRedoButtonState();

    const coords = historyEntry.actionCoords;
    if (coords && typeof coords.row !== 'undefined' && typeof coords.col !== 'undefined') {
        const cellToSelect = document.querySelector(`.cell[data-row='${coords.row}'][data-col='${coords.col}']`);
        if (cellToSelect) {
            selectCell(cellToSelect);
        }
    } else {
        selectCell(null);
    }

    if (gameMode === 'multiplayer') {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(r => r.map(c => c.value)),
            pencilMarks: pencilMarksData.map(row => row.map(set => Array.from(set)))
        });
    }
  }

  function updateUndoButtonState() {
    if (undoBtn) {
      undoBtn.disabled = historyIndex <= 0;
    }
  }

  function updateRedoButtonState() {
    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
      redoBtn.disabled = historyIndex >= history.length - 1;
    }
  }

  function updateTimerDisplay(serverSeconds) {
    const timerContainer = document.getElementById("timer-container");

    // 【核心修正】多人模式：暴力替換整個計時器區域的 HTML
    if (gameMode === 'multiplayer') {
        if (currentlySpectatingId) return; // ✨ 觀戰時強制不更新右上角，保護「正在觀看」文字
        if (timerContainer) {
            timerContainer.innerHTML = `<span class="timer-label">房號：</span><span id="timer-value" style="font-weight:bold; color:var(--theme-color-dark);">${currentGameId || "未知"}</span>`;
        }
        return; 
    }

    // 單人模式：確保計時器結構正常
    let timerValueEl = document.getElementById("timer-value");
    if (!timerValueEl && timerContainer) {
        timerContainer.innerHTML = `<span class="timer-label">已用時間：</span><span id="timer-value">00:00:00</span>`;
        timerValueEl = document.getElementById("timer-value");
    }
    
    const currentSeconds = typeof serverSeconds !== 'undefined' ? serverSeconds : seconds;
    const totalSeconds = Number.isFinite(currentSeconds) ? currentSeconds : 0;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    
    if (timerValueEl) {
      timerValueEl.textContent = formattedTime;
    }
  }

  function updateProgress() {
    if (!initialPuzzle || initialPuzzle.length === 0) return;
    const totalCells = 81;
    const initialFilled = initialPuzzle
      .flat()
      .filter((cell) => cell.value !== 0).length;
    const currentFilled = puzzle
      .flat()
      .filter((cell) => cell.value !== 0).length;
    const totalToFill = totalCells - initialFilled;
    const playerFilled = currentFilled - initialFilled;
    
    if (totalToFill <= 0) return;

    // 【核心修正】基礎進度算法：將滿分設為 99%
    let percentage = Math.floor((playerFilled / totalToFill) * 99);
    percentage = Math.max(0, Math.min(99, percentage)); // 確保不會超過99%

    // 只有當玩家真正完成且「完全正確」時，才給予最後的 1% 達到 100%
    if (iHaveFinished) {
      percentage = 100;
    }

    if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
  }

  function updateNumberCounter() {
    if (!gameSettings.allowNumberCounter) {
      if (document.getElementById("number-counter-container"))
        document
          .getElementById("number-counter-container")
          .classList.add("hidden");
      return;
    }
    if (document.getElementById("number-counter-container"))
      document
        .getElementById("number-counter-container")
        .classList.remove("hidden");

    const numberCounterEl = document.getElementById("number-counter");
    if (!numberCounterEl || !puzzle || puzzle.length === 0) return;

    const counts = new Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r]?.[c]?.value !== 0) {
          counts[puzzle[r][c].value]++;
        }
      }
    }
    numberCounterEl.innerHTML = "";
    for (let i = 1; i <= 9; i++) {
      const item = document.createElement("div");
      item.classList.add("counter-item");
      if (counts[i] === 9) {
        item.classList.add("completed");
      }
      item.innerHTML = `<span class="num">${i}</span><span class="count">${counts[i]}/9</span>`;
      numberCounterEl.appendChild(item);
    }
  }

  async function showSolutionView() {
    isInSolutionView = true;
    stopTimer();
    isPaused = false; 

    if (boardElement) {
      boardElement.classList.remove("is-loading");
      drawBoard();
    }

    clearAllHighlights();

    const inGameControls = document.getElementById("in-game-controls");
    if (inGameControls) inGameControls.classList.add("hidden");

    const solutionView = document.getElementById("solution-view");
    if (solutionView) solutionView.classList.remove("hidden");

    try {
      const response = await fetch(`/api/sudoku/solution/${currentGameId}`);
      if (!response.ok) throw new Error("無法從伺服器獲取解答");
      const data = await response.json();
      const finalSolution = data.solution;

      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cellData = puzzle[r][c];
          if (
            cellData.source === "player" &&
            cellData.value !== finalSolution[r][c]
          ) {
            const cellElement = document.querySelector(
              `.cell[data-row='${r}'][data-col='${c}']`
            );
            if (cellElement) cellElement.classList.add("player-error");
          }
        }
      }

      if (solutionBoard && finalSolution) {
        solutionBoard.innerHTML = "";
        for (let i = 0; i < 9; i++) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "row";
          for (let j = 0; j < 9; j++) {
            const cellDiv = document.createElement("div");
            cellDiv.className = "cell";
            cellDiv.textContent = finalSolution[i][j];
            if (initialPuzzle[i]?.[j]?.value !== 0) {
              cellDiv.classList.add("given-number");
            }
            rowDiv.appendChild(cellDiv);
          }
          solutionBoard.appendChild(rowDiv);
        }
      }
    } catch (error) {
      console.error("顯示解答時出錯:", error);
      showCustomAlert("無法獲取解答，請稍後再試。");
      hideSolutionView();
    }
  }

  function hideSolutionView() {
    isInSolutionView = false;
    const inGameControls = document.getElementById("in-game-controls");
    if (inGameControls) inGameControls.classList.remove("hidden");
    const solutionView = document.getElementById("solution-view");
    if (solutionView) solutionView.classList.add("hidden");
    document.querySelectorAll(".cell.player-error").forEach((cell) => {
      cell.classList.remove("player-error");
    });
  }

  function updatePauseButtonState() {
    if (!pauseBtn) return;

    if (iHaveSurrendered) {
        pauseBtn.disabled = true;
        return;
    }

    if (gameMode === 'single') {
        pauseBtn.disabled = !isTimerRunning;
    } else if (gameMode === 'multiplayer') {
        const myState = opponentStates.find(p => p.playerId === myPlayerId);
        if (!myState || myState.pauseUses <= 0) {
            pauseBtn.disabled = true;
        } else {
            pauseBtn.disabled = false;
        }
    } else {
        pauseBtn.disabled = true;
    }
  }

  function restorePlayerView() {
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.innerHTML = `
            <span class="timer-label">用時：</span>
            <span id="timer-value">00:00:00</span>`;
        
        timerValueElement = document.getElementById('timer-value');
        updateTimerDisplay();
    }
    drawBoard();
  }

  function updateGameInfo() {
    if (infoHintCount) infoHintCount.textContent = hintCount;
    if (infoValidateCount) infoValidateCount.textContent = validateCount;

    const multiHintCount = document.getElementById('info-hint-count-display');
    const multiValidateCount = document.getElementById('info-validate-count-display');
    if (multiHintCount) multiHintCount.textContent = hintCount;
    if (multiValidateCount) multiValidateCount.textContent = validateCount;
  }

  function disableGameControls(disabled, exceptions = []) {
    const controls = {
      'validate-btn': validateBtn,
      'pause-btn': pauseBtn,
      'game-menu-btn': gameMenuBtn,
      'pencil-toggle-checkbox': pencilToggleCheckbox,
      'highlight-helper-checkbox': highlightHelperCheckbox,
      'hint-btn': hintBtn
    };

    for (const id in controls) {
      if (controls[id] && !exceptions.includes(id)) {
        controls[id].disabled = disabled;
      }
    }

    if (hintBtn && !disabled && hintCount <= 0) {
      hintBtn.disabled = true;
    }

    if (disabled) {
      if (paletteElement) paletteElement.classList.add("disabled");
      if (boardElement) boardElement.classList.add("disabled");
    } else {
      if (paletteElement) paletteElement.classList.remove("disabled");
      if (boardElement) boardElement.classList.remove("disabled");
    }
  }

  function drawBoard() {
    if (!boardElement || !puzzle || puzzle.length === 0) return;
    boardElement.innerHTML = "";
    boardElement.classList.remove('is-loading');
    for (let i = 0; i < 9; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        for (let j = 0; j < 9; j++) {
            const cell = document.createElement('div');
            cell.classList.add("cell");
            cell.dataset.row = i;
            cell.dataset.col = j;
            const mainValue = document.createElement("span");
            mainValue.classList.add("main-value");
            const pencilGrid = document.createElement("div");
            pencilGrid.classList.add("pencil-grid");
            const marks = pencilMarksData[i][j];
            for (let k = 1; k <= 9; k++) {
                const pencilMark = document.createElement("div");
                pencilMark.classList.add("pencil-mark");
                pencilMark.dataset.mark = k;
                if (marks.has(k)) {
                    pencilMark.textContent = k;
                }
                pencilGrid.appendChild(pencilMark);
            }
            const cellData = puzzle[i][j];
            if (cellData.value !== 0) {
                mainValue.textContent = cellData.value;
                if (cellData.source === "initial") cell.classList.add("given-number");
                else if (cellData.source === "hint") cell.classList.add("hinted");
            }
            if (cellData.source !== "initial" && cellData.source !== "hint") {
                cell.addEventListener("click", () => selectCell(cell));
            }
            cell.appendChild(mainValue);
            cell.appendChild(pencilGrid);
            rowDiv.appendChild(cell);
        }
        boardElement.appendChild(rowDiv);
    }
  }

  function newGame(puzzleData, prepareOnly = false) {
    iHaveSurrendered = false;
    currentlySpectatingId = null;
    history = [];
    historyIndex = -1;
    iHaveFinished = false;
    pencilMarksData = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
    isPaused = false;
    isTimerStartedByFirstMove = false;
    isFirstPencilMarkMade = false;
    selectedCell = null;
    lastSelectedCoords = null;
    myCurrentStatus = 'playing'; // ✨ 補上這行：確保再來一局時，狀態恢復為遊戲中
    if (pauseBtn) pauseBtn.textContent = "暫停";
    
    if (puzzleData && puzzleData[0] && typeof puzzleData[0][0] === 'object' && puzzleData[0][0] !== null) {
        puzzle = JSON.parse(JSON.stringify(puzzleData));
    } else {
        puzzle = puzzleData.map((row) =>
          row.map((num) => ({
            value: num,
            source: num !== 0 ? "initial" : "empty",
          }))
        );
        initialPuzzle = JSON.parse(JSON.stringify(puzzle));
    }

    if (gameMode === "single") {
      setUIState("playing_single");
    } else {
      setUIState("playing_multiplayer");
    }
    hideWaitingScreen();
    hideSolutionView();
    disableGameControls(false);
    if (pencilToggleCheckbox) pencilToggleCheckbox.checked = false;
    if (highlightHelperCheckbox) highlightHelperCheckbox.checked = false;
    if (boardElement) boardElement.classList.remove("is-loading");

    if (!prepareOnly) {
      setTimeout(() => {
        drawBoard();
        highlightAndCheckConflicts();
      }, 0);
    }
    
    resetTimer();
    updateProgress();
    updateNumberCounter();
    
    recordHistoryState(null);
  }

  function runOneAnimationCycle(targetElement) {
    return new Promise(async (resolve) => {
      if (!targetElement) return resolve();

      const loadingTexts = [
        "產生謎題中...",
        "執行挖洞作業...",
        "驗證唯一解...",
      ];

      for (const text of loadingTexts) {
        targetElement.textContent = text;
        const randomDelay = 300 + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, randomDelay));
      }
      
      resolve();
    });
  }

  function applyDifficultySettings(difficulty, holes = 0) {
    if (!boardElement) {
      boardElement = document.getElementById("game-board");
    }
    
    if (boardElement) {
      boardElement.classList.remove('storm-mode', 'telescope-mode'); 
    }

    gameSettings.difficulty = difficulty;
    gameSettings.allowNumberCounter = true;
    let helpersText = "無";
    let difficultyText = "中等";
    
    switch (difficulty) {
      case "easy":
        hintCount = 5;
        validateCount = 5;
        gameSettings.allowConflictHighlight = true;
        gameSettings.allowNumberHighlight = true;
        helpersText = "衝突高亮、數字高亮";
        difficultyText = "簡單";
        break;
      case "medium":
        hintCount = 3;
        validateCount = 3;
        gameSettings.allowConflictHighlight = false;
        gameSettings.allowNumberHighlight = true;
        helpersText = "數字高亮";
        difficultyText = "中等";
        break;
      case "hard":
        hintCount = 1;
        validateCount = 1;
        gameSettings.allowConflictHighlight = false;
        gameSettings.allowNumberHighlight = false;
        gameSettings.allowNumberCounter = false;
        helpersText = "準心輔助";
        difficultyText = "困難";
        break;
      case "extreme":
        hintCount = 0;
        validateCount = 0;
        gameSettings.allowConflictHighlight = false;
        gameSettings.allowNumberHighlight = false;
        gameSettings.allowNumberCounter = false;
        helpersText = "無輔助";
        difficultyText = "極限";
        break;
    }

    if (gameSettings.specialMode === 'telescope' && boardElement) {
          boardElement.classList.add('telescope-mode');
          showCustomAlert("已進入【望遠鏡模式】！<br>筆記將只在您選中的格子上顯示。");
    }

    const keybindingsInfoHTML = `
      <div class="keybindings-info" style="margin-top: clamp(5px, 2vh, 20px); padding-top: clamp(5px, 1.5vh, 15px); border-top: 2px solid #d8d8d8; text-align: left;">
        <h4 style="margin: 0 0 clamp(2px, 1vh, 10px) 0; color: var(--theme-color-dark); font-size: clamp(0.85rem, 2vh, 1.1rem);">⌨️ 快捷鍵說明</h4>
        <div style="display: grid; grid-template-columns: max-content 1fr; gap: clamp(2px, 0.8vh, 6px) 15px; font-size: clamp(0.7rem, 1.8vh, 0.95em); color: #555; line-height: clamp(1.2, 2.5vh, 1.5);">
          <span>填寫 / 筆記：</span><span>1~9</span>
          <span>清除格子：</span><span>&lt;-- / Del</span>
          <span>切換筆記模式：</span><span>P / 中鍵</span>
          <span>切換高亮輔助：</span><span>L</span>
          <span>移動選取框：</span><span>方向鍵</span>
        </div>
      </div>
    `;

    const gameInfoHTML = `
      <div class="info-item-wrapper" style="display: flex; flex-direction: column; height: 100%; justify-content: space-evenly;">
          <div class="info-item" style="font-size: clamp(0.8rem, 2vh, 1rem);"><span>剩餘提示:</span><span id="info-hint-count-display">${hintCount}</span></div>
          <div class="info-item" style="font-size: clamp(0.8rem, 2vh, 1rem);"><span>剩餘檢查:</span><span id="info-validate-count-display">${validateCount}</span></div>
          <div class="info-item" style="font-size: clamp(0.8rem, 2vh, 1rem);"><span>剩餘暫停:</span><span id="info-pause-count-display">2</span></div>
          
          <hr style="margin: clamp(5px, 1.5vh, 10px) 0; border: none; height: 2px; background-color: #d8d8d8;">
          
          <div class="info-item-column">
              <h4 style="margin: 0 0 2px 0; font-size: clamp(0.85rem, 2vh, 1.05rem);">當前難度</h4>
              <p style="margin: 0 0 clamp(2px, 1vh, 8px) 0; font-size: clamp(0.8rem, 1.9vh, 1rem); color: #555;">${difficultyText} (${holes} 空格)</p>
          </div>
          <div class="info-item-column">
              <h4 style="margin: 0 0 2px 0; font-size: clamp(0.85rem, 2vh, 1.05rem);">輔助功能</h4>
              <p style="margin: 0; font-size: clamp(0.8rem, 1.9vh, 1rem); color: #555;">${helpersText}</p>
          </div>
          
          ${keybindingsInfoHTML}
      </div>
    `;

    if (singlePlayerInfoPanel) {
      if (difficultyDisplay) difficultyDisplay.textContent = `${difficultyText} (${holes} 空格)`;
      if (helpersDisplay) helpersDisplay.textContent = helpersText;
      const singlePlayerPanel = document.getElementById('single-player-info');
      if (singlePlayerPanel) {
          const oldKeybindings = singlePlayerPanel.querySelector('.keybindings-info');
          if (oldKeybindings) oldKeybindings.remove();
          singlePlayerPanel.insertAdjacentHTML('beforeend', keybindingsInfoHTML);
      }
    }

    if (multiplayerGameInfoContent) {
      multiplayerGameInfoContent.innerHTML = gameInfoHTML;
    }

    updateGameInfo();
  }

  async function checkWinCondition() {
    // 1. 如果盤面沒滿，或者已經完成，就不需要檢查
    if (!isBoardFull() || iHaveFinished) return;

    // ✨ 2. 核心分流：多人模式全權交給 WebSocket 伺服器判定！完全不走 HTTP API！
    if (gameMode === 'multiplayer') return; 

    // 👤 3. 單人模式：繼續使用原本的 API 檢查邏輯
    try {
      const response = await fetch(`/api/sudoku/solution/${currentGameId}`);
      if (!response.ok) throw new Error("API 異常");
      const data = await response.json();
      
      if (isBoardCorrect(puzzle, data.solution)) {
        if (!iHaveFinished) {
            iHaveFinished = true;
            updateProgress();
            showWinModal(); 
        }
      } else {
        showCustomAlert("您已填滿所有格子，但答案包含錯誤。");
        validateBoard(true); 
      }
    } catch (error) {
      console.error("單人模式判斷勝利時發生錯誤:", error);
    }
  }

  function clearAllHighlights() {
    document
      .querySelectorAll(
        ".highlight-rc, .highlight-conflict, .selected, .conflict-with-selection, .highlight-same-number"
      )
      .forEach((c) => {
        c.classList.remove(
          "highlight-rc",
          "highlight-conflict",
          "selected",
          "conflict-with-selection",
          "highlight-same-number"
        );
      });
  }

  function showWinModal() {
    stopTimer();
    disableGameControls(true, ['game-menu-btn']);
    
    // ✨ 核心修復：把所有需要的 DOM 元素宣告，全部搬到函式最頂端！
    const winModalExtremeBtn = document.getElementById('win-modal-extreme-challenge-btn');
    const exitRoomBtn = document.getElementById('win-modal-exit-room-btn');
    const winTitle = document.getElementById('win-modal-title');
    const winSubtitle = document.getElementById('win-modal-subtitle');
    const winStatContainer = document.getElementById('win-stats-container');

    // ==========================================
    // ⚔️ 多人模式專屬邏輯
    // ==========================================
    if (gameMode === 'multiplayer') {
        const othersPlaying = opponentStates.some(p => p.playerId !== myPlayerId && p.status === 'playing');

        // 煙火照放，慶祝通關！
        if (typeof confetti === "function") confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });

        if (othersPlaying) {
            // 情況 A：還有人在玩。隱藏彈窗，並跳出觀戰通知
            if (winModalNewGameBtn) winModalNewGameBtn.classList.add("hidden");
            
            // 💡 現在這裡絕對找得到這兩個變數，不會再崩潰了！
            if (winModalExtremeBtn) winModalExtremeBtn.classList.add("hidden");
            if (exitRoomBtn) exitRoomBtn.classList.add("hidden");
            
            if (winModalOverlay) winModalOverlay.classList.add("hidden");
            
            showCustomAlert("恭喜通關！🎉<br>還有其他對手正在努力中，您可以點擊右下角的進度條切換視角進行觀戰喔！", "通關成功");
        } 
        
        return; // 多人模式到此結束
    }

    // ==========================================
    // 👤 以下為「單人模式」專屬邏輯
    // ==========================================
    if (winTitle) winTitle.textContent = "恭喜通關！";
    if (winSubtitle) winSubtitle.classList.remove("hidden");

    const difficultyMap = { 'easy': '簡單', 'medium': '中等', 'hard': '困難', 'extreme': '極限' }; 
    const difficultyText = difficultyMap[gameSettings.difficulty] || '未知';
    const finalTime = timerValueElement ? timerValueElement.textContent : '未知';
    const initialHintCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
    const initialValidateCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
    const hintsUsed = initialHintCount - hintCount;
    const validationsUsed = initialValidateCount - validateCount;

    if (winStatContainer) {
        winStatContainer.innerHTML = `
            <div class="win-stat-item"><span class="stat-label">遊戲難度:</span><span class="stat-value">${difficultyText}</span></div>
            <div class="win-stat-item"><span class="stat-label">謎題空格:</span><span class="stat-value">${puzzleHoles} 個</span></div>
            <div class="win-stat-item"><span class="stat-label">通關耗時:</span><span class="stat-value">${finalTime}</span></div>
            <div class="win-stat-item"><span class="stat-label">使用提示:</span><span class="stat-value">${hintsUsed} 次</span></div>
            <div class="win-stat-item"><span class="stat-label">使用檢查:</span><span class="stat-value">${validationsUsed} 次</span></div>
        `;
    }

    if (winModalNewGameBtn) {
        winModalNewGameBtn.classList.remove("hidden");
        winModalNewGameBtn.textContent = "再來一局";
        winModalNewGameBtn.onclick = () => {
            socket.emit("leaveRoom", { roomId: currentGameId }); 
            resetUIForNewGame();
            winModalOverlay.classList.add("hidden");
            appContainer.classList.add("hidden");
            difficultyModalOverlay.classList.remove("hidden");
        };
    }
    
    if (exitRoomBtn) {
        exitRoomBtn.classList.remove("hidden");
        exitRoomBtn.textContent = "返回主選單"; 
        exitRoomBtn.onclick = () => {
            socket.emit("leaveRoom", { roomId: currentGameId }); 
            resetToModeSelection(); 
        };
    }
    
    if (winModalExtremeBtn) winModalExtremeBtn.classList.add("hidden");

    if (winModalOverlay) winModalOverlay.classList.remove("hidden");
    if (typeof confetti === "function") confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }

  function highlightAndCheckConflicts() {
    clearAllHighlights();
    if (!selectedCell) return;
    selectedCell.classList.add("selected");
    if (!highlightHelperCheckbox.checked) return;
    const selectedRow = parseInt(selectedCell.dataset.row);
    const selectedCol = parseInt(selectedCell.dataset.col);
    const selectedValue = selectedCell.querySelector(".main-value").textContent;
    for (let i = 0; i < 9; i++) {
      const rowCell = document.querySelector(`.cell[data-row='${selectedRow}'][data-col='${i}']`);
      if (rowCell) rowCell.classList.add("highlight-rc");
      const colCell = document.querySelector(`.cell[data-row='${i}'][data-col='${selectedCol}']`);
      if (colCell) colCell.classList.add("highlight-rc");
    }
    if (selectedValue && gameSettings.allowNumberHighlight) {
      document.querySelectorAll(".cell").forEach((cell) => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        if (puzzle[r]?.[c]?.value === parseInt(selectedValue)) {
          cell.classList.add("highlight-same-number");
        }
      });
    }
    if (selectedValue && gameSettings.allowConflictHighlight) {
      let hasConflict = false;
      const checkPeers = (peerCell) => {
        if (!peerCell || (peerCell.dataset.row == selectedRow && peerCell.dataset.col == selectedCol)) return;
        const peerRow = parseInt(peerCell.dataset.row);
        const peerCol = parseInt(peerCell.dataset.col);
        if (puzzle[peerRow]?.[peerCol]?.value === parseInt(selectedValue)) {
          peerCell.classList.add("conflict-with-selection");
          hasConflict = true;
        }
      };
      const startRow = Math.floor(selectedRow / 3) * 3;
      const startCol = Math.floor(selectedCol / 3) * 3;
      for (let r = 0; r < 9; r++) { checkPeers(document.querySelector(`.cell[data-row='${selectedRow}'][data-col='${r}']`)); }
      for (let r = 0; r < 9; r++) { checkPeers(document.querySelector(`.cell[data-row='${r}'][data-col='${selectedCol}']`)); }
      for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
          checkPeers(document.querySelector(`.cell[data-row='${r}'][data-col='${c}']`));
        }
      }
      if (hasConflict) {
        selectedCell.classList.add("conflict-with-selection");
      }
    }
  }

  function updateOpponentProgressUI() {
    if (!opponentProgressContainer || !opponentStates) return;

    const myState = opponentStates.find(p => p.playerId === myPlayerId);
    const myStatus = myState ? myState.status : 'disconnected';
    const iCanSpectate = myStatus === 'surrendered' || myStatus === 'finished';

    opponentProgressContainer.innerHTML = ''; 

    opponentStates.sort((a, b) => {
        const statusOrder = { 'finished': 0, 'playing': 1, 'surrendered': 2, 'disconnected': 2 };
        const statusA = statusOrder[a.status] ?? 9;
        const statusB = statusOrder[b.status] ?? 9;
        if (statusA !== statusB) return statusA - statusB;
        if (a.status === 'finished') return a.finishTime - b.finishTime;
        return b.progress - a.progress;
    });

    // ▼▼▼▼▼ 這裡就是補上的完整內部邏輯 ▼▼▼▼▼
    opponentStates.forEach((player, index) => {
      const progressItem = document.createElement('div');
      progressItem.className = 'opponent-progress-item';
      progressItem.dataset.playerId = player.playerId;

      if (player.playerId === myPlayerId) {
          progressItem.classList.add('is-me');
      }
      
      if (myStatus === 'playing') {
          if (player.playerId === myPlayerId) {
              progressItem.classList.add('spectating');
          }
      } else { 
          if (player.playerId === currentlySpectatingId) {
              progressItem.classList.add('spectating');
          }
      }

      if (iCanSpectate && player.status === 'playing' && player.playerId !== myPlayerId) {
          progressItem.classList.add('spectatable');
      }
      
      const rankHTML = `<span class="rank">${index + 1}.</span>`;
      const nameHTML = `<span class="opponent-name">${player.playerName}${player.playerId === myPlayerId ? ' (你)' : ''}</span>`;
      let statusHTML = '';

      switch (player.status) {
        case 'finished':
          const time = new Date(player.finishTime * 1000).toISOString().substr(11, 8);
          statusHTML = `<span class="finish-time" style="grid-column: 3 / span 2;">完成: ${time}</span>`;
          break;
        case 'surrendered':
        case 'disconnected':
          const statusText = player.status === 'surrendered' ? '已投降' : '已離線';
          statusHTML = `<span class="player-status-text ${player.status}" style="grid-column: 3 / span 2;">${statusText}</span>`;
          break;
        default:
          const progress = Math.max(0, player.progress);
          statusHTML = `<div class="progress-bar"><div class="progress-bar-fill" style="width: ${progress}%;"></div></div><span class="progress-percentage">${progress}%</span>`;
          break;
      }

      progressItem.innerHTML = rankHTML + nameHTML + statusHTML;
      
      progressItem.addEventListener('click', () => {
          const targetPlayerId = player.playerId;
          if (targetPlayerId === myPlayerId || progressItem.classList.contains('spectatable')) {
              document.querySelectorAll('#opponent-progress-container .opponent-progress-item').forEach(item => item.classList.remove('spectating'));
              progressItem.classList.add('spectating');
              if (targetPlayerId === myPlayerId) {
                  currentlySpectatingId = null;
                  restorePlayerView();
              } else {
                  currentlySpectatingId = targetPlayerId;
                  socket.emit('sudoku_requestSpectate', { roomId: currentGameId, targetPlayerId });
              }
          }
      });

      opponentProgressContainer.appendChild(progressItem);
    });
    // ▲▲▲▲▲ 內部邏輯結束 ▲▲▲▲▲
  }

  function clearSelectedCellContent() {
    if (!selectedCell || selectedCell.classList.contains("given-number") || selectedCell.classList.contains("hinted") || isPaused || currentViewedPlayerId !== myPlayerId) return;
    
    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    puzzle[row][col] = { value: 0, source: "empty" };
    selectedCell.querySelector(".main-value").textContent = "";
    pencilMarksData[row][col].clear();
    
    recordHistoryState({ row, col });
    clearAllErrors();
    highlightAndCheckConflicts();
    updateProgress();
    updateNumberCounter();

    if (gameMode === 'multiplayer' && currentGameId && currentViewedPlayerId === myPlayerId) {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(r => r.map(c => c.value))
        });
    }
  }

  function updateInfoPanelForSpectator(playerName, hints, validates) {
    if (!multiplayerInfoPanel || !infoPanelTitle) return;
    
    const infoTabButton = document.querySelector('.in-game-tab-button[data-tab="ingame-info"]');
    if (infoTabButton) infoTabButton.click();
    
    infoPanelTitle.textContent = `觀戰中: ${playerName}`;
    
    const multiHintCount = document.getElementById('info-hint-count-display');
    const multiValidateCount = document.getElementById('info-validate-count-display');
    if (multiHintCount) multiHintCount.textContent = hints > 0 ? hints : "無";
    if (multiValidateCount) multiValidateCount.textContent = validates > 0 ? validates : "無";
  }

  function updateInGameChatBadge() {
    if (inGameChatNotificationBadge) {
      if (unreadInGameMessages > 0) {
        inGameChatNotificationBadge.textContent = unreadInGameMessages;
        inGameChatNotificationBadge.classList.remove('hidden');
      } else {
        inGameChatNotificationBadge.classList.add('hidden');
      }
    }
    // ✨ 同步更新手機版懸浮大頭貼的紅點 (使用 setProperty 壓制 CSS)
    const mobileChatBadge = document.getElementById('mobile-chat-badge');
    if (mobileChatBadge) {
      if (unreadInGameMessages > 0) {
        mobileChatBadge.textContent = unreadInGameMessages;
        mobileChatBadge.style.setProperty('display', 'flex', 'important');
      } else {
        mobileChatBadge.textContent = '0';
        mobileChatBadge.style.setProperty('display', 'none', 'important');
      }
    }
  }

  function selectCell(cell, isKeyboardAction = false) {
    if (isPaused || currentlySpectatingId) return;

    if (!cell) {
        selectedCell = null;
        highlightAndCheckConflicts();
        return;
    }

    if (!isKeyboardAction) {
        const currentFocus = document.querySelector(".keyboard-focus");
        if (currentFocus) {
            currentFocus.classList.remove("keyboard-focus");
        }
    }

    const previouslySelected = document.querySelector(".cell.selected");
    if (previouslySelected) {
        previouslySelected.classList.remove("selected");
    }

    if (cell.classList.contains("given-number") || cell.classList.contains("hinted")) {
        selectedCell = null;
        lastSelectedCoords = { row: cell.dataset.row, col: cell.dataset.col };
        highlightAndCheckConflicts();
    } else if (selectedCell === cell) {
        selectedCell = null;
        lastSelectedCoords = null;
        highlightAndCheckConflicts();
    } else {
        selectedCell = cell;
        selectedCell.classList.add("selected");
        lastSelectedCoords = { row: cell.dataset.row, col: cell.dataset.col };
        highlightAndCheckConflicts();
    }
    
    if (gameMode === 'multiplayer' && currentGameId) {
        socket.emit('sudoku_playerSelectCell', {
            roomId: currentGameId,
            coords: selectedCell ? { row: parseInt(selectedCell.dataset.row), col: parseInt(selectedCell.dataset.col) } : null
        });
    }
  }

  function clearAllErrors() {
    document.querySelectorAll(".cell.error").forEach((cell) => {
      cell.classList.remove("error");
    });
  }

  async function validateBoard(isAutoTrigger = false) {
    if (isPaused || currentViewedPlayerId !== myPlayerId) return;

    if (!isAutoTrigger) {
      if (validateCount <= 0) {
        return showCustomAlert("您的檢查次數已經用完了！");
      }
      let confirmMessage = '';
      if (gameSettings.difficulty === 'hard' || gameSettings.difficulty === 'extreme') {
        confirmMessage = `這將會和正確答案比對，並標示出您填錯的數字中的<b>其中一個</b>。<br>沒有發現錯誤則不消耗使用次數。<br>確定要使用一次檢查嗎？ 剩餘次數：${validateCount}`;
      } else {
        confirmMessage = `這將會和正確答案比對，並標示出<b>所有</b>您填錯的數字。<br>沒有發現錯誤則不消耗使用次數。<br>確定要使用一次檢查嗎？ 剩餘次數：${validateCount}`;
      }
      const userConfirmed = await showCustomConfirm(confirmMessage, "使用「檢查」功能");
      if (!userConfirmed) return;
    }

    clearAllErrors();
    try {
      const response = await fetch(`/api/sudoku/solution/${currentGameId}`);
      if (!response.ok) throw new Error("無法從伺服器獲取解答");
      const data = await response.json();
      const solution = data.solution;
      if (!solution) throw new Error("伺服器回傳的解答格式不正確");

      const errorCells = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cellData = puzzle[r][c];
          if (cellData.source === 'player' && cellData.value !== 0 && cellData.value !== solution[r][c]) {
            errorCells.push({ r, c });
          }
        }
      }

      if (errorCells.length > 0) {
        if (!isAutoTrigger) {
          if (gameMode === 'multiplayer') {
            socket.emit('sudoku_useValidate', { roomId: currentGameId });
          }
          validateCount--;
          updateGameInfo();
        }
        if (gameSettings.difficulty === 'hard' || gameSettings.difficulty === 'extreme') {
          const firstError = errorCells[0];
          document.querySelector(`.cell[data-row='${firstError.r}'][data-col='${firstError.c}']`)?.classList.add("error");
          if (!isAutoTrigger) {
            showCustomAlert(`檢查發現錯誤！已為您標示出其中一個錯誤位置。`);
          }
        } else {
          errorCells.forEach(coords => {
            document.querySelector(`.cell[data-row='${coords.r}'][data-col='${coords.c}']`)?.classList.add("error");
          });
          if (!isAutoTrigger) {
            showCustomAlert(`檢查發現您共填寫了 ${errorCells.length} 個錯誤的數字，已為您標示出來。`);
          }
        }
      } else if (!isAutoTrigger) {
        showCustomAlert("恭喜！所有您填寫的數字都和正確答案相符！");
      }
    } catch (error) {
      console.error("檢查盤面時發生錯誤:", error);
      if (!isAutoTrigger) showCustomAlert(`檢查功能暫時無法使用。\n錯誤: ${error.message}`);
    }
  }

  // ✨ 宣告一個外掛專用的防呆鎖
  let isSecretFilling = false; 

  // 🤫 開發者專屬後門：無痕自動填入正確答案 (升級版)
  async function secretAutoFill() {
    // ✨ 如果已經在填寫中了，或是條件不符，就直接擋掉！
    if (isSecretFilling || !selectedCell || selectedCell.classList.contains("given-number") || selectedCell.classList.contains("hinted") || isPaused) return;

    isSecretFilling = true; // 🔒 上鎖！在伺服器回傳前，誰都不准再觸發！

    try {
      const row = parseInt(selectedCell.dataset.row);
      const col = parseInt(selectedCell.dataset.col);

      const response = await fetch("/api/sudoku/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: currentGameId,
          puzzle: puzzle.map((r) => r.map((c) => c.value)),
          preferredCell: { row, col }
        }),
      });

      if (!response.ok) throw new Error("API 異常");
      const hint = await response.json();
      
      if (hint) {
        const targetRow = hint.row;
        const targetCol = hint.col;
        
        puzzle[targetRow][targetCol] = { value: hint.value, source: "player" };
        pencilMarksData[targetRow][targetCol].clear();
        
        const targetCell = document.querySelector(`.cell[data-row='${targetRow}'][data-col='${targetCol}']`);
        if (targetCell) {
            targetCell.querySelectorAll('.pencil-mark').forEach(mark => mark.textContent = '');
            targetCell.querySelector(".main-value").textContent = hint.value;
        }
        
        recordHistoryState({ row: targetRow, col: targetCol });
        highlightAndCheckConflicts();
        updateProgress();
        updateNumberCounter();
        checkWinCondition();
        
        if (gameMode === 'multiplayer' && currentGameId) {
          socket.emit('sudoku_playerAction', {
              roomId: currentGameId,
              puzzle: puzzle.map(r => r.map(c => c.value)),
              pencilMarks: pencilMarksData.map(r => r.map(set => Array.from(set)))
          });
        }
      }
    } catch (error) {
      console.error("Oops! 後門連線異常。");
    } finally {
      isSecretFilling = false; // 🔓 解鎖！無論成功或失敗，執行完一定會把鎖打開
    }
  }

  async function giveHint() {
    if (isPaused || currentViewedPlayerId !== myPlayerId) return;
    if (hintCount <= 0) {
      return showCustomAlert("您的提示次數已經用完了！");
    }
    const confirmMessage = `這會為您填入一個正確數字。<br>（將優先填入您當前選中的空格）<br>確定要使用一次提示嗎？ 剩餘次數：${hintCount}`;
    const userConfirmed = await showCustomConfirm(confirmMessage, "使用「提示」功能");
    if (!userConfirmed) return;
    if (gameMode === 'multiplayer') {
        socket.emit('sudoku_useHint', { roomId: currentGameId });
    }
    
    if (!currentGameId) {
      return showCustomAlert("錯誤：找不到遊戲ID，無法獲取提示。");
    }
    try {
      let payload = {
        gameId: currentGameId,
        puzzle: puzzle.map((row) => row.map((cell) => cell.value)),
      };
      if (selectedCell && selectedCell.querySelector(".main-value") && selectedCell.querySelector(".main-value").textContent === "") {
        payload.preferredCell = {
          row: parseInt(selectedCell.dataset.row),
          col: parseInt(selectedCell.dataset.col),
        };
      }
      const response = await fetch("/api/sudoku/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("從伺服器獲取提示失敗");
      const hint = await response.json();
      if (!hint) {
        return showCustomAlert("棋盤已滿，無可用的提示。");
      }
      const { row, col, value } = hint;
      puzzle[row][col] = { value: value, source: "hint" };
      const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
      if (cell) {
        if (pencilMarksData?.[row]?.[col]) {
          pencilMarksData[row][col].clear();
        }
        cell.querySelector(".main-value").textContent = value;
        cell.classList.add("hinted");
        const pencilGrid = cell.querySelector(".pencil-grid");
        if (pencilGrid) pencilGrid.innerHTML = ''; // 清空視覺上的筆記
      }
      if (selectedCell === cell) {
        selectedCell = null;
      }
      hintCount--;
      updateGameInfo();
      updateProgress();
      updateNumberCounter();
      highlightAndCheckConflicts();
      recordHistoryState({ row, col });
      checkWinCondition();
      if (gameMode === 'multiplayer' && currentGameId) {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(row => row.map(cell => cell.value))
        });
    }
    } catch (error) {
      console.error(error);
      showCustomAlert("獲取提示時發生錯誤。");
    }
  }

  function setupInGameChat() {
    const sendMessage = () => {
      if (!inGameChatInput || !currentGameId) return;
      const message = inGameChatInput.value.trim();
      if (message) {
        socket.emit('sendChatMessage', { roomId: currentGameId, message });
        inGameChatInput.value = '';
        inGameChatInput.focus();
      }
    };

    if (inGameChatSendBtn) inGameChatSendBtn.addEventListener('click', sendMessage);
    if (inGameChatInput) {
      inGameChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
        }
      });
    }
  }

  function setupChat() {
    const sendMessage = () => {
      if (!chatInput || !chatSendBtn || !currentGameId) {
        console.warn("聊天室元件尚未準備好或未在房間內。");
        return;
      }
      const message = chatInput.value.trim();
      if (message) {
        socket.emit("sendChatMessage", { roomId: currentGameId, message });
        chatInput.value = "";
        chatInput.focus();
      }
    };

    if (chatSendBtn) {
      chatSendBtn.addEventListener("click", sendMessage);
    } else {
      console.error("找不到聊天室的發送按鈕。");
    }

    if (chatInput) {
      chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        }
      });
    } else {
      console.error("找不到聊天室的輸入框。");
    }
  }

  function addChatMessageToUI(data) {
    if (data.type === 'system' || data.senderId !== myPlayerId) {
      const chatTabContent = document.getElementById('tab-content-lobby-chat');
      if (chatTabContent && !chatTabContent.classList.contains('active')) {
        unreadChatMessages++;
        updateChatBadge();
      }
      const inGameChatTab = document.getElementById('tab-content-ingame-chat');
      // ✨ 增加檢查 show-floating (懸浮對話框是否開啟)
      if (inGameChatTab && !inGameChatTab.classList.contains('active') && !inGameChatTab.classList.contains('show-floating')) {
          unreadInGameMessages++;
          updateInGameChatBadge();
      }
    }

    const targets = [];
    if (chatMessages) targets.push(chatMessages);
    if (inGameChatMessages) targets.push(inGameChatMessages);
    if (targets.length === 0) return;

    targets.forEach(target => {
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message');

      if (data.type === 'system') {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `<span>${data.message}</span>`;
      } else {
        if (data.senderId === myPlayerId) messageElement.classList.add('my-message');
        const senderNameSpan = document.createElement('span');
        senderNameSpan.className = 'sender-name';
        senderNameSpan.textContent = data.senderName;
        const messageContentP = document.createElement('p');
        messageContentP.className = 'message-content';
        messageContentP.textContent = data.message;
        messageElement.appendChild(senderNameSpan);
        messageElement.appendChild(messageContentP);
      }
      
      target.appendChild(messageElement);
      target.scrollTop = target.scrollHeight; // 自動捲到最新訊息
    });
  }

  function updateChatBadge() {
    if (!chatNotificationBadge) return;

    if (unreadChatMessages > 0) {
      chatNotificationBadge.textContent = unreadChatMessages; 
      chatNotificationBadge.classList.remove("hidden");
    } else {
      chatNotificationBadge.classList.add("hidden");
    }
  }
  function setupLotteryStage(finalResult) {
    return new Promise(resolve => {
      const lotteryOverlay = document.getElementById('lottery-modal-overlay');
      const loadingContainer = document.querySelector('#game-board .loading-container');
      const lever = document.getElementById('lottery-lever');
      const resultText = document.getElementById('lottery-result-text');

      if (!lotteryOverlay || !loadingContainer || !lever || !resultText) {
        console.error("[拉霸機錯誤] 找不到必要的 HTML 元素，直接跳過動畫。");
        return resolve();
      }

      if (loadingContainer.style) loadingContainer.style.opacity = '0';
      lotteryOverlay.classList.remove('hidden');
      lever.classList.remove('disabled');
      resultText.textContent = "拉動拉桿，決定你的命運！";

      const cleanupAndPlay = () => {
        clearTimeout(lotteryTimeoutId);
        lever.removeEventListener('click', handleLeverPull);
        playLotteryAnimation(finalResult).then(resolve);
      };

      const handleLeverPull = () => {
          console.log("拉桿被手動拉下！");
          cleanupAndPlay();
      };
      lever.addEventListener('click', handleLeverPull, { once: true });

      const lotteryTimeoutId = setTimeout(() => {
          console.log("30秒到！自動播放動畫...");
          cleanupAndPlay();
      }, 30000);
    });
  }

  async function playLotteryAnimation(finalResult) {
    const lotteryOverlay = document.getElementById('lottery-modal-overlay');
    const reels = [ document.querySelector('.reel-1'), document.querySelector('.reel-2'), document.querySelector('.reel-3') ];
    const resultText = document.getElementById('lottery-result-text');
    const lever = document.getElementById('lottery-lever');

    if (!lotteryOverlay || !reels.every(r => r) || !lever) return;
    
    lever.classList.add('disabled');

    const modeSymbols = { 'telescope': '🔭', 'storm': '🌀' };
    const modeNames = { 'telescope': '望遠鏡模式', 'storm': '次元風暴' };
    
    const finalSymbol = modeSymbols[finalResult] || '✨';
    const finalName = modeNames[finalResult] || '驚喜模式';

    const options = ['🔭', '🌀', '✨', '💰', '🍀', '🔥', '💎', '🎁'];
    
    reels.forEach(reel => {
        const randomOptions = Array.from({ length: 50 }, () => options[Math.floor(Math.random() * options.length)]);
        reel.innerHTML = [...randomOptions, finalSymbol].map(opt => `<div class="reel-item">${opt}</div>`).join('');
        reel.style.transform = `translateY(-${(randomOptions.length) * 100}px)`;
        reel.classList.add('spinning');
        reel.style.transition = '';
    });

    if (resultText) resultText.textContent = '命運的輪盤開始轉動...';

    const stopReel = (reel, delay) => {
        return new Promise(resolve => {
            setTimeout(() => {
                reel.classList.remove('spinning');
                reel.innerHTML = `<div class="reel-item">${finalSymbol}</div>`;
                reel.style.transform = 'translateY(0px)';
                resolve();
            }, delay);
        });
    };

    await stopReel(reels[0], 1500);
    await stopReel(reels[1], 500);
    await stopReel(reels[2], 500);

    if (resultText) {
        resultText.innerHTML = `🎉  <span style="color: #ffd700;">${finalSymbol} ${finalName} ${finalSymbol}</span>  🎉`;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const loadingContainer = document.querySelector('#game-board .loading-container');
    lotteryOverlay.classList.add('hidden');
    if (loadingContainer && loadingContainer.style) loadingContainer.style.opacity = '1';
  }

  async function handleDimensionalStorm(plan) {
    console.log(`收到次元風暴計畫！`, plan);
    await showCustomAlert(`警告！偵測到空間扭曲！<br>棋盤結構即將發生劇烈變化！`, `🌀 次元風暴 🌀`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    for (const step of plan) {
        const { type, groupA, groupB } = step;
        const cellsToFlash = [];

        if (type === 'band_swap') {
            const startRowA = groupA * 3;
            const startRowB = groupB * 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 9; j++) {
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${startRowA + i}"][data-col="${j}"]`));
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${startRowB + i}"][data-col="${j}"]`));
                }
            }
        } else if (type === 'stack_swap') {
            const startColA = groupA * 3;
            const startColB = groupB * 3;
            for (let i = 0; i < 3; i++) {
                for (let row = 0; row < 9; row++) {
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${row}"][data-col="${startColA + i}"]`));
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${row}"][data-col="${startColB + i}"]`));
                }
            }
        }

        cellsToFlash.forEach(el => el?.classList.add('flash-swap'));
        await new Promise(resolve => setTimeout(resolve, 500));
        cellsToFlash.forEach(el => el?.classList.remove('flash-swap'));
        
        const transformState = (puzzleState, pencilState) => {
            if (type === 'band_swap') {
                const startRowA = groupA * 3;
                const startRowB = groupB * 3;
                for (let i = 0; i < 3; i++) {
                    [puzzleState[startRowA + i], puzzleState[startRowB + i]] = [puzzleState[startRowB + i], puzzleState[startRowA + i]];
                    [pencilState[startRowA + i], pencilState[startRowB + i]] = [pencilState[startRowB + i], pencilState[startRowA + i]];
                }
            } else if (type === 'stack_swap') {
                const startColA = groupA * 3;
                const startColB = groupB * 3;
                for (let i = 0; i < 3; i++) {
                    for (let row = 0; row < 9; row++) {
                        [puzzleState[row][startColA + i], puzzleState[row][startColB + i]] = [puzzleState[row][startColB + i], puzzleState[row][startColA + i]];
                        [pencilState[row][startColA + i], pencilState[row][startColB + i]] = [pencilState[row][startColB + i], pencilState[row][startColA + i]];
                    }
                }
            }
        };
        transformState(puzzle, pencilMarksData);
        history.forEach(historyEntry => {
            transformState(historyEntry.state.puzzle, historyEntry.state.pencilMarks);
        });
        
        drawBoard();
        await new Promise(resolve => setTimeout(resolve, 300)); 
    }

    drawBoard();
    selectCell(null);
    updateUndoButtonState();
    updateRedoButtonState();
  }

  function redrawCell(row, col) {
    const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const mainValueSpan = cell.querySelector('.main-value');
    const pencilGrid = cell.querySelector('.pencil-grid');
    if (mainValueSpan) {
      mainValueSpan.textContent = puzzle[row][col].value === 0 ? '' : puzzle[row][col].value;
    }
    if (pencilGrid) {
      pencilGrid.innerHTML = '';
      const marks = pencilMarksData[row][col];
      for (let k = 1; k <= 9; k++) {
          const pencilMark = document.createElement("div");
          pencilMark.classList.add("pencil-mark");
          pencilMark.dataset.mark = k;
          if (marks.has(k)) {
              pencilMark.textContent = k;
          }
          pencilGrid.appendChild(pencilMark);
      }
    }
  }

  function highlightOpponentSelection(coords) {
    document.querySelectorAll('.cell.opponent-selected, .cell.opponent-highlight-rc').forEach(c => {
        c.classList.remove('opponent-selected', 'opponent-highlight-rc');
    });

    if (coords) {
        const { row, col } = coords;
        const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
        if (cell) {
            cell.classList.add('opponent-selected');
        }
    }
  }

  function drawSpectatorBoard(boardData, initialBoardData, pencilMarks, playerName) {
    console.log(`[偵錯日誌] 步驟 6: drawSpectatorBoard 函式被呼叫，準備繪製 ${playerName} 的棋盤。`);
    if (!boardElement) {
        console.error("[偵錯日誌] 錯誤：找不到 boardElement！");
        return;
    }
    if (!boardData || !initialBoardData) {
        console.error("[偵錯日誌] 錯誤：繪製觀戰棋盤時缺少 boardData 或 initialBoardData！");
        return;
    }
    
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.innerHTML = `<span class="spectator-text">正在觀看 ${playerName}</span>`;
    }

    boardElement.innerHTML = ""; 
    for (let i = 0; i < 9; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        for (let j = 0; j < 9; j++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = i;
            cell.dataset.col = j;
            const mainValue = document.createElement('span');
            mainValue.classList.add('main-value');
            const cellValue = boardData[i]?.[j];
            if (cellValue && cellValue !== 0) {
                mainValue.textContent = cellValue;
            }
            const pencilGrid = document.createElement("div");
            pencilGrid.classList.add("pencil-grid");
            const marks = pencilMarks?.[i]?.[j] || [];
            for (let k = 1; k <= 9; k++) {
                const pencilMark = document.createElement("div");
                pencilMark.classList.add("pencil-mark");
                if (marks.includes(k)) {
                    pencilMark.textContent = k;
                }
                pencilGrid.appendChild(pencilMark);
            }
            if (initialBoardData?.[i]?.[j] !== 0) {
                cell.classList.add('given-number');
            }
            cell.appendChild(mainValue);
            cell.appendChild(pencilGrid);
            rowDiv.appendChild(cell);
        }
        boardElement.appendChild(rowDiv);
    }
    console.log("[偵錯日誌] 步驟 7: 棋盤繪製邏輯執行完畢。");
  }

  async function handleNumberInput(number) {
    if (!isTimerStartedByFirstMove && gameMode === 'single') {
        socket.emit('sudoku_player_first_move', { roomId: currentGameId });
        isTimerStartedByFirstMove = true;
    }
    if (!selectedCell || selectedCell.classList.contains("given-number") || selectedCell.classList.contains("hinted") || isPaused || currentViewedPlayerId !== myPlayerId) {
      return;
    }

    clearAllErrors();
    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);
    const mainValueSpan = selectedCell.querySelector(".main-value");
    const isPencilMode = pencilToggleCheckbox.checked;

    if (isPencilMode) {
        if (mainValueSpan.textContent !== "") {
            const userConfirmed = await showCustomConfirm("這將會清除您已填寫的數字，並切換為筆記。<br>確定要繼續嗎？");
            if (!userConfirmed) return;
        }
        mainValueSpan.textContent = "";
        puzzle[row][col].value = 0;
        const pencilMark = selectedCell.querySelector(`.pencil-mark[data-mark="${number}"]`);
        if (pencilMark) {
            let noteExists = pencilMarksData[row][col].has(number);
            if (noteExists) {
                pencilMark.textContent = "";
                pencilMarksData[row][col].delete(number);
            } else {
                pencilMark.textContent = number;
                pencilMarksData[row][col].add(number);
                if (gameSettings.difficulty === 'extreme' && !isFirstPencilMarkMade) {
                  socket.emit('sudoku_start_storm_timer', { gameId: currentGameId });
                  isFirstPencilMarkMade = true;
                  console.log('[風暴] 已觸發首次筆記，請求伺服器啟動風暴計時器。');
                }
            }
        }
    } else {
        pencilMarksData[row][col].clear();
        const pencilMarkElements = selectedCell.querySelectorAll('.pencil-mark');
        pencilMarkElements.forEach(mark => {
            mark.textContent = '';
        });
        mainValueSpan.textContent = number;
        puzzle[row][col] = { value: number, source: "player" };
    }

    recordHistoryState({ row, col });
    highlightAndCheckConflicts();
    updateProgress();
    updateNumberCounter();
    checkWinCondition();

    if (gameMode === 'multiplayer' && currentGameId) {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(row => row.map(cell => cell.value)),
            pencilMarks: pencilMarksData.map(row => row.map(set => Array.from(set)))
        });
    }
  }

  

function setupEventListeners() {
    console.log("[前端] 正在設定所有事件監聽器...");

    // 🤫 手機版開發者專屬後門：雙擊遊戲標題觸發神蹟
    const secretTitleTrigger = document.querySelector('.title-container h1');
    if (secretTitleTrigger) {
      let lastTap = 0;
      secretTitleTrigger.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 500 && tapLength > 0) {
          if (selectedCell) {
            e.preventDefault(); 
            lastTap = 0; // ✨ 核心防呆：成功觸發後立刻歸零記憶！強迫你必須重新「完整點兩下」才算數
            secretAutoFill();   
          }
        } else {
          lastTap = currentTime; // ✨ 只有在沒觸發雙擊時，才更新最後點擊時間
        }
      }, { passive: false });
    }
    // ✨ 新增：限制房號輸入框只能輸入大寫英文與數字
    if (roomIdInput) {
        roomIdInput.addEventListener("input", function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }

    // --- 多人連線彈窗按鈕事件 ---
    if (createMultiplayerRoomBtn) {
      createMultiplayerRoomBtn.addEventListener("click", () => {
        if (multiplayerJoinModalOverlay) multiplayerJoinModalOverlay.classList.add("hidden");
        socket.emit("createRoom", {
          playerName: myPlayerName,
          gameType: "sudoku",
          isSinglePlayer: false,
        });
        showWaitingScreen("正在建立多人房間...");
      });
    }

    if (joinRoomBtn) {
      const executeJoin = () => {
        // 確保 roomIdInput 存在，並取得它的值
        if (!roomIdInput) return;
        
        const roomId = roomIdInput.value.trim(); 
        if (!roomId) {
          showCustomAlert("請輸入房號！");
          return;
        }
        
        // ✨ 純粹發送請求，不切換畫面
        socket.emit("requestJoinRoom", {
          roomId: roomId,
          playerName: myPlayerName
        });
      };

      // 為了避免重複綁定，先移除可能存在的舊事件
      joinRoomBtn.replaceWith(joinRoomBtn.cloneNode(true));
      // 重新取得乾淨的按鈕
      const cleanJoinBtn = document.getElementById("join-room-btn");
      if (cleanJoinBtn) {
          cleanJoinBtn.addEventListener("click", executeJoin);
      }
      
      if (roomIdInput) {
          roomIdInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") executeJoin();
          });
      }
    }

    if (cancelMultiplayerBtn) {
      cancelMultiplayerBtn.addEventListener("click", () => {
        if (multiplayerJoinModalOverlay) multiplayerJoinModalOverlay.classList.add("hidden");
        if (sudokuModeModalOverlay) sudokuModeModalOverlay.classList.remove("hidden");
      });
    }

    // --- 處理伺服器回傳的房間事件 ---
    socket.on("roomCreated", (data) => {
        if (gameMode === 'multiplayer') {
            currentGameId = data.roomId;
            iAmHost = true;
            showWaitingScreen(currentGameId);
            updateTimerDisplay(0); // 觸發房號顯示
            updatePlayerListUI([{
                id: myPlayerId,
                name: myPlayerName,
                isHost: true
            }]);
        }
    });

    socket.on("joinRoomResult", (data) => {
        console.log("[前端] 收到 joinRoomResult:", data);
        if (gameMode === 'multiplayer') {
            if (data.success) {
                if (multiplayerJoinModalOverlay) multiplayerJoinModalOverlay.classList.add("hidden");
                currentGameId = data.roomId;
                iAmHost = data.isHost;
                
                // 1. 強制把畫面中間的字換成房號
                showWaitingScreen(currentGameId); 
                // 2. 強制把右上角換成房號
                updateTimerDisplay(0); 
                
            } else {
                hideWaitingScreen();
                showCustomAlert(data.message || "加入房間失敗");
                const modal = document.getElementById("multiplayer-join-modal-overlay");
                if (modal) modal.classList.remove("hidden");
            }
        }
    });

    socket.on("updateRoomPlayers", (data) => {
        console.log("[前端] 收到玩家名單更新:", data.players);
        
        // 1. 初始化或更新對手狀態清單
        opponentStates = data.players.map(p => ({
            playerId: p.id,
            playerName: p.name,
            progress: -1, 
            status: p.isHost ? 'host' : 'waiting', 
            finishTime: null
        }));
        
        // 2. 更新畫面上的玩家列表 (這會連帶觸發防呆機制，把按鈕變回大地色！)
        updatePlayerListUI(data.players);
        
        // 3. 更新進度條 UI
        updateOpponentProgressUI(); 
    });

    socket.on('sudoku_dimensional_storm_hit', (data) => {
        if (data && data.plan) {
            handleDimensionalStorm(data.plan);
        }
    });

    socket.on('sudoku_spectateSelectionUpdate', ({ playerId, selectedCoords }) => {
        if (currentlySpectatingId === playerId) {
            highlightOpponentSelection(selectedCoords);
        }
    });
    
    

    

    // --- 修正後的觀戰更新邏輯 ---
    socket.on('sudoku_spectateUpdate', (data) => {
        if (!data || !data.puzzle || !data.initialPuzzle || !data.playerName) return;
        
        const { puzzle: spectatePuzzle, initialPuzzle: spectateInitialPuzzle, playerName, pencilMarks, hintCount, validateCount } = data;
        
        // 繪製觀戰棋盤
        drawSpectatorBoard(spectatePuzzle, spectateInitialPuzzle, pencilMarks, playerName);
        
        // 更新右側資訊面板
        updateInfoPanelForSpectator(playerName, hintCount, validateCount);
    });

    socket.on('sudoku_full_state_update', (fullPlayerState) => {
        opponentStates = fullPlayerState;
        updateOpponentProgressUI();
        updatePauseButtonState();
        
        const myState = fullPlayerState.find(p => p.playerId === myPlayerId);

        if (myState) {
            // ✨ 終極防護：接收伺服器的通關認證！
            // 如果伺服器判定我完成了，但我本地還沒觸發通關流程，就立刻觸發！
            if (myState.status === 'finished' && !iHaveFinished) {
                iHaveFinished = true;
                updateProgress(); // 確保進度條達到 100%
                showWinModal();   // 🎆 放煙火與跳出繼續觀戰通知
            }

            myCurrentStatus = myState.status;
            hintCount = myState.hintCount;
            validateCount = myState.validateCount;
            updateGameInfo();

            const pauseCountDisplay = document.getElementById('info-pause-count-display');
            if (pauseCountDisplay) pauseCountDisplay.textContent = myState.pauseUses;
            
            if (menuRestartBtn) {
                if (myCurrentStatus === 'playing') {
                    const activePlayers = fullPlayerState.filter(p => p.status === 'playing').length;
                    if (activePlayers === 1 && fullPlayerState.length > 1) {
                        menuRestartBtn.textContent = '放棄遊戲';
                    } else {
                        menuRestartBtn.textContent = '投降';
                    }
                } else {
                    menuRestartBtn.textContent = '退出房間'; 
                }
            }
        }
    });


    socket.on('sudoku_dispatch_progress', ({ progress }) => {
        const percentageSpan = document.getElementById("generation-progress-percentage");
        const progressBarFill = document.getElementById("generation-progress-bar-fill");
        if (progress < 99) {
            const displayProgress = Math.min(progress, 1);
            if (percentageSpan) percentageSpan.textContent = `${displayProgress}%`;
            if (progressBarFill) progressBarFill.style.width = `${displayProgress}%`;
        }
    });

    

    socket.on('sudoku_gamePaused', ({ requesterId, playerName }) => {
        isPaused = true;
        if (requesterId === myPlayerId) {
            if (boardElement) {
                boardElement.innerHTML = '';
                boardElement.classList.add('is-loading');
                boardElement.innerHTML = `<div class="pause-text-container" id="pause-container"><h2>遊戲已暫停</h2><div class="play-icon">▶</div><p>點擊任意處繼續</p></div>`;
                boardElement.addEventListener('click', resumeGame, { once: true });
            }
            if (pauseBtn) {
                pauseBtn.textContent = "繼續";
                pauseBtn.disabled = false;
            }
            disableGameControls(true, ['pause-btn', 'game-menu-btn']); 
        } else {
            disableGameControls(true, ['game-menu-btn']);
            showCustomAlert(`${playerName || '對手'} 已暫停遊戲。`);
        }
    });

   

    socket.on('sudoku_timerStart', (data) => {
        const { puzzle: puzzleData, difficulty, holes, specialMode, blackoutNumbers } = data;
        if (!puzzleData) { console.error("計時開始，但未收到謎題資料！"); return; }
        const countdownOverlay = document.getElementById('countdown-overlay');
        if (countdownOverlay) countdownOverlay.remove();
        newGame(puzzleData);
        drawBoard();
        disableGameControls(false);
        if (difficulty) {
            puzzleHoles = holes; 
            gameSettings.specialMode = specialMode;
            applyDifficultySettings(difficulty, holes);
        }
        isTimerRunning = true;
        updateTimerDisplay(0);
        updatePauseButtonState();
        if (gameMode === 'multiplayer') {
            sessionStorage.setItem('sudoku_reconnect_gameId', currentGameId);
            sessionStorage.setItem('sudoku_reconnect_playerId', myPlayerId);
        }
    });

    socket.on('sudoku_countdown_started', () => {
        if (appContainer) appContainer.classList.remove('hidden');
        hideWaitingScreen();
        if (boardElement) {
            boardElement.innerHTML = '';
            boardElement.classList.add("is-loading");
            boardElement.innerHTML = `<div class="game-start-countdown"><p id="countdown-timer" style="font-size: 5em; font-weight: bold; color: var(--theme-color-dark);"></p></div>`;
            const timerEl = document.getElementById('countdown-timer');
            if (!timerEl) return;
            let count = 3;
            timerEl.textContent = count;
            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) { timerEl.textContent = count; } 
                else if (count === 0) { timerEl.textContent = "Go!"; } 
                else { clearInterval(countdownInterval); }
            }, 1000);
        }
    });

    socket.on("chatMessage", addChatMessageToUI);
  } // <--- 關鍵！提早把括號關起來，讓後面的函式獨立出來

  // --- 處理玩家選擇單人或多人模式 ---
  function handleModeSelection(mode) {
    console.log(`[模式選擇] 玩家選擇了: ${mode}`);
    gameMode = mode; 
    
    if (sudokuModeModalOverlay) sudokuModeModalOverlay.classList.add("hidden");

    if (mode === "single") {
      if (difficultyModalOverlay) difficultyModalOverlay.classList.remove("hidden");
    } else {
      // 顯示多人連線專屬的輸入/創建彈窗
      if (multiplayerJoinModalOverlay) {
        if (roomIdInput) roomIdInput.value = ""; // 清空之前的輸入
        multiplayerJoinModalOverlay.classList.remove("hidden");
      }
    }
  }

  // --- 🌟 補上的函式 1：重置回選擇模式畫面 ---
  function resetToModeSelection() {
      resetUIForNewGame(); // 確保清空前一局的狀態
      if (appContainer) appContainer.classList.add("hidden");
      if (solutionView) solutionView.classList.add("hidden");
      if (gameMenuModalOverlay) gameMenuModalOverlay.classList.add("hidden");
      
      if (sudokuModeModalOverlay) sudokuModeModalOverlay.classList.remove("hidden");
      if (timerValueElement) timerValueElement.textContent = "00:00:00";
  }

  // --- 🌟 補上的函式 2：重新開始當前單人遊戲 ---
  function restartCurrentGame() {
      // 1. 恢復初始盤面 (深拷貝)
      puzzle = JSON.parse(JSON.stringify(initialPuzzle));
      // 2. 清空所有筆記
      pencilMarksData = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
      // 3. 重置歷史紀錄
      history = [];
      historyIndex = -1;
      recordHistoryState(null);
      // 4. 重置計時器
      resetTimer();
      isTimerStartedByFirstMove = false;
      // 5. 解除暫停狀態
      isPaused = false;
      if (pauseBtn) pauseBtn.textContent = "暫停";
      // 6. 重新繪製畫面並清除錯誤紅框
      drawBoard();
      updateProgress();
      updateNumberCounter();
      clearAllHighlights();
      clearAllErrors();
  }

  // ======================================================
  // --- 3. 初始化函式 init ---
  // ======================================================
  function init() {
    // 3.1 獲取所有 DOM 元素
    boardElement = document.getElementById("game-board");
    timerValueElement = document.getElementById("timer-value");
    paletteElement = document.getElementById("number-palette");
    pencilToggleCheckbox = document.getElementById("pencil-toggle-checkbox");
    highlightHelperCheckbox = document.getElementById(
      "highlight-helper-checkbox"
    );
    multiplayerJoinModalOverlay = document.getElementById("multiplayer-join-modal-overlay");
    roomIdInput = document.getElementById("room-id-input");
    joinRoomBtn = document.getElementById("join-room-btn");
    createMultiplayerRoomBtn = document.getElementById("create-multiplayer-room-btn");
    cancelMultiplayerBtn = document.getElementById("cancel-multiplayer-btn");
    winModalOverlay = document.getElementById("win-modal-overlay");
    winModalNewGameBtn = document.getElementById("win-modal-new-game-btn");
    sudokuModeModalOverlay = document.getElementById(
      "sudoku-mode-modal-overlay"
    );
    singlePlayerBtn = document.getElementById("sudoku-single-player-btn");
    multiplayerBtn = document.getElementById("sudoku-multi-player-btn");
    difficultyModalOverlay = document.getElementById(
      "difficulty-modal-overlay"
    );
    difficultyButtons = document.querySelectorAll(
      "#difficulty-modal .difficulty-btn"
    );
    appContainer = document.querySelector(".app-container");
    validateBtn = document.getElementById("validate-btn");
    hintBtn = document.getElementById("hint-btn");
    pauseBtn = document.getElementById("pause-btn");
    controlsWrapper = document.querySelector(".controls-wrapper");
    solutionBoard = document.getElementById("solution-board");
    infoHintCount = document.getElementById("info-hint-count");
    infoValidateCount = document.getElementById("info-validate-count");
    progressBarFill = document.getElementById("progress-bar-fill");
    progressPercentage = document.getElementById("progress-percentage");
    difficultyDisplay = document.getElementById("difficulty-display");
    helpersDisplay = document.getElementById("helpers-display");
    gameMenuBtn = document.getElementById("game-menu-btn");
    gameMenuModalOverlay = document.getElementById("game-menu-modal-overlay");
    menuResumeBtn = document.getElementById("menu-resume-btn");
    menuRestartBtn = document.getElementById("menu-restart-btn");
    menuNewGameBtn = document.getElementById("menu-new-game-btn");
    menuBackToLobbyBtn = document.getElementById("menu-back-to-lobby-btn");
    cornerPlayerName = document.getElementById("player-name-display-corner");
    infoPanelTitle = document.getElementById('info-panel-title');
    singlePlayerInfoPanel = document.getElementById('single-player-info');
    multiplayerInfoPanel = document.getElementById('multiplayer-info');
    opponentProgressContainer = document.getElementById('opponent-progress-container');
    inGameChatMessages = document.querySelector('#in-game-chat-container .in-game-chat-messages');
    inGameChatInput = document.querySelector('#in-game-chat-container .in-game-chat-input input');
    inGameChatSendBtn = document.querySelector('#in-game-chat-container .in-game-chat-input button');
    multiplayerGameInfoContent = document.getElementById('multiplayer-game-info-content');
    inGameChatNotificationBadge = document.getElementById("ingame-chat-notification-badge");
    playerNameDisplay = document.getElementById('player-name-display');
    if (playerNameDisplay && myPlayerName) {
      playerNameDisplay.textContent = `玩家: ${myPlayerName}`;}

    sudokuJoinRequestsArea = document.getElementById(
      "sudoku-join-requests-area"
    );
    sudokuJoinRequestsList = document.getElementById(
      "sudoku-join-requests-list"
    );
    inGameControls = document.getElementById("in-game-controls");
    multiplayerWaitingPanel = document.getElementById(
      "multiplayer-waiting-panel"
    );
    waitingView = document.getElementById("waiting-view");
    solutionView = document.getElementById("solution-view");
    const solutionBackToLobbyBtn = document.getElementById(
      "solution-back-to-lobby-btn"
    );
    const solutionNewGameBtn = document.getElementById("solution-new-game-btn");

    if (solutionNewGameBtn) {
        solutionNewGameBtn.addEventListener("click", () => {
            if (gameMode === 'multiplayer') {
                sessionStorage.removeItem('sudoku_reconnect_gameId');
                sessionStorage.removeItem('sudoku_reconnect_playerId');
                console.log('[斷線保護] 玩家開啟新局，已清理重連資訊。');
            } else if (gameMode === 'single') {
                socket.emit('sudoku_leave_single_player_game');
                console.log('[Client] 已通知伺服器離開單人遊戲。');
            }
            // 重置 UI 並回到模式選擇畫面
            resetUIForNewGame();            
            if (appContainer) appContainer.classList.add("hidden");
          if (sudokuModeModalOverlay) sudokuModeModalOverlay.classList.remove("hidden");
      });
    }

    const startGameBtn = document.getElementById("sudoku-start-game-btn");
    const hostDifficultyButtons = document.querySelectorAll(
      "#host-difficulty-selection .difficulty-btn"
    );
    chatMessages = document.querySelector('#tab-content-lobby-chat .chat-messages');
    chatInput = document.querySelector('#tab-content-lobby-chat .chat-input-container input');
    chatSendBtn = document.querySelector('#tab-content-lobby-chat .chat-input-container button');
    chatNotificationBadge = document.getElementById("chat-notification-badge");
    undoBtn = document.getElementById('undo-btn');
    const winModalExtremeChallengeBtn = document.getElementById('win-modal-extreme-challenge-btn');
      if (undoBtn) updateUndoButtonState(); // 初始化按鈕狀態

    // 3.2 呼叫輔助初始化函式
    initializeTabs();
    initializeInGameTabs();

    // 3.3 綁定所有按鈕和元素的事件
    setupChat();
    setupInGameChat();

    if (singlePlayerBtn)
      singlePlayerBtn.addEventListener("click", () =>
        handleModeSelection("single")
      );
    if (multiplayerBtn)
      multiplayerBtn.addEventListener("click", () =>
        handleModeSelection("multiplayer")
      );

    if (startGameBtn) {
      startGameBtn.addEventListener("click", async () => {
        if (iAmHost && !startGameBtn.disabled) {
          const userConfirmed = await showCustomConfirm(
            "您確定要開始遊戲嗎？<br>開始後將無法再加入新玩家。"
          );
          if (userConfirmed) {
            appContainer.classList.add("hidden");
            difficultyModalOverlay.classList.remove("hidden");
          }
        }
      });
    }

    hostDifficultyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (iAmHost && !button.disabled) {
          const selectedDifficulty = button.dataset.difficulty;
          const customHoles = document.getElementById('custom-holes-slider') ? parseInt(document.getElementById('custom-holes-slider').value) : 45; // 取得洞數
          
          socket.emit("sudoku_startGame", {
            roomId: currentGameId,
            difficulty: selectedDifficulty,
            holes: customHoles
          });
          hideWaitingScreen();
          boardElement.innerHTML = "<h2>正在為所有玩家產生謎題...</h2>";
          boardElement.classList.add("is-loading");
        }
      });
    });

  if (winModalExtremeChallengeBtn) {
    winModalExtremeChallengeBtn.addEventListener('click', () => {
      // 點擊後，先重置遊戲狀態
      resetUIForNewGame();
      // 隱藏勝利視窗
      if (winModalOverlay) winModalOverlay.classList.add("hidden");
      
      // 讓主容器可見
      if (appContainer) appContainer.classList.remove("hidden");

      // ▼▼▼ 【核心重構】改為呼叫新的「建立單人房間」流程 ▼▼▼
      gameMode = 'single'; // 確保遊戲模式是單人

      socket.emit("createRoom", {
        playerName: myPlayerName,
        gameType: "sudoku",
        isSinglePlayer: true,
      });

      if (boardElement) {
          boardElement.innerHTML = "<h2>正在準備極限挑戰...</h2>";
          boardElement.classList.add("is-loading");
      }

      socket.once("roomCreated", (data) => {
        currentGameId = data.roomId;
        iAmHost = true;

        socket.emit("sudoku_startGame", {
          roomId: currentGameId,
          difficulty: 'extreme', // 直接鎖定極限難度
        });
      });
      // ▲▲▲ 重構結束 ▲▲▲
      });
    }

  // ==========================================
    // --- 1. 處理低中高與「自訂」按鈕的點擊 ---
    // ==========================================
    if (difficultyButtons) {
      difficultyButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          const selectedDifficulty = event.currentTarget.dataset.difficulty;
          
          // ✨ 如果點擊的是「自訂」，則關閉當前視窗，開啟滑桿彈窗並中斷後續動作
          if (selectedDifficulty === 'custom') {
            difficultyModalOverlay.classList.add("hidden");
            const customModal = document.getElementById("custom-difficulty-modal-overlay");
            if (customModal) customModal.classList.remove("hidden");
            return; 
          }

          if (gameMode === 'single') {
            socket.emit("createRoom", { playerName: myPlayerName, gameType: "sudoku", isSinglePlayer: true });
            socket.once("roomCreated", (data) => {
              currentGameId = data.roomId;
              iAmHost = true;
              socket.emit("sudoku_startGame", { roomId: currentGameId, difficulty: selectedDifficulty });
            });
          } else {
            socket.emit("sudoku_startGame", { roomId: currentGameId, difficulty: selectedDifficulty });
          }
        });
      });
    }

    // ==========================================
    // --- 2. 處理自訂滑桿彈窗的連動邏輯 ---
    // ==========================================
    const customDiffModal = document.getElementById("custom-difficulty-modal-overlay");
    const cancelCustomBtn = document.getElementById("cancel-custom-diff-btn");
    const confirmCustomBtn = document.getElementById("confirm-custom-diff-btn");
    const customSlider = document.getElementById("custom-holes-slider");
    const customDisplay = document.getElementById("holes-value-display");
    const customTextDisplay = document.getElementById("holes-diff-text");

    // 拖動滑桿時即時更新數字與難度文字
    if (customSlider) {
        customSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            customDisplay.textContent = val;
            if (val < 41) customTextDisplay.textContent = '簡單';
            else if (val < 51) customTextDisplay.textContent = '中等';
            else customTextDisplay.textContent = '困難';
        });
    }

    // 按下取消：關閉自訂彈窗，回到四顆按鈕的選擇畫面
    if (cancelCustomBtn) {
        cancelCustomBtn.addEventListener("click", () => {
            if (customDiffModal) customDiffModal.classList.add("hidden");
            if (difficultyModalOverlay) difficultyModalOverlay.classList.remove("hidden"); 
        });
    }

    
    // 按下確認：讀取滑桿數值並發送遊戲開始請求
    if (confirmCustomBtn) {
        confirmCustomBtn.addEventListener("click", () => {
            if (customDiffModal) customDiffModal.classList.add("hidden");

            let val = parseInt(customSlider.value);
            const actualHoles = val; 
            let baseDifficulty = 'medium';
            if (val <= 40) baseDifficulty = 'easy';
            else if (val >= 51) baseDifficulty = 'hard';

            // 🛑 這裡已刪除所有 boardElement.innerHTML 的干涉代碼，全權交給伺服器廣播處理
            if (gameMode === 'single') {
                socket.emit("createRoom", { playerName: myPlayerName, gameType: "sudoku", isSinglePlayer: true });
                socket.once("roomCreated", (data) => {
                    currentGameId = data.roomId;
                    iAmHost = true;
                    socket.emit("sudoku_startGame", { roomId: currentGameId, difficulty: baseDifficulty, holes: actualHoles });
                });
            } else {
                socket.emit("sudoku_startGame", { roomId: currentGameId, difficulty: baseDifficulty, holes: actualHoles });
            }
        });
    }


if (menuRestartBtn) {
  menuRestartBtn.addEventListener("click", async () => {
    if (gameMenuModalOverlay) gameMenuModalOverlay.classList.add("hidden");

    if (gameMode === 'multiplayer') {
      if (myCurrentStatus === 'playing') {
        const message = menuRestartBtn.textContent === '放棄遊戲' 
            ? "只剩您一個人了，確定要放棄遊戲並進行結算嗎？" 
            : "您確定要投降嗎？您將留在房間內但無法繼續作答。<br>可點選進度條切換至他人盤面觀戰。";
        const userConfirmed = await showCustomConfirm(message, "確認");
        if (userConfirmed) {
            socket.emit("sudoku_surrender", { roomId: currentGameId });
            disableGameControls(true, ['game-menu-btn']);
            iHaveSurrendered = true;
        }
      } else {
        // ✨ 投降後的退出房間確認彈窗
        const confirmed = await showCustomConfirm("確定要退出房間嗎？", "退出確認");
        if (confirmed) {
            socket.emit("leaveRoom", { roomId: currentGameId });
            resetToModeSelection();
        }
      }
    } else {
      // ▼▼▼ 【核心修正】單人模式的「重新開始本局」邏輯 ▼▼▼
      const userConfirmed = await showCustomConfirm("您確定要放棄當前的進度，並重新開始這一局嗎？", "重新開始？");
      if (userConfirmed) {
        restartCurrentGame();
      }
    }
  });
}


    if (boardElement) {

      boardElement.addEventListener('wheel', (event) => {
        // 1. 只有在遊戲進行中且未暫停時才作用
        if (isPaused || iHaveFinished || iHaveSurrendered || isInSolutionView) {
          return;
        }

        // 2. 阻止頁面滾動的預設行為，避免整個網頁上下動
        event.preventDefault();

        // 3. 切換筆記模式 checkbox 的狀態
        if (pencilToggleCheckbox) {
          pencilToggleCheckbox.checked = !pencilToggleCheckbox.checked;
        }
      }, { passive: false }); // passive: false 是為了讓 preventDefault() 能順利運作

      boardElement.addEventListener('mousedown', (event) => {
        // 1. 和滾輪事件一樣，先檢查遊戲是否處於鎖定狀態
        if (isPaused || iHaveFinished || iHaveSurrendered || isInSolutionView) {
          return;
        }

        // 2. 檢查被按下的按鈕是不是「中鍵」(event.button === 1)
        if (event.button === 1) {
          // 3. 阻止瀏覽器的預設行為！(例如 Windows 的自動滾動功能)
          event.preventDefault();

          // 4. 執行和滾輪事件完全一樣的「切換筆記模式」操作
          if (pencilToggleCheckbox) {
            pencilToggleCheckbox.checked = !pencilToggleCheckbox.checked;
          }
        }
      });
    }

    

    if (validateBtn)
      validateBtn.addEventListener("click", () => validateBoard(false));
    if (hintBtn) hintBtn.addEventListener("click", giveHint);
    if (highlightHelperCheckbox)
      highlightHelperCheckbox.addEventListener(
        "change",
        highlightAndCheckConflicts
      );
    if (pauseBtn)
      pauseBtn.addEventListener("click", () => {
        isPaused ? resumeGame() : pauseGame();
      });
    if (gameMenuBtn)
      gameMenuBtn.addEventListener("click", () =>
        gameMenuModalOverlay.classList.remove("hidden")
      );
    if (menuResumeBtn)
      menuResumeBtn.addEventListener("click", () =>
        gameMenuModalOverlay.classList.add("hidden")
      );
    

    if (menuNewGameBtn)
      menuNewGameBtn.addEventListener("click", async () => {
        if (gameMenuModalOverlay) gameMenuModalOverlay.classList.add("hidden");
        const wantsSolution = await showCustomConfirm(
          "在開啟新的一局前，您要先查看本局的完整解答嗎？",
          "查看解答？"
        );
        if (wantsSolution) {
          showSolutionView();
        } else {
          if (gameMode === 'multiplayer') {
              sessionStorage.removeItem('sudoku_reconnect_gameId');
              sessionStorage.removeItem('sudoku_reconnect_playerId');
              console.log('[斷線保護] 玩家開啟新局，已清理重連資訊。');
          }
          else if (gameMode === 'single') { // 把原本的程式碼包在 else if 裡
            socket.emit('sudoku_leave_single_player_game');
            console.log('[Client] 已通知伺服器離開單人遊戲。');
          }
          resetUIForNewGame();
          appContainer.classList.add("hidden");
          // 我們之前修正過的，去模式選擇而不是難度選擇
          sudokuModeModalOverlay.classList.remove("hidden"); 
        }
      });

async function handleNumberInput(number) {
  if (!isTimerStartedByFirstMove && gameMode === 'single') {
        socket.emit('sudoku_player_first_move', { roomId: currentGameId });
        isTimerStartedByFirstMove = true;
    }
    if (
      !selectedCell ||
      selectedCell.classList.contains("given-number") ||
      selectedCell.classList.contains("hinted") ||
      isPaused ||
      currentViewedPlayerId !== myPlayerId
    ) {
      return;
    }

    clearAllErrors();
    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    // 【BUG 修正】將 mainValueSpan 的定義放在 if/else 判斷之前
    const mainValueSpan = selectedCell.querySelector(".main-value");
    const isPencilMode = pencilToggleCheckbox.checked;

    if (isPencilMode) {
        if (mainValueSpan.textContent !== "") {
            const userConfirmed = await showCustomConfirm(
                "這將會清除您已填寫的數字，並切換為筆記。<br>確定要繼續嗎？"
            );
            if (!userConfirmed) return;
        }
        mainValueSpan.textContent = "";
        puzzle[row][col].value = 0;
        const pencilMark = selectedCell.querySelector(
            `.pencil-mark[data-mark="${number}"]`
        );
        if (pencilMark) {
            let noteExists = pencilMarksData[row][col].has(number);
            
            if (noteExists) {
                pencilMark.textContent = "";
                pencilMarksData[row][col].delete(number);
            } else {
                pencilMark.textContent = number;
                pencilMarksData[row][col].add(number);

                if (gameSettings.difficulty === 'extreme' && !isFirstPencilMarkMade) {
                  socket.emit('sudoku_start_storm_timer', { gameId: currentGameId });
                  isFirstPencilMarkMade = true;
                  console.log('[風暴] 已觸發首次筆記，請求伺服器啟動風暴計時器。');
                }
            }
        }
    } else {
        
       
        pencilMarksData[row][col].clear();
        const pencilMarkElements = selectedCell.querySelectorAll('.pencil-mark');
        pencilMarkElements.forEach(mark => {
            mark.textContent = '';
        });
        mainValueSpan.textContent = number; // 現在這裡可以正常運作了
        puzzle[row][col] = { value: number, source: "player" };
    }

    // --- 後續的函式呼叫 ---
    recordHistoryState({ row, col });
    highlightAndCheckConflicts();
    updateProgress();
    updateNumberCounter();
    checkWinCondition();

    if (gameMode === 'multiplayer' && currentGameId) {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(row => row.map(cell => cell.value)),
            pencilMarks: pencilMarksData.map(row => row.map(set => Array.from(set)))
        });
    }
}

      if (paletteElement) {
      paletteElement.innerHTML = "";
      for (let i = 1; i <= 9; i++) {
        const numberDiv = document.createElement("div");
        numberDiv.classList.add("number");
        numberDiv.textContent = i;
        numberDiv.addEventListener("click", () => {
          // 新增 !iHaveSurrendered 的檢查
          if (selectedCell && !isPaused && !iHaveSurrendered) {
            handleNumberInput(i);
          }
        });
        paletteElement.appendChild(numberDiv);
      }
      
      // ▼▼▼▼▼ 用以下這整段邏輯，來取代您舊的 undo/delete 邏輯 ▼▼▼▼▼

      // 復原
      const undoDiv = document.createElement("div");
      undoDiv.id = "undo-btn";
      undoDiv.classList.add("control-key", "control-button-style");
      undoDiv.innerHTML = "<span>Undo</span>";
      undoDiv.addEventListener("click", undo); // 呼叫新的 undo 函式
      paletteElement.appendChild(undoDiv);

      // 取消復原
      const redoDiv = document.createElement("div");
      redoDiv.id = "redo-btn";
      redoDiv.classList.add("control-key", "control-button-style");
      redoDiv.innerHTML = "<span>Redo</span>";
      redoDiv.addEventListener("click", redo); // 呼叫新的 redo 函式
      paletteElement.appendChild(redoDiv);

      // 建立「Delete」按鈕
      const deleteDiv = document.createElement("div");
      deleteDiv.classList.add("delete-key", "control-key");
      deleteDiv.innerHTML = "&#9003;";
      deleteDiv.addEventListener("click", clearSelectedCellContent);
      paletteElement.appendChild(deleteDiv);

      // 初始化所有按鈕的狀態
      updateUndoButtonState();
      updateRedoButtonState();
      // ▲▲▲▲▲ 取代結束 ▲▲▲▲▲
    }
    
    document.addEventListener("keydown", (event) => {
    
    if (isModalOpen || isPaused || isInSolutionView || iHaveSurrendered) return;
    if (isModalOpen) {
      return;
    }

    if (isPaused || isInSolutionView) return;
    
    const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type === "text") {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (activeEl === chatInput && chatSendBtn) chatSendBtn.click();
          if (activeEl === inGameChatInput && inGameChatSendBtn) inGameChatSendBtn.click();
        }
        return;
      }
      
      
      if (selectedCell && event.key === "`") {
        event.preventDefault();
        secretAutoFill();
        return; // 執行完就結束，不干擾其他按鍵
      }
      

      const currentFocus = document.querySelector(".keyboard-focus");
      const selected = selectedCell;
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        let startCoords = { row: 0, col: 0 };
        let startCell =
          currentFocus ||
          selected ||
          document.querySelector(
            `.cell[data-row='${lastSelectedCoords?.row || 0}'][data-col='${
              lastSelectedCoords?.col || 0
            }']`
          );
        if (startCell) {
          startCoords = {
            row: parseInt(startCell.dataset.row),
            col: parseInt(startCell.dataset.col),
          };
        }
        let nextRow = startCoords.row,
          nextCol = startCoords.col;
        switch (event.key) {
          case "ArrowUp":
            nextRow = nextRow > 0 ? nextRow - 1 : 8;
            break;
          case "ArrowDown":
            nextRow = nextRow < 8 ? nextRow + 1 : 0;
            break;
          case "ArrowLeft":
            nextCol = nextCol > 0 ? nextCol - 1 : 8;
            break;
          case "ArrowRight":
            nextCol = nextCol < 8 ? nextCol + 1 : 0;
            break;
        }
        const nextCell = document.querySelector(
          `.cell[data-row='${nextRow}'][data-col='${nextCol}']`
        );
        if (nextCell) {
          if (currentFocus) currentFocus.classList.remove("keyboard-focus");
          nextCell.classList.add("keyboard-focus");
          selectCell(nextCell, true);
        }
      } else if (selected && event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        handleNumberInput(parseInt(event.key));
      } else if (
        selected &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        event.preventDefault();
        clearSelectedCellContent();
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (pencilToggleCheckbox)
          pencilToggleCheckbox.checked = !pencilToggleCheckbox.checked;
      } else if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (highlightHelperCheckbox) {
          highlightHelperCheckbox.checked = !highlightHelperCheckbox.checked;
          highlightAndCheckConflicts();
        }
      }
});

   document.addEventListener("visibilitychange", () => {
    // 只有在「視窗被切換」且「遊戲模式為單人」且「未暫停」且「不在解答畫面」時，才觸發自動暫停
    if (document.hidden && gameMode === 'single' && !isPaused && !isInSolutionView) { 
      pauseGame(true); // 自動暫停
    }
  });
    // 3.4 綁定 Socket.IO 事件監聽器

    socket.on('sudoku_dimensional_storm_hit', (data) => {
        if (data && data.plan) {
            handleDimensionalStorm(data.plan);
        }
    });

  socket.on('sudoku_spectateSelectionUpdate', ({ playerId, selectedCoords }) => {
    // 只有當我們正在觀看這位玩家時，才更新他/她的高亮
    if (currentlySpectatingId === playerId) {
        highlightOpponentSelection(selectedCoords);
    }
});


socket.on('sudoku_storm_hit', ({ r, c, mark }) => {
      // 1. 無論如何，都先跳出帶有標題的通知
      showCustomAlert("你被颱風尾掃到，一個隨筆的記憶被吹走了?!", "⚠️颱風警報！");

      // 2. 檢查伺服器是否真的有指定要清除的筆記
      if (r !== null && c !== null && mark !== null) {
        if (!pencilMarksData || !pencilMarksData[r]) return;

        // 3. 更新本地的筆記資料
        pencilMarksData[r][c].delete(mark);
        
        // 4. 只重繪被影響的那一個格子
        redrawCell(r, c);

        
      } else {
        
      }
    });

    function redrawCell(row, col) {
  const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
  if (!cell) return;
  const mainValueSpan = cell.querySelector('.main-value');
  const pencilGrid = cell.querySelector('.pencil-grid');
  if (mainValueSpan) {
    mainValueSpan.textContent = puzzle[row][col].value === 0 ? '' : puzzle[row][col].value;
  }
  if (pencilGrid) {
    pencilGrid.innerHTML = '';
    const marks = pencilMarksData[row][col];
    for (let k = 1; k <= 9; k++) {
        const pencilMark = document.createElement("div");
        pencilMark.classList.add("pencil-mark");
        pencilMark.dataset.mark = k;
        if (marks.has(k)) {
            pencilMark.textContent = k;
        }
        pencilGrid.appendChild(pencilMark);
    }
  }
}

  

  socket.on('reconnectionSuccess', (data) => {
      console.log(`%c[斷線保護] 🎊 重連成功！伺服器已核准身分。`, `color: #28a745; font-weight: bold; font-size: 1.1em;`);
      console.log(`%c ➜ 正在恢復至房間 ${data.roomId} 的遊戲狀態...`, `color: #007bff;`);
      
      gameMode = 'multiplayer';
      currentGameId = data.roomId;
      
      // 1. 恢復 UI 面板
      appContainer.classList.remove('hidden');
      sudokuModeModalOverlay.classList.add('hidden');
      difficultyModalOverlay.classList.add('hidden');
      setUIState('playing_multiplayer');
      
      if (data.gameState && data.gameState.puzzle && data.playerData) {
          // 2. 恢復初始盤面與難度設定
          initialPuzzle = JSON.parse(JSON.stringify(data.gameState.puzzle.map(row => row.map(num => ({ value: num, source: num !== 0 ? "initial" : "empty" })))));
          
          if (data.gameState.difficulty) {
              applyDifficultySettings(data.gameState.difficulty, data.gameState.holes);
          }

          // 3. ✨ 核心修復：精準注入玩家的私人進度
          const pd = data.playerData;
          puzzle = JSON.parse(JSON.stringify(pd.currentPuzzle));
          
          // 恢復筆記 (將陣列轉回 Set)
          pencilMarksData = pd.pencilMarks.map(row => row.map(arr => new Set(arr)));

          // 恢復工具使用狀態
          hintCount = pd.hintCount;
          validateCount = pd.validateCount;
          
          const pauseCountDisplay = document.getElementById('info-pause-count-display');
          if (pauseCountDisplay) pauseCountDisplay.textContent = pd.pauseUses;

          // 4. 重置環境變數與歷史紀錄 (建立第一個快照)
          iHaveSurrendered = false;
          iHaveFinished = false;
          currentlySpectatingId = null;
          isPaused = false;
          history = [];
          historyIndex = -1;
          selectedCell = null;
          lastSelectedCoords = null;
          myCurrentStatus = 'playing';
          
          if (pauseBtn) pauseBtn.textContent = "暫停";
          
          // 建立第一筆歷史紀錄 (讓 Undo 可以回到重連當下的狀態)
          recordHistoryState(null);
          
          // 5. 重新繪製畫面與啟動計時器
          drawBoard();
          highlightAndCheckConflicts();
          updateProgress();
          updateNumberCounter();
          updateGameInfo();
          updateTimerDisplay(data.gameState.seconds);
          isTimerRunning = true;
          disableGameControls(false);
          updatePauseButtonState();
      }
  });


socket.on('sudoku_gameOver', ({ finalRanking }) => {
        isPaused = true;
        disableGameControls(true, ['game-menu-btn']); 
        
        const winTitle = document.getElementById('win-modal-title');
        const winSubtitle = document.getElementById('win-modal-subtitle');
        if (winTitle) winTitle.textContent = "🏆 最終排行榜";
        if (winSubtitle) winSubtitle.classList.add("hidden");

        // ✨ 建立詳細的表格排行榜 HTML
        let rankingHTML = `
        <div class="ranking-table-container">
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>排名</th><th>玩家</th><th>耗時</th><th>正確率</th><th>填寫率</th><th>用掉提示</th><th>用掉檢查</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (finalRanking && finalRanking.length > 0) {
            finalRanking.forEach((player, index) => {
                // 時間格式化 (若為未完成且無時間紀錄則顯示 --:--)
                const timeStr = player.finishTime !== 999999 
                    ? new Date(player.finishTime * 1000).toISOString().substr(11, 8) 
                    : '--:--:--';
                
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎖️';
                
                let statusText = '未知';
                let statusColor = '#333';
                if (player.status === 'finished') { statusText = '通關'; statusColor = '#28a745'; }
                else if (player.status === 'surrendered') { statusText = '投降'; statusColor = '#dc3545'; }
                else if (player.status === 'disconnected') { statusText = '離線'; statusColor = '#6c757d'; }
                else { statusText = '未完成'; statusColor = '#f39c12'; }

                rankingHTML += `
                <tr>
                    <td>${medal}</td>
                    <td style="font-weight: bold;">${player.playerName}</td>
                    <td>${timeStr}</td>
                    <td>${player.accuracy}%</td>
                    <td>${player.fillRate}%</td>
                    <td>${player.hintCount}</td>
                    <td>${player.validateCount}</td>
                    
                </tr>`;
            });
        }
        rankingHTML += '</tbody></table></div>';

        const winStatContainer = document.getElementById('win-stats-container');
        if (winStatContainer) winStatContainer.innerHTML = rankingHTML;

        // 隱藏觀戰按鈕，顯示退出房間
        const winModalExtremeBtn = document.getElementById('win-modal-extreme-challenge-btn');
        if (winModalExtremeBtn) winModalExtremeBtn.classList.add("hidden");

        const exitRoomBtn = document.getElementById('win-modal-exit-room-btn');
        if (exitRoomBtn) {
            exitRoomBtn.classList.remove("hidden");
            exitRoomBtn.onclick = () => {
                socket.emit("leaveRoom", { roomId: currentGameId });
                resetToModeSelection();
            };
        }

        // 修改再來一局按鈕
        if (winModalNewGameBtn) {
            winModalNewGameBtn.classList.remove("hidden");
            if (iAmHost) {
                winModalNewGameBtn.textContent = "再來一局 (發送邀請)";
                winModalNewGameBtn.onclick = () => {
                    currentlySpectatingId = null;
                    socket.emit('sudoku_request_rematch', { roomId: currentGameId });
                    winModalOverlay.classList.add("hidden");
                    resetUIForNewGame();
                    updateTimerDisplay(0);
                    showWaitingScreen(currentGameId);
                };
            } else {
                winModalNewGameBtn.textContent = "等待房主決定...";
                winModalNewGameBtn.disabled = true;
            }
        }

        if (winModalOverlay) winModalOverlay.classList.remove("hidden");
    });

    // --- 3. 接收房主的再來一局邀請 ---
    socket.on('sudoku_rematch_requested', async () => {
        if (winModalOverlay) winModalOverlay.classList.add("hidden");
        const confirmed = await showCustomConfirm("房主邀請您再來一局！是否接受？<br>點選確認進入等待室，點選取消退出房間。", "再來一局？", "接受", "退出房間");
        if (confirmed) {
           currentlySpectatingId = null; // ✨ 強制清除觀戰狀態
            socket.emit('sudoku_accept_rematch', { roomId: currentGameId });
            resetUIForNewGame();
            updateTimerDisplay(0); // ✨ 強制立刻刷新右上角，變回顯示房號
            showWaitingScreen("正在準備新局...");
        } else {
            socket.emit("leaveRoom", { roomId: currentGameId });
            resetToModeSelection();
        }
    });

    // --- 4. 時間更新監聽器 ---
    socket.on('sudoku_timeUpdate', ({ seconds: serverSeconds }) => {
        if (!isPaused) updateTimerDisplay(serverSeconds);
    });

    // ✨ 最完美的載入畫面與隱藏彈窗邏輯
    socket.on('sudoku_generation_started', (data) => {
        console.log("[前端日誌] 收到 'sudoku_generation_started' 事件。", data);
        
        // 1. 強制隱藏所有可能擋住畫面的彈窗與大廳文字
        const waitingView = document.getElementById("waiting-view");
        if (waitingView) waitingView.classList.add("hidden");
        // ✨ 解決房主卡住的關鍵：強制隱藏難度選擇彈窗！
        if (difficultyModalOverlay) difficultyModalOverlay.classList.add("hidden"); 
        if (appContainer) appContainer.classList.remove("hidden");

        // 2. 初始化控制面板
        if (gameMode === 'single') {
            // ✨ 單人模式：直接顯示包含數字小鍵盤的遊戲面板 (填補空白)
            if (inGameControls) inGameControls.classList.remove('hidden');
            if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.remove('hidden');
            if (multiplayerWaitingPanel) multiplayerWaitingPanel.classList.add('hidden');
        } else {
            // ✨ 多人模式：顯示聊天室與玩家列表，隱藏數字鍵盤
            if (inGameControls) inGameControls.classList.add('hidden');
            if (multiplayerWaitingPanel) multiplayerWaitingPanel.classList.remove('hidden');
        }
        
        resetControlPanel();
        // 鎖死所有按鍵，只留遊戲選單可以點
        disableGameControls(true);

        // 3. 改變左側棋盤區顯示進度條或文字
        if (boardElement) {
            boardElement.classList.remove("hidden");
            boardElement.classList.add("is-loading");
            
            const actualHoles = data.holes || 45;
            if (actualHoles >= 58) {
                boardElement.innerHTML = `
                    <div class="loading-container">
                        <h2 id="loading-text-animation" style="color: var(--theme-color-dark); min-height: 35px;">伺服器準備中...</h2>
                        <div class="progress-bar-container" style="display:flex; width:100%; gap:10px; align-items:center;">
                            <div class="progress-bar" style="flex-grow:1; height:14px; background:#eae4dd; border-radius:7px; overflow:hidden;">
                                <div id="generation-progress-bar-fill" style="width:0%; height:100%; background:var(--theme-color-dark); transition: width 0.3s;"></div>
                            </div>
                            <span id="generation-progress-percentage" style="font-weight:bold;">0%</span>
                        </div>
                    </div>`;
                
                // 啟動無限循環播放動畫，直到畫面被倒數計時切換掉為止
                const playAnimation = async () => {
                    let target = document.getElementById("loading-text-animation");
                    while (target) {
                        await runOneAnimationCycle(target);
                        target = document.getElementById("loading-text-animation"); 
                    }
                };
                playAnimation();

            } else {
                boardElement.innerHTML = `<div class="loading-container"><h2>正在產生題目...</h2></div>`;
            }
        }
    });


socket.on('sudoku_dispatch_progress', ({ progress }) => {
    const percentageSpan = document.getElementById("generation-progress-percentage");
    const progressBarFill = document.getElementById("generation-progress-bar-fill");

    // 【⭐星探 A 的工作⭐】
    // 任務：只負責更新前 5% 的進度條。
    // 為了避免和星探 B 的進度衝突，我們只在 progress < 95 時更新
    // (因為當 dispatch progress 到 100% 時，completion progress 可能還在 0%)
    if (progress < 99) {
        const displayProgress = Math.min(progress, 1); // 最多只跑到 5%
        if (percentageSpan) percentageSpan.textContent = `${displayProgress}%`;
        if (progressBarFill) progressBarFill.style.width = `${displayProgress}%`;
    }
});


    // ✨ 前端只負責接收數字並改變寬度，計算邏輯全交給後端的大腦
    socket.on('sudoku_generation_progress', ({ progress }) => {
        const percentageSpan = document.getElementById("generation-progress-percentage");
        const progressBarFill = document.getElementById("generation-progress-bar-fill");
        
        if (percentageSpan) percentageSpan.textContent = `${progress}%`;
        if (progressBarFill) progressBarFill.style.width = `${progress}%`;
    });

  socket.on('sudoku_gamePaused', ({ requesterId, playerName }) => {
  // 步驟 1：更新本地的暫停狀態
  isPaused = true;
  
  // 步驟 2：判斷暫停是由誰發起的
  if (requesterId === myPlayerId) {
    // 【情況一：暫停是我自己發起的】
    
    // ▼▼▼ 【核心修正】將你想要的豐富UI邏輯放在這裡 ▼▼▼
    if (boardElement) {
      // 1. 【安全】徹底清空棋盤的內容，防止從主控台查看
      boardElement.innerHTML = '';

      // 2. 【美觀】加上 is-loading class 以便CSS能將內容置中
      boardElement.classList.add('is-loading');

      // 3. 【互動】插入你設計的、包含大播放鍵的暫停畫面
      boardElement.innerHTML = `
        <div class="pause-text-container" id="pause-container">
          <h2>遊戲已暫停</h2>
          <div class="play-icon">▶</div>
          <p>點擊任意處繼續</p>
        </div>
      `;
      
      // 4. 【功能】為整個棋盤（現在只顯示暫停畫面）加上「繼續遊戲」的點擊事件
      boardElement.addEventListener('click', resumeGame, { once: true });
    }
    
    // 更新右下角控制面板的「暫停/繼續」按鈕狀態
    if (pauseBtn) {
      pauseBtn.textContent = "繼續";
      pauseBtn.disabled = false;
    }
    
    // 禁用除了「繼續」和「選單」外的所有遊戲按鈕
    disableGameControls(true, ['pause-btn', 'game-menu-btn']); 
    // ▲▲▲ 修正結束 ▲▲▲

  } else {
    // 【情況二：暫停是其他玩家發起的（僅限多人模式）】
    disableGameControls(true, ['game-menu-btn']); // 禁用所有操作
    showCustomAlert(`${playerName || '對手'} 已暫停遊戲。`);
  }
});

// ✨ 接收參數 data
    socket.on('sudoku_gameResumed', (data) => {
        isPaused = false;
        if (boardElement && boardElement.classList.contains('is-loading')) {
            boardElement.classList.remove("is-loading");
            drawBoard(); 
        }
        disableGameControls(false); 
        
        if (pauseBtn) pauseBtn.textContent = "暫停";

        // ✨ 如果收到解除暫停的通知，且解除的人不是我，就跳出提示彈窗！
        if (data && data.resumerId !== myPlayerId) {
            showCustomAlert("對手已結束暫停，遊戲繼續！");
        }
    });

 socket.on('sudoku_timerStart', (data) => {
  console.log('[Frontend] 收到 sudoku_timerStart 事件，接收到的 data:', data);
    const { puzzle: puzzleData, difficulty, holes, specialMode, blackoutNumbers } = data;

    if (!puzzleData) {
        console.error("計時開始，但未收到謎題資料！");
        return;
    }

    const countdownOverlay = document.getElementById('countdown-overlay');
    if (countdownOverlay) countdownOverlay.remove();

    newGame(puzzleData);
    drawBoard();
    disableGameControls(false);

    if (difficulty) {
      puzzleHoles = holes; 
      gameSettings.specialMode = specialMode;
      applyDifficultySettings(difficulty, holes);
    }

    isTimerRunning = true;
    updateTimerDisplay(0);
    updatePauseButtonState()

    if (gameMode === 'multiplayer') {
            console.log(`[斷線保護] 多人遊戲開始，已儲存重連資訊。PlayerID: ${myPlayerId}, RoomID: ${currentGameId}`);
            sessionStorage.setItem('sudoku_reconnect_gameId', currentGameId);
            sessionStorage.setItem('sudoku_reconnect_playerId', myPlayerId);
        }
});

    socket.on('sudoku_countdown_started', () => {
    // 收到「準備倒數」信號，此時還沒有謎題資料
    
    // 步驟 1：確保遊戲主容器是可見的
    if (appContainer) appContainer.classList.remove('hidden');

    // 步驟 2：隱藏等待室畫面
    hideWaitingScreen();
    
    // 步驟 3：清空棋盤區，並準備顯示倒數
    if (boardElement) {
        boardElement.innerHTML = ''; // 清空可能存在的 "生成中..." 文字
        boardElement.classList.add("is-loading"); // 使用 is-loading 來讓內容置中
    }
    
    // 步驟 4：直接在棋盤區建立並顯示倒數動畫
    // 這次我們不再建立覆蓋層，而是直接修改 is-loading 畫面的內容
    if (boardElement) {
        boardElement.innerHTML = `
            <div class="game-start-countdown">
                <p id="countdown-timer" style="font-size: 5em; font-weight: bold; color: var(--theme-color-dark);"></p>
            </div>
        `;

        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;

        let count = 3;
        timerEl.textContent = count; // 立即顯示 3

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                timerEl.textContent = count;
            } else if (count === 0) {
                timerEl.textContent = "Go!";
            } else {
                clearInterval(countdownInterval);
                // 倒數結束後，可以選擇性地清空畫面，等待 timerStart 事件
                // boardElement.innerHTML = ''; 
            }
        }, 1000);
    }
});

    // ✨ Messenger 風格：可拖曳聊天大頭貼邏輯
    const floatingBtn = document.getElementById('mobile-floating-chat-btn');
    const chatTab = document.getElementById('tab-content-ingame-chat');
    
    if (floatingBtn) {
        let isDragging = false;
        let startX, startY;
        let initialX, initialY;

        // 監聽觸控開始
        floatingBtn.addEventListener('touchstart', (e) => {
            isDragging = false; // 重置拖拽標記
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            // 取得目前的位移位置
            const rect = floatingBtn.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
        }, { passive: true });

        // 監聽觸控移動
floatingBtn.addEventListener('touchmove', (e) => {
    // ✨ 客觀防護：如果不是單指觸控，或是按鈕不存在，就不處理
    if (!e.touches || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // ✨ 防呆邏輯：滑動超過 5px 才判定為拖曳，避免手抖誤判為點擊
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
        
        // ✨ 強制阻止瀏覽器預設的滾動行為 (必須搭配 { passive: false })
        if (e.cancelable) {
            e.preventDefault(); 
        }
        
        // 1. 計算預計的新位置
        let newLeft = initialX + dx;
        let newTop = initialY + dy;

        // 2. 獲取螢幕與按鈕的物理尺寸
        const btnRect = floatingBtn.getBoundingClientRect();
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // 3. 上下邊界限制：不准超過 0，也不准超過 (螢幕高度 - 按鈕高度)
        if (newTop < 0) newTop = 0;
        if (newTop > screenH - btnRect.height) newTop = screenH - btnRect.height;

        // 4. 左右邊界限制 (順便防滑出螢幕)
        if (newLeft < 0) newLeft = 0;
        if (newLeft > screenW - btnRect.width) newLeft = screenW - btnRect.width;

        // 5. 套用位置 (使用 setProperty 加上 important 壓制 CSS)
        floatingBtn.style.setProperty('left', newLeft + 'px', 'important');
        floatingBtn.style.setProperty('top', newTop + 'px', 'important');
        floatingBtn.style.setProperty('bottom', 'auto', 'important');
        floatingBtn.style.setProperty('right', 'auto', 'important');
    }
}, { passive: false }); // ✨ 必須是 false 才能使用 preventDefault()

        // 監聽觸控結束
        floatingBtn.addEventListener('touchend', (e) => {
            if (!isDragging) {
                if (chatTab) {
                    chatTab.classList.toggle('show-floating');
                    if (chatTab.classList.contains('show-floating')) {
                        unreadInGameMessages = 0;
                        updateInGameChatBadge();
                        
                        // 強制隱藏紅點，並確保數字歸零
                        const badge = document.getElementById('mobile-chat-badge');
                        if (badge) {
                            badge.textContent = '0';
                            badge.style.setProperty('display', 'none', 'important');
                        }
                        
                        if (typeof adjustFloatingChatSize === 'function') {
                            adjustFloatingChatSize();
                        }
                        
                        const container = document.querySelector('.in-game-chat-messages');
                        if (container) container.scrollTop = container.scrollHeight;
                    }
                }
            } else {
                // 拖動結束，吸附邊界特效 (✨ 核心修正：同樣使用 setProperty 加上 important)
                const screenWidth = window.innerWidth;
                const finalRect = floatingBtn.getBoundingClientRect();
                
                // 簡單吸附：靠近哪邊就貼哪邊
                if (finalRect.left + finalRect.width / 2 < screenWidth / 2) {
                    floatingBtn.style.setProperty('left', '10px', 'important');
                } else {
                    floatingBtn.style.setProperty('left', (screenWidth - finalRect.width - 10) + 'px', 'important');
                }
            }
        });
    }

    // ==========================================
    // ✨ 終極防護：虛擬鍵盤自適應魔法 (Visual Viewport)
    // ==========================================
    function adjustFloatingChatSize() {
        const chatWindow = document.getElementById('tab-content-ingame-chat');
        if (!chatWindow || !chatWindow.classList.contains('show-floating')) return;

        if (window.visualViewport) {
            const vv = window.visualViewport;
            // 判斷鍵盤是否開啟：如果真實可視高度小於螢幕物理高度的 85%，代表鍵盤出來了
            const isKeyboardOpen = vv.height < window.innerHeight * 0.85; 

            // 1. 動態計算頂部位置 (解決 iOS 整個畫面被往上推的問題)
            chatWindow.style.setProperty('top', (vv.offsetTop + 10) + 'px', 'important');
            
            if (isKeyboardOpen) {
                // 2. 鍵盤彈出時：強制聊天室高度等於「真實可視高度 - 20px 縫隙」
                chatWindow.style.setProperty('height', (vv.height - 20) + 'px', 'important');
                chatWindow.style.setProperty('bottom', 'auto', 'important');
            } else {
                // 3. 鍵盤收起時：恢復原本的設計，避開底部的遊戲按鈕
                chatWindow.style.setProperty('height', 'auto', 'important');
                chatWindow.style.setProperty('bottom', '85px', 'important');
            }

            // 確保每次改變大小時，訊息都能滾動到最底下的最新一則
            const msgBox = document.querySelector('.in-game-chat-messages');
            if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
        }
    }

    // 監聽鍵盤的彈出(resize)與畫面的推擠(scroll)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustFloatingChatSize);
        window.visualViewport.addEventListener('scroll', adjustFloatingChatSize);
    }

    setupEventListeners();

    // 3.5 設定初始畫面
    if (initialState && initialState.roomId && initialState.players && initialState.players.length > 0) {
        // 這是「加入別人房間」的流程
        iAmHost = false;
        gameMode = 'multiplayer';
        currentGameId = initialState.roomId;
        appContainer.classList.remove('hidden');
        showWaitingScreen(currentGameId);
        updatePlayerListUI(initialState.players);
        // 初始化 opponentStates
        opponentStates = initialState.players.map(p => ({
            playerId: p.id,
            playerName: p.name,
            progress: -1, // 初始進度
            status: p.isHost ? 'host' : 'waiting',
            finishTime: null
        }));
        updateOpponentProgressUI(); // 首次更新觀戰列表
        if (boardElement) {
            boardElement.classList.add('is-loading');
            boardElement.innerHTML = '<h2></h2>';
        }
    } else {
        // 這是「自己開新局」的流程，顯示單人/多人模式選擇
        if(sudokuModeModalOverlay) {
            sudokuModeModalOverlay.classList.remove('hidden');
        } else {
            console.error("錯誤：找不到 #sudoku-mode-modal-overlay 元素！");
        }
    }
  }

  function highlightOpponentSelection(coords) {
    // 移除所有舊的「對手高亮」
    document.querySelectorAll('.cell.opponent-selected, .cell.opponent-highlight-rc').forEach(c => {
        c.classList.remove('opponent-selected', 'opponent-highlight-rc');
    });

    if (coords) {
        const { row, col } = coords;
        const cell = document.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
        if (cell) {
            cell.classList.add('opponent-selected');
        }
    }
}


// ✨ 新增：專門用來繪製觀戰棋盤的函式
function drawSpectatorBoard(boardData, initialBoardData, pencilMarks, playerName) {
    console.log(`[偵錯日誌] 步驟 6: drawSpectatorBoard 函式被呼叫，準備繪製 ${playerName} 的棋盤。`);
    if (!boardElement) {
        console.error("[偵錯日誌] 錯誤：找不到 boardElement！");
        return;
    }
    if (!boardData || !initialBoardData) {
        console.error("[偵錯日誌] 錯誤：繪製觀戰棋盤時缺少 boardData 或 initialBoardData！");
        return;
    }
    
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.innerHTML = `<span class="spectator-text">正在觀看 ${playerName}</span>`;
    }

    boardElement.innerHTML = ""; 
    for (let i = 0; i < 9; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        for (let j = 0; j < 9; j++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = i;
            cell.dataset.col = j;

            const mainValue = document.createElement('span');
            mainValue.classList.add('main-value');
            const cellValue = boardData[i]?.[j];
            if (cellValue && cellValue !== 0) {
                mainValue.textContent = cellValue;
            }

            const pencilGrid = document.createElement("div");
            pencilGrid.classList.add("pencil-grid");
            
            // 核心修正：使用傳入的參數 pencilMarks
            const marks = pencilMarks?.[i]?.[j] || [];

            for (let k = 1; k <= 9; k++) {
                const pencilMark = document.createElement("div");
                pencilMark.classList.add("pencil-mark");
                if (marks.includes(k)) {
                    pencilMark.textContent = k;
                }
                pencilGrid.appendChild(pencilMark);
            }

            if (initialBoardData?.[i]?.[j] !== 0) {
                cell.classList.add('given-number');
            }

            cell.appendChild(mainValue);
            cell.appendChild(pencilGrid);
            rowDiv.appendChild(cell);
        }
        boardElement.appendChild(rowDiv);
    }
    console.log("[偵錯日誌] 步驟 7: 棋盤繪製邏輯執行完畢。");
}

  // ======================================================
  // --- 4. 執行初始化 ---
  // ======================================================
  init();
}