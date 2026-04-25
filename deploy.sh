#!/bin/bash

# 俊佑的 30 秒自動部署守護靈 (含自動重啟礦工)
while true
do
    cd /home/ubuntu/sudoku-app
    
    git fetch origin main
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse @{u})

    if [ $LOCAL != $REMOTE ]; then
        echo "[$(date)] 發現新版本！啟動自動部署..." >> deploy.log
        
        git pull origin main
        npm install
        
        # 重啟遊戲本體
        pm2 restart sudoku
        
        # ⛏️ 重啟數獨礦工 (你剛才想加的就是這行！)
        pm2 restart sudoku-miner
        
        echo "[$(date)] 部署完成！" >> deploy.log
    fi

    sleep 30
done