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
    if (playerInfoDisplay) playerInfoDisplay.classList.add("hidden");
    
    gameContainer.innerHTML = "";
    document.title = "數獨 Sudoku";
    gameContainer.classList.remove("hidden");
    
    const gamePath = `games/${gameName}/${gameName}`;
  
    try {
      const response = await fetch(`${gamePath}.html`);
      if (!response.ok) throw new Error(`HTML 載入失敗: ${response.statusText}`);
      gameContainer.innerHTML = await response.text();
  
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.id = `game-style-${gameName}`;
      cssLink.href = `${gamePath}.css`;
      document.head.appendChild(cssLink);
      
      const gameScript = document.createElement("script");
      gameScript.id = `game-script-${gameName}`;
      gameScript.src = `${gamePath}.js`;
      
      gameScript.onload = () => {
        if (window.initializeGame) {
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
    
    displayPlayerNameSpan.textContent = myPlayerName;
    playerInfoDisplay.classList.remove("hidden");
    
    // ✨ 修改點：按下確認後，先隱藏登入畫面，但不立刻載入遊戲
    loginScreen.classList.add("hidden");

    // 📢 監聽來自啟動動畫的「完成廣播」
    window.addEventListener('splashComplete', () => {
        console.log("啟動動畫播放完畢，正式載入遊戲介面！");
        mainAppScreen.classList.remove("hidden");
        // 動畫播完了，這時候才載入數獨遊戲
        loadGame('sudoku'); 
    }, { once: true }); // 使用 once 確保這個監聽器只會執行一次
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
});