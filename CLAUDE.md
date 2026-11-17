# big-dial-phonebook — 大字電話簿

給長輩用：打開就看到家人的大照片＋大字號碼，點一下照片 → 「要打給 大兒子 嗎？」（朗讀）→ 綠色大鍵撥出（`tel:`）。上方常駐 110、119。家人在「整理電話簿」新增／修改／排序／照片，用 LINE 傳 `#c=` 連結給長輩一鍵加入；列印紙本電話簿（一頁 6 位）與皮夾小卡；備份還原 JSON（含照片）。

2026-11-17 建立。使用者從「更多方向」清單的長輩線挑「大字電話簿＋一鍵撥號」，規格由 Claude 決定。標準五件套，**無序號、不串 AI、資料只存手機**。**2026-11-17 已上線** <https://m255525.github.io/big-dial-phonebook/>（使用者自己 `gh repo create`；開 Pages 後立刻補 master 分支許可，這次第一次 deploy 就成功）。線上 `BDP_BASE=https://m255525.github.io/big-dial-phonebook/ python tools/e2e_phone.py` 53 項全過。已加進 AI 工具導航（幫長輩情境第二站）、程式牆與 github-dashboard `REPO_META`。上線改版要升 `service-worker.js` 的 `CACHE_NAME`（目前 v2）。

## 設計原則
- 視覺＝**一本實體電話簿**：深紅布紋硬殼封面＋燙金字、淡黃橫線內頁＋紅色邊線、彩色索引標籤（家人／朋友／看病／生活／緊急）、照片卡片上貼紙膠帶。字型 Noto Sans TC＋粉圓 Huninn。不要改成撕日曆、鐵窗、血壓計、站牌 LED、紅綠燈（其他長輩工具已用）。
- 長輩畫面只有：110／119、分類標籤、照片卡片。所有修改都在「整理電話簿」，**要在 ⚙ 裡按住 2 秒**（`bindHold`，pointer 與鍵盤都支援；短按會提示要按住；**用 `setPointerCapture`**，因為線上版跑馬燈晚幾秒才出現、會把對話框往下推，沒 capture 時按鈕滑出手指下方就被當成放開——本機測不到、線上 e2e 才抓到）；可再設 4 位數整理密碼（SHA-256 雜湊存 `cfg.pin`，備份檔不含）。
- 撥號前預設先確認＋朗讀（speechSynthesis zh-TW）；⚙ 可改「一按就撥」，但有兩支以上電話時仍會先問。確認畫面用 `history.pushState`，手機返回鍵會關掉確認畫面。
- 「常按的在前」只記按「撥出」的次數（`counts`），文案不能說成「通話次數」。
- 緊急分頁 7 支公共專線（110、119、165、1966、1925、113、1957），附用途與主管機關；110／119 永遠在封面不能關，其他可在 ⚙ 隱藏。**不能宣稱緊急救援或保證接通**。
- 範例 10 位全虛構，號碼用 0912-000-xxx 與 02-1234-xxxx；`cfg.example` 為真時顯示範例提示，匯入分享連結時自動取代範例。

## 引擎（engine.js）
- `normTel`：全形轉半形、去空白破折號括號、保留 `+`；分機（`#`、`轉`、`分機`、`ext`、**`,`**）→ `,123`（撥號時暫停後自動按分機）。**`,` 一定要在分機規則裡**，否則整理兩次會把分機黏進號碼（2026-11-17 測試抓到：分享連結還原後 `0212340102,215` 變成 `0212340102215`）。
- `fmtTel`：手機 09xx-xxx-xxx、02／04 八碼、三碼區碼 037／049／082／089、四碼 0826／0836、`+886` 顯示成 09；分機顯示「分機 N」。`checkTel`：mobile／land／short／intl／bad（bad 時表單提醒，再按一次儲存才放行）。
- `clean` 擋掉奇怪欄位（照片只收 `data:image/jpeg|png|webp`、不能自己存成 emg 分類、最多 4 支電話）。`mergeContacts`：任一支號碼相同（`+886` 與 09 視為同號）就更新並**保留原照片**。`encodeShare` 不含照片（10 位約 1.5KB）。
- 改 engine.js 跑 `node tools/test_engine.mjs`（79 項）。

## 畫面（app.js）
- localStorage `bdp.`：contacts（照片 320×320 JPEG dataURL）、cfg、counts、tab、fold、warnSeen、marquee。存不進去時提醒刪照片。測試掛鉤 `window._bdp`。
- 從 `#c=` 連結進來時先問要不要加入，不跳首訪警語。
- 列印：`preparePrint('book'|'wallet')` 填 `#printArea`；書本一頁 2×3（列高 76mm，84mm 會擠出第三頁）、號碼 `nowrap`、分機換行；皮夾小卡 85.6×54mm 兩款各 2 張。
- `✏` 在 Noto Sans TC 會變成黑條，介面一律用 📝。

## 驗證
- `python tools/e2e_phone.py [輸出資料夾]`（先開 8891；線上版設 `BDP_BASE`）：53 項，含警語、五件套、範例、分類、撥號確認與 tel 連結（用 capture 監聽攔下 tel／sms，不真的開電話程式）、計數與排序、一按就撥、字級高對比、按住 2 秒／短按／0.9 秒、新增（全形號碼、照片裁切）、錯號碼提醒、修改排序刪除、整理密碼、列印頁數、備份不含密碼、LINE 分享→新瀏覽器匯入取代範例且分機保留、重複匯入不重複、還原合併補照片、375／390px 無橫捲、無 console 錯誤。2026-11-17 全過；手機首頁、撥號畫面、整理畫面、列印 PDF 都轉圖目視過。
- **真手機撥號、iPhone 朗讀、LINE 內建瀏覽器開連結都還沒實測。**

## 標準配備
跑馬燈（工作區公告 GAS，滑鼠移入暫停，不可關）、⚙ 設定（收合：整理電話簿、字的大小、撥號方式、排列順序、緊急與公共專線、關於本工具）、首訪警語＋封面入口、`manual.html#creator`（改 `tools/manual_body.html` 後跑 `python tools/build_manual.py`）、PWA（`tools/make_icons.py`；上線改版升 `service-worker.js` 的 `CACHE_NAME`）、訪客計數器 `m255525.bigdialphonebook`。本機 port **8891**。
