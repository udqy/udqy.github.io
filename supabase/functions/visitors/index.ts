// Public read-only proxy for the Umami visitor total.
//
// Umami Cloud has no unauthenticated endpoint, and its API key must never reach
// the browser -- it can read every site on the account. So the key stays in the
// function's env and the browser only ever sees a single integer.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SITE_ORIGIN = "https://udqy.github.io";
const UMAMI_API = "https://api.umami.is/v1";

// Umami wants an explicit window; this one predates the site, so it reads as
// "all time" without relying on the API accepting 0.
const SITE_EPOCH_MS = Date.UTC(2025, 0, 1);

// Umami Cloud rate-limits, and this number moves slowly. One upstream call per
// 10 minutes per warm instance is plenty.
const CACHE_TTL_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Let the CDN and browser share the cached figure too.
      "Cache-Control": "public, max-age=600",
    },
  });

let cache: { visitors: number; at: number } | null = null;

async function fetchVisitors(): Promise<number> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.visitors;

  const apiKey = Deno.env.get("UMAMI_API_KEY");
  const websiteId = Deno.env.get("UMAMI_WEBSITE_ID");
  if (!apiKey || !websiteId) throw new Error("umami env not configured");

  const url =
    `${UMAMI_API}/websites/${websiteId}/stats?startAt=${SITE_EPOCH_MS}&endAt=${Date.now()}`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json", "x-umami-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`umami responded ${res.status}`);

  // Umami has shipped both a flat `visitors: 123` and a nested
  // `visitors: { value: 123 }`; accept either so a version bump can't break us.
  const stats = await res.json();
  const raw = stats?.visitors;
  const visitors = typeof raw === "number" ? raw : raw?.value;
  if (typeof visitors !== "number" || !Number.isFinite(visitors)) {
    throw new Error("unexpected umami payload");
  }

  cache = { visitors, at: Date.now() };
  return visitors;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    return json({ visitors: await fetchVisitors() });
  } catch (err) {
    // Serve a stale figure rather than nothing if Umami is briefly unreachable.
    if (cache) return json({ visitors: cache.visitors, stale: true });
    console.error("visitors:", err instanceof Error ? err.message : err);
    return json({ error: "unavailable" }, 503);
  }
});
