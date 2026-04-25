const fs = require('fs');
const path = require('path');
// 直接引入你寫好的核心邏輯
const sudokuServer = require('./server/sudoku_server.js');

const DB_FILE = path.join(__dirname, 'hard_puzzles_db.json');
const TARGET_HOLES = 60; // 俊佑指定的骨灰級難度門檻

console.log(`[礦工] ⛏️ 數獨礦工已上線！目標：挖掘 ${TARGET_HOLES} 洞以上的神級題目...`);

// 初始化資料庫檔案 (如果沒有的話建一個空的)
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// 寫入硬碟的函數 (隨算隨存，釋放記憶體)
function savePuzzleToDB(puzzleData) {
    try {
        const currentData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        currentData.push(puzzleData);
        fs.writeFileSync(DB_FILE, JSON.stringify(currentData));
        console.log(`[礦工] 💾 成功入庫！目前題庫累積：${currentData.length} 題。`);
    } catch (e) {
        console.error("[礦工] 寫入檔案失敗，記憶體保護啟動，捨棄此題。", e);
    }
}

async function startMining() {
    let attempts = 0;

    while (true) {
        attempts++;
        
        // 1. 產生初始終盤
        let solvedBoard = sudokuServer.generateSolvedBoard();
        
        // 2. 先初步挖 45 洞 (繼承你原本的邏輯)
        let preDug = sudokuServer.digToTargetWithOptionalBlackout(solvedBoard, 45);
        
        // 3. 使用你的「極限挖掘演算法」進行深挖
        let finalResult = sudokuServer.digFromStateToLimit(
            preDug.puzzle, 
            solvedBoard, 
            preDug.blackoutNumbers
        );

        // 4. 判斷是否達標
        if (finalResult.holes >= TARGET_HOLES) {
            console.log(`[礦工] 🎉 第 ${attempts} 次嘗試：挖到寶了！發現 ${finalResult.holes} 洞的極限題目！`);
            
            // 整理要存的資料
            const puzzleToSave = {
                holes: finalResult.holes,
                puzzle: finalResult.puzzle,
                solution: finalResult.solution,
                blackoutNumbers: finalResult.blackoutNumbers,
                timestamp: Date.now()
            };
            
            savePuzzleToDB(puzzleToSave);
            attempts = 0; // 重置計數器
        }

        // ==========================================
        // 🧹 記憶體防護機制 (非常重要)
        // ==========================================
        // 手動解除參照，幫助 V8 引擎的 Garbage Collector 快速回收
        solvedBoard = null;
        preDug = null;
        finalResult = null;

        // 強制休息 50 毫秒。這不是為了降溫，是為了把線程的主導權還給 Node.js，
        // 讓它有時間去執行垃圾回收 (GC)，徹底防止 1GB 記憶體被撐爆！
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// 啟動挖礦
startMining();