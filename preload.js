const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 這個功能負責：從遊戲畫面(身體)「傳話」給大腦(main.js)
  generatePuzzle: (payload) => ipcRenderer.send('generate-sudoku-puzzle', payload)
});

// 這段負責：接收來自大腦(main.js)的「回信」
ipcRenderer.on('puzzle-generated', (event, result) => {
  console.log('[Preload] 收到來自 Main 的 puzzle-generated 事件');
  // 收到回信後，建立一個自訂的 window 事件，並把結果放進去
  // 這就像特使在遊戲大廳裡大喊：「有新結果囉！」
  const customEvent = new CustomEvent('puzzle-result', { detail: result });
  window.dispatchEvent(customEvent);
});