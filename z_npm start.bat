@echo off
chcp 65001 >nul
title 數獨遊戲伺服器 (本機測試)
color 0E
echo =========================================
echo   🚀 專屬數獨伺服器啟動中！
echo   🧹 正在為你清理被佔用的 Port...
echo =========================================

:: 尋找並自動強制關閉佔用 3000 port 的隱藏行程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo 幫你自動打開網頁中...
start http://localhost:3000
echo.
node server/main_server.js
pause