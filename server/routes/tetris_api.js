const express = require('express');
const router = express.Router();

module.exports = function(tetrisGame, activeTetrisGames) {
  
    // 處理遊戲結束時提交分數的 API
    router.post('/tetris/submit-score', (req, res) => {
        const { playerId, playerName, score, linesCleared, finalBoard, gameId } = req.body; 
        
        // 伺服器端驗證依然可以保留，用於檢查數據的合法性，而不是為了排行榜
        const validationResult = tetrisGame.validateGameResult(finalBoard, score, linesCleared);

        if (!validationResult.isValid) {
            console.warn(`[Tetris API] 驗證失敗: ${validationResult.message} - 玩家 ${playerName} (ID: ${playerId})`);
            return res.status(400).json({ success: false, message: `遊戲結果驗證失敗: ${validationResult.message}` });
        }

        // ✨ 暫時不儲存分數，僅記錄日誌
        console.log(`[Tetris API] (未儲存) 玩家 ${playerName || '匿名'} 提交了分數: ${score} 分, 清除了 ${linesCleared} 行`);
        
        res.json({ success: true, message: "遊戲結果已接收！" });
    });

    // ✨ 暫時移除或註解掉排行榜 API
    // router.get('/tetris/leaderboard', (req, res) => {
    //     res.json([]); 
    // });

    return router;
};