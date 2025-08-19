// ======================================================
// Sudoku 遊戲主腳本 (最終完整版 - 無省略)
// ======================================================

function initializeGame(
  socket,
  initialState,
  showCustomAlertFromLobby,
  showCustomConfirmFromLobby
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
    menuBackToLobbyBtn,
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
  const myPlayerId = initialState.playerId;
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

  // ======================================================
  // --- 2. 輔助函式定義區 ---
  // ======================================================

  // --- 2.1 通知與流程控制相關函式 ---
  function internalShowCustomAlert(message, title = "提示") { // <-- 1. 新增 title 參數，預設為「提示」
    const alertOverlay = document.getElementById("alert-modal-overlay");
    const alertMessage = document.getElementById("alert-message");
    const alertOkBtn = document.getElementById("alert-ok-btn");
    const alertTitle = document.getElementById("alert-title"); // <-- 2. 獲取我們剛新增的標題元素

    return new Promise((resolve) => {
      if (!alertOverlay || !alertMessage || !alertOkBtn || !alertTitle) {
        // 如果找不到元素，就退回使用瀏覽器內建的 alert
        window.alert(`${title}\n\n${message.replace(/<br>/g, "\n")}`);
        return resolve();
      }

      // ▼▼▼ 3. 設定標題和訊息文字 ▼▼▼
      alertTitle.textContent = title; 
      alertMessage.innerHTML = message;

      alertOverlay.classList.remove("hidden");
      isModalOpen = true;

      // 使用 .once 來確保事件只被觸發一次，避免重複綁定
      alertOkBtn.addEventListener('click', function handler() {
        alertOverlay.classList.add("hidden");
        isModalOpen = false;
        resolve();
      }, { once: true });
    });
  }

  function internalShowCustomConfirm(message, title = "需要您的確認") {
    console.log("偵探日誌：internalShowCustomConfirm 函式已啟動。");
    const modalOverlay = document.getElementById("custom-modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalConfirmBtn = document.getElementById("modal-confirm-btn");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");

    return new Promise((resolve) => {
        if (!modalOverlay || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
            return resolve(window.confirm(message.replace(/<br>/g, "\n")));
        }

        if (modalTitle) modalTitle.textContent = title;
        modalMessage.innerHTML = message;
        modalOverlay.classList.remove("hidden");

        isModalOpen = true;
        setTimeout(() => { // 增加一個小延遲
        modalConfirmBtn.focus(); 
    }, 0);
        console.log(`偵探日誌：彈窗已開啟，isModalOpen 狀態 -> ${isModalOpen}`);

        setTimeout(() => {
            modalConfirmBtn.focus();
            console.log("偵探日誌：嘗試設定焦點到確認按鈕。");
            console.log("偵探日誌：目前擁有焦點的元素是 ->", document.activeElement);
        }, 50);

        const confirmHandler = () => { cleanup(); resolve(true); };
        const cancelHandler = () => { cleanup(); resolve(false); };

        const cleanup = () => {
            modalOverlay.classList.add("hidden");
            isModalOpen = false;
            console.log(`偵探日誌：彈窗已關閉，isModalOpen 狀態 -> ${isModalOpen}`);
            modalConfirmBtn.removeEventListener("click", confirmHandler);
            modalCancelBtn.removeEventListener("click", cancelHandler);
        };

        modalConfirmBtn.addEventListener("click", confirmHandler, { once: true });
        modalCancelBtn.addEventListener("click", cancelHandler, { once: true });
    });
}



  const showCustomAlert =
    typeof showCustomAlertFromLobby === "function"
      ? showCustomAlertFromLobby
      : internalShowCustomAlert;
      console.log("偵測到的 showCustomAlert 函式原始碼:", showCustomAlert.toString());
  const showCustomConfirm =
    typeof showCustomConfirmFromLobby === "function"
      ? showCustomConfirmFromLobby
      : internalShowCustomConfirm;
  const returnToLobby =
    typeof initialState.returnToLobby === "function"
      ? initialState.returnToLobby
      : () => {
          window.location.href = "/";
        };

  function handleModeSelection(selectedMode) {
    gameMode = selectedMode;
    sudokuModeModalOverlay.classList.add("hidden");
    if (gameMode === "single") {
      appContainer.classList.add("hidden");
      difficultyModalOverlay.classList.remove("hidden");
    } else {
      // gameMode === 'multiplayer'
      appContainer.classList.remove("hidden");
      socket.emit("createRoom", {
        playerName: myPlayerName,
        gameType: "sudoku",
        isSinglePlayer: false,
      });
      const boardElement = document.getElementById("game-board");
      if (boardElement) {
        boardElement.innerHTML = "<h2>正在建立遊戲房間...</h2>";
        boardElement.classList.add("is-loading");
      }
      socket.once("roomCreated", (data) => {
        currentGameId = data.roomId;
        iAmHost = true;
        if (boardElement) {
          boardElement.innerHTML = "";
          boardElement.classList.remove("is-loading");
        }
        showWaitingScreen(data.roomId);
        updatePlayerListUI(data.players);
      });
    }
  }

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
    // 比較兩個棋盤陣列最簡單可靠的方式是將它們轉換為 JSON 字串
    // 注意：這裡的 board 是前端的物件陣列， solution 是後端的純數字陣列
    // 所以需要轉換 board 為純數字陣列再比較
    const flatBoardValues = board.flat().map(cell => cell.value);
    const flatSolutionValues = solution.flat();
    return JSON.stringify(flatBoardValues) === JSON.stringify(flatSolutionValues);
}

function setUIState(state) {
  // --- 控制面板切換 ---
  if (!inGameControls) inGameControls = document.getElementById('in-game-controls');
  if (!multiplayerWaitingPanel) multiplayerWaitingPanel = document.getElementById('multiplayer-waiting-panel');
  
  // 先隱藏所有主要的面板
  inGameControls?.classList.add('hidden');
  multiplayerWaitingPanel?.classList.add('hidden');
  if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.add('hidden');
  if (multiplayerInfoPanel) multiplayerInfoPanel.classList.add('hidden');

  // 根據狀態，顯示對應的面板
  if (state === 'waiting_multiplayer') {
    multiplayerWaitingPanel?.classList.remove('hidden');
  } else if (state === 'playing_single') {
    inGameControls?.classList.remove('hidden');
    singlePlayerInfoPanel?.classList.remove('hidden');
  } else if (state === 'playing_multiplayer' || state === 'gameOver_multiplayer') {
    // ✨ 在多人遊戲中或結束後，都顯示遊戲中的控制項
    inGameControls?.classList.remove('hidden');
    multiplayerInfoPanel?.classList.remove('hidden');
  }
  
  // --- ✨ 核心修正：集中管理所有遊戲選單按鈕的狀態 ---
  const isMultiplayerPlaying = (state === 'playing_multiplayer');
  const isMultiplayerGameOver = (state === 'gameOver_multiplayer');

  // 根據模式，修改「重新開始/投降/返回大廳」按鈕的文字
  if (menuRestartBtn) {
    if (isMultiplayerGameOver) {
      menuRestartBtn.textContent = "返回大廳";
    } else {
      menuRestartBtn.textContent = isMultiplayerPlaying ? "投降" : "重新開始本局";
    }
  }
  
  // 在多人模式中 (無論是進行中還是已結束)，都隱藏「開啟新局」和「返回大廳」這兩個多餘的按鈕
  if (menuNewGameBtn) {
    menuNewGameBtn.style.display = (isMultiplayerPlaying || isMultiplayerGameOver) ? 'none' : 'block';
  }
  if (menuBackToLobbyBtn) {
    menuBackToLobbyBtn.style.display = (isMultiplayerPlaying || isMultiplayerGameOver) ? 'none' : 'block';
  }
}

  function initializeTabs() {
    const tabButtons = document.querySelectorAll(
      "#multiplayer-waiting-panel .tab-button"
    );
    const tabContents = document.querySelectorAll(
      "#multiplayer-waiting-panel .tab-content"
    );
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.tab === "lobby-chat") {
          unreadChatMessages = 0; // 清空未讀計數
          updateChatBadge(); // 更新(隱藏)紅點
        }
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));
        button.classList.add("active");
        const targetContent = document.getElementById(
          `tab-content-${button.dataset.tab}`
        );
        if (targetContent) targetContent.classList.add("active");
      });
    });
  }

  function initializeInGameTabs() {
  const tabButtons = document.querySelectorAll('.in-game-tab-button');
  const tabContents = document.querySelectorAll('.in-game-tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // ✨ 新增：如果點擊的是遊戲中的聊天室頁籤，就清除紅點
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
      btn.className =
        action === "accept" ? "accept-join-btn" : "reject-join-btn";
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
    // 移除指定的 li 元素
    document.getElementById(`join-request-${requesterId}`)?.remove();

    // ▼▼▼▼▼ 主要修改 ▼▼▼▼▼
    // 使用 .children.length 來做更精確的判斷，它只會計算真正的 HTML 元素
    if (
      sudokuJoinRequestsList &&
      sudokuJoinRequestsList.children.length === 0
    ) {
      // 如果列表裡已經沒有任何 li 元素了，才隱藏整個面板
      sudokuJoinRequestsArea.classList.add("hidden");
    }
    // ▲▲▲▲▲ 主要修改 ▲▲▲▲▲
  }

  function updatePlayerListUI(players) {
    const playerListContainer = document.querySelector(
      "#multiplayer-waiting-panel .player-list-container"
    );
    if (!playerListContainer || !players || !myPlayerId) return;

    const meInNewList = players.find((p) => p.id === myPlayerId);
    if (meInNewList && meInNewList.isHost) {
      iAmHost = true;
    } else {
      iAmHost = false;
    }

    const startGameBtn = document.getElementById("sudoku-start-game-btn");
    if (startGameBtn) {
      if (iAmHost) {
        startGameBtn.classList.remove("hidden");
        startGameBtn.disabled = players.length < 2;
      } else {
        startGameBtn.classList.add("hidden");
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
      playerNameSpan.textContent =
        player.name + (player.id === myPlayerId ? " (你)" : "");
      const playerStatusSpan = document.createElement("span");
      playerStatusSpan.className = "player-status";
      if (player.isHost) {
        playerStatusSpan.textContent = "(房主)";
      } else {
        playerStatusSpan.textContent = "(挑戰者)";
      }
      playerItem.appendChild(playerNameSpan);
      playerItem.appendChild(playerStatusSpan);
      playerListContainer.appendChild(playerItem);
    });
  }

  function resetControlPanel() {
  // 根據當前遊戲模式，顯示對應的資訊面板
  if (gameMode === 'single') {
    if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.remove('hidden');
    if (multiplayerInfoPanel) multiplayerInfoPanel.classList.add('hidden');
  } else { // multiplayer
    if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.add('hidden');
    if (multiplayerInfoPanel) multiplayerInfoPanel.classList.remove('hidden');
  }

  // 將所有資訊顯示為預設值
  if (difficultyDisplay) difficultyDisplay.textContent = '生成中...';
  if (helpersDisplay) helpersDisplay.textContent = '-';
  if (infoHintCount) infoHintCount.textContent = '-';
  if (infoValidateCount) infoValidateCount.textContent = '-';
  if (progressBarFill) progressBarFill.style.width = '0%';
  if (progressPercentage) progressPercentage.textContent = '0%';

  // 清空多人模式下的對手進度列表
  if (opponentProgressContainer) opponentProgressContainer.innerHTML = '';
}

  function resetUIForNewGame() {
  console.log('[流程] 正在重置 UI 以準備新遊戲...');

  // --- 核心重置邏輯 ---
  hideWaitingScreen();
  resetTimer();
  history = [];
  historyIndex = -1;
  iHaveFinished = false;
  iHaveSurrendered = false;
  selectedCell = null;
  lastSelectedCoords = null;
  currentViewedPlayerId = myPlayerId;
  
  // --- 清理左側棋盤 ---
  if (boardElement) {
    boardElement.innerHTML = ''; // 徹底清空舊棋盤
    boardElement.classList.remove("is-loading");
  }
  clearAllHighlights();
  clearAllErrors();

  // ▼▼▼ 【核心修正】清理右側控制面板 ▼▼▼

  // 1. 隱藏整個遊戲控制面板和解答畫面
  if (inGameControls) inGameControls.classList.add('hidden');
  if (solutionView) solutionView.classList.add('hidden');
  
  // 2. 重置單人模式的資訊顯示
  if (progressBarFill) progressBarFill.style.width = "0%";
  if (progressPercentage) progressPercentage.textContent = "0%";
  if (difficultyDisplay) difficultyDisplay.textContent = "-";
  if (helpersDisplay) helpersDisplay.textContent = "-";
  if (infoHintCount) infoHintCount.textContent = "0";
  if (infoValidateCount) infoValidateCount.textContent = "0";

  // 3. 重置多人模式的資訊顯示
  if (opponentProgressContainer) opponentProgressContainer.innerHTML = '';
  if (inGameChatMessages) inGameChatMessages.innerHTML = '';
  if (multiplayerGameInfoContent) multiplayerGameInfoContent.innerHTML = '';

  // 4. 重置數字鍵盤和功能按鈕的狀態
  updateUndoButtonState();
  updateRedoButtonState();
  updatePauseButtonState(); // 確保暫停按鈕也被重置

  // ▲▲▲ 修正結束 ▲▲▲
}

  function showWaitingScreen(roomId) {
    setUIState("waiting_multiplayer");
    const mainText = document.getElementById("waiting-main-text");

    if (mainText) {
      mainText.innerHTML = `已進入房間 <strong>${roomId}</strong>`;
    }

    // 顯示等待畫面，隱藏遊戲棋盤
    if (waitingView) waitingView.classList.remove("hidden");
    if (boardElement) boardElement.classList.add("hidden");
  }

  function hideWaitingScreen() {
    // 隱藏等待畫面，顯示遊戲棋盤
    if (waitingView) waitingView.classList.add("hidden");
    if (multiplayerWaitingPanel) multiplayerWaitingPanel.classList.add('hidden');
    if (boardElement) boardElement.classList.remove("hidden");
  }

  // ======================================================
  // --- 2.2 遊戲核心邏輯函式 (完整無省略版) ---
  // ======================================================

  async function pauseGame(isAutoPause = false) { // <-- 新增 isAutoPause 參數
  // 如果已經暫停，或按鈕被禁用，則不執行任何操作
  if (isPaused || (pauseBtn && pauseBtn.disabled)) return;

  // ▼▼▼ 【核心修正】▼▼▼

  let userConfirmed = true; // 預設為 true，代表自動暫停時直接通過

  // 只有在「非」自動暫停（也就是玩家手動點擊）時，才跳出確認視窗
  if (!isAutoPause) {
    const message = (gameMode === 'single') 
      ? "您確定要暫停遊戲嗎？"
      : "您確定要使用本局唯一的一次暫停機會嗎？<br>所有玩家的遊戲都將會暫停。";
    
    userConfirmed = await showCustomConfirm(message, "確認暫停");
  }

  // 如果確認通過（自動暫停時永遠為 true），就向伺服器發送請求
  if (userConfirmed) {
    socket.emit("sudoku_requestPause", { roomId: currentGameId });
  }
  // ▲▲▲ 修正結束 ▲▲▲
}

function resumeGame() {
  if (!isPaused) return;
  socket.emit('sudoku_resumeGame', { roomId: currentGameId });
}

function resumeGame() {
  // 如果遊戲不是暫停狀態，就什麼都不做
  if (!isPaused) return;

  // ▼▼▼ 【核心修正】▼▼▼
  // 不管是單人還是多人模式，都統一向伺服器發送「我要繼續遊戲囉！」的請求
  socket.emit('sudoku_resumeGame', { roomId: currentGameId });
  // ▲▲▲ 修正結束 ▲▲▲
}


function resetTimer() {
  stopTimer();
  seconds = 0;
  if (timerValueElement) {
    timerValueElement.textContent = "00:00:00";
  }
}

  function stopTimer() {
  // 這個函式只對單人模式的 timerInterval 有效
  isTimerRunning = false;
  clearInterval(timerInterval);
}

function recordHistoryState(coords) {
    const currentState = {
        puzzle: JSON.parse(JSON.stringify(puzzle)),
        pencilMarks: pencilMarksData.map(row => row.map(cellSet => new Set(cellSet)))
    };

    // ▼▼▼ 核心修改：將狀態和座標一起打包存入 history ▼▼▼
    const historyEntry = {
        state: currentState,
        actionCoords: coords // 記錄是哪個格子的操作
    };
    // ▲▲▲ 修改結束 ▲▲▲

    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(historyEntry); // 存入打包好的物件
    historyIndex++;

    updateUndoButtonState();
    updateRedoButtonState();
}

function undo() {
    // 檢查是否還有可以復原的步驟
    if (historyIndex <= 0) return;

    // 將指標向前移動一位
    historyIndex--;
    loadStateFromHistory();
}

/**
 * 取消復原 (Redo)
 */
function redo() {
    // 檢查是否還有可以取消復原的步驟
    if (historyIndex >= history.length - 1) return;

    // 將指標向後移動一位
    historyIndex++;
    loadStateFromHistory();
}

/**
 * 根據當前 historyIndex 從 history 陣列讀取狀態並應用到遊戲中
 */
function loadStateFromHistory() {
    const historyEntry = history[historyIndex];
    if (!historyEntry) return;

    const stateToLoad = historyEntry.state;
    if (!stateToLoad) return;

    // 1. 從歷史紀錄中還原盤面數據和筆記數據 (這部分是正確的)
    puzzle = JSON.parse(JSON.stringify(stateToLoad.puzzle));
    pencilMarksData = stateToLoad.pencilMarks.map(row => row.map(cellSet => new Set(cellSet)));

    // 2. 重新繪製UI
    drawBoard();
    updateProgress();
    updateNumberCounter();
    updateUndoButtonState();
    updateRedoButtonState();

    // 3. 【⭐核心修正⭐】
    //    讀取歷史紀錄中「已經被風暴改造過」的 actionCoords 來選中格子！
    const coords = historyEntry.actionCoords;
    if (coords && typeof coords.row !== 'undefined' && typeof coords.col !== 'undefined') {
        const cellToSelect = document.querySelector(`.cell[data-row='${coords.row}'][data-col='${coords.col}']`);
        if (cellToSelect) {
            // 呼叫 selectCell，而不是直接操作 class，確保所有高亮邏輯都被觸發
            selectCell(cellToSelect);
        }
    } else {
        // 如果這個歷史步驟沒有座標，就取消所有選中
        selectCell(null);
    }

    // 4. 如果是多人模式，將新狀態同步給後端 (維持不變)
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
    undoBtn.disabled = historyIndex <= 0; // 當指標在第0步(初始狀態)時，無法復原
  }
}

function updateRedoButtonState() {
  const redoBtn = document.getElementById('redo-btn');
  if (redoBtn) {
    redoBtn.disabled = historyIndex >= history.length - 1; // 當指標在最後一步時，無法取消復原
  }
}

function updateUndoButtonState() {
  if (undoBtn) {
    undoBtn.disabled = moveHistory.length === 0;
  }
}

 function updateTimerDisplay(serverSeconds) {
  const currentSeconds = typeof serverSeconds !== 'undefined' ? serverSeconds : seconds;
  const totalSeconds = Number.isFinite(currentSeconds) ? currentSeconds : 0;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  
  if (timerValueElement) {
    timerValueElement.textContent = formattedTime;
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
    if (totalToFill <= 0) {
      if (progressBarFill) progressBarFill.style.width = `100%`;
      if (progressPercentage) progressPercentage.textContent = `100%`;
      return;
    }
    const percentage = Math.max(
      0,
      Math.min(100, Math.floor((playerFilled / totalToFill) * 100))
    );
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
    isPaused = false; // 確保解除暫停狀態

    // ✨ 核心修正：在顯示解答前，先恢復棋盤的顯示 ✨
    if (boardElement) {
      boardElement.classList.remove("is-loading"); // 移除暫停時的 is-loading 樣式
      drawBoard(); // 根據當前的 puzzle 數據，重新繪製棋盤
    }

    clearAllHighlights(); // 在重繪後再清除高亮

    // --- 底下原有程式碼不變 ---
    const inGameControls = document.getElementById("in-game-controls");
    if (inGameControls) inGameControls.classList.add("hidden");

    const solutionView = document.getElementById("solution-view");
    if (solutionView) solutionView.classList.remove("hidden");

    try {
      const response = await fetch(`/api/sudoku/solution/${currentGameId}`);
      if (!response.ok) throw new Error("無法從伺服器獲取解答");
      const data = await response.json();
      const finalSolution = data.solution;

      // 標示玩家棋盤上的錯誤
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

      // 繪製完整解答棋盤
      if (solutionBoard && finalSolution) {
        solutionBoard.innerHTML = "";
        for (let i = 0; i < 9; i++) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "row";
          for (let j = 0; j < 9; j++) {
            const cellDiv = document.createElement("div");
            cellDiv.className = "cell";
            cellDiv.textContent = finalSolution[i][j];
            // 修正：initialPuzzle 的結構是 {value, source}，所以要檢查 .value
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

    // 【⭐核心修正⭐】
    if (gameMode === 'single') {
        // 單人模式下，按鈕是否可用的唯一判斷標準是「計時器是否在跑」
        // 遊戲結束或還沒開始時，isTimerRunning 會是 false
        pauseBtn.disabled = !isTimerRunning;
    } else if (gameMode === 'multiplayer') {
        // 多人模式下，才去檢查剩餘次數
        const myState = opponentStates.find(p => p.playerId === myPlayerId);
        // 如果找不到自己的狀態，或者暫停次數已用完，則禁用按鈕
        if (!myState || myState.pauseUses <= 0) {
            pauseBtn.disabled = true;
        } else {
            pauseBtn.disabled = false;
        }
    } else {
        // 預設情況下禁用
        pauseBtn.disabled = true;
    }
}

function restorePlayerView() {
    // 步驟 1: 恢復計時器容器的原始樣貌
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) {
        timerContainer.innerHTML = `
            <span class="timer-label">已用時間：</span>
            <span id="timer-value">00:00:00</span>`;
        
        timerValueElement = document.getElementById('timer-value');
        updateTimerDisplay(); // 立即更新一次時間顯示
    }

    // 步驟 2: 繪製自己的棋盤
    drawBoard();
}

  function updateGameInfo() {
  // 更新單人模式的顯示 (舊邏輯)
  if (infoHintCount) infoHintCount.textContent = hintCount > 0 ? hintCount : "用完";
  if (infoValidateCount) infoValidateCount.textContent = validateCount > 0 ? validateCount : "用完";

  // ✨ 新增：同時更新多人模式「遊戲資訊」頁籤中的顯示
  const multiHintCount = document.getElementById('info-hint-count-display');
  const multiValidateCount = document.getElementById('info-validate-count-display');
  if (multiHintCount) multiHintCount.textContent = hintCount > 0 ? hintCount : "用完";
  if (multiValidateCount) multiValidateCount.textContent = validateCount > 0 ? validateCount : "用完";
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
    // 只有當按鈕不屬於例外列表時，才進行禁用/啟用
    if (controls[id] && !exceptions.includes(id)) {
      controls[id].disabled = disabled;
    }
  }

  // 特殊處理提示按鈕：即使在「啟用」狀態，次數用完也要禁用
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
    // 移除了開頭重置 timerContainer.innerHTML 的部分
    
    if (!boardElement || !puzzle || puzzle.length === 0) return;
    boardElement.innerHTML = "";
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
  // 步驟 1: 重置所有遊戲相關的狀態
  iHaveSurrendered = false;       // 重置投降狀態
  currentlySpectatingId = null;   // 重置觀戰狀態
  history = [];                   // 清空新的「時間軸」歷史紀錄
  historyIndex = -1;              // 重置歷史紀錄指標
  iHaveFinished = false;          // 重置「已完成」狀態
  pencilMarksData = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
  isPaused = false;
  isTimerStartedByFirstMove = false;
  isFirstPencilMarkMade = false;
  selectedCell = null;
  lastSelectedCoords = null;
  if (pauseBtn) pauseBtn.textContent = "暫停";
  
  // 步驟 2: 處理傳入的謎題資料
  // 這個邏輯修復了「重新開始本局」時，因資料格式不同而導致的錯誤
  if (puzzleData && puzzleData[0] && typeof puzzleData[0][0] === 'object' && puzzleData[0][0] !== null) {
      // 如果傳入的是物件陣列 (來自 initialPuzzle)，直接深拷貝
      puzzle = JSON.parse(JSON.stringify(puzzleData));
  } else {
      // 如果傳入的是純數字陣列 (第一次開局)，則轉換為物件陣列
      puzzle = puzzleData.map((row) =>
        row.map((num) => ({
          value: num,
          source: num !== 0 ? "initial" : "empty",
        }))
      );
      // 只有在第一次開局時，才設定初始題目
      initialPuzzle = JSON.parse(JSON.stringify(puzzle));
  }

  // 步驟 3: 更新並顯示 UI
  if (gameMode === "single") {
    setUIState("playing_single");
  } else {
    setUIState("playing_multiplayer");
  }
  hideWaitingScreen();
  hideSolutionView();
  disableGameControls(false); // 啟用所有遊戲控制項
  if (pencilToggleCheckbox) pencilToggleCheckbox.checked = false;
  if (highlightHelperCheckbox) highlightHelperCheckbox.checked = false;
  if (boardElement) boardElement.classList.remove("is-loading");

  if (!prepareOnly) {
    setTimeout(() => {
      drawBoard();
      highlightAndCheckConflicts();
    }, 0);
  }
  
  // 步驟 4: 重置計時器並更新所有資訊面板
  resetTimer();
  updateProgress();
  updateNumberCounter();

  // 步驟 5: 將棋盤的「初始狀態」作為第 0 步，存入歷史紀錄
  
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
  // ▼▼▼ 核心修改：在函式開頭加入這一段 ▼▼▼
  // 為了能操作棋盤，我們先確保 boardElement 已經被獲取
  if (!boardElement) {
    boardElement = document.getElementById("game-board");
  }
  
  // 每次套用設定前，都先移除所有可能的特殊模式 class，確保狀態乾淨
  if (boardElement) {
    boardElement.classList.remove('storm-mode', 'telescope-mode'); 
  }
  // ▲▲▲ 修改結束 ▲▲▲

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
    case "extreme": // 極限模式
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
    <div class="info-item-column keybindings-info">
        <h4>快捷鍵說明</h4>
        <p>
            <span class="key-combo">方向鍵</span>: 移動選框<br>
            <span class="key-combo">數字 1-9</span>: 填入數字<br>
            <span class="key-combo">P  &  滾輪  &  中鍵</span>: 切換筆記模式<br>
            <span class="key-combo">L</span>: 切換高亮模式<br>
            <span class="key-combo">Backspace</span>: 清除數字
        </p>
    </div>
  `;
  
  const gameInfoHTML = `
    <div class="info-item"><span>剩餘提示:</span><span id="info-hint-count-display">${hintCount > 0 ? hintCount : "用完"}</span></div>
    <div class="info-item"><span>剩餘檢查:</span><span id="info-validate-count-display">${validateCount > 0 ? validateCount : "用完"}</span></div>
    <div class="info-item"><span>剩餘暫停:</span><span id="info-pause-count-display">1</span></div>
    <hr>
    <div class="info-item-column"><h4>當前難度</h4><p>${difficultyText} (${holes} 空格)</p></div>
    <div class="info-item-column"><h4>輔助功能</h4><p>${helpersText}</p></div>
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
  // 只有在棋盤填滿時才觸發檢查
  if (isBoardFull()) {
    try {
      // ✨ 核心修正：確保 body 中包含了 currentGameId
      const response = await fetch("/api/sudoku/check-win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: currentGameId, // 將儲存的 gameId 一併發送
          puzzle: puzzle.map((row) => row.map((cell) => cell.value)),
        }),
      });

      if (!response.ok) {
        // 如果 API 回傳錯誤 (例如 404 Not Found)，就拋出錯誤
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();

      if (data.isCorrect) {
        // 如果後端回報答案正確
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(row => row.map(cell => cell.value)),
            pencilMarks: pencilMarksData.map(row => row.map(set => Array.from(set)))
        });
        showWinModal();
      } else {
        // 如果後端回報答案不正確
        showCustomAlert("您已填滿所有格子，但答案包含錯誤。");
        validateBoard(true); // 觸發自動檢查來標示錯誤
      }
    } catch (error) {
      // 如果在 fetch 過程中發生任何網路或程式錯誤
      console.error("判斷勝利時發生錯誤:", error);
      showCustomAlert("無法確認勝利狀態，請稍後再試。"); // 顯示通用的錯誤訊息
    }
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
  disableGameControls(true);
  // --- 獲取並填充戰績數據 ---
  
  // 1. 獲取所有用來顯示數據的 span 元素
  const difficultyEl = document.getElementById('win-stat-difficulty');
  const holesEl = document.getElementById('win-stat-holes'); // ✨ 新增：獲取用來顯示洞數的元素
  const timeEl = document.getElementById('win-stat-time');
  const hintsEl = document.getElementById('win-stat-hints');
  const validationsEl = document.getElementById('win-stat-validations');

  // 2. 準備數據
  const difficultyMap = { 'easy': '簡單', 'medium': '中等', 'hard': '困難', 'extreme': '極限' };
  const difficultyText = difficultyMap[gameSettings.difficulty] || '未知';
  const finalTime = timerValueElement ? timerValueElement.textContent : '未知';
  
  const initialHintCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
  const initialValidateCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
  const hintsUsed = initialHintCount - hintCount;
  const validationsUsed = initialValidateCount - validateCount;

  // 3. 將數據填入 HTML 元素中
  if (difficultyEl) difficultyEl.textContent = difficultyText;
  if (holesEl) holesEl.textContent = `${puzzleHoles} 個`; // ✨ 新增：將儲存的 puzzleHoles 變數填入
  if (timeEl) timeEl.textContent = finalTime;
  if (hintsEl) hintsEl.textContent = `${hintsUsed} 次`;
  if (validationsEl) validationsEl.textContent = `${validationsUsed} 次`;

  // --- 後續邏輯維持不變 ---
  if (winModalOverlay) winModalOverlay.classList.remove("hidden");
  
  if (typeof confetti === "function") {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }
  const extremeChallengeBtn = document.getElementById('win-modal-extreme-challenge-btn');

  if (extremeChallengeBtn && (gameSettings.difficulty === 'hard' || gameSettings.difficulty === 'easy')) {
      extremeChallengeBtn.classList.remove('hidden');
  }
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
      const rowCell = document.querySelector(
        `.cell[data-row='${selectedRow}'][data-col='${i}']`
      );
      if (rowCell) rowCell.classList.add("highlight-rc");
      const colCell = document.querySelector(
        `.cell[data-row='${i}'][data-col='${selectedCol}']`
      );
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
        if (
          !peerCell ||
          (peerCell.dataset.row == selectedRow &&
            peerCell.dataset.col == selectedCol)
        )
          return;
        const peerRow = parseInt(peerCell.dataset.row);
        const peerCol = parseInt(peerCell.dataset.col);
        if (puzzle[peerRow]?.[peerCol]?.value === parseInt(selectedValue)) {
          peerCell.classList.add("conflict-with-selection");
          hasConflict = true;
        }
      };
      const startRow = Math.floor(selectedRow / 3) * 3;
      const startCol = Math.floor(selectedCol / 3) * 3;
      for (let r = 0; r < 9; r++) {
        checkPeers(
          document.querySelector(
            `.cell[data-row='${selectedRow}'][data-col='${r}']`
          )
        );
      }
      for (let r = 0; r < 9; r++) {
        checkPeers(
          document.querySelector(
            `.cell[data-row='${r}'][data-col='${selectedCol}']`
          )
        );
      }
      for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
          checkPeers(
            document.querySelector(`.cell[data-row='${r}'][data-col='${c}']`)
          );
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
      // ▼▼▼▼▼ 核心修正：修復錯字 ▼▼▼▼▼
      if (statusA !== statusB) return statusA - statusB; // 應該是 statusA - statusB
      // ▲▲▲▲▲ 修正結束 ▲▲▲▲▲
      if (a.status === 'finished') return a.finishTime - b.finishTime;
      return b.progress - a.progress;
  });

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

    // 確保這個 switch 結構是完整的
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
      default: // 當 status 是 'playing' 或其他未定義狀態時，執行此處
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
}

  function clearSelectedCellContent() {
    if (!selectedCell || selectedCell.classList.contains("given-number") || selectedCell.classList.contains("hinted") || isPaused || currentViewedPlayerId !== myPlayerId) return;
    
    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);

    const beforeState = {
        cellData: JSON.parse(JSON.stringify(puzzle[row][col])),
        pencilMarks: Array.from(pencilMarksData[row][col])
    };

    puzzle[row][col] = { value: 0, source: "empty" };
    selectedCell.querySelector(".main-value").textContent = "";
    pencilMarksData[row][col].clear();

    const afterState = {
        cellData: JSON.parse(JSON.stringify(puzzle[row][col])),
        pencilMarks: Array.from(pencilMarksData[row][col])
    };
    
    recordHistoryState({ row, col });
    clearAllErrors();
    highlightAndCheckConflicts();
    updateProgress();
    updateNumberCounter();
    // 只有在非觀戰模式且是自己的盤面時才發送 playerAction
    if (gameMode === 'multiplayer' && currentGameId && currentViewedPlayerId === myPlayerId) {
        socket.emit('sudoku_playerAction', {
            roomId: currentGameId,
            puzzle: puzzle.map(r => r.map(c => c.value))
        });
    }
}

function updateInfoPanelForSpectator(playerName, hints, validates) {
    if (!multiplayerInfoPanel || !infoPanelTitle) return;
    
    // 切換到「遊戲資訊」分頁來顯示對手資訊
    const infoTabButton = document.querySelector('.in-game-tab-button[data-tab="ingame-info"]');
    if (infoTabButton) infoTabButton.click();
    
    infoPanelTitle.textContent = `觀戰中: ${playerName}`;
    
    const multiHintCount = document.getElementById('info-hint-count-display');
    const multiValidateCount = document.getElementById('info-validate-count-display');
    if (multiHintCount) multiHintCount.textContent = hints > 0 ? hints : "用完";
    if (multiValidateCount) multiValidateCount.textContent = validates > 0 ? validates : "用完";
}

  function updateInGameChatBadge() {
    if (!inGameChatNotificationBadge) return;

    if (unreadInGameMessages > 0) {
      inGameChatNotificationBadge.textContent = unreadInGameMessages;
      inGameChatNotificationBadge.classList.remove('hidden');
    } else {
      inGameChatNotificationBadge.classList.add('hidden');
    }
  }

  function selectCell(cell, isKeyboardAction = false) {
    // 您的優化：當暫停或正在觀戰時，不允許選中自己的格子
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

    // 處理題目或提示格，不允許選中
    if (cell.classList.contains("given-number") || cell.classList.contains("hinted")) {
        selectedCell = null;
        lastSelectedCoords = { row: cell.dataset.row, col: cell.dataset.col };
        highlightAndCheckConflicts();
    
    // ▼▼▼▼▼ 核心修正 ▼▼▼▼▼
    // 如果點擊的是已選中的格子，則取消選中並結束函式
    } else if (selectedCell === cell) {
        selectedCell = null;
        lastSelectedCoords = null; // 取消選中時，也清除 lastCoords
        highlightAndCheckConflicts();
    // ▲▲▲▲▲ 修正結束 ▲▲▲▲▲

    } else {
        // 否則，正常選中新格子
        selectedCell = cell;
        selectedCell.classList.add("selected");
        lastSelectedCoords = { row: cell.dataset.row, col: cell.dataset.col };
        highlightAndCheckConflicts();
    }
    
    // 將選中狀態發送給伺服器（這部分不變）
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
    // 確認視窗的邏輯維持不變
    let confirmMessage = '';
    // 檢查當前的遊戲難度
    if (gameSettings.difficulty === 'hard' || gameSettings.difficulty === 'extreme') {
      // 如果是困難或極限模式，顯示「標示一個」的文字
      confirmMessage = `這將會和正確答案比對，並標示出您填錯的數字中的<b>其中一個</b>。<br>沒有發現錯誤則不消耗使用次數。<br>確定要使用一次檢查嗎？ 剩餘次數：${validateCount}`;
    } else {
      // 否則 (簡單或中等模式)，顯示「標示所有」的文字
      confirmMessage = `這將會和正確答案比對，並標示出<b>所有</b>您填錯的數字。<br>沒有發現錯誤則不消耗使用次數。<br>確定要使用一次檢查嗎？ 剩餘次數：${validateCount}`;
    }
    // ▲▲▲▲▲ 修改結束 ▲▲▲▲▲

    const userConfirmed = await showCustomConfirm(
      confirmMessage, // <-- 在此處使用我們動態產生的訊息
      "使用「檢查」功能"
    );
    if (!userConfirmed) return;
  }

  clearAllErrors(); // 先清除舊的錯誤標記
  try {
    // 步驟 A: 從伺服器獲取本局的最終解答
    const response = await fetch(`/api/sudoku/solution/${currentGameId}`);
    if (!response.ok) throw new Error("無法從伺服器獲取解答");
    const data = await response.json();
    const solution = data.solution;
    if (!solution) throw new Error("伺服器回傳的解答格式不正確");

    // 步驟 B: 遍歷玩家棋盤，找出所有填錯的數字
    const errorCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellData = puzzle[r][c];
        if (cellData.source === 'player' && cellData.value !== 0 && cellData.value !== solution[r][c]) {
          errorCells.push({ r, c });
        }
      }
    }

    // 步驟 C: 根據比對結果，更新 UI 並執行新規則
    if (errorCells.length > 0) {
      // ▼▼▼▼▼ 規則 #2：只有在真的發現錯誤時，才扣除次數並通知伺服器 ▼▼▼▼▼
      if (!isAutoTrigger) {
        if (gameMode === 'multiplayer') {
          socket.emit('sudoku_useValidate', { roomId: currentGameId });
        }
        validateCount--;
        updateGameInfo();
      }
      // ▲▲▲▲▲ 規則 #2 結束 ▲▲▲▲▲

      // ▼▼▼▼▼ 規則 #3：根據難度決定要標示一個還是全部錯誤 ▼▼▼▼▼
      if (gameSettings.difficulty === 'hard' || gameSettings.difficulty === 'extreme') {
        // 困難或極限模式：只標示第一個發現的錯誤
        const firstError = errorCells[0];
        document
          .querySelector(`.cell[data-row='${firstError.r}'][data-col='${firstError.c}']`)
          ?.classList.add("error");
        if (!isAutoTrigger) {
          showCustomAlert(`檢查發現錯誤！已為您標示出其中一個錯誤位置。`);
        }
      } else {
        // 簡單和中等模式：標示所有錯誤
        errorCells.forEach(coords => {
          document
            .querySelector(`.cell[data-row='${coords.r}'][data-col='${coords.c}']`)
            ?.classList.add("error");
        });
        if (!isAutoTrigger) {
          showCustomAlert(`檢查發現您共填寫了 ${errorCells.length} 個錯誤的數字，已為您標示出來。`);
        }
      }
      // ▲▲▲▲▲ 規則 #3 結束 ▲▲▲▲▲
      
    } else if (!isAutoTrigger) {
      // 規則 #2 的另一部分：如果沒有錯誤，就不扣次數，並給予正面回饋
      showCustomAlert("恭喜！所有您填寫的數字都和正確答案相符！");
    }

  } catch (error) {
    console.error("檢查盤面時發生錯誤:", error);
    if (!isAutoTrigger) showCustomAlert(`檢查功能暫時無法使用。\n錯誤: ${error.message}`);
  }
}


  async function giveHint() {
    if (isPaused || currentViewedPlayerId !== myPlayerId) return; // 觀戰模式下不能使用
    if (hintCount <= 0) {
      return showCustomAlert("您的提示次數已經用完了！");
    }
    const confirmMessage = `這會為您填入一個正確數字。<br>（將優先填入您當前選中的空格）<br>確定要使用一次提示嗎？ 剩餘次數：${hintCount}`;
    const userConfirmed = await showCustomConfirm(
      confirmMessage,
      "使用「提示」功能"
    );
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
      if (
        selectedCell &&
        selectedCell.querySelector(".main-value") &&
        selectedCell.querySelector(".main-value").textContent === ""
      ) {
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
      const cell = document.querySelector(
        `.cell[data-row='${row}'][data-col='${col}']`
      );
      if (cell) {
        const pencilMarks = cell.querySelectorAll(".pencil-mark");
        pencilMarks.forEach((pm) => {
          pm.textContent = "";
        });
        if (pencilMarksData?.[row]?.[col]) {
          pencilMarksData[row][col].clear();
        }
        cell.querySelector(".main-value").textContent = value;
        cell.classList.add("hinted");
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
      // 再次確認所有需要的變數都存在
      if (!chatInput || !chatSendBtn || !currentGameId) {
        console.warn("聊天室元件尚未準備好或未在房間內。");
        return;
      }
      const message = chatInput.value.trim();

      // 只有在訊息不為空時才發送
      if (message) {
        // 發送訊息到伺服器
        socket.emit("sendChatMessage", { roomId: currentGameId, message });
        chatInput.value = ""; // 清空輸入框
        chatInput.focus(); // 保持焦點在輸入框，方便連續輸入
      }
    };

    // 監聽發送按鈕的點擊事件
    if (chatSendBtn) {
      chatSendBtn.addEventListener("click", sendMessage);
    } else {
      console.error("找不到聊天室的發送按鈕。");
    }

    // 監聽輸入框的 Enter 鍵事件
    if (chatInput) {
      chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault(); // 防止預設行為 (例如表單提交)
          sendMessage();
        }
      });
    } else {
      console.error("找不到聊天室的輸入框。");
    }
  }

  /**
 * 將聊天訊息新增到所有相關的 UI 介面上 (等待大廳 & 遊戲中)
 * @param {object} data - 包含訊息內容的物件
 * @param {string} [data.type] - 訊息類型 ('system' 或 undefined)
 * @param {string} [data.senderId] - 發送者ID
 * @param {string} [data.senderName] - 發送者名稱
 * @param {string} data.message - 訊息內容
 */
  
  // --- 新增：將收到的訊息新增到 UI 上 ---
  function addChatMessageToUI(data) {
  // --- 1. 處理紅點通知的邏輯 ---
  // 條件：(訊息是系統訊息) 或 (訊息不是我發的)
  if (data.type === 'system' || data.senderId !== myPlayerId) {
    const chatTabContent = document.getElementById('tab-content-lobby-chat');
    // 並且聊天室分頁目前不是開啟狀態
    if (chatTabContent && !chatTabContent.classList.contains('active')) {
      unreadChatMessages++;
      updateChatBadge();
    }
    const inGameChatTab = document.getElementById('tab-content-ingame-chat');
        if (inGameChatTab && !inGameChatTab.classList.contains('active')) {
            unreadInGameMessages++;
            updateInGameChatBadge(); // 呼叫新的 badge 更新函式
        }
  }

  // --- 2. 決定訊息要顯示在哪個(或哪些)視窗 ---
  const targets = [];
  // 如果等待大廳的聊天室存在，就加入目標列表
  if (chatMessages) {
    targets.push(chatMessages);
  }
  // 如果遊戲中的聊天室存在，也加入目標列表
  if (inGameChatMessages) {
    targets.push(inGameChatMessages);
  }

  // 如果找不到任何可以顯示訊息的地方，就直接返回
  if (targets.length === 0) {
    return;
  }

  // --- 3. 為所有目標視窗產生並加入訊息元素 ---
  targets.forEach(target => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');

    // 根據訊息類型產生對應的 HTML
    if (data.type === 'system') {
      messageElement.classList.add('system-message');
      messageElement.innerHTML = `<span>${data.message}</span>`;
    } else {
      // 對於玩家訊息，增加 'my-message' class (如果是自己發的)
      if (data.senderId === myPlayerId) {
        messageElement.classList.add('my-message');
      }

      // 安全性強化：使用 textContent 來設定使用者輸入的內容，防止 XSS 攻擊
      const senderNameSpan = document.createElement('span');
      senderNameSpan.className = 'sender-name';
      senderNameSpan.textContent = data.senderName; // 使用 textContent

      const messageContentP = document.createElement('p');
      messageContentP.className = 'message-content';
      messageContentP.textContent = data.message; // 使用 textContent

      messageElement.appendChild(senderNameSpan);
      messageElement.appendChild(messageContentP);
    }
    
    // 將建立好的訊息元素加入到目標視窗
    target.appendChild(messageElement);
    // 自動捲動到最新的訊息
    target.scrollTop = target.scrollHeight;
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

  /**
 * 播放賭場風格的拉霸機動畫
 * @param {string} finalResult - 伺服器決定的最終模式
 */
/**
 * 準備並顯示拉霸機舞台，設定手動與自動觸發
 * @param {string} finalResult - 伺服器決定的最終模式
 */
function setupLotteryStage(finalResult) {
  // 這個函式現在會回傳一個 Promise，async 函式呼叫它時才能真正地 await
  return new Promise(resolve => {
    const lotteryOverlay = document.getElementById('lottery-modal-overlay');
    const loadingContainer = document.querySelector('#game-board .loading-container');
    const lever = document.getElementById('lottery-lever');
    const resultText = document.getElementById('lottery-result-text');

    if (!lotteryOverlay || !loadingContainer || !lever || !resultText) {
      console.error("[拉霸機錯誤] 找不到必要的 HTML 元素，直接跳過動畫。");
      return resolve(); // 如果找不到元素，立刻結束，防止流程卡住
    }

    // 隱藏進度條，顯示拉霸機
    if (loadingContainer.style) loadingContainer.style.opacity = '0';
    lotteryOverlay.classList.remove('hidden');
    lever.classList.remove('disabled');
    resultText.textContent = "拉動拉桿，決定你的命運！";

    // 定義一個「清理函式」，用來清除監聽器和計時器
    const cleanupAndPlay = () => {
      clearTimeout(lotteryTimeoutId);
      lever.removeEventListener('click', handleLeverPull);
      playLotteryAnimation(finalResult).then(resolve); // 播放動畫，並在動畫結束後 resolve Promise
    };

    // 手動觸發
    const handleLeverPull = () => {
        console.log("拉桿被手動拉下！");
        cleanupAndPlay();
    };
    lever.addEventListener('click', handleLeverPull, { once: true });

    // 自動觸發
    const lotteryTimeoutId = setTimeout(() => {
        console.log("30秒到！自動播放動畫...");
        cleanupAndPlay();
    }, 30000);
  });
}


/**
 * 播放拉霸機動畫
 * @param {string} finalResult - 伺服器決定的最終模式
 */
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



/**
 * 處理次元風暴，根據計畫書連續執行多次交換
 * @param {Array<object>} plan - 伺服器傳來的交換計畫書
 */
async function handleDimensionalStorm(plan) {
    console.log(`收到次元風暴計畫！`, plan);

    // 劇本第一幕：警告
    await showCustomAlert(`警告！偵測到空間扭曲！<br>棋盤結構即將發生劇烈變化！`, `🌀 次元風暴 🌀`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 劇本第二幕：依序執行交換計畫
    for (const step of plan) {
        const { type, groupA, groupB } = step;
        
        const cellsToFlash = [];

        if (type === 'band_swap') { // 交換行組
            const startRowA = groupA * 3;
            const startRowB = groupB * 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 9; j++) {
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${startRowA + i}"][data-col="${j}"]`));
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${startRowB + i}"][data-col="${j}"]`));
                }
            }
        } else if (type === 'stack_swap') { // 交換列組
            const startColA = groupA * 3;
            const startColB = groupB * 3;
            for (let i = 0; i < 3; i++) {
                for (let row = 0; row < 9; row++) {
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${row}"][data-col="${startColA + i}"]`));
                    cellsToFlash.push(document.querySelector(`.cell[data-row="${row}"][data-col="${startColB + i}"]`));
                }
            }
        }

        // 觸發閃爍動畫！
        cellsToFlash.forEach(el => el?.classList.add('flash-swap'));
        // 等待動畫播放一小段時間 (例如 500 毫秒)
        await new Promise(resolve => setTimeout(resolve, 500));
        // 動畫結束後立刻移除 class，為下一次交換做準備
        cellsToFlash.forEach(el => el?.classList.remove('flash-swap'));
        
        // 在動畫播放的同時，我們在背景執行數據交換的邏輯
        // (這一段是之前修正歷史紀錄的正確邏輯，維持不變)
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
        
        // 數據交換完畢，重繪棋盤以顯示交換後的樣貌
        drawBoard();
        // 加上短暫延遲，讓玩家能看清每次的變化
        await new Promise(resolve => setTimeout(resolve, 300)); 
    }

    // 劇本第三幕：全部交換完畢，做最後的整理
    drawBoard();
    selectCell(null);
    updateUndoButtonState();
    updateRedoButtonState();
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
          socket.emit("sudoku_startGame", {
            roomId: currentGameId,
            difficulty: selectedDifficulty,
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

   if (difficultyButtons) {
      difficultyButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          const selectedDifficulty = event.currentTarget.dataset.difficulty;
          difficultyModalOverlay.classList.add("hidden");
          appContainer.classList.remove("hidden");

          hideWaitingScreen();

          if (gameMode === "multiplayer") {
            // --- 多人模式的處理邏輯 ---
            // 房主選擇難度後，直接通知伺服器開始遊戲
            socket.emit("sudoku_startGame", {
              roomId: currentGameId,
              difficulty: selectedDifficulty,
            });
            hideWaitingScreen();
            if (boardElement) {
              boardElement.innerHTML = "";
              boardElement.classList.remove("is-loading");
              // 多人遊戲的棋盤會在收到 'sudoku_countdown_started' 或 'sudoku_timerStart' 事件後才繪製
            }
          } else if (gameMode === "single") {
            // ▼▼▼ 【核心重構】單人模式現在也要走建立房間的流程 ▼▼▼
            
            // 1. 通知伺服器建立一個「單人」房間
            socket.emit("createRoom", {
              playerName: myPlayerName,
              gameType: "sudoku",
              isSinglePlayer: true,
            });

            // 2. 顯示載入畫面，等待伺服器回應
            if (boardElement) {
                boardElement.innerHTML = "<h2>正在準備單人遊戲...</h2>";
                boardElement.classList.add("is-loading");
            }

            // 3. 監聽伺服器是否已成功建立房間 (使用 .once 確保只監聽一次)
            socket.once("roomCreated", (data) => {
              currentGameId = data.roomId;
              iAmHost = true;

              // 4. 房間建立後，立刻通知伺服器開始遊戲
              // 這將會觸發伺服器上我們統一後的 sudoku_startGame 處理器
              socket.emit("sudoku_startGame", {
                roomId: currentGameId,
                difficulty: selectedDifficulty,
              });
            });
            // ▲▲▲ 重構結束 ▲▲▲
          }
        });
      });
    }
if (menuRestartBtn) {
  menuRestartBtn.addEventListener("click", async () => {
    if (gameMenuModalOverlay) gameMenuModalOverlay.classList.add("hidden");

    if (gameMode === 'multiplayer') {
      // 多人模式的「投降/返回大廳」邏輯維持不變
      if (myCurrentStatus === 'playing') {
        const message = "您確定要投降嗎？您將留在房間內但無法繼續作答。<br>可點選進度條切換至他人盤面觀戰。";
        const userConfirmed = await showCustomConfirm(message, "確認投降");
        if (userConfirmed) {
            socket.emit("sudoku_surrender", { roomId: currentGameId });
            iHaveSurrendered = true;
        }
      } else {
        socket.emit("leaveRoom", { roomId: currentGameId });
        returnToLobby();
      }
    } else {
      // ▼▼▼ 【核心修正】單人模式的「重新開始本局」邏輯 ▼▼▼
      const message = "您確定要放棄當前的進度，並重新開始這一局嗎？";
      const userConfirmed = await showCustomConfirm(message, "重新開始？");
      if (userConfirmed) {
        // 呼叫我們的新函式，而不是舊的 resetUIForNewGame 和 newGame
        restartCurrentGame();
      }
      // ▲▲▲ 修正結束 ▲▲▲
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
    if (menuBackToLobbyBtn)
      menuBackToLobbyBtn.addEventListener("click", async () => {
        if (gameMenuModalOverlay) gameMenuModalOverlay.classList.add("hidden");
        if (currentGameId && gameMode === 'multiplayer') { // 如果是多人遊戲，才發送離開房間事件
          socket.emit("leaveRoom", { roomId: currentGameId });
        }
        const wantsSolution = await showCustomConfirm(
          "在返回大廳前，您要先查看本局的完整解答嗎？",
          "查看解答？"
        );
        if (wantsSolution) {
          showSolutionView();
        } else {
          if (gameMode === 'multiplayer') {
              sessionStorage.removeItem('sudoku_reconnect_gameId');
              sessionStorage.removeItem('sudoku_reconnect_playerId');
              console.log('[斷線保護] 玩家正常離開，已清理重連資訊。');
          }
          if (gameMode === 'single') {
            socket.emit('sudoku_leave_single_player_game');
          }
          returnToLobby();
        }
      });

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

    
    if (winModalNewGameBtn)
      winModalNewGameBtn.addEventListener("click", () => {
      if (gameMode === 'multiplayer') {
            sessionStorage.removeItem('sudoku_reconnect_gameId');
            sessionStorage.removeItem('sudoku_reconnect_playerId');
            console.log('[斷線保護] 玩家正常離開，已清理重連資訊。');
        }
        if (gameMode === 'single') {
          socket.emit('sudoku_leave_single_player_game');
        }
        resetUIForNewGame();
        winModalOverlay.classList.add("hidden");
        appContainer.classList.add("hidden");
        difficultyModalOverlay.classList.remove("hidden");
      });

    if (solutionBackToLobbyBtn)
      solutionBackToLobbyBtn.addEventListener("click", () => {
    if (gameMode === 'multiplayer') {
            sessionStorage.removeItem('sudoku_reconnect_gameId');
            sessionStorage.removeItem('sudoku_reconnect_playerId');
            console.log('[斷線保護] 玩家從解答畫面返回大廳，已清理重連資訊。');
            socket.emit("leaveRoom", { roomId: currentGameId });
        } 
        if (currentGameId) socket.emit("leaveRoom", { roomId: currentGameId });
        if (gameMode === 'single') {
          socket.emit('sudoku_leave_single_player_game');
        } else if (currentGameId) { // 多人模式
          socket.emit("leaveRoom", { roomId: currentGameId });
        }
        returnToLobby();
      });

    if (solutionNewGameBtn)
      solutionNewGameBtn.addEventListener("click", () => {
    if (gameMode === 'multiplayer') {
            sessionStorage.removeItem('sudoku_reconnect_gameId');
            sessionStorage.removeItem('sudoku_reconnect_playerId');
            console.log('[斷線保護] 玩家從解答畫面開啟新局，已清理重連資訊。');
        }
      if (gameMode === 'single') {
          socket.emit('sudoku_leave_single_player_game');
        }
        appContainer.classList.add("hidden");
        difficultyModalOverlay.classList.remove("hidden");
      });

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

      // 建立「復原」按鈕
      const undoDiv = document.createElement("div");
      undoDiv.id = "undo-btn";
      undoDiv.classList.add("control-key", "control-button-style");
      undoDiv.innerHTML = "<span>復原</span>";
      undoDiv.addEventListener("click", undo); // 呼叫新的 undo 函式
      paletteElement.appendChild(undoDiv);

      // 【是的，您需要新增這一段來建立「取消復原」按鈕】
      const redoDiv = document.createElement("div");
      redoDiv.id = "redo-btn";
      redoDiv.classList.add("control-key", "control-button-style");
      redoDiv.innerHTML = "<span>取消<br>復原</span>";
      redoDiv.addEventListener("click", redo); // 呼叫新的 redo 函式
      paletteElement.appendChild(redoDiv);
      // 【新增結束】

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
    
    // ... (後續所有遊戲快捷鍵的邏輯維持原樣，不需要改動) ...
    const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type === "text") {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (activeEl === chatInput && chatSendBtn) chatSendBtn.click();
          if (activeEl === inGameChatInput && inGameChatSendBtn) inGameChatSendBtn.click();
        }
        return;
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
  // 只有在「視窗被切換」且「遊戲模式為單人」時，才觸發自動暫停
  if (document.hidden && gameMode === 'single' && !isPaused) { // <-- 增加 !isPaused 判斷更安全
    pauseGame(true); // <-- 【核心修正】傳入 true，標記為自動暫停
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

  socket.on('connect', () => {
      console.log('[斷線保護] Socket 連線成功！檢查是否有需要重連的遊戲...');
      const reconnectGameId = sessionStorage.getItem('sudoku_reconnect_gameId');
      const reconnectPlayerId = sessionStorage.getItem('sudoku_reconnect_playerId');

      if (reconnectGameId && reconnectPlayerId) {
          console.log(`[斷線保護] 發現舊的遊戲紀錄，嘗試重連至房間 ${reconnectGameId}...`);
          socket.emit('playerReconnected', {
              roomId: reconnectGameId,
              playerId: reconnectPlayerId,
              gameType: 'sudoku'
          });
      }
  });

  socket.on('reconnectionSuccess', (data) => {
      console.log('[斷線保護] 重連成功！正在恢復遊戲狀態...');
      showCustomAlert("斷線重連成功！");
      // 這裡需要根據 data 恢復遊戲畫面的完整邏輯
      // 例如：更新 opponentStates, 重繪棋盤, 更新計時器...
      gameMode = 'multiplayer';
      currentGameId = data.roomId;
      
      // 確保UI處於正確的遊戲狀態
      appContainer.classList.remove('hidden');
      sudokuModeModalOverlay.classList.add('hidden');
      difficultyModalOverlay.classList.add('hidden');
      setUIState('playing_multiplayer');
      
      // 根據重連資料恢復遊戲
      if(data.gameState && data.gameState.puzzle) {
        newGame(data.gameState.puzzle);
        updateOpponentProgressUI(data.players);
        updateTimerDisplay(data.gameState.seconds);
      }
  });

  socket.on('sudoku_spectateUpdate', (data) => {
    // 步驟 1: 先在日誌中打印出從伺服器收到的最原始的資料
    
    
    // 步驟 2: 進行嚴格的資料檢查
    if (!data || !data.puzzle || !data.initialPuzzle || !data.playerName) {
        // 只有在資料真的不完整時，才打印錯誤訊息並停止執行
        console.error("[偵錯日誌] 錯誤：收到的觀戰資料不完整或格式錯誤！");
        return;
    }
    
    // 步驟 3: 如果資料檢查通過，才解構並呼叫繪圖函式
    const { puzzle: spectatePuzzle, initialPuzzle: spectateInitialPuzzle, playerName, pencilMarks, hintCount, validateCount } = data;
    drawSpectatorBoard(spectatePuzzle, spectateInitialPuzzle, pencilMarks, playerName);
    highlightOpponentSelection(selectedCoords);
    // 呼叫新的資訊欄更新函式
    updateInfoPanelForSpectator(playerName, hintCount, validateCount);
});


    socket.on('sudoku_full_state_update', (fullPlayerState) => {
    opponentStates = fullPlayerState;
    updateOpponentProgressUI();
    updatePauseButtonState();
    const myState = fullPlayerState.find(p => p.playerId === myPlayerId);

    // ▼▼▼▼▼ 核心修改 ▼▼▼▼▼
    if (myState) {
        myCurrentStatus = myState.status;

        // ▼▼▼▼▼ 核心修正：接收伺服器的權威狀態並更新 UI ▼▼▼▼▼
        
        // 1. 用伺服器傳來的最新次數，更新前端的變數
        hintCount = myState.hintCount;
        validateCount = myState.validateCount;

        // 2. 呼叫 UI 更新函式，來顯示最新的次數
        updateGameInfo();

        // ▲▲▲▲▲ 修正結束 ▲▲▲▲▲

        const pauseCountDisplay = document.getElementById('info-pause-count-display');
        if (pauseCountDisplay) {
            pauseCountDisplay.textContent = myState.pauseUses > 0 ? `${myState.pauseUses} 次` : "用完";
        }
        if (menuRestartBtn) {
            if (myCurrentStatus === 'playing') {
                menuRestartBtn.textContent = '投降';
            } else { // 如果狀態是 'surrendered', 'finished', 'disconnected'
                menuRestartBtn.textContent = '返回大廳';
            }
        }
    }
    // ▲▲▲▲▲ 修改結束 ▲▲▲▲▲

    if (myState.status === 'finished' && !iHaveFinished && gameMode === 'multiplayer') {
        iHaveFinished = true;
        disableGameControls(true);
        showCustomAlert("恭喜您已完成！請等待其他玩家或在選單中選擇離開。");
    }
});


// ✨ 新增：監聽「遊戲正式結束」的事件
socket.on('sudoku_gameOver', ({ finalRanking }) => {
    isPaused = true;
    disableGameControls(true); // 禁用所有遊戲內控制項

    // 建立最終排名訊息
    let rankingText = '<h3>最終排名</h3><ol>';
    if (finalRanking && finalRanking.length > 0) {
        finalRanking.forEach((player, index) => {
            const time = new Date(player.finishTime * 1000).toISOString().substr(11, 8);
            rankingText += `<li>${player.playerName} - ${time}</li>`;
        });
    } else {
        rankingText += '<li>沒有完成的玩家。</li>';
    }
    rankingText += '</ol>';

    showCustomAlert(`遊戲結束！<br>${rankingText}`);
    setUIState('gameOver_multiplayer'); // 設定遊戲結束狀態，以便更新選單按鈕文字

    // 幾秒後顯示解答
    setTimeout(() => {
        showSolutionView();
    }, 5000);
});

  socket.on('sudoku_timeUpdate', ({ seconds: serverSeconds }) => {
      // ▼▼▼ 【核心修正】移除 gameMode 的判斷 ▼▼▼
      // 只要遊戲沒有暫停，就接收伺服器的時間更新
      if (!isPaused) {
          updateTimerDisplay(serverSeconds);
      }
});

   socket.on('sudoku_generation_started', async (data) => {
    console.log("[前端日誌 1/7] 收到 'sudoku_generation_started' 事件。", data);
    hideWaitingScreen();
    
    currentLotteryResult = data.lotteryResult || null;
    const difficulty = initialState.difficulty || gameSettings.difficulty;
    
    console.log(`[前端日誌 2/7] 當前難度判定為: ${difficulty}，抽獎結果為: ${currentLotteryResult}`);
    
    // --- ⭐ 核心修正：將所有邏輯合併到一個流暢的流程中 ⭐ ---

    if (boardElement) {
        boardElement.innerHTML = `<div class="loading-container"><h2>等待伺服器準備...</h2></div>`;
        boardElement.classList.add("is-loading");
    }

    if (inGameControls) inGameControls.classList.remove('hidden');
    resetControlPanel();
    disableGameControls(true);

    // 只有在極限模式下才需要進度條，否則可以略過
    if (difficulty === 'extreme') {
        const loadingContainer = boardElement.querySelector(".loading-container");
        if (loadingContainer) {
            loadingContainer.innerHTML = `
                <h2 id="loading-text-animation">${data.message || '正在生成謎題...'}</h2>
                <div class="progress-bar-container">
                    <div class="progress-bar"><div id="generation-progress-bar-fill"></div></div>
                    <span id="generation-progress-percentage">0%</span>
                </div>`;
        }
    }
    
    // 檢查是否有拉霸機動畫的結果，如果有就播放並等待它完成
    if (currentLotteryResult) {
        console.log("[前端日誌 4/7] 偵測到抽獎結果，準備呼叫 setupLotteryStage...");
        // 這裡我們需要等待 setupLotteryStage 函式的 Promise
        await setupLotteryStage(currentLotteryResult);
        console.log("[前端日誌 6/7] setupLotteryStage 執行完畢。");
    } else {
        console.log("[前端日誌 4/7] 無抽獎結果，跳過拉霸機動畫。");
    }
    
    // 無論是否播放了動畫，現在都向後端回報，表示前端已準備好
    console.log("[前端日誌 7/7] 準備向後端回報 'client_ready_for_countdown'。");
    socket.emit('sudoku_client_ready_for_countdown', { roomId: currentGameId });
    
    // 在等待後端倒數信號時，顯示等待文字
    if (boardElement) {
        boardElement.innerHTML = `<div class="loading-container"><h2>等待遊戲開始...</h2></div>`;
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


    socket.on('sudoku_generation_progress', ({ progress }) => {
    const percentageSpan = document.getElementById("generation-progress-percentage");
    const progressBarFill = document.getElementById("generation-progress-bar-fill");

    // 【⭐星探 B 的工作⭐】
    // 任務：獨立運作，負責更新 5% 到 100% 的進度條。
    // 把工人回報的 0-100% 進度，等比例縮放到 5-100% 的 95% 區間
    const displayProgress = 1 + Math.floor(progress * 0.99);

    if (percentageSpan) percentageSpan.textContent = `${displayProgress}%`;
    if (progressBarFill) progressBarFill.style.width = `${displayProgress}%`;
    
    // 拉霸機的觸發邏輯維持不變，由「完成進度」觸發，確保真實性
    if (!lotteryHasBeenTriggered && currentLotteryResult && progress >= 20) {
        lotteryHasBeenTriggered = true; 
        
        const randomDelay = Math.random() * 10000; 
        
        console.log(`[拉霸機] 實際進度已達 ${progress}%，將在 ${randomDelay.toFixed(0)} 毫秒後觸發動畫。`);
        setTimeout(() => {
            setupLotteryStage(currentLotteryResult);
        }, randomDelay);
    }
});


    socket.on("playerJoinRequest", (data) => {
      if (iAmHost) {
        if (data.status) {
          removeJoinRequestFromUI(data.requesterId);
        } else {
          addJoinRequestToUI(data.requesterId, data.playerName, data.timeout);
        }
      }
    });
    socket.on("updateRoomPlayers", (data) => {
      if (iAmHost && data.requesterId) {
        removeJoinRequestFromUI(data.requesterId);
      }
      opponentStates = data.players.map(p => ({
        playerId: p.id,
        playerName: p.name,
        progress: -1, // 預設為-1，因為還沒開始遊戲
        status: p.isHost ? 'host' : 'waiting', // 可以在這裡給予初始狀態
        finishTime: null
      }));
      updatePlayerListUI(data.players);
      updateOpponentProgressUI(); // 更新進度條 UI
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
    disableGameControls(true); // 禁用所有操作
    showCustomAlert(`${playerName || '對手'} 已暫停遊戲。`);
  }
});

socket.on('sudoku_gameResumed', () => {
  isPaused = false;
  if (boardElement && boardElement.classList.contains('is-loading')) {
    boardElement.classList.remove("is-loading");
    drawBoard(); // 如果畫面被覆蓋過，重繪棋盤
  }
  disableGameControls(false); // 解除所有禁用
  
  if (pauseBtn) pauseBtn.textContent = "暫停";
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


    socket.on("chatMessage", addChatMessageToUI);

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