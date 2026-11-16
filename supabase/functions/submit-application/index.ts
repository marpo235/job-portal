// submit-application — Supabase Edge Function
// Receives application records from the public job portal, captures the real
// client IP server-side, resolves it to a location (city/region/country) via
// ipapi.co, and inserts the enriched record with the service role.
//
// Deploy:
//   supabase functions deploy submit-application --no-verify-jwt
// The function URL is then:
//   https://<project-ref>.supabase.co/functions/v1/submit-application
// Set that URL as SUBMIT_FUNCTION_URL in js/supabase.js and js/video-supabase.js.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TABLES = new Set(["job_applications", "video_job_applications"]);

// Fields the client may not supply — the server is authoritative so they
// cannot be spoofed.
const SERVER_FIELDS = ["ip_address", "city", "region", "country"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: { table?: string; record?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: corsHeaders });
  }

  const { table, record } = body;
  if (!table || !ALLOWED_TABLES.has(table) || !record || typeof record !== "object") {
    return new Response("Invalid table or record", { status: 400, headers: corsHeaders });
  }

  // Real client IP from proxy headers (Supabase/Cloudflare edge).
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "Unknown";

  let city = "Unknown";
  let region = "Unknown";
  let country = "Unknown";

  if (ip !== "Unknown") {
    try {
      const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        city = geo.city || city;
        region = geo.region || region;
        country = geo.country_name || country;
      }
    } catch (e) {
      console.warn("Geo lookup failed:", e);
    }
  }

  // Strip any client-supplied location fields; server values win.
  const clean: Record<string, unknown> = { ...record };
  for (const f of SERVER_FIELDS) delete clean[f];
  clean.ip_address = ip;
  clean.city = city;
  clean.region = region;
  clean.country = country;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await supabase.from(table).insert(clean).select().single();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
