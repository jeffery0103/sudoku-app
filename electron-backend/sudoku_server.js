function isValid(board, row, col, k) {
  for (let i = 0; i < 9; i++) {
    const m = 3 * Math.floor(row / 3) + Math.floor(i / 3);
    const n = 3 * Math.floor(col / 3) + (i % 3);
    if (board[row][i] == k || board[i][col] == k || board[m][n] == k) {
      return false;
    }
  }
  return true;
}

function solveSudoku(board) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j] == 0) {
        let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (let k of numbers) {
          if (isValid(board, i, j, k)) {
            board[i][j] = k;
            if (solveSudoku(board)) return true;
            else board[i][j] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board) {
  let count = 0;
  function solve() {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] == 0) {
          for (let k = 1; k <= 9; k++) {
            if (isValid(board, i, j, k)) {
              board[i][j] = k;
              if (count < 2) solve();
              board[i][j] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }
  solve();
  return count;
}

function generateSolvedBoard() {
  const board = Array(9).fill().map(() => Array(9).fill(0));
  solveSudoku(board);
  return board;
}

function getSmartHint(puzzle, solution, preferredCell) {
    if (preferredCell && (puzzle[preferredCell.row][preferredCell.col] === 0 || puzzle[preferredCell.row][preferredCell.col] === null)) {
        return {
            row: preferredCell.row,
            col: preferredCell.col,
            value: solution[preferredCell.row][preferredCell.col]
        };
    }
    const emptyCells = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (puzzle[r][c] === 0 || puzzle[r][c] === null) {
                emptyCells.push({ row: r, col: c });
            }
        }
    }
    if (emptyCells.length === 0) return null;
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    return {
        row: randomCell.row,
        col: randomCell.col,
        value: solution[randomCell.row][randomCell.col]
    };
}

function findErrors(puzzle) {
    const errorCells = new Set();
    const findDuplicatesInGroup = (group) => {
        const seen = new Map();
        group.forEach((cell) => {
            if (cell.value !== 0) {
                if (seen.has(cell.value)) {
                    errorCells.add(`${cell.r},${cell.c}`);
                    const firstOccurrence = seen.get(cell.value);
                    errorCells.add(`${firstOccurrence.r},${firstOccurrence.c}`);
                } else {
                    seen.set(cell.value, { r: cell.r, c: cell.c });
                }
            }
        });
    };
    for (let r = 0; r < 9; r++) {
        const rowGroup = [];
        for (let c = 0; c < 9; c++) { rowGroup.push({ value: puzzle[r][c], r, c }); }
        findDuplicatesInGroup(rowGroup);
    }
    for (let c = 0; c < 9; c++) {
        const colGroup = [];
        for (let r = 0; r < 9; r++) { colGroup.push({ value: puzzle[r][c], r, c }); }
        findDuplicatesInGroup(colGroup);
    }
    for (let boxRow = 0; boxRow < 9; boxRow += 3) {
        for (let boxCol = 0; boxCol < 9; boxCol += 3) {
            const boxGroup = [];
            for (let r = boxRow; r < boxRow + 3; r++) {
                for (let c = boxCol; c < boxCol + 3; c++) {
                    boxGroup.push({ value: puzzle[r][c], r, c });
                }
            }
            findDuplicatesInGroup(boxGroup);
        }
    }
    return Array.from(errorCells);
}


function digToTargetWithOptionalBlackout(solvedBoard, targetHoles) {

  if (!solvedBoard) {
      console.error("[監控失敗] solvedBoard 在這裡確定是 undefined！流程中斷。");
      // 手動拋出一個更明確的錯誤
      throw new Error("digToTargetWithOptionalBlackout收到了空的solvedBoard");
  }

  let puzzle = solvedBoard.map(row => [...row]);
  let removedCount = 0;
  
  let blackoutNumbers = [];
  let cellsToTry;

  // 觸發黑洞邏輯 (維持不變)
  if (Math.random() < 1.0) {
    const allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    const count = Math.random() < 0.7 ? 1 : 2; 
    blackoutNumbers = allNumbers.slice(0, count); // 把產生的數字賦值給初始化的變數

    const priorityCells = [], otherCells = [];
    for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9), c = i % 9;
        if (blackoutNumbers.includes(solvedBoard[r][c])) priorityCells.push(i);
        else otherCells.push(i);
    }
    priorityCells.sort(() => Math.random() - 0.5);
    otherCells.sort(() => Math.random() - 0.5);
    cellsToTry = [...priorityCells, ...otherCells];
  } else {
    cellsToTry = Array.from({length: 81}, (_, j) => j).sort(() => Math.random() - 0.5);
  }

  // 執行挖洞 (維持不變)
  for (const cellIndex of cellsToTry) {
    if (removedCount >= targetHoles) break;
    const row = Math.floor(cellIndex / 9), col = cellIndex % 9;
    if (puzzle[row][col] === 0) continue;
    const originalValue = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(puzzle.map(r => [...r])) !== 1) {
      puzzle[row][col] = originalValue;
    } else {
      removedCount++;
    }
  }
  const result = { puzzle, holes: removedCount, blackoutNumbers };
  
  return result;
}

// ▼▼▼ 新增回歸：您最高效的極限挖掘演算法 ▼▼▼
function digFromStateToLimit(startPuzzle, solvedBoard, blackoutNumbers) {
  
  let puzzle = startPuzzle.map(row => [...row]);
  const diggableCells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] !== 0) diggableCells.push({ r, c });
    }
  }
  diggableCells.sort(() => Math.random() - 0.5);

  for (const cell of diggableCells) {
    const originalValue = puzzle[cell.r][cell.c];
    puzzle[cell.r][cell.c] = 0;
    if (countSolutions(puzzle.map(r => [...r])) !== 1) {
      puzzle[cell.r][cell.c] = originalValue;
    }
  }
  
  const finalHoles = puzzle.flat().filter(n => n === 0).length;
  const result = { puzzle, solution: solvedBoard, holes: finalHoles, blackoutNumbers: blackoutNumbers };
  
  return result;
}




// ======================================================
// --- 模組匯出 ---
// ======================================================

module.exports = {
  generateSolvedBoard,
  digToTargetWithOptionalBlackout, 
  digFromStateToLimit,
  getSmartHint,
  isValid,
  findErrors,
  countSolutions, 
};