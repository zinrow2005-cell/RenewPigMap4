# Version Notes

## PKG87_FIX36

- 上方地址搜尋引擎改為快速地址 / 路名 / 門牌搜尋。
- 新增台灣地址解析、門牌優先排序、線上查詢快取與少量並行查詢。
- 統一 PWA 快取版本為 `87fix36`。

# VERSION NOTES

## PKG87_FIX36

- GitHub Pages 乾淨上傳版。
- 統一 PWA 快取版本為 `87fix36`。
- 主系統保留單檔 `index.html` 內嵌 CSS / JS。
- 移除未使用的 `assets/css` 與 `assets/js`，降低漏傳或路徑錯誤機率。
- `service-worker.js` 僅快取實際存在的檔案。
- 牧場資料 JSON 已確認與 index 內建備援資料一致。

## 重要相容性

部分程式內部 guard 變數仍沿用舊版命名，例如 `__PKG87_FIX29...`。這些只是避免重複初始化的內部名稱，未影響本版上線。
