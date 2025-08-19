# start-server.ps1

# --- 您可以在此設定 ---
$coresToExclude = @(10, 11)
$mainScript = "./server/main_server.js"
# --------------------

try {
    # 取得 CPU 核心總數
    $totalCores = (Get-CimInstance -ClassName Win32_Processor).NumberOfLogicalProcessors
    Write-Host "[Launcher] System has $totalCores logical processors."

    # 計算 CPU 親和性遮罩
    $mask = 0
    for ($i = 0; $i -lt $totalCores; $i++) {
        if (-not ($coresToExclude -contains $i)) {
            $mask = $mask -bor (1 -shl $i)
        }
    }
    
    $hexMask = "0x{0:X}" -f $mask
    Write-Host "[Launcher] Calculated Affinity Mask: $hexMask. Excluding cores: $($coresToExclude -join ', ')."

    # 使用 PowerShell 的 Start-Process 來啟動 Node.js
    # -PassThru 會傳回一個處理程序物件，以便我們設定親和性
    # -NoNewWindow 確保它在同一個視窗中執行
    Write-Host "[Launcher] Starting Node.js server..."
    Write-Host "--------------------------------------------------------"
    
    $process = Start-Process node -ArgumentList $mainScript -PassThru -NoNewWindow
    
    # 在行程啟動後，立刻為其設定親和性
    $process.ProcessorAffinity = $mask

    # 等待該行程結束。這是確保 Ctrl+C 能正常運作的關鍵
    $process.WaitForExit()

} catch {
    Write-Error "An error occurred: $_"
    Read-Host "Press Enter to exit"
}