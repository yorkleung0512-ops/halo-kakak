# Halo Kakak

香港僱主同印尼籍家庭傭工嘅**雙語家務管理** web app（mobile-first）。

- 公開網址：https://halo-kakak.pages.dev
- GitHub：https://github.com/yorkleung0512-ops/halo-kakak
- Supabase project：`yevqwospotfujiziegpz`

## 認證流程（唔再用房間碼）

1. 僱主用**電郵 magic link**登入（免密碼）。
2. 首次登入後**建立家庭**（成為 `owner`）。
3. 喺「家庭」頁產生**一次性邀請連結**，經 WhatsApp 傳畀姐姐。
4. 姐姐打開 `/invite/<token>` → 登入 → 接受邀請 → 角色係 `helper`。
5. 權限由 Supabase **RLS + RPC** 強制；前端顯示唔係安全邊界。
6. 僱主可開「Preview helper view」（唯讀，唔改真實角色）。

**邀請軟→硬門禁（P2）**：

1. 加入家庭必須帶合法 invite token（64-hex / ≥16 字）；`?invite=test` 等垃圾參數會被前端拒絕。
2. 新帳戶可 magic link 登入；**建立家庭**必須走邀請加入，或僱主確認 checkbox + 客戶端短冷卻（防濫用 MVP）。
3. 可選環境變數 `VITE_REQUIRE_INVITE=true`：magic link **唔再**為冇邀請嘅新電郵建帳（`shouldCreateUser: false`）；已有帳戶仍可登入；有合法邀請嘅姐姐仍可註冊。**預設關閉**，唔會靜默鎖死生產環境僱主開戶。

> `?room=` / `?mode=kakak` **唔再**當登入憑證。

## 環境變數

複製 `.env.example`：

```
VITE_SUPABASE_URL=https://yevqwospotfujiziegpz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
# optional: VITE_REQUIRE_INVITE=true
```

**千祈唔好**把 `service_role` key 放進前端。

## 本機開發

```bash
npm install
npm run dev
```

## CI / 測試

GitHub Actions（`.github/workflows/ci.yml`）會跑 lint、`scripts/*-unit.mjs`、production build、同 Playwright 公開頁 smoke（Chromium）。

```bash
npm run test:unit   # today + presets + notifications + comment-reads + invite-token + calendar + registration-gate
npm run lint
npm run build
npx playwright install chromium   # 首次本機 e2e
npm run test:e2e                  # SignIn / Legal / junk invite soft-gate
```

## 資料庫 migration

檔案喺 `supabase/migrations/`。已套用到 production 嘅基礎 schema：

1. `20261019150000_normalized_schema.sql`
2. `20261019150100_rls_policies.sql`
3. `20261019150200_rpc_auth_invites.sql`

舊表 `household_sync` **保留**，新 app **唔再寫入**。詳見 `docs/MIGRATION.md`。

本地 seed（只供開發）：`supabase/seed.local.sql`（唔會自動跑上 production）。

## Edge Function：translate

- 路徑：`supabase/functions/translate`
- `verify_jwt: true` — 必須帶用戶 JWT
- 前端只可經 `supabase.functions.invoke('translate')` 翻譯
- Rate limit；**唔會** log 完整任務文字；**唔會**把 user/household id 傳去 MyMemory

部署：

```bash
# via Supabase MCP / CLI
supabase functions deploy translate --project-ref yevqwospotfujiziegpz
```

URL：`https://yevqwospotfujiziegpz.supabase.co/functions/v1/translate`

## Auth 後台設定（必須）

喺 Supabase Dashboard → Authentication：

1. 開啟 **Email** provider（magic link / OTP）。
2. Redirect URLs 加入：
   - `https://halo-kakak.pages.dev/**`
   - `http://localhost:5173/**`
3. Phone OTP（Twilio）屬可選；MVP **唔要求密碼**。

## RLS smoke test

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
EMPLOYER_ACCESS_TOKEN=... HELPER_ACCESS_TOKEN=... \
node scripts/rls-smoke.mjs
```

清單對應 `supabase/tests/rls_checks.sql` 12 項。

## 點樣測試

1. 開網站 → 輸入電郵 → 查收 magic link → 登入。
2. 建立家庭。
3. 「家庭」→ 產生邀請 → WhatsApp / 複製連結。
4. 另一電郵開邀請連結 → 登入 → 接受 → 姐姐介面。
5. 僱主新增任務（可語音、翻譯、核准印尼文）→ 姐姐改狀態（明白／開始／有問題／完成等）。
6. 斷網改狀態 → 應見到離線提示，恢復後自動同步。

## PWA / 保安

- Manifest + service worker（只 cache app shell；**唔** cache private API）
- `public/_headers`：CSP、HSTS、frame-ancestors、Referrer-Policy、X-Content-Type-Options
- CSP **冇** `unsafe-eval`

## 技術棧

Vite + React + Tailwind + Supabase Auth/DB/Edge + Cloudflare Pages
