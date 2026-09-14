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
 * Upload an audio file to the private Supabase storage bucket.
 * @param {File} file
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<{ filePath: string, fullPath: string }>}
 */
export async function uploadAudio(file, onProgress) {
  ensureClient();

  const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `${Date.now()}_${safeName}`;

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
    throw new Error(`Audio upload failed: ${error.message}`);
  }

  return { filePath: data.path, fullPath: data.fullPath };
}

/**
 * Insert a job application record into the database.
 * @param {Object} record
 * @returns {Promise<Object>}
 */
export async function insertApplication(record) {
  ensureClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  return data;
}
