/**
 * video-supabase.js
 * Supabase client for the US English video recording job portal.
 * Separate table + bucket from the audio job portal.
 */

export const SUPABASE_URL = "https://upjwbnpxmuoxfktztvdu.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_eNFTfcppzq8cTvut-QSOMg_q9iN0F_o";
export const TABLE_NAME = "video_job_applications";
export const BUCKET_NAME = "applicant-video";

// Backend submit endpoint (Supabase Edge Function). Captures the real client
// IP server-side and resolves location, so it cannot be spoofed.
// Deploy: supabase functions deploy submit-application --no-verify-jwt
export const SUBMIT_FUNCTION_URL =
  "https://upjwbnpxmuoxfktztvdu.supabase.co/functions/v1/submit-application";

import { createClient } from "https://esm.sh/@supabase/supabase-js";

const isPlaceholder = (v) => !v || v.startsWith("YOUR_") || v.includes("_HERE");

function createSupabaseClient() {
  if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_ANON_KEY)) {
    console.warn("Supabase URL or anon key is still a placeholder.");
    return null;
  }
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Failed to initialise Supabase client:", err);
    return null;
  }
}

export const supabase = createSupabaseClient();

function ensureClient() {
  if (!supabase) {
    throw new Error("Supabase client is not initialised.");
  }
}

export async function uploadVideoFile(file, path, onProgress) {
  ensureClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (progress) => {
        if (progress.total && typeof onProgress === "function") {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
    });
  if (error) throw new Error(`Video upload failed for "${path}": ${error.message}`);
  return { filePath: data.path, fullPath: data.fullPath };
}

export async function insertVideoApplication(record) {
  ensureClient();

  // Prefer the Edge Function (server-side IP capture + geo). Fall back to a
  // direct insert if the function is not deployed or unreachable.
  if (SUBMIT_FUNCTION_URL) {
    try {
      const res = await fetch(SUBMIT_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: TABLE_NAME, record }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.data) return payload.data;
      } else {
        console.warn("Submit function returned", res.status, "— falling back to direct insert.");
      }
    } catch (err) {
      console.warn("Submit function unreachable — falling back to direct insert:", err);
    }
  }

  // NOTE: no .select() here — requesting the row back requires SELECT
  // permission, which anonymous applicants do not (and should not) have.
  const { error } = await supabase
    .from(TABLE_NAME)
    .insert(record);

  if (error) {
    // 42703 / PGRST204 = column does not exist (region column migration not
    // yet run). Retry without it so submissions never break.
    if (error.code === "42703" || error.code === "PGRST204") {
      console.warn("accent/region column missing — run SUPABASE_MIGRATION_ACCENT_GEO.sql. Retrying without them.");
      const { accent, region, ...rest } = record;
      const retry = await supabase.from(TABLE_NAME).insert(rest);
      if (retry.error) throw new Error(`Database insert failed: ${retry.error.message}`);
      return { ...rest, id: null };
    }
    throw new Error(`Database insert failed: ${error.message}`);
  }

  return { ...record, id: null };
}
