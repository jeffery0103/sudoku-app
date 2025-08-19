document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const nextCanvas = document.getElementById('next-canvas');
    const nextCtx = nextCanvas.getContext('2d');
    const scoreDisplay = document.getElementById('score');
    const levelDisplay = document.getElementById('level');
    const linesDisplay = document.getElementById('lines');
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');
    const gameOverModal = document.getElementById('game-over-modal');
    const finalScoreDisplay = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const backToLobbyButton = document.getElementById('back-to-lobby-button');

    const BOARD_WIDTH = 10; // 與後端定義一致
    const BOARD_HEIGHT = 20; // 與後端定義一致
    const BLOCK_SIZE = 30; // 每個小方塊的大小

    canvas.width = BOARD_WIDTH * BLOCK_SIZE;
    canvas.height = BOARD_HEIGHT * BLOCK_SIZE;
    nextCanvas.width = 4 * BLOCK_SIZE; // 用於顯示下一個方塊
    nextCanvas.height = 4 * BLOCK_SIZE;

    // Tetrominoes (方塊形狀) - 與後端定義保持一致，用於前端繪製
    const TETROMINOES = {
        'I': [[0,0],[0,1],[0,2],[0,3]],
        'J': [[0,0],[1,0],[1,1],[1,2]],
        'L': [[0,2],[1,0],[1,1],[1,2]],
        'O': [[0,0],[0,1],[1,0],[1,1]],
        'S': [[0,1],[0,2],[1,0],[1,1]],
        'T': [[0,1],[1,0],[1,1],[1,2]],
        'Z': [[0,0],[0,1],[1,1],[1,2]]
    };

    // 方塊顏色
    const COLORS = {
        'I': 'cyan',
        'J': 'blue',
        'L': 'orange',
        'O': 'yellow',
        'S': 'green',
        'T': 'purple',
        'Z': 'red',
        'empty': '#333' // 遊戲板面空閒格子的顏色
    };

    let board = [];
    let currentTetromino = null;
    let nextTetromino = null;
    let currentX = 0;
    let currentY = 0;
    let score = 0;
    let level = 1;
    let lines = 0;
    let gameInterval = null;
    let isPaused = false;
    let isGameOver = false;
    let dropSpeed = 1000; // 初始下落速度，毫秒

    // 初始化遊戲板面
    function initializeBoard() {
        board = Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill('empty'));
    }

    // 隨機生成一個方塊
    function generateTetromino() {
        const tetrominoTypes = Object.keys(TETROMINOES);
        const randomType = tetrominoTypes[Math.floor(Math.random() * tetrominoTypes.length)];
        return {
            shape: TETROMINOES[randomType],
            color: COLORS[randomType],
            type: randomType,
            rotation: 0 // 初始旋轉角度
        };
    }

    // 繪製單個小方塊
    function drawBlock(x, y, color, context) {
        context.fillStyle = color;
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        context.strokeStyle = 'black';
        context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    // 繪製遊戲板面
    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let r = 0; r < BOARD_HEIGHT; r++) {
            for (let c = 0; c < BOARD_WIDTH; c++) {
                drawBlock(c, r, COLORS[board[r][c]], ctx);
            }
        }
    }

    // 繪製當前方塊
    function drawCurrentTetromino() {
        if (!currentTetromino) return;
        currentTetromino.shape.forEach(block => {
            drawBlock(currentX + block[1], currentY + block[0], currentTetromino.color, ctx);
        });
    }

    // 繪製下一個方塊的預覽
    function drawNextTetromino() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextTetromino) return;
        // 為了讓預覽居中，需要調整繪製的起始座標
        let minX = 4, minY = 4, maxX = 0, maxY = 0;
        nextTetromino.shape.forEach(block => {
            minX = Math.min(minX, block[1]);
            minY = Math.min(minY, block[0]);
            maxX = Math.max(maxX, block[1]);
            maxY = Math.max(maxY, block[0]);
        });
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const startX = (nextCanvas.width / BLOCK_SIZE - width) / 2 - minX;
        const startY = (nextCanvas.height / BLOCK_SIZE - height) / 2 - minY;

        nextTetromino.shape.forEach(block => {
            drawBlock(startX + block[1], startY + block[0], nextTetromino.color, nextCtx);
        });
    }

    // 檢查碰撞 (與板面邊界或已固定的方塊)
    function checkCollision(x, y, shape) {
        for (let i = 0; i < shape.length; i++) {
            const blockX = x + shape[i][1];
            const blockY = y + shape[i][0];

            if (blockX < 0 || blockX >= BOARD_WIDTH || blockY >= BOARD_HEIGHT) {
                return true; // 碰到左右邊界或底部
            }
            if (blockY < 0) continue; // 忽略在板面上方的方塊部分

            if (board[blockY] && board[blockY][blockX] !== 'empty') {
                return true; // 碰到已固定的方塊
            }
        }
        return false;
    }

    // 旋轉方塊
    function rotateTetromino() {
        if (!currentTetromino || currentTetromino.type === 'O') return; // O 型不需要旋轉

        const originalShape = currentTetromino.shape;
        const newShape = originalShape.map(block => {
            // 繞 (0,0) 順時針旋轉 90 度：(x, y) -> (y, -x)
            // 調整到相對座標 (y, -x)
            return [block[1], -block[0]];
        });

        // 簡單的 Wall Kick 實現 (Kicking against walls)
        // 嘗試偏移，直到找到有效位置
        const testOffsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]; // 嘗試的偏移量
        for (const offset of testOffsets) {
            const offsetX = offset[0];
            const offsetY = offset[1];
            if (!checkCollision(currentX + offsetX, currentY + offsetY, newShape)) {
                currentTetromino.shape = newShape;
                currentX += offsetX;
                currentY += offsetY;
                return;
            }
        }
    }

    // 將方塊固定在板面上
    function lockTetromino() {
        currentTetromino.shape.forEach(block => {
            const boardX = currentX + block[1];
            const boardY = currentY + block[0];
            if (boardY >= 0) { // 確保只鎖定在遊戲板面內的方塊
                board[boardY][boardX] = currentTetromino.color;
            }
        });
        clearLines();
        spawnNewTetromino();
    }

    // 清除已滿的行
    function clearLines() {
        let linesClearedThisTurn = 0;
        for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
            if (board[r].every(cell => cell !== 'empty')) {
                // 該行已滿，清除並下移上方所有行
                board.splice(r, 1); // 移除該行
                board.unshift(Array(BOARD_WIDTH).fill('empty')); // 在頂部添加一行空白行
                linesClearedThisTurn++;
                r++; // 重新檢查當前行 (因為新的行已經下移到這裡)
            }
        }
        if (linesClearedThisTurn > 0) {
            lines += linesClearedThisTurn;
            score += linesClearedThisTurn * 100 * level; // 根據清除行數和等級加分
            updateDisplay();
            // 提升等級
            if (lines >= level * 10) { // 每10行升一級
                level++;
                dropSpeed = Math.max(50, dropSpeed - 50); // 加快下落速度，最快50ms
                resetGameInterval();
            }
        }
    }

    // 生成新的方塊
    function spawnNewTetromino() {
        currentTetromino = nextTetromino;
        nextTetromino = generateTetromino();
        currentX = Math.floor(BOARD_WIDTH / 2) - 2; // 初始 X 座標
        currentY = 0; // 初始 Y 座標

        if (checkCollision(currentX, currentY, currentTetromino.shape)) {
            // 新方塊生成時就發生碰撞，遊戲結束
            gameOver();
            return;
        }
        drawNextTetromino();
    }

    // 遊戲主循環
    function gameLoop() {
        if (isPaused || isGameOver) return;

        if (checkCollision(currentX, currentY + 1, currentTetromino.shape)) {
            // 到底部或碰到其他方塊，固定方塊
            lockTetromino();
        } else {
            currentY++; // 方塊下落
        }
        drawBoard();
        drawCurrentTetromino();
    }

    // 更新顯示數據
    function updateDisplay() {
        scoreDisplay.textContent = score;
        levelDisplay.textContent = level;
        linesDisplay.textContent = lines;
    }

    // 重設遊戲計時器
    function resetGameInterval() {
        clearInterval(gameInterval);
        if (!isGameOver) {
            gameInterval = setInterval(gameLoop, dropSpeed);
        }
    }

    // 開始遊戲
    function startGame() {
        if (isGameOver) {
            gameOverModal.classList.add('hidden');
            isGameOver = false;
        }
        initializeBoard();
        score = 0;
        level = 1;
        lines = 0;
        isPaused = false;
        dropSpeed = 1000;
        updateDisplay();
        nextTetromino = generateTetromino(); // 預先生成下一個方塊
        spawnNewTetromino(); // 生成第一個方塊
        resetGameInterval();
        startButton.textContent = "重新開始";
        pauseButton.classList.remove('hidden');
    }

    // 暫停/恢復遊戲
    function togglePause() {
        if (isGameOver) return;
        isPaused = !isPaused;
        if (isPaused) {
            clearInterval(gameInterval);
            pauseButton.textContent = "繼續";
        } else {
            resetGameInterval();
            pauseButton.textContent = "暫停";
        }
    }

    // 遊戲結束
    async function gameOver() {
        isGameOver = true;
        clearInterval(gameInterval);
        finalScoreDisplay.textContent = score;
        gameOverModal.classList.remove('hidden');
        pauseButton.classList.add('hidden');
        startButton.textContent = "重新開始"; // 遊戲結束後按鈕變為重新開始
        
        // 提交分數到後端 API
        try {
            const response = await fetch('/api/tetris/submit-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // 這裡可以加上玩家 ID 和名稱，如果你的系統有這些資訊的話
                    // playerId: 'user123', 
                    // playerName: 'Guest',
                    score: score,
                    linesCleared: lines,
                    finalBoard: board.map(row => row.map(cell => cell === 'empty' ? 0 : 1)) // 簡化板面數據
                })
            });
            const data = await response.json();
            if (data.success) {
                console.log("分數提交成功:", data.message);
                // 可以彈出一個提示或更新排行榜
            } else {
                console.error("分數提交失敗:", data.message);
            }
        } catch (error) {
            console.error("提交分數時發生錯誤:", error);
        }
    }

    // 鍵盤事件處理
    document.addEventListener('keydown', e => {
        if (isPaused || isGameOver) return;

        switch (e.key) {
            case 'ArrowLeft':
                if (!checkCollision(currentX - 1, currentY, currentTetromino.shape)) currentX--;
                break;
            case 'ArrowRight':
                if (!checkCollision(currentX + 1, currentY, currentTetromino.shape)) currentX++;
                break;
            case 'ArrowDown':
                if (!checkCollision(currentX, currentY + 1, currentTetromino.shape)) currentY++;
                else lockTetromino(); // 如果不能下落，直接固定
                break;
            case 'ArrowUp':
                rotateTetromino();
                break;
            case ' ': // 空白鍵快速下落
                e.preventDefault(); // 防止頁面滾動
                while (!checkCollision(currentX, currentY + 1, currentTetromino.shape)) {
                    currentY++;
                }
                lockTetromino();
                break;
        }
        drawBoard();
        drawCurrentTetromino();
    });

    // 事件監聽器
    startButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);
    restartButton.addEventListener('click', startGame);
    backToLobbyButton.addEventListener('click', () => {
      // 假設你有一個返回大廳的函式
      window.location.href = '/'; // 跳轉回主頁
    });

    // 初始繪製
    initializeBoard();
    drawBoard();
});