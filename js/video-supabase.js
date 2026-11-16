/**
 * video-supabase.js
 * Supabase client for the US English video recording job portal.
 * Separate table + bucket from the audio job portal.
 */

export const SUPABASE_URL = "https://upjwbnpxmuoxfktztvdu.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_eNFTfcppzq8cTvut-QSOMg_q9iN0F_o";
export const TABLE_NAME = "video_job_applications";
export const BUCKET_NAME = "applicant-video";

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
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(record)
    .select()
    .single();
  if (error) throw new Error(`Database insert failed: ${error.message}`);
  return data;
}
