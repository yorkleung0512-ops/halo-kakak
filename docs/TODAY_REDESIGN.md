# Today 頁面改版（Halo Kakak）

**狀態：** 已實作，等待批核  
**基線 commit（改版前）：** `b1e2fa8`（custom task atomic RPC）  
**範圍：** 只改 Today 資訊架構與卡片／時間線；**不**改 `create_tasks_from_presets`、通知 RPC、RLS；**不**開 Upcoming／Schedule Management／Web Push／Email。

---

## 1. 現況評估（改版前）

| 項目 | 狀況 |
|------|------|
| 查詢 | 單次 `task_occurrences`，`task_date = todayHK()`，`select *` |
| Realtime | **無**任務訂閱（只有通知 context） |
| 排序 | status 優先再 `due_at` |
| 重複 | `nextTask` + `overdue` + 完整 `sorted` **同一張卡可出現多次** |
| 臨時／排程 | `template_id` null = 臨時；有值 = 排程 |
| 新任務 | 僅靠 `pending`，未同通知 unread 分開標示 |
| Quick Add | 在頁頂；已有 max 6 |
| 離線佇列 | 全域 key，未按 user+household 範圍顯示 |

---

## 2. 資訊層級（文字 wireframe）

### 僱主

```
[離線橫幅若有]
[摘要帶] 今日 N項 · 待完成 · 已完成
         需要處理 · 逾期 · 等待確認
[需要處理] 卡片列表（或一行空狀態）
[逾期] 卡片列表
[Quick Add] max 6 + 查看全部範本
[新增] 按鈕
[今日時間線] 篩選 全部|臨時|排程
[今日已完成]（>3 可收合）
```

### 姐姐（Helper，印尼文為主）

```
[離線橫幅若有]
[摘要行] Hari ini N tugas · …
[Tugas baru]
[Perlu ditanggapi]
[Tugas berikutnya] hero（或「全部完成」）
[Jadwal hari ini] 篩選 Semua|Sekali|Terjadwal
[Selesai hari ini]
```

---

## 3. 分類規則（單一工具）

檔案：`src/lib/todayClassify.js`

主區優先序（每張任務只進 **一個** 主區；徽章可多個）：

1. `needs_attention` — `needs_clarification` | `cannot_complete` | `delayed` | 對方最新留言待回覆  
2. `new_task` — helper 且 `assigned_to === me` 且 `status === pending`（讀通知 **不會** 變 acknowledged）  
3. `overdue` — 未完成／未取消，且 `due_at < now`  
4. `upcoming` — 進行中或兩小時內到期  
5. `later` — 其餘今日未完成（含無時間；無時間排在有時間之後）  
6. `completed` — 今日已完成  
7. `cancelled` — 不計入活躍摘要

臨時 = `!template_id`；排程 = `template_id` 有值。

`Baru` 徽章：pending +（可選）未讀 `task_assigned` 通知；與 acknowledgement 分開。

Next-task（hero）：urgent overdue → urgent due-soon → 任一逾期 → 最早有 due → in_progress → 無 due；只含指派給自己嘅任務。

---

## 4. 組件／檔案變更

| 路徑 | 說明 |
|------|------|
| `src/lib/todayClassify.js` | 分類、partition、摘要、pickNext、留言聚合 |
| `src/lib/recurrenceFormat.js` | 雙語排程摘要 |
| `src/lib/offlineQueue.js` | v2 + userId/householdId 範圍；遷移 v1 |
| `src/pages/Today.jsx` | 角色版面、Realtime、批次 templates/comments |
| `src/components/TaskCard.jsx` | 豐富卡片（類型／指派／排程／Baru／逾期／留言數） |
| `src/components/today/TodaySummaryStrip.jsx` | 摘要帶 |
| `src/components/today/NeedsAttentionSection.jsx` | 需要處理 |
| `src/components/today/NewTasksSection.jsx` | Tugas baru |
| `src/components/today/NextTaskHero.jsx` | Hero |
| `src/components/today/TodayTimeline.jsx` | 時間線 + 類型篩選 |
| `src/components/today/CompletedSection.jsx` | 已完成（>3 收合） |
| `src/components/today/OverdueSection.jsx` | 逾期（僱主） |
| `src/components/today/TaskDetailSheet.jsx` | 詳情（留言／事件 on-open；查看排程） |
| `scripts/today-unit.mjs` | 單元測試 |
| `docs/TODAY_REDESIGN.md` | 本文件 |
| `package.json` | `test:today` |

**未改：** `create_tasks_from_presets`、通知 RPC、RLS、Quick Add 建立路徑（仍用 `createCustomTask`）。

---

## 5. 查詢與 Realtime

- 今日 occurrences：1 次  
- templates：`id in (...)` 1 次  
- comments：`task_occurrence_id in (...)` 1 次，client 聚合 count + unreadComment  
- profiles／helpers：指派顯示名（批次）  
- 未讀新任務：來自 `useNotifications().items`（唔重複訂閱通知）  
- Realtime：`task_occurrences` + `task_comments` by `household_id`；unmount／轉戶清除 channel  
- `visibilitychange` visible + online → refetch；`flushQueue` 後 refetch  
- 樂觀更新：以 `id` + `version` 去重

---

## 6. 測試指令

```bash
npm run test:today
npm run test:presets
npm run test:notifications
npm run build
```

單元已覆蓋規格 14 項（臨時／排程／新任務一次／逾期一次／needs 優先於逾期／完成與取消唔入活躍／無 due 排序／next 優先／只指派可操作／雙語 recurrence／讀通知≠ack／ack 清 new／HK 日界）。

**E2E：** 未加 Playwright。請人手用 Owner A／Employer A／Helper A／Helper B／Household B 對照規格 21 條（通知→Tugas baru→讀通知仍 pending→Mengerti→排程徽章→需要處理→Realtime 唔重複→轉戶清資料→375px／鍵盤）。

---

## 7. 部署／回滾

- **部署：** push `main` → Cloudflare Pages 自動建置  
- **回滾：** `git revert <today-redesign-sha>` 或 reset 到 `b1e2fa8` 再 force（僅緊急；prefer revert）

---

## 8. Acceptance checklist

- [x] 臨時／排程有文字徽章（唔單靠顏色）  
- [x] 每張任務只在一個主區  
- [x] Helper 可見 Tugas baru + Baru  
- [x] 讀通知 ≠ acknowledge  
- [x] 僱主需要處理突出  
- [x] Next-task 優先序  
- [x] 摘要由已載入集合計，取消唔計、唔雙計  
- [x] Realtime 以 id/version 合併  
- [x] 卡片：時間、類型、狀態、優先、指派、排程摘要  
- [x] Quick Add／自訂表單仍走 atomic RPC  
- [x] 僱主／姐姐版面優先序不同  
- [x] 單元測試 + build 通過  
- [ ] 人手 E2E／375px／鍵盤（待批核後驗）  
- [x] RLS／通知 RPC 未改  

---

## 9. 已知限制

- 「未讀留言」以「最新留言作者 ≠ 目前用戶」推斷，無獨立 comment read receipt。  
- 附件指示未做（schema 未強制支援）。  
- Hero 與時間線唔重複；僱主逾期獨立區，姐姐逾期可做 hero 或入時間線（唔入兩個主區）。  
