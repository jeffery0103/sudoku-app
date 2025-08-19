const express = require('express');
const router = express.Router();
// 注意：這裡不再需要引用 sudoku_generator_service

// 參數也變得更少了，不再需要 pendingGenerationJobs
module.exports = function(sudokuGame, activeSudokuGames, io) {

  /*
   * 由於單人遊戲的謎題生成流程已移交給 socket_handler.js 處理，
   * /api/sudoku/new 這個 POST 路由及其相關的 pendingGenerationJobs 邏輯
   * 已經被完全移除，使此 API 檔案更專注於處理遊戲「進行中」的請求。
  */

  // ======================================================
  // --- 其他 API 路由 (維持不變) ---
  // ======================================================

  // 取得指定遊戲的完整解答
  router.get('/sudoku/solution/:gameId', (req, res) => {
    // activeSudokuGames 的 gameId 在多人模式下是 roomId，在單人模式下是獨立生成的ID
    const game = activeSudokuGames[req.params.gameId];
    if (game && game.solution) {
      res.json({ solution: game.solution });
    } else {
      res.status(404).json({ error: '找不到該數獨遊戲' });
    }
  });

  // 請求一個智慧提示
  router.post('/sudoku/hint', (req, res) => {
    const { gameId, puzzle, preferredCell } = req.body;
    const game = activeSudokuGames[gameId];
    if (!game || !game.solution) return res.status(404).json({ error: '找不到該數獨遊戲' });
    const hint = sudokuGame.getSmartHint(puzzle, game.solution, preferredCell);
    res.json(hint || { error: '棋盤已滿' });
  });

  // 驗證當前盤面是否有任何不符合規則的數字
  router.post('/sudoku/validate', (req, res) => {
      const { puzzle } = req.body;
      if (!puzzle) return res.status(400).json({ error: '缺少謎題資料' });
      const errors = sudokuGame.findErrors(puzzle);
      res.json({ errors });
  });

  // 檢查玩家提交的盤面是否為最終正確答案
  router.post('/sudoku/check-win', (req, res) => {
      const { gameId, puzzle } = req.body;
      const game = activeSudokuGames[gameId];
      if (!game || !game.solution) return res.status(404).json({ error: '找不到遊戲或解答' });
      const isCorrect = JSON.stringify(puzzle) === JSON.stringify(game.solution);
      res.json({ isCorrect });
  });

  return router;
};