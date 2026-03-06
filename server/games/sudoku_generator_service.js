const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const sudokuGame = require('./sudoku_server.js'); 

// ✨ 1. 將 onProgress 放入接收參數中，讓外部可以傳遞回報函數
function generatePuzzleParallel(difficulty, customHoles = null, onProgress = () => {}) {
  const onDispatch = () => {};
  const isExtreme = difficulty === 'extreme' || customHoles >= 58;

  if (!isExtreme) {
    return new Promise((resolve) => {
        let attempts = 10; 
        let targetHoles = 45;
        switch (difficulty) {
            case 'easy':   targetHoles = 40; break; 
            case 'medium': targetHoles = 50; break; 
            case 'hard':   targetHoles = 57; break; 
        }
        if (customHoles) targetHoles = customHoles;

        let bestResult = { holes: -1 };
        for (let i = 0; i < attempts; i++) {
            const solved = sudokuGame.generateSolvedBoard();
            const currentResult = sudokuGame.digToTargetWithOptionalBlackout(solved, targetHoles);
            if (currentResult.holes > bestResult.holes) {
                bestResult = { ...currentResult, solution: solved };
            }
            if (bestResult.holes >= targetHoles) break; 
        }
        resolve(bestResult);
    });
  }

  // --- 58洞以上 (極限模式) 的正式運作邏輯 ---
  return new Promise(async (resolve, reject) => {
    console.log(`[生成器] 啟動極限模式運算 (目標: ${customHoles || '59+'} 洞)`);
    
    let totalAttempts = 1000;
    const SPRINT_RUNS_AFTER_GOOD_PUZZLE = 50; 

    // ✨ 核心修正：加上雲端環境的防爆安全鎖 (限制最多 2 個 Worker)
    const physicalCores = os.cpus().length;
    const numWorkers = Math.min(physicalCores, 2); 
    
    console.log(`[生成器] 底層主機核心數: ${physicalCores}，為避免雲端記憶體爆炸，實際啟動執行緒: ${numWorkers}`);
    const workers = [];
    let tasksDispatched = 0;
    let completedTasks = 0;
    let bestResult = { puzzle: null, solution: null, holes: -1, blackoutNumbers: [] };
    let isFinished = false;

    let foundGoodPuzzle = false;
    let progressWhenFound = 0; 
    let tasksCompletedWhenFound = 0; 
    let runsWithoutImprovement = 0;

    const NUM_MASTER_BOARDS = 10;
    console.log(`[生成器] 正在準備 ${NUM_MASTER_BOARDS} 個基礎終盤... `);
    const masterBoards = Array.from({ length: NUM_MASTER_BOARDS }, () => sudokuGame.generateSolvedBoard());
    const PRE_DIG_HOLES = 45;

    const finish = (finalResult) => {
      if (isFinished) return;
      isFinished = true;
      workers.forEach(worker => worker.terminate());
      if (finalResult instanceof Error) reject(finalResult);
      else if (!finalResult || finalResult.holes === -1) reject(new Error("並行挖洞未能產生任何有效結果。"));
      else resolve(finalResult);
    };

    // ✨ 核心修正：任務派發器 (做完一個才給下一個，保證不塞車、100% CPU)
    const dispatchNextTask = (worker) => {
        if (isFinished || tasksDispatched >= totalAttempts) return;

        const solved = masterBoards[tasksDispatched % NUM_MASTER_BOARDS];
        const preDug = sudokuGame.digToTargetWithOptionalBlackout(solved, PRE_DIG_HOLES);
        
        worker.postMessage({
            command: 'deep_dig',
            startPuzzle: preDug.puzzle,
            solvedBoard: solved,
            blackoutNumbers: preDug.blackoutNumbers
        });
        tasksDispatched++;
    };
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path.join(__dirname, 'sudoku_worker.js'));
      workers.push(worker);
      
      worker.on('message', (result) => {
        if (isFinished) return;
        completedTasks++;

        // 1. 判斷是否有進步
        if (result.status === 'success' && result.holes > bestResult.holes) {
          bestResult = result;
          runsWithoutImprovement = 0; // ✨ 有進步！耐心值歸零
          console.log(`[生成器] 發現新的最佳結果！洞數: ${bestResult.holes}`);
        } else {
          runsWithoutImprovement++; // ✨ 沒進步，耐心值 +1
        }
        
        const targetHolesForSprint = customHoles ? Math.min(customHoles, 57) : 57;

        // 2. ✨ 核心修改：如果達到目標洞數，或者「連續 50 次沒進步」，就提早進入最後衝刺！
        if (!foundGoodPuzzle && (bestResult.holes >= targetHolesForSprint || runsWithoutImprovement >= 50)) {
            foundGoodPuzzle = true;
            
            const triggerReason = bestResult.holes >= targetHolesForSprint ? `達到目標 ${bestResult.holes} 洞` : `連續 50 次未破紀錄`;
            console.log(`[生成器] ${triggerReason}！提早收手，進入最後 ${SPRINT_RUNS_AFTER_GOOD_PUZZLE} 次衝刺...`);
            
            tasksCompletedWhenFound = completedTasks;
            progressWhenFound = Math.floor((completedTasks / 1000) * 100);
            
        
            totalAttempts = completedTasks + SPRINT_RUNS_AFTER_GOOD_PUZZLE;
        }

        // 3. 結算與進度條更新
        if (completedTasks >= totalAttempts) {
            onProgress({ progress: 100 });
            finish(bestResult);
        } else {
            if (!foundGoodPuzzle) {
                // 還在盲找階段，進度條慢慢爬
                onProgress({ progress: Math.floor((completedTasks / 1000) * 100) });
            } else {
                // 進入衝刺階段，進度條會加速衝刺到 99% (這會帶給玩家很棒的「快算完了」的視覺回饋！)
                const runsDoneInSprint = completedTasks - tasksCompletedWhenFound;
                const actualSprintTarget = totalAttempts - tasksCompletedWhenFound; 
                if (actualSprintTarget > 0) {
                    const remainingProgressPercentage = 100 - progressWhenFound;
                    const addedProgress = Math.floor((runsDoneInSprint / actualSprintTarget) * remainingProgressPercentage);
                    onProgress({ progress: Math.min(progressWhenFound + addedProgress, 99) }); 
                }
            }
            // 派發下一個任務
            dispatchNextTask(worker);
        }
      });

      worker.on('error', (err) => { if (!isFinished) finish(err); });
      worker.on('exit', (code) => { if (code !== 0 && !isFinished) finish(new Error(`Worker stopped with exit code ${code}`)); });
      
      // 初始化：先給每個工人一個任務
      dispatchNextTask(worker);
    }
  });
}



module.exports = {
  generatePuzzleParallel,
};