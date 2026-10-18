# 屋企家務通 · Halo Kakak

香港僱主 ↔ 印尼籍家庭傭工（Kakak）雙語家務 Dashboard。

Bilingual household task & routine app for Hong Kong employers and Indonesian domestic helpers.

## Features / 功能

- **雙語顯示**：每項同時顯示繁中／廣東話 + Bahasa Indonesia
- **僱主／姐姐模式**：`?mode=kakak` 放大印尼文、大 checkbox
- **每日固定時間表** + **今日特別任務**（Urgent、完成時間）
- **廣東話語音輸入**（Web Speech API `zh-HK`）→ MyMemory 翻譯 + 香港家務詞庫
- **印尼文朗讀**（`speechSynthesis` `id-ID`）
- **房間碼同步**：Supabase `household_sync` + Realtime／輪詢 + `localStorage` + `BroadcastChannel`

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 — default room `HOME-888`.

Helper link example:

```
https://YOUR_DOMAIN/?room=HOME-888&mode=kakak
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

Copy `.env.example` → `.env`. If unset, the app falls back to the provisioned `halo-kakak` project anon credentials (safe for frontend; never commit `service_role`).

Schema reference: [`supabase/schema.sql`](supabase/schema.sql).

## Cloudflare Pages deploy

1. Connect this GitHub repo to **Cloudflare Pages**.
2. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. (Optional) Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Share `https://YOUR_PAGES_DOMAIN/?room=HOME-888&mode=kakak` via WhatsApp.

Or CLI:

```bash
npm run build
npx wrangler pages deploy dist --project-name=halo-kakak
```

## Security note

Current RLS allows anon read/write by `room_code` for easy demo. For production, tighten with signed room tokens or an Edge Function.

## Stack

Vite · React · Tailwind CSS v4 · Lucide · Supabase JS
