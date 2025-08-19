const { app, BrowserWindow } = require('electron');
const path = require('path');

// 建立一個函式來產生我們的應用程式視窗
const createWindow = () => {
  // 建立一個新的瀏覽器視窗，並設定長寬
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      // 預先載入的腳本 (如果需要的話)
      // preload: path.join(__dirname, 'preload.js') 
    }
  });

  // ⚠️ 最關鍵的一步：讓這個視窗載入你的 Render 網站網址！
  win.loadURL('https://sudoku-app-cwzh.onrender.com');

  // (可選) 如果你想在啟動時自動打開開發者工具 (像 Chrome 的 F12)，可以取消下面這行的註解
  // win.webContents.openDevTools();
};

// 當 Electron 應用程式準備好時，就呼叫 createWindow 函式
app.whenReady().then(() => {
  createWindow();

  // 處理 macOS 的特殊情況
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 當所有視窗都關閉時，結束應用程式 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { // 'darwin' 就是 macOS
    app.quit();
  }
});