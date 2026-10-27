# 捷徑「電池Plus 分析」建置步驟

用途：在「設定 → 隱私權與安全性 → 分析與改進功能 → 分析資料」打開 Analytics- 檔 → 分享 → 選這個捷徑，
資料就會送進網頁分析並記錄，同時在 iCloud 雲碟留一份精簡檔當長期備份。

> 動作名稱依英文版官方名稱對照中文翻譯；中文介面若用字略有不同，用動作搜尋框找英文括號內的名稱。

## 一、建立捷徑

開「捷徑」App → 右上「＋」→ 名稱改成「電池Plus 分析」。

| # | 動作（英文名稱） | 設定 |
|---|---|---|
| 0 | 捷徑設定（右下 ⓘ） | 開啟「在分享表單中顯示」；接收類型只勾「檔案」與「文字」 |
| 1 | 從輸入取得文字（Get Text from Input） | 輸入＝捷徑輸入 |
| 2 | 比對文字（Match Text） | 規則貼上下方【規則 A】；不區分大小寫關閉 |
| 3 | 合併文字（Combine Text） | 對象＝「符合項目」，分隔用「換行」 |
| 4 | 取代文字（Replace Text） | 尋找貼上【規則 B】，取代為空白（什麼都不填）；展開後開啟「正規表示式」 |
| 5 | 設定名稱（Set Name） | 對象＝「更新後的文字」，名稱＝`電池_` ＋ 變數「目前日期」（格式選 ISO 8601 或自訂 yyyyMMdd_HHmm）＋ `.txt` |
| 6 | 儲存檔案（Save File） | 位置＝iCloud 雲碟 / Shortcuts / 電池Plus（先在「檔案」App 建好資料夾）；關閉「詢問儲存位置」；開啟「覆寫」以外的預設即可 |
| 7 | Base64 編碼（Base64 Encode） | 對象＝第 4 步「更新後的文字」；模式＝編碼；換行＝無 |
| 8 | URL 編碼（URL Encode） | 對象＝第 7 步結果 |
| 9 | 文字（Text） | `https://bith4510.github.io/battery/#d=` 後面接第 8 步變數 |
| 10 | 打開 URL（Open URLs） | 對象＝第 9 步文字 |

【規則 A】只留下檔頭與電池相關紀錄（一行一筆）：

```
(?m)^.*(?:"bug_type"|"name"\s*:\s*"(?:Battery[A-Za-z0-9_]*|JITCharging[A-Za-z0-9_]*|SlowChargingReason|RawDeviceStateHistogram|DailyWirelessUsageAgg)").*$
```

【規則 B】移除可能的識別碼欄位：

```
"(?:deviceId|incident_id|crashReporterKey|uuid|serialNumber|SerialNumber)"\s*:\s*"[^"]*"\s*,?
```

## 二、備用版：網址太長打不開時

把第 7～10 步換成：

| # | 動作 | 設定 |
|---|---|---|
| 7' | 拷貝到剪貼簿（Copy to Clipboard） | 對象＝第 4 步「更新後的文字」 |
| 8' | 打開 URL | `https://bith4510.github.io/battery/#paste` |

網頁會出現「從剪貼簿貼上」按鈕，點一下即可（Safari 會詢問是否允許貼上）。

## 三、使用與累積紀錄

- 每天（或想記錄時）打開最新的 Analytics- 檔 → 分享 → 「電池Plus 分析」。
- 捷徑會用 **Safari** 開網頁（不是主畫面的 App 圖示），兩者的紀錄分開存。
  建議以 iCloud「電池Plus」資料夾的精簡檔為主檔：任何時候在網頁的「匯入（可多選）」一次全選這些 .txt，
  就能在任一邊重建完整歷史，同一份檔案不會重複。
- 分析資料檔 iOS 只保留約數週，要長期比較就靠第 6 步存下的精簡檔與網頁的「匯出 JSON」。

## 四、限制

- 精簡檔不含 metadata 行，所以網頁上的地區型號代碼（如 ZP/A）會顯示空白，其他數值不受影響（已用測試比對）。
- 網址能帶多長的資料，iOS Safari 沒有公開上限；真機檔若打不開，改用第二節的剪貼簿版。
