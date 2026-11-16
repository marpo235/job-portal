/**
 * supabase.js
 * Supabase client and helper functions for job applications.
 *
 * Replace placeholder values with your real Supabase project credentials
 * before deploying. Do NOT commit real secrets to GitHub.
 */

export const SUPABASE_URL = "https://upjwbnpxmuoxfktztvdu.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_eNFTfcppzq8cTvut-QSOMg_q9iN0F_o";
export const TABLE_NAME = "job_applications";
export const BUCKET_NAME = "applicant-audio";

// Backend submit endpoint (Supabase Edge Function). Captures the real client
// IP server-side and resolves location, so it cannot be spoofed.
// Deploy: supabase functions deploy submit-application --no-verify-jwt
export const SUBMIT_FUNCTION_URL =
  "https://upjwbnpxmuoxfktztvdu.supabase.co/functions/v1/submit-application";

import { createClient } from "https://esm.sh/@supabase/supabase-js";

const isPlaceholder = (value) =>
  !value || value.startsWith("YOUR_") || value.includes("_HERE");

function createSupabaseClient() {
  if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_ANON_KEY)) {
    console.warn(
      "Supabase URL or anon key is still set to a placeholder. Replace them in js/supabase.js before deploying."
    );
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
    throw new Error(
      "Supabase client is not initialised. Replace SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase.js."
    );
  }
}

/**
 * Upload an audio file to the private Supabase storage bucket with a custom path.
 * @param {File} file
 * @param {string} path
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<{ filePath: string, fullPath: string }>}
 */
export async function uploadAudioFile(file, path, onProgress) {
  ensureClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (progress) => {
        if (progress.total && typeof onProgress === "function") {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percent);
        }
      },
    });

  if (error) {
    throw new Error(`Audio upload failed for "${path}": ${error.message}`);
  }

  return { filePath: data.path, fullPath: data.fullPath };
}

/**
 * Backwards-compatible single-file helper. Generates a timestamped path.
 * @param {File} file
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<{ filePath: string, fullPath: string }>}
 */
export async function uploadAudio(file, onProgress) {
  const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `${Date.now()}_${safeName}`;
  return uploadAudioFile(file, path, onProgress);
}

/**
 * Insert a job application record into the database.
 * @param {Object} record
 * @returns {Promise<Object>}
 */
export async function insertApplication(record) {
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
    // 42703 / PGRST204 = column does not exist (accent/region migration not
    // yet run). Retry without those fields so submissions never break.
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
