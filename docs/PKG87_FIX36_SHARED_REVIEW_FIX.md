# PKG87_FIX36｜共用端送審 / 管理端審核修正說明

## 修正原因
原本共用端送出使用 `fetch(..., mode: "no-cors")`，瀏覽器無法讀取 Apps Script 真正回傳內容，因此前端可能顯示「已送出」，但實際上可能因 Token 錯誤、Apps Script 未重新部署、後端未支援送審流程而沒有寫入 `shared_submissions`。

## FIX35 修正內容
1. 共用端送審改用 JSONP GET 寫入 `shared_submissions`。
2. 共用端送出後會確認 Apps Script 回傳 `ok:true`，才顯示「送審成功」。
3. 若 Token 錯誤、Web App URL 錯誤、Apps Script 沒更新，前端會直接顯示失敗原因。
4. 管理端會顯示「共用端送審地標（待審 N）」提醒。
5. 管理端核准 / 退回也改為可確認回傳結果。

## 必做步驟
1. 打開 Google Apps Script。
2. 用本包的 `google_apps_script_backend.gs` 覆蓋原本後端程式。
3. 設定：
   - `ADMIN_TOKEN`：管理端使用。
   - `EDITOR_TOKEN`：共用端使用。
   - `SPREADSHEET_ID`：若 Apps Script 沒綁定試算表，請填 Google Sheet ID。
4. 點「部署」→「管理部署作業」→「編輯」→「新增版本」→「部署」。
5. GitHub Pages 上傳本包所有檔案。
6. 管理端網址建議：`index.html?v=87fix36`
7. 共用端網址建議：`index.html?mode=shared&token=你的EDITOR_TOKEN&webapp=你的AppsScriptWebAppURL`

> 如果不想把 Apps Script URL 放進共用端網址，也可以讓共用端第一次開啟後在「同步設定」貼上 Web App URL；但實務上直接放 `webapp=` 會最穩。
