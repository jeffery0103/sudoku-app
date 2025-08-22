// ======================================================
// Sudoku 遊戲主腳本 (最終完整版 - 無省略)
// ======================================================
function initializeGame(
  socket, // 我們直接使用這個傳進來的 socket，不再需要全域變數
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
    
    inGameControls?.classList.add('hidden');
    multiplayerWaitingPanel?.classList.add('hidden');
    if (singlePlayerInfoPanel) singlePlayerInfoPanel.classList.add('hidden');
    if (multiplayerInfoPanel) multiplayerInfoPanel.classList.add('hidden');

    if (state === 'waiting_multiplayer') {
      multiplayerWaitingPanel?.classList.remove('hidden');
    } else if (state === 'playing_single') {
      inGameControls?.classList.remove('hidden');
      singlePlayerInfoPanel?.classList.remove('hidden');
    } else if (state === 'playing_multiplayer' || state === 'gameOver_multiplayer') {
      inGameControls?.classList.remove('hidden');
      multiplayerInfoPanel?.classList.remove('hidden');
    }
    
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
    if (menuBackToLobbyBtn) {
      menuBackToLobbyBtn.style.display = (isMultiplayerPlaying || isMultiplayerGameOver) ? 'none' : 'block';
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

    const meInNewList = players.find((p) => p.id === myPlayerId);
    iAmHost = meInNewList ? meInNewList.isHost : false;

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
      playerNameSpan.textContent = player.name + (player.id === myPlayerId ? " (你)" : "");
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
    if (inGameChatMessages) inGameChatMessages.innerHTML = '';
    if (multiplayerGameInfoContent) multiplayerGameInfoContent.innerHTML = '';

    updateUndoButtonState();
    updateRedoButtonState();
    updatePauseButtonState();
  }

  function showWaitingScreen(roomId) {
    setUIState("waiting_multiplayer");
    const mainText = document.getElementById("waiting-main-text");

    if (mainText) {
      mainText.innerHTML = `已進入房間 <strong>${roomId}</strong>`;
    }

    if (waitingView) waitingView.classList.remove("hidden");
    if (boardElement) boardElement.classList.add("hidden");
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
            <span class="timer-label">已用時間：</span>
            <span id="timer-value">00:00:00</span>`;
        
        timerValueElement = document.getElementById('timer-value');
        updateTimerDisplay();
    }
    drawBoard();
  }

  function updateGameInfo() {
    if (infoHintCount) infoHintCount.textContent = hintCount > 0 ? hintCount : "用完";
    if (infoValidateCount) infoValidateCount.textContent = validateCount > 0 ? validateCount : "用完";

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

    const keybindingsInfoHTML = `...`; // (你的快捷鍵說明HTML)
    const gameInfoHTML = `...`; // (你的遊戲資訊HTML)

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
    if (isBoardFull()) {
      try {
        const response = await fetch("/api/sudoku/check-win", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: currentGameId,
            puzzle: puzzle.map((row) => row.map((cell) => cell.value)),
          }),
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();

        if (data.isCorrect) {
          socket.emit('sudoku_playerAction', {
              roomId: currentGameId,
              puzzle: puzzle.map(row => row.map(cell => cell.value)),
              pencilMarks: pencilMarksData.map(row => row.map(set => Array.from(set)))
          });
          showWinModal();
        } else {
          showCustomAlert("您已填滿所有格子，但答案包含錯誤。");
          validateBoard(true);
        }
      } catch (error) {
        console.error("判斷勝利時發生錯誤:", error);
        showCustomAlert("無法確認勝利狀態，請稍後再試。");
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
    
    const difficultyEl = document.getElementById('win-stat-difficulty');
    const holesEl = document.getElementById('win-stat-holes');
    const timeEl = document.getElementById('win-stat-time');
    const hintsEl = document.getElementById('win-stat-hints');
    const validationsEl = document.getElementById('win-stat-validations');

    const difficultyMap = { 'easy': '簡單', 'medium': '中等', 'hard': '困難', 'extreme': '極限' };
    const difficultyText = difficultyMap[gameSettings.difficulty] || '未知';
    const finalTime = timerValueElement ? timerValueElement.textContent : '未知';
    
    const initialHintCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
    const initialValidateCount = { 'easy': 5, 'medium': 3, 'hard': 1, 'extreme': 0 }[gameSettings.difficulty] || 0;
    const hintsUsed = initialHintCount - hintCount;
    const validationsUsed = initialValidateCount - validateCount;

    if (difficultyEl) difficultyEl.textContent = difficultyText;
    if (holesEl) holesEl.textContent = `${puzzleHoles} 個`;
    if (timeEl) timeEl.textContent = finalTime;
    if (hintsEl) hintsEl.textContent = `${hintsUsed} 次`;
    if (validationsEl) validationsEl.textContent = `${validationsUsed} 次`;

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
    if (!inGameChatNotificationBadge) return;

    if (unreadInGameMessages > 0) {
      inGameChatNotificationBadge.textContent = unreadInGameMessages;
      inGameChatNotificationBadge.classList.remove('hidden');
    } else {
      inGameChatNotificationBadge.classList.add('hidden');
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
      if (inGameChatTab && !inGameChatTab.classList.contains('active')) {
          unreadInGameMessages++;
          updateInGameChatBadge();
      }
    }

    const targets = [];
    if (chatMessages) {
      targets.push(chatMessages);
    }
    if (inGameChatMessages) {
      targets.push(inGameChatMessages);
    }

    if (targets.length === 0) {
      return;
    }

    targets.forEach(target => {
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message');

      if (data.type === 'system') {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `<span>${data.message}</span>`;
      } else {
        if (data.senderId === myPlayerId) {
          messageElement.classList.add('my-message');
        }
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
      target.scrollTop = target.scrollHeight;
    });
  }

  function updateChatBadge() {
    if (!chatNotificationBadge) return;

    if (unreadChatMessages > 0) {
      chatNotificationbadge.textContent = unreadChatMessages;
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

    // ======================================================
    // --- 1. 全新增加的「混合模式」核心監聽器 ---
    // ======================================================

    // 1.1 身分宣告 (確保 socket 已連線)
    const identifyAsElectron = () => {
      if (typeof window.electronAPI !== 'undefined') {
        console.log("[前端] 偵測到 Electron 環境，進行身分宣告。");
        socket.emit('client-identity', 'electron-app');
      }
    };
    if (socket.connected) {
      identifyAsElectron();
    } else {
      socket.once('connect', identifyAsElectron);
    }

    // 1.2 接收伺服器的本地運算指令
    socket.on('server-requests-puzzle-generation', ({ difficulty }) => {
      console.log(`[前端] 收到伺服器的本地運算指令！難度: ${difficulty}`);
      if (boardElement) boardElement.innerHTML = `<h2>收到指揮官指令！<br>正在您的電腦上高速產生謎題...</h2>`;
      
      if (window.electronAPI) {
        window.electronAPI.generatePuzzle({ difficulty, roomId: currentGameId });
      } else {
        console.error("[前端] 錯誤：收到本地運算指令，但找不到 window.electronAPI！");
        showCustomAlert("APP 內部通訊錯誤，無法啟動本地運算。");
      }
    });

    // 1.3 監聽來自 Preload 的廣播
    window.addEventListener('puzzle-result', (event) => {
      const result = event.detail;
      console.log('[前端] 監聽到 Preload 廣播，收到運算成果！', result);
      
      if (result && !result.error) {
        console.log('[前端] 成果有效，正在上繳給伺服器...');
        socket.emit('client-submits-generated-puzzle', { roomId: currentGameId, result: result });
      } else {
        console.error('[前端] 本地運算回報錯誤:', result.error);
        showCustomAlert(`本地運算時發生錯誤：<br>${result.error}`);
        socket.emit('client-submits-generated-puzzle', { roomId: currentGameId, result: { error: result.error || '未知錯誤' } });
      }
    });

    // ======================================================
    // --- 2. 從你原本程式碼中，集中過來的監聽器 ---
    // ======================================================

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
        gameMode = 'multiplayer';
        currentGameId = data.roomId;
        appContainer.classList.remove('hidden');
        sudokuModeModalOverlay.classList.add('hidden');
        difficultyModalOverlay.classList.add('hidden');
        setUIState('playing_multiplayer');
        if(data.gameState && data.gameState.puzzle) {
          newGame(data.gameState.puzzle);
          updateOpponentProgressUI(data.players);
          updateTimerDisplay(data.gameState.seconds);
        }
    });

    socket.on('sudoku_spectateUpdate', (data) => {
        if (!data || !data.puzzle || !data.initialPuzzle || !data.playerName) {
            console.error("[偵錯日誌] 錯誤：收到的觀戰資料不完整或格式錯誤！");
            return;
        }
        const { puzzle: spectatePuzzle, initialPuzzle: spectateInitialPuzzle, playerName, pencilMarks, hintCount, validateCount } = data;
        drawSpectatorBoard(spectatePuzzle, spectateInitialPuzzle, pencilMarks, playerName);
        updateInfoPanelForSpectator(playerName, hintCount, validateCount);
    });

    socket.on('sudoku_full_state_update', (fullPlayerState) => {
        opponentStates = fullPlayerState;
        updateOpponentProgressUI();
        updatePauseButtonState();
        const myState = fullPlayerState.find(p => p.playerId === myPlayerId);
        if (myState) {
            myCurrentStatus = myState.status;
            hintCount = myState.hintCount;
            validateCount = myState.validateCount;
            updateGameInfo();
            const pauseCountDisplay = document.getElementById('info-pause-count-display');
            if (pauseCountDisplay) {
                pauseCountDisplay.textContent = myState.pauseUses > 0 ? `${myState.pauseUses} 次` : "用完";
            }
            if (menuRestartBtn) {
                if (myCurrentStatus === 'playing') {
                    menuRestartBtn.textContent = '投降';
                } else {
                    menuRestartBtn.textContent = '返回大廳';
                }
            }
        }
        if (myState.status === 'finished' && !iHaveFinished && gameMode === 'multiplayer') {
            iHaveFinished = true;
            disableGameControls(true);
            showCustomAlert("恭喜您已完成！請等待其他玩家或在選單中選擇離開。");
        }
    });

    socket.on('sudoku_gameOver', ({ finalRanking }) => {
        isPaused = true;
        disableGameControls(true);
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
        setUIState('gameOver_multiplayer');
        setTimeout(() => { showSolutionView(); }, 5000);
    });

    socket.on('sudoku_timeUpdate', ({ seconds: serverSeconds }) => {
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
      if (boardElement) {
          boardElement.innerHTML = `<div class="loading-container"><h2>等待伺服器準備...</h2></div>`;
          boardElement.classList.add("is-loading");
      }
      if (inGameControls) inGameControls.classList.remove('hidden');
      resetControlPanel();
      disableGameControls(true);
      if (difficulty === 'extreme') {
          const loadingContainer = boardElement.querySelector(".loading-container");
          if (loadingContainer) {
              loadingContainer.innerHTML = `<h2 id="loading-text-animation">${data.message || '正在生成謎題...'}</h2><div class="progress-bar-container"><div class="progress-bar"><div id="generation-progress-bar-fill"></div></div><span id="generation-progress-percentage">0%</span></div>`;
          }
      }
      if (currentLotteryResult) {
          console.log("[前端日誌 4/7] 偵測到抽獎結果，準備呼叫 setupLotteryStage...");
          await setupLotteryStage(currentLotteryResult);
          console.log("[前端日誌 6/7] setupLotteryStage 執行完畢。");
      } else {
          console.log("[前端日誌 4/7] 無抽獎結果，跳過拉霸機動畫。");
      }
      console.log("[前端日誌 7/7] 準備向後端回報 'client_ready_for_countdown'。");
      socket.emit('sudoku_client_ready_for_countdown', { roomId: currentGameId });
      if (boardElement) {
          boardElement.innerHTML = `<div class="loading-container"><h2>等待遊戲開始...</h2></div>`;
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

    socket.on('sudoku_generation_progress', ({ progress }) => {
        const percentageSpan = document.getElementById("generation-progress-percentage");
        const progressBarFill = document.getElementById("generation-progress-bar-fill");
        const displayProgress = 1 + Math.floor(progress * 0.99);
        if (percentageSpan) percentageSpan.textContent = `${displayProgress}%`;
        if (progressBarFill) progressBarFill.style.width = `${displayProgress}%`;
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
        if (iAmHost && data.requesterId) { removeJoinRequestFromUI(data.requesterId); }
        opponentStates = data.players.map(p => ({ playerId: p.id, playerName: p.name, progress: -1, status: p.isHost ? 'host' : 'waiting', finishTime: null }));
        updatePlayerListUI(data.players);
        updateOpponentProgressUI();
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
            disableGameControls(true);
            showCustomAlert(`${playerName || '對手'} 已暫停遊戲。`);
        }
    });

    socket.on('sudoku_gameResumed', () => {
        isPaused = false;
        if (boardElement && boardElement.classList.contains('is-loading')) {
            boardElement.classList.remove("is-loading");
            drawBoard();
        }
        disableGameControls(false);
        if (pauseBtn) pauseBtn.textContent = "暫停";
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

      // 顯示通用的載入畫面
      if (boardElement) {
        boardElement.innerHTML = `<h2>正在向伺服器請求謎題...</h2><p>請稍候...</p>`;
        boardElement.classList.add("is-loading");
      }

      // --- ▼▼▼ 恢復判斷邏輯，但決策依然交給伺服器 ▼▼▼ ---

      if (gameMode === 'single') {
        // --- 單人模式：必須先建立房間，再開始遊戲 ---
        
        // 1. 通知伺服器建立一個「單人」房間
        socket.emit("createRoom", {
          playerName: myPlayerName,
          gameType: "sudoku",
          isSinglePlayer: true,
        });

        // 2. 用 .once 監聽，確保只觸發一次
        socket.once("roomCreated", (data) => {
          currentGameId = data.roomId;
          iAmHost = true;

          // 3. 房間建立成功後，才發送「開始遊戲」指令
          socket.emit("sudoku_startGame", {
            roomId: currentGameId,
            difficulty: selectedDifficulty,
          });
        });

      } else { // gameMode === 'multiplayer'
        // --- 多人模式：房間已存在，直接開始遊戲 ---
        // (因為多人模式下，currentGameId 早就已經在你建立或加入房間時就設定好了)
        socket.emit("sudoku_startGame", {
          roomId: currentGameId,
          difficulty: selectedDifficulty,
        });
      }
      // --- ▲▲▲ 判斷邏輯結束 ▲▲▲ ---
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