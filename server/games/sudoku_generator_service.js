const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const sudokuGame = require('./sudoku_server.js'); 

function generatePuzzleParallel(difficulty, onProgress = () => {}, onDispatch = () => {}, specialMode = null) {
  
  if (difficulty !== 'extreme') {
    return new Promise((resolve) => {
        let attempts;
        switch (difficulty) {
            case 'easy':   attempts = 1; break;
            case 'medium': attempts = 2; break;
            case 'hard':   attempts = 10; break;
            default:       attempts = 1;
        }
        let bestResult = { holes: -1 };
        for (let i = 0; i < attempts; i++) {
            const solved = sudokuGame.generateSolvedBoard();
            const targetHoles = { easy: 38, medium: 50, hard: 57 }[difficulty] || 50;
            const currentResult = sudokuGame.digToTargetWithOptionalBlackout(solved, targetHoles);
            if (currentResult.holes > bestResult.holes) {
                bestResult = { ...currentResult, solution: solved };
            }
        }
        resolve(bestResult);
    });
  }

  // --- 極限模式的正式運作邏輯 ---
  return new Promise(async (resolve, reject) => {
    console.log(`[生成器] 極限模式啟動，抽中效果: ${specialMode || '無'}`);
    
    // 【修改點 1】將 totalAttempts 改為 let，並定義衝刺次數
    let totalAttempts = 1000;
    const SPRINT_RUNS_AFTER_GOOD_PUZZLE = 100;

    const numWorkers = os.cpus().length;
    const workers = [];
    let completedTasks = 0;
    let bestResult = { puzzle: null, solution: null, holes: -1, blackoutNumbers: [] };
    let isFinished = false;

    // 【修改點 2】增加新的狀態變數，用來管理「最後衝刺」階段
    let foundGoodPuzzle = false;
    let progressWhenFound = 0; // 找到好題目時的「完成進度」百分比

    const finish = (finalResult) => {
      if (isFinished) return;
      isFinished = true;
      workers.forEach(worker => worker.terminate());
      if (finalResult instanceof Error) reject(finalResult);
      else if (!finalResult || finalResult.holes === -1) reject(new Error("並行挖洞未能產生任何有效結果。"));
      else resolve(finalResult);
    };
    
    //大幅改造 Worker 的訊息處理與進度回報邏輯
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path.join(__dirname, 'sudoku_worker.js'));
      workers.push(worker);
      worker.on('message', (result) => {
        if (isFinished) return;
        
        completedTasks++;

        if (result.status === 'success' && result.holes > bestResult.holes) {
          bestResult = result;
          console.log(`[生成器] 發現新的最佳結果！洞數: ${bestResult.holes}`);
        }
        
        // --- 全新智慧進度條與結束邏輯 (最終修正版) ---

        // 衝刺模式
        if (!foundGoodPuzzle && bestResult.holes >= 60) {
            foundGoodPuzzle = true;
            console.log(`[生成器] 找到 ${bestResult.holes} 洞的優質題目！進入最後衝刺階段...`);
            
            const currentCompletionProgress = Math.floor((completedTasks / 1000) * 100); // 分母用固定的1000
            progressWhenFound = 90 + Math.floor(currentCompletionProgress / 10);
            
            // 動態修改任務總數，同時確保不超過 1000 的絕對上限！
            totalAttempts = Math.min(1000, completedTasks + SPRINT_RUNS_AFTER_GOOD_PUZZLE);
            console.log(`[生成器] 新的目標總次數為: ${totalAttempts}`);
        }

        // 【⭐核心修正⭐】然後才做進度回報和結束判斷
        // 只有在「結束條件滿足時」，才呼叫 finish()
        if (completedTasks >= totalAttempts) {
            onProgress({ progress: 100 });
            finish(bestResult);
        } else {
            // 如果還沒結束，就正常回報進度
            if (!foundGoodPuzzle) {
                // A. 正常模式下的進度回報
                const currentCompletionProgress = Math.floor((completedTasks / 1000) * 100);
                onProgress({ progress: currentCompletionProgress });
            } else {
                // B. 衝刺模式下的進度回報
                const sprintBaseAttempts = totalAttempts - SPRINT_RUNS_AFTER_GOOD_PUZZLE;
                const runsDoneInSprint = completedTasks - sprintBaseAttempts;
                if (runsDoneInSprint >= 0) {
                    const remainingProgressPercentage = 100 - progressWhenFound;
                    const addedProgress = Math.floor((runsDoneInSprint / SPRINT_RUNS_AFTER_GOOD_PUZZLE) * remainingProgressPercentage);
                    onProgress({ progress: Math.min(progressWhenFound + addedProgress, 100) });
                }
            }
        }
      });
      worker.on('error', (err) => { if (!isFinished) finish(err); });
      worker.on('exit', (code) => { if (code !== 0 && !isFinished) finish(new Error(`Worker stopped with exit code ${code}`)); });
    }
    const NUM_MASTER_BOARDS = 10;
    console.log(`[生成器] 正在準備 ${NUM_MASTER_BOARDS} 個基礎終盤... `);
    const masterBoards = Array.from({ length: NUM_MASTER_BOARDS }, () => sudokuGame.generateSolvedBoard());
    const PRE_DIG_HOLES = 45;

    let lastDispatchedProgress = -1;
    console.log('[生成器] 開始邊生成起點邊分派任務...');
    for (let i = 0; i < totalAttempts; i++) {
      // 如果在迴圈中 totalAttempts 被修改了，這個檢查可以確保迴圈能提早停止
      if (i >= totalAttempts && foundGoodPuzzle) break;

      const solved = masterBoards[i % NUM_MASTER_BOARDS];
      const preDug = sudokuGame.digToTargetWithOptionalBlackout(solved, PRE_DIG_HOLES);
      
      workers[i % numWorkers].postMessage({
        command: 'deep_dig',
        startPuzzle: preDug.puzzle,
        solvedBoard: solved,
        blackoutNumbers: preDug.blackoutNumbers
      });
      
      const currentDispatchProgress = Math.floor(((i + 1) / totalAttempts) * 100);
      if (currentDispatchProgress > lastDispatchedProgress) {
          lastDispatchedProgress = currentDispatchProgress;
          onDispatch({ progress: currentDispatchProgress });
      }
    }
  });
}



module.exports = {
  generatePuzzleParallel,
};