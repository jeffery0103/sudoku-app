document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const loginScreen = document.getElementById("login-screen");
  const mainAppScreen = document.getElementById("main-app-screen");
  const playerInfoDisplay = document.getElementById("player-info-display");
  const gameContainer = document.getElementById("game-container");

  let myPlayerName = null;
  let myPlayerId = null;

  const playerNameInput = document.getElementById("player-name-input");
  const confirmNameButton = document.getElementById("confirm-name-button");
  const displayPlayerNameSpan = document.getElementById("display-player-name");

  // --- 公用函式：顯示提示訊息 ---
  function showCustomAlert(message, title = "提示") {
    const alertOverlay = document.getElementById("alert-modal-overlay");
    const alertMessage = document.getElementById("alert-message");
    const alertOkBtn = document.getElementById("alert-ok-btn");
    const alertTitle = document.getElementById("alert-title");
  
    return new Promise((resolve) => {
      if (!alertOverlay || !alertMessage || !alertOkBtn || !alertTitle) {
        window.alert(`${title}\n\n${message.replace(/<br>/g, "\n")}`);
        return resolve();
      }
      alertTitle.textContent = title; 
      alertMessage.innerHTML = message;
      alertOverlay.classList.remove("hidden");
      
      alertOkBtn.addEventListener('click', function handler() {
        alertOverlay.classList.add("hidden");
        resolve();
      }, { once: true });
    });
  }

  // --- 公用函式：顯示確認對話框 ---
  function showCustomConfirm(message, title = "需要您的確認") {
    return new Promise((resolve) => {
      const modalOverlay = document.getElementById("custom-modal-overlay");
      const modalMessage = document.getElementById("modal-message");
      const modalConfirmBtn = document.getElementById("modal-confirm-btn");
      const modalCancelBtn = document.getElementById("modal-cancel-btn");
      const modalTitleElement = document.getElementById("modal-title");
      
      if(modalTitleElement) modalTitleElement.textContent = title;
      modalMessage.innerHTML = message;
  
      modalOverlay.classList.remove("hidden");

      modalConfirmBtn.onclick = () => {
        modalOverlay.classList.add("hidden");
        resolve(true);
      };
      modalCancelBtn.onclick = () => {
        modalOverlay.classList.add("hidden");
        resolve(false);
      };
    });
  }

  // --- 核心流程：載入遊戲 ---
  async function loadGame(gameName, initialState = {}) {
    // 登入後，玩家資訊就不需要一直顯示在右上角了，交給遊戲內部處理
    if (playerInfoDisplay) playerInfoDisplay.classList.add("hidden");
    
    gameContainer.innerHTML = "";
    document.title = "數獨 Sudoku";
    gameContainer.classList.remove("hidden");
    
    const gamePath = `games/${gameName}/${gameName}`;
  
    try {
      // 1. 載入遊戲的 HTML 結構
      const response = await fetch(`${gamePath}.html`);
      if (!response.ok) throw new Error(`HTML 載入失敗: ${response.statusText}`);
      gameContainer.innerHTML = await response.text();
  
      // 2. 載入遊戲的 CSS 樣式
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.id = `game-style-${gameName}`;
      cssLink.href = `${gamePath}.css`;
      document.head.appendChild(cssLink);
      
      // 3. 載入遊戲的 JavaScript 腳本
      const gameScript = document.createElement("script");
      gameScript.id = `game-script-${gameName}`;
      gameScript.src = `${gamePath}.js`;
      
      // 4. 當腳本載入完成後，執行初始化
      gameScript.onload = () => {
        if (window.initializeGame) {
          // 傳遞必要的資訊和公用函式給遊戲
          const fullInitialState = {
            ...initialState,
            playerName: myPlayerName,
            playerId: myPlayerId,
          };
          window.initializeGame(
            socket,
            fullInitialState,
            showCustomAlert,
            showCustomConfirm
          );
        } else {
          console.error(`${gameName}.js 中找不到 initializeGame 函式。`);
        }
      };
      document.body.appendChild(gameScript);
  
    } catch (error) {
      console.error("載入遊戲時出錯:", error);
      gameContainer.innerHTML = `<p>載入遊戲時發生錯誤，請重新整理。</p>`;
    }
  }
  
  // --- 處理玩家登入 ---
  function handleLogin() {
    const name = playerNameInput.value.trim();
    if (!name) {
      showCustomAlert("玩家名稱不能為空！");
      playerNameInput.classList.add('input-error');
      setTimeout(() => playerNameInput.classList.remove('input-error'), 500);
      return;
    }
    myPlayerName = name;
    
    // 這裡不再發送 'playerEnteredLobby'，因為沒有大廳了
    // socket.emit('playerEnteredLobby', myPlayerName); 
    
    displayPlayerNameSpan.textContent = myPlayerName;
    playerInfoDisplay.classList.remove("hidden");
    loginScreen.classList.add("hidden");
    mainAppScreen.classList.remove("hidden");
    
    // 登入成功後，直接載入數獨遊戲！
    loadGame('sudoku');
  }

  // --- 綁定登入事件 ---
  confirmNameButton.addEventListener("click", handleLogin);
  playerNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // --- Socket.IO 基礎連線 ---
  socket.on("connect", () => {
    myPlayerId = socket.id;
  });

  // (所有跟大廳相關的 socket 監聽器都已被移除)
});