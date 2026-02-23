const { parentPort } = require('worker_threads');
const sudokuGenerator = require('./sudoku_server.js');

parentPort.on('message', (task) => {
  
  if (task && task.command === 'deep_dig' && task.startPuzzle) {
    try {
      
      const result = sudokuGenerator.digFromStateToLimit(
        task.startPuzzle, 
        task.solvedBoard, 
        task.blackoutNumbers 
      );
      
      const messageToHQ = { status: 'success', ...result };
      
      parentPort.postMessage(messageToHQ);
    } catch (err) {
      console.error(`[Worker] 極限挖掘時發生錯誤: ${err.message}`);
      parentPort.postMessage({ status: 'error', error: err.message });
    }
  }
});