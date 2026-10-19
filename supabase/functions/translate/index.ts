// Halo Kakak translation proxy — JWT required (verify_jwt: true)
// Does NOT log full task text. Does NOT send user/household ids to MyMemory.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const buckets = new Map<string, { count: number; reset: number }>();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function rateLimit(uid: string): boolean {
  const now = Date.now();
  const b = buckets.get(uid);
  if (!b || now > b.reset) {
    buckets.set(uid, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!rateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").trim().slice(0, 2000);
    const glossary: { zh: string; id: string }[] = Array.isArray(body?.glossary)
      ? body.glossary.slice(0, 100)
      : [];

    if (!text) {
      return new Response(JSON.stringify({ translated: "", source: "empty" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Exact glossary hit
    const exact = glossary.find((g) => g.zh === text);
    if (exact?.id) {
      return new Response(
        JSON.stringify({ translated: exact.id, source: "glossary" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Call MyMemory WITHOUT user or household identifiers
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-TW|id`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    let translated = String(data?.responseData?.translatedText || "");

    // Overlay glossary terms (longest first)
    const sorted = [...glossary].sort((a, b) => (b.zh?.length || 0) - (a.zh?.length || 0));
    for (const g of sorted) {
      if (g.zh && translated.includes(g.zh)) {
        translated = translated.split(g.zh).join(g.id);
      }
    }

    // Log only metadata — never full text
    console.log(
      JSON.stringify({
        event: "translate",
        uid_hash: await hashShort(user.id),
        chars: text.length,
        ok: !!translated,
      }),
    );

    return new Response(
      JSON.stringify({
        translated: translated || text,
        source: "mymemory",
        machineGenerated: true,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.log(JSON.stringify({ event: "translate_error", msg: String(e).slice(0, 80) }));
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function hashShort(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
