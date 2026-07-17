import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const slug = new URL(req.url).searchParams.get("slug");
    if (!slug) return new Response("missing slug", { status: 400 });

    const { data } = await supabase
      .from("reactions")
      .select("count")
      .eq("slug", slug)
      .maybeSingle();

    return new Response(
      JSON.stringify({ "like": [data?.count ?? 0, false] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method === "POST") {
    const { slug, reacted } = await req.json();
    if (!slug) return new Response("missing slug", { status: 400 });

    const { data: existing } = await supabase
      .from("reactions")
      .select("count")
      .eq("slug", slug)
      .maybeSingle();

    const current = existing?.count ?? 0;
    const next = reacted ? current + 1 : Math.max(0, current - 1);

    await supabase
      .from("reactions")
      .upsert({ slug, count: next }, { onConflict: "slug" });

    return new Response(
      JSON.stringify({ "like": [next, false] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
