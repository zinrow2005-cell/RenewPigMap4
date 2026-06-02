# 檔案結構

```text
/
├─ index.html                         主系統，已內嵌 CSS / JS
├─ manifest.webmanifest               PWA 安裝資訊
├─ service-worker.js                  PWA 離線快取
├─ offline.html                       離線備援頁
├─ .nojekyll                          GitHub Pages 防止 Jekyll 處理
├─ google_apps_script_backend.gs      Google Apps Script 後端備份
├─ data/
│  └─ pig_farm_map_data.json          牧場地標資料
├─ assets/
│  └─ icons/                          PWA 圖示
└─ docs/                              部署與檢查文件
```

本包不再保留舊的 `assets/css` 與 `assets/js`，因為目前 `index.html` 已是單檔內嵌版。
