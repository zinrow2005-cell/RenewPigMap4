# GitHub Pages 上傳步驟

1. 解壓縮本 ZIP。
2. 將本包根目錄內所有檔案上傳到 GitHub Repository，不要只上傳 ZIP。
3. Repository 設定：Settings → Pages → Deploy from a branch。
4. Branch 選 `main`，資料夾選 `/root`。
5. 開啟 GitHub Pages 網址後，建議加上：`?v=87fix36`。
6. 若手機 PWA 仍顯示舊版，刪除舊 App 後重新加入主畫面。

注意：`google_apps_script_backend.gs` 是給 Apps Script 使用的後端程式，不會被 GitHub Pages 執行，但建議保留在專案中方便備份。
