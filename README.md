# PKG87_FIX36｜台灣豬隻畜牧場地圖｜GitHub Pages 乾淨上傳版

本包已整理為適合直接放上 GitHub Pages 的乾淨版本。主系統採用「單檔 `index.html` 內嵌 CSS / JS」方式，避免只上傳 index 或 assets 路徑漏掉時，頁面變成純文字或按鈕失效。

## 上傳到 GitHub 時要保留的檔案

```text
index.html
manifest.webmanifest
service-worker.js
offline.html
.nojekyll
google_apps_script_backend.gs
data/pig_farm_map_data.json
assets/icons/icon-192.png
assets/icons/icon-512.png
assets/icons/maskable-512.png
assets/icons/apple-touch-icon.png
docs/
```

## 建議開啟網址

```text
index.html?v=87fix36
```

手機或電腦若曾安裝舊版 PWA，第一次更新後建議重新整理一次；若還看到舊畫面，請清除該網站快取或刪除舊 App 後重新加入主畫面。

## 本次整理重點

- 移除未使用的重複 `assets/css`、`assets/js`，減少上傳混亂。
- 統一 PWA 快取版本為 `87fix36`。
- `service-worker.js` 只快取本包實際存在的檔案，避免安裝快取失敗。
- 保留 `data/pig_farm_map_data.json`，並確認與 `index.html` 內建備援資料一致。
- 保留 `google_apps_script_backend.gs`，共用端送審與管理端審核仍需重新部署 Apps Script。

## Google Apps Script 提醒

若你要使用「雲端上傳 / 雲端下載 / 共用端送審」，請把根目錄的 `google_apps_script_backend.gs` 貼到 Apps Script，填入 Token 與試算表設定後重新部署 Web App。

共用端連結格式：

```text
index.html?mode=shared&token=你的EDITOR_TOKEN
```

管理者端使用一般網址即可；同步設定內請填入 Apps Script Web App URL 與管理者 Token。


## PKG87_FIX36 重要修正：共用端送審 / 管理端審核

本版修正共用端送出後管理端看不到待審核資料的問題。共用端送審已改為可確認回傳結果的 JSONP 流程，不再只顯示「已送出請求」。

上線時請務必同步更新 Google Apps Script：

1. 用本包 `google_apps_script_backend.gs` 覆蓋 Apps Script 後端。
2. 設定 `ADMIN_TOKEN` 與 `EDITOR_TOKEN`。
3. 重新部署 Web App 新版本。
4. 共用端網址建議使用：`index.html?mode=shared&token=你的EDITOR_TOKEN&webapp=你的AppsScriptWebAppURL`

管理端開啟後會顯示「共用端送審地標（待審 N）」提醒。
