const { app, BrowserWindow, ipcMain } = require('electron'); // <-- ✨ 1. 引入 ipcMain
const path = require('path');

// ✨ 2. 引入我們剛剛移植進來的謎題產生器！
const { generatePuzzleParallel } = require('./electron-backend/sudoku_generator_service.js');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      // ✨ 3. 這是關鍵設定！它允許我們的遊戲畫面(sudoku.js)可以使用 require 和 ipcRenderer 等 Node.js 功能
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // 這一行維持不變，APP 打開時依然是先載入你的 Render 網站
  win.loadURL('https://sudoku-app-cwzh.onrender.com');
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ======================================================
// --- ✨ 4. 全新增加的區塊：APP 大腦的核心運算中心 ---
// ======================================================
ipcMain.handle('generate-sudoku-puzzle', async (event, difficulty) => {
  console.log(`[Electron Main] 收到來自遊戲畫面的運算請求！難度: ${difficulty}`);
  
  try {
    // 當收到請求時，直接呼叫我們移植進來的謎題產生器
    // 這裡的運算會在你自己的電腦上火力全開！
    const result = await generatePuzzleParallel(difficulty);
    console.log(`[Electron Main] 本地端已成功產生謎題，洞數: ${result.holes}，準備回傳結果。`);
    
    // 將運算結果回傳給遊戲畫面
    return result;
  } catch (error) {
    console.error('[Electron Main] 本地端產生謎題時發生錯誤:', error);
    // 如果發生錯誤，也把錯誤訊息回傳
    return { error: error.message };
  }
});

