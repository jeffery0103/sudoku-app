const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const os = require('os');

const TARGET_PATHS = 10000;
const ROWS = 9;
const COLS = 9;
const TOTAL_CELLS = ROWS * COLS;
// 方向索引：0:右, 1:下, 2:左, 3:上
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

if (isMainThread) {
    const numCPUs = os.cpus().length;
    console.log(`啟動「不規則智慧導航」模式！(${numCPUs} 執行緒)`);
    const paths = [];
    let workers = [];
    let finished = false;

    for (let i = 0; i < numCPUs; i++) {
        const worker = new Worker(__filename);
        workers.push(worker);
        worker.on('message', (path) => {
            if (finished) return;
            paths.push(path);
            if (paths.length % 1 === 0) console.log(`進度：${paths.length} / ${TARGET_PATHS}`);
            if (paths.length >= TARGET_PATHS) {
                finished = true;
                fs.writeFileSync('paths.json', JSON.stringify(paths));
                console.log(`完成，儲存至 paths.json`);
                workers.forEach(w => w.terminate());
                process.exit(0);
            }
        });
    }
} else {
    // 🧩 拼圖理論：連通性檢查
    function isConnected(visited) {
        let startR = -1, startC = -1, unvisitedCount = 0;
        for (let i = 0; i < ROWS; i++) {
            for (let j = 0; j < COLS; j++) {
                if (!visited[i][j]) {
                    unvisitedCount++;
                    if (startR === -1) { startR = i; startC = j; }
                }
            }
        }
        if (unvisitedCount === 0) return true;
        let q = [[startR, startC]], bfsVisited = Array.from({length: ROWS}, () => Array(COLS).fill(false));
        bfsVisited[startR][startC] = true;
        let reachable = 1, head = 0;
        while(head < q.length) {
            let [cr, cc] = q[head++];
            for (let [dr, dc] of DIRS) {
                let nr = cr + dr, nc = cc + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && !bfsVisited[nr][nc]) {
                    bfsVisited[nr][nc] = true;
                    q.push([nr, nc]);
                    reachable++;
                }
            }
        }
        return reachable === unvisitedCount;
    }

    function getNeighbors(r, c, visited) {
        return DIRS.map(([dr, dc]) => [r + dr, c + dc])
                   .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]);
    }

    function generateSinglePath() {
        while (true) {
            let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
            let currentPath = [], successPath = null;
            
            // d0:當前方向, l0:當前長度, d1:上一段方向, l1:上一段長度, d2:上上段方向, l2:上上段長度
            function dfs(r, c, d0, l0, d1, l1, d2, l2) {
                if (successPath) return;
                currentPath.push([r, c]);
                visited[r][c] = true;

                if (currentPath.length === TOTAL_CELLS) {
                    if (r === ROWS - 1 && c === COLS - 1) successPath = [...currentPath];
                    visited[r][c] = false; currentPath.pop(); return;
                }
                if (r === ROWS - 1 && c === COLS - 1 || !isConnected(visited)) {
                    visited[r][c] = false; currentPath.pop(); return;
                }

                let validMoves = [];
                for (let i = 0; i < DIRS.length; i++) {
                    let [dr, dc] = DIRS[i], nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
                        
                        let nextD0, nextL0, nextD1, nextL1, nextD2, nextL2;
                        
                        if (d0 === -1) { // 第一步
                            nextD0 = i; nextL0 = 1; nextD1 = -1; nextL1 = 0; nextD2 = -1; nextL2 = 0;
                        } else if (i === d0) { // 直走
                            nextD0 = d0; nextL0 = l0 + 1; nextD1 = d1; nextL1 = l1; nextD2 = d2; nextL2 = l2;
                        } else { // 轉彎
                            nextD0 = i; nextL0 = 1; nextD1 = d0; nextL1 = l0; nextD2 = d1; nextL2 = l1;
                        }

                        // 🔴 檢查規則：
                        // 1. 直線不能超過 4
                        if (nextL0 > 4) continue;
                        
                        // 2. 你的核心規則：如果「轉彎前的這段(l1)」長度是 1
                        // 且「現在這段」是「上上段(d2)」的反方向，則長度不能跟「上上段(l2)」一樣
                        if (nextL1 === 1 && d2 !== -1) {
                            let isOpposite = (nextD0 === (d2 + 2) % 4);
                            if (isOpposite && nextL0 === l2) continue;
                        }

                        validMoves.push({ r: nr, c: nc, d0: nextD0, l0: nextL0, d1: nextD1, l1: nextL1, d2: nextD2, l2: nextL2 });
                    }
                }

                validMoves.sort(() => Math.random() - 0.5);
                validMoves.sort((a, b) => getNeighbors(a.r, a.c, visited).length - getNeighbors(b.r, b.c, visited).length);

                for (let m of validMoves) {
                    dfs(m.r, m.c, m.d0, m.l0, m.d1, m.l1, m.d2, m.l2);
                    if (successPath) return;
                }
                visited[r][c] = false; currentPath.pop();
            }

            dfs(0, 0, -1, 0, -1, 0, -1, 0);
            if (successPath) parentPort.postMessage(successPath);
        }
    }
    generateSinglePath();
}