# LaLaLand - 夜間配對聊天

一個有趣的配對聊天網站，只在每晚 21:00-23:59 開放！

## 功能特色

- ⏰ **限時開放**：每晚 21:00-23:59 才能使用，其他時間顯示倒數計時
- 🎲 **隨機配對**：上線後自動配對一位陌生人聊天
- 💬 **即時聊天**：使用 WebSocket 實現即時訊息傳送
-  **無需資料庫**：使用記憶體儲存，輕量簡潔

## 技術棧

- **後端**：Node.js + Express + Socket.io
- **前端**：原生 HTML/CSS/JavaScript
- **部署**：Render

## 本地開發

1. 安裝依賴：
```bash
npm install
```

2. 啟動伺服器：
```bash
npm start
```

3. 開啟瀏覽器訪問：
```
http://localhost:3000
```

## 測試開放時間

如果你想在非開放時間測試，可以修改 `server.js` 中的 `isOpenTime()` 函數：

```javascript
function isOpenTime() {
  return true; // 永遠開放，用於測試
}
```

## 部署到 Render

1. 將專案推送到 GitHub
2. 在 Render 創建新的 Web Service
3. 連接你的 GitHub 倉庫
4. Render 會自動檢測到 `package.json` 並部署
5. 使用以下設置：
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

## 注意事項

- 因為使用記憶體儲存，伺服器重啟後所有資料會消失
- 適合小規模使用，大流量需要考慮使用資料庫
- Render 免費版會在閒置時休眠，首次訪問可能較慢

## 使用說明

1. 在開放時間（21:00-23:59）訪問網站
2. 輸入暱稱並點擊「開始配對」
3. 系統會自動為你配對一位聊天對象
4. 開始聊天！享受隨機配對的樂趣

## License

MIT
