const TETROMINOES = {
    'I': [[0,0],[0,1],[0,2],[0,3]], // I 形 (4x1)
    'J': [[0,0],[1,0],[1,1],[1,2]], // J 形 (3x2)
    'L': [[0,2],[1,0],[1,1],[1,2]], // L 形 (3x2)
    'O': [[0,0],[0,1],[1,0],[1,1]], // O 形 (2x2)
    'S': [[0,1],[0,2],[1,0],[1,1]], // S 形 (3x2)
    'T': [[0,1],[1,0],[1,1],[1,2]], // T 形 (3x2)
    'Z': [[0,0],[0,1],[1,1],[1,2]]  // Z 形 (3x2)
};

// 每種方塊的初始旋轉中心 (用於旋轉邏輯)
const ROTATION_OFFSETS = {
    'I': [ [0,0], [-1,0], [1,0], [2,0] ], // 對於 I 型，旋轉中心可能在第二個方塊或中心
    'J': [ [0,0], [0,1], [0,-1], [-1,-1] ],
    'L': [ [0,0], [0,1], [0,-1], [-1,1] ],
    'O': [ [0,0], [0,1], [1,0], [1,1] ], // O 型不需要旋轉
    'S': [ [0,0], [0,1], [1,-1], [1,0] ],
    'T': [ [0,0], [0,1], [0,-1], [1,0] ],
    'Z': [ [0,0], [0,1], [1,1], [1,2] ]
};

// 遊戲板面的尺寸
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20; // 實際可見區域，但通常會留一些頂部空間

// 顏色 (可選，前端也需要定義)
const COLORS = {
    'I': 'cyan',
    'J': 'blue',
    'L': 'orange',
    'O': 'yellow',
    'S': 'green',
    'T': 'purple',
    'Z': 'red',
    'empty': 'lightgray'
};


// 這裡可以放一些遊戲開始時需要設定的參數，例如初始速度、分數規則等
function getGameSettings(difficulty = 'normal') {
    let initialSpeed = 1000; // 單位毫秒
    let linesPerLevel = 10;
    let scorePerLine = 100;
    let scorePerTetromino = 10; // 每成功放置一個方塊的分數

    switch (difficulty) {
        case 'easy':
            initialSpeed = 1200;
            linesPerLevel = 8;
            scorePerLine = 80;
            break;
        case 'hard':
            initialSpeed = 800;
            linesPerLevel = 12;
            scorePerLine = 120;
            break;
        case 'normal':
        default:
            break;
    }
    return { initialSpeed, linesPerLevel, scorePerLine, scorePerTetromino };
}

/**
 * 驗證前端提交的遊戲結果
 * @param {Array<Array<number>>} finalBoard 前端提交的最終遊戲板面狀態
 * @param {number} finalScore 前端提交的最終分數
 * @param {number} totalLinesCleared 前端提交的總消除行數
 * @returns {{isValid: boolean, serverScore: number, serverLines: number, message: string}} 驗證結果
 */
function validateGameResult(finalBoard, finalScore, totalLinesCleared) {
    // 這裡可以實現一些基本的驗證邏輯來防止簡單作弊
    // 對於俄羅斯方塊，完全在後端模擬遊戲過程來驗證會非常複雜且耗資源
    // 簡單的驗證可以包括：
    // 1. 檢查板面尺寸是否正確
    // 2. 檢查板面上是否只包含有效方塊值
    // 3. (較複雜) 估計分數是否在合理範圍內 (例如，基於總消除行數的最小分數)

    // 舉例：簡單檢查板面尺寸
    if (!finalBoard || finalBoard.length !== BOARD_HEIGHT || !finalBoard.every(row => row.length === BOARD_WIDTH)) {
        return { isValid: false, serverScore: 0, serverLines: 0, message: "板面數據不正確" };
    }

    // 在這裡，我們假設前端發送的數據是「可信」的，或者只做非常基本的驗證
    // 更複雜的驗證需要：
    // a. 前端每次方塊移動/旋轉/下落都通知後端，後端同步遊戲狀態 (高延遲，不適合即時遊戲)
    // b. 後端隨機抽樣驗證 (複雜)
    // c. 依賴前端混淆、加密等手段 (降低但無法消除作弊)

    // 對於單機版遊戲，通常將信任放在前端。如果你想加入排行榜，則需要考慮作弊問題。
    // For now, we'll just "trust" the client data for a simple leaderboard.
    // 實際的伺服器端分數計算和行數，應該基於一個更完善的遊戲狀態同步或重新計算邏輯。
    // 這裡只是回傳前端的值，假設它是正確的 (因為我們沒有複雜的後端遊戲狀態同步)
    const serverCalculatedScore = finalScore; // 在沒有複雜邏輯前，直接拿前端的
    const serverCalculatedLines = totalLinesCleared; // 同上

    // 你可以在這裡加入一些邏輯來大致判斷分數是否「過高」或「不可能」
    // 例如：每行至少100分，不可能一秒鐘清除100行等
    if (finalScore < 0 || totalLinesCleared < 0) {
        return { isValid: false, serverScore: 0, serverLines: 0, message: "分數或行數為負值" };
    }
    // 可以添加更進階的驗證，例如檢查板面上方塊的排列是否合理等

    return { isValid: true, serverScore: serverCalculatedScore, serverLines: serverCalculatedLines, message: "遊戲結果驗證成功" };
}

// 導出模組中會用到的所有函式和常數
module.exports = {
    TETROMINOES,
    ROTATION_OFFSETS,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    COLORS,
    getGameSettings,
    validateGameResult,
};