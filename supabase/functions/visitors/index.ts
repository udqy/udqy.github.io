// Visitor counter.
//
// One GET both records the caller and returns the running total, so the page
// needs a single request. Identity is a salted daily hash of IP + user agent,
// computed here and never stored in raw form -- the browser sends nothing
// identifying, and the database only ever sees the digest.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_ORIGIN = "https://udqy.github.io";

// Obvious crawlers shouldn't inflate a number meant to describe people. This
// won't catch everything, and it isn't meant to.
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|monitor|preview|scrape|curl|wget|python-requests|go-http-client/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // This request has a side effect, so it must not be replayed from cache.
      "Cache-Control": "no-store",
    },
  });

/** Salted sha256 of IP + user agent + today, as lowercase hex. */
async function visitorHash(req: Request, salt: string): Promise<string> {
  // Supabase sits behind a proxy; the client IP is the first entry.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = req.headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);

  const data = new TextEncoder().encode(`${salt}|${ip}|${ua}|${day}`);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Current total without recording anything. */
async function readTotal(): Promise<number | null> {
  const { data, error } = await supabase
    .from("site_stats")
    .select("count")
    .eq("key", "visitors")
    .maybeSingle();

  return error ? null : (data?.count ?? 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const salt = Deno.env.get("VISITOR_SALT");
  const ua = req.headers.get("user-agent") ?? "";

  // Bots and a missing salt both mean "show the number, record nothing".
  // Without the salt the hash would be guessable, which would let anyone
  // suppress a real visitor's count by claiming their identifier first.
  if (!salt || !ua || BOT_RE.test(ua)) {
    if (!salt) console.error("visitors: VISITOR_SALT is not set");
    const total = await readTotal();
    return total === null
      ? json({ error: "unavailable" }, 503)
      : json({ visitors: total });
  }

  const { data, error } = await supabase.rpc("count_visitor", {
    p_hash: await visitorHash(req, salt),
  });

  if (error) {
    console.error("visitors:", error.message);
    const total = await readTotal();
    return total === null
      ? json({ error: "unavailable" }, 503)
      : json({ visitors: total });
  }

  return json({ visitors: data });
});
