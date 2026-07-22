import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_ORIGIN = "https://udqy.github.io";

// Slugs come from location.pathname's last segment, which Zola always emits
// slugified: lowercase alphanumerics joined by single hyphens.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LEN = 100;
const MAX_BODY_BYTES = 1024;
const SITEMAP_TTL_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Slugs of every page in the published sitemap, cached per warm instance. */
let sitemapCache: { slugs: Set<string>; at: number } | null = null;

async function publishedSlugs(): Promise<Set<string>> {
  if (sitemapCache && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) {
    return sitemapCache.slugs;
  }

  const res = await fetch(`${SITE_ORIGIN}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);

  const slugs = new Set<string>();
  for (const [, loc] of (await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const last = new URL(loc).pathname.split("/").filter(Boolean).pop();
    if (last) slugs.add(last);
  }

  sitemapCache = { slugs, at: Date.now() };
  return slugs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const slug = new URL(req.url).searchParams.get("slug");
    // Reads are harmless, so they only need a shape check -- an unknown slug
    // simply has no row and reports zero.
    if (!slug || slug.length > MAX_SLUG_LEN || !SLUG_RE.test(slug)) {
      return json({ error: "invalid slug" }, 400);
    }

    const { data, error } = await supabase
      .from("reactions")
      .select("count")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return json({ error: "lookup failed" }, 500);
    return json({ like: [data?.count ?? 0, false] });
  }

  if (req.method === "POST") {
    if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
      return json({ error: "body too large" }, 413);
    }

    let body: { slug?: unknown; reacted?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "malformed json" }, 400);
    }

    const { slug, reacted } = body;
    if (
      typeof slug !== "string" || slug.length > MAX_SLUG_LEN ||
      !SLUG_RE.test(slug)
    ) {
      return json({ error: "invalid slug" }, 400);
    }
    if (typeof reacted !== "boolean") {
      return json({ error: "invalid reacted" }, 400);
    }

    // Writes must name a page that actually exists, so nobody can seed the
    // table with junk keys. Fail closed if the sitemap is unreachable.
    let known: Set<string>;
    try {
      known = await publishedSlugs();
    } catch {
      return json({ error: "validation unavailable" }, 503);
    }
    if (!known.has(slug)) return json({ error: "unknown slug" }, 404);

    const { data, error } = await supabase.rpc("bump_reaction", {
      p_slug: slug,
      p_delta: reacted ? 1 : -1,
    });

    if (error) return json({ error: "update failed" }, 500);
    return json({ like: [data, false] });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
