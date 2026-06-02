# Google Apps Script 設定提醒

1. 到 Google Drive 建立或開啟試算表。
2. 擴充功能 → Apps Script。
3. 將本包根目錄的 `google_apps_script_backend.gs` 內容貼上。
4. 依需求填入：
   - `SPREADSHEET_ID`
   - `ADMIN_TOKEN`
   - `EDITOR_TOKEN`
   - 或舊版相容 `SYNC_TOKEN`
5. 部署 → 新增部署作業 → 網頁應用程式。
6. 執行身分選「我」，存取權依你的使用需求設定。
7. 複製 `/exec` 結尾的 Web App URL，貼到地圖系統的同步設定。

共用端建議使用：

```text
index.html?mode=shared&token=你的EDITOR_TOKEN
```

管理端若要讀取共用端送審資料，需使用 `ADMIN_TOKEN`。
