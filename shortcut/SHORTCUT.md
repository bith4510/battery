# 捷徑「電池Plus 分析」建置步驟

用途：在「設定 → 隱私權與安全性 → 分析與改進功能 → 分析資料」打開 Analytics- 檔 → 分享 → 選這個捷徑，
網頁就會讀入分析並記錄，同時在 iCloud 雲碟留一份原始檔當長期備份。

動作名稱以 Apple 台灣官方《捷徑使用手冊》的用字為準（來源列在最後）。

## 一、簡易版（建議）：4 個動作

先在「檔案」App 的 iCloud 雲碟 → Shortcuts 資料夾裡建立一個資料夾「電池Plus」。

1. 開「捷徑」App → 右上「＋」→ 名稱改成「電池Plus 分析」。
2. 點下方 ⓘ 打開「詳細資訊」→ 開啟「在分享表單中顯示」→「完成」。
3. 編輯器最上方出現接收輸入的那一行，點「任何」→「清除」→ 只勾「檔案」與「文字」→「完成」。
4. 依序加入下面 4 個動作（在下方搜尋框輸入名稱即可找到）：

| # | 動作名稱 | 設定 |
|---|---|---|
| 1 | 儲存檔案 | 對象選「捷徑輸入」；關閉「詢問儲存位置」；路徑填 `/電池Plus/`（位置是 Shortcuts 資料夾） |
| 2 | 文字 | 內容裡插入變數「捷徑輸入」（點文字框 → 鍵盤上方的變數列選「捷徑輸入」） |
| 3 | 拷貝到剪貼板 | 對象＝第 2 步「文字」 |
| 4 | 打開 URL | 網址填 `https://bith4510.github.io/battery/#paste` |

使用時：分享 → 「電池Plus 分析」→ Safari 打開網頁 → 點「從剪貼簿讀取」→ Safari 跳出「貼上」再點一次。

- 第 1 步存的是原始檔（保留 Analytics-日期 的檔名，不會互相覆蓋）。不想存可以刪掉這一步。
- 第 2 步的作用是把檔案轉成文字，網頁的剪貼簿只能讀文字。

## 二、進階版：不用點貼上（網址直接帶資料）

把簡易版第 3、4 步換成以下動作。這幾個動作的中文名稱在 Apple 台灣手冊裡查不到，
括號內是英文版官方名稱，找不到時改用英文名稱或功能關鍵字（「比對」、「取代」、「Base64」、「URL」）搜尋。

| # | 動作 | 設定 |
|---|---|---|
| 3 | 比對文字（Match Text） | 對象＝第 2 步「文字」；規則貼上【規則 A】 |
| 4 | 結合文字（Combine Text） | 對象＝第 3 步的符合項目；分隔用「新行」 |
| 5 | 取代文字（Replace Text） | 尋找貼上【規則 B】，取代為空白；開啟「正規表示式」 |
| 6 | Base64 編碼（Base64 Encode） | 模式＝編碼；換行＝無 |
| 7 | URL 編碼（URL Encode） | 對象＝第 6 步結果 |
| 8 | 文字 | `https://bith4510.github.io/battery/#d=` 後面插入第 7 步變數 |
| 9 | 打開 URL | 對象＝第 8 步文字 |

【規則 A】只留下檔頭與電池相關紀錄：

```
(?m)^.*(?:"bug_type"|"name"\s*:\s*"(?:Battery[A-Za-z0-9_]*|JITCharging[A-Za-z0-9_]*|SlowChargingReason|RawDeviceStateHistogram|DailyWirelessUsageAgg)").*$
```

【規則 B】移除可能的識別碼欄位：

```
,\s*"(?:deviceId|incident_id|crashReporterKey|uuid|serialNumber|SerialNumber)"\s*:\s*"[^"]*"|"(?:deviceId|incident_id|crashReporterKey|uuid|serialNumber|SerialNumber)"\s*:\s*"[^"]*"\s*,?
```

## 三、累積紀錄

- 捷徑會用 **Safari** 打開網頁，不是主畫面上的 App 圖示，兩邊的紀錄分開存。
- iCloud「電池Plus」資料夾就是主檔：在任一邊網頁按「匯入（可多選）」→ 全選資料夾裡的檔案，就能重建完整歷史，同一份不會重複。
- iOS 的分析資料檔只保留幾週，所以要長期比較，就靠第 1 步存下的檔案，加上不定期在網頁「匯出 JSON」。

## 四、限制

- 進階版的精簡資料不含 metadata 行，網頁上的地區型號代碼（如 ZP/A）會顯示空白，其他數值不受影響。
- iOS Safari 沒有公開網址長度上限，進階版如果打不開，改用簡易版。

## 來源

- Apple《捷徑使用手冊》：從其他 App 執行捷徑（在分享表單中顯示）https://support.apple.com/zh-tw/guide/shortcuts/apd163eb9f95/ios
- 分享動作（儲存檔案、打開 URL）https://support.apple.com/zh-tw/guide/shortcuts/apdaf74d75a5/ios
- 轉換動作（結合文字）https://support.apple.com/zh-tw/guide/shortcuts/apd1d9413cfb/ios
- 複雜捷徑中的動作（拷貝到剪貼板）https://support.apple.com/zh-tw/guide/shortcuts/apd081d9d61f/ios
- 取得動作（文字）https://support.apple.com/zh-tw/guide/shortcuts/apd5c2bd430f/ios
- 限制捷徑的輸入（任何、清除、完成）https://support.apple.com/zh-tw/guide/shortcuts/apd8195f96d6/ios
