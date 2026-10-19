# Comment read receipts（留言已讀收據）

**狀態：** 已實作，等待批核  
**基線：** Today 改版 `d001da0`  
**範圍：** 真實 per-user 留言已讀；**不**改 `create_tasks_from_presets`、通知建立架構、任務 RLS、任務 status workflow。

---

## 1. 問題（改版前）

Today 用 `deriveUnreadCommentTaskIds`：只要「最新留言唔係自己」就當未讀。  
結果：僱主睇完留言後，「需要處理」仍會永遠顯示。

通知 `read_at` 同任務 acknowledgement 本來已分開；留言已讀亦必須同兩者分開。

---

## 2. 資料模型

表 `public.task_comment_reads`：

| 欄位 | 說明 |
|------|------|
| `comment_id` | FK → `task_comments` |
| `user_id` | FK → `auth.users`（讀取者） |
| `household_id` | FK → `households` |
| `read_at` | 預設 `now()`；**不可 UPDATE／DELETE**（trigger） |
| PK | `(comment_id, user_id)` |

Migration：`supabase/migrations/20261019230000_task_comment_reads.sql`（已套用 live `yevqwospotfujiziegpz`）。

---

## 3. RLS

- `SELECT`：`user_id = auth.uid()` のみ  
- **無** authenticated INSERT／UPDATE／DELETE policy（客戶端不可直接寫）  
- `anon` 無存取  
- 寫入只經 `mark_task_comments_read`（SECURITY DEFINER，只插 `auth.uid()`）

---

## 4. RPC

### `mark_task_comments_read(p_task_occurrence_id, p_comment_ids uuid[] default null)`

- 要求 active member  
- 只標記**別人**嘅留言  
- `p_comment_ids` null／空 = 該任務全部他人留言  
- 錯誤 ID（唔屬該任務）→ `NOT_AUTHORIZED`  
- Idempotent（`ON CONFLICT DO NOTHING`）  
- 回傳 `{ marked_count, remaining_unread_count }`

### `get_my_unread_comment_summary(p_household_id, p_task_date)`

- SECURITY INVOKER + member check  
- 回傳：`task_occurrence_id`, `unread_count`, `latest_unread_comment_at`, `latest_comment_preview`（最多 80 字）  
- 排除自己嘅留言；只計當日 `task_occurrences`

---

## 5. 前端整合

| 檔案 | 行為 |
|------|------|
| `src/lib/commentReads.js` | fetch／mark helpers + pure Set builders |
| `src/pages/Today.jsx` | 用 summary 建 `unreadCommentTaskIds`；唔再用 inference；Realtime `task_comments` + `task_comment_reads`；visibility／reconnect refetch；offline `mark_comments_read` |
| `src/components/today/TaskDetailSheet.jsx` | 載入並渲染後 mark 可見他人留言；深連結 `?comment=` scroll＋「新留言」／「Komentar baru」；「全部標為已讀」／「Tandai semua sudah dibaca」；Realtime 新留言唔自動 mark、唔搶 focus |
| `src/lib/notificationUtils.js` | `metadata.comment_id` → `&comment=`；通知已讀同留言已讀分開 |
| `src/lib/todayClassify.js` | `needsAttention(unreadCommentTaskIds)` 不變；`deriveUnreadCommentTaskIds` 僅 legacy／測試 |

---

## 6. Offline

Queue v2 type：`mark_comments_read`  
Payload：`{ task_occurrence_id, comment_ids, household_id }`  
按 `userId` + `householdId` 隔離；重連 idempotent flush。

---

## 7. 部署

1. 確認 migration 已喺目標專案（live 已有）  
2. `npm run build` 後部署前端  
3. 回歸：`npm run test:today && npm run test:presets && npm run test:notifications && npm run test:comment-reads && npm run build`

## 8. 回滾

- 前端：`git revert <this-commit>`（或退返 `d001da0`）  
- DB（僅在需要）：drop functions → drop table `task_comment_reads`（會失去已讀紀錄；今日會暫時失去「需要處理」留言準確度，唔要重開 inference）

---

## 9. Acceptance

- [x] 已讀收據 per-user，唔用 global `is_read`  
- [x] 自己留言唔算未讀  
- [x] 開詳情並渲染後先 mark；Realtime 唔自動 mark  
- [x] 通知 read ≠ 留言 read ≠ 任務 acknowledge  
- [x] Today「需要處理」用真實 unread set  
- [x] 深連結可帶 comment id  
- [x] 未改 create_tasks／通知架構／任務 RLS  
