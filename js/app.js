/**
 * app.js
 * Main form controller: validation, audio upload, geolocation, feedback states.
 */

import { uploadAudio, insertApplication } from "./supabase.js";
import { getGeoData } from "./geo.js";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/wave", "audio/ogg", "audio/aac", "audio/mp4", "audio/webm"];

let selectedFile = null;

const form = document.getElementById("application-form");
const fileInput = document.getElementById("audio-file");
const fileInfo = document.getElementById("file-info");
const fileSize = document.getElementById("file-size");
const fileWarning = document.getElementById("file-warning");
const uploadProgress = document.getElementById("upload-progress");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const submitBtn = document.getElementById("submit-btn");
const spinner = document.getElementById("spinner");
const successToast = document.getElementById("success-toast");
const successMessage = document.getElementById("success-message");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");
const closeButtons = document.querySelectorAll(".toast-close");

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  fileInput.disabled = isSubmitting;
  document.getElementById("full-name").disabled = isSubmitting;
  document.getElementById("email").disabled = isSubmitting;
  document.getElementById("age").disabled = isSubmitting;
  document.getElementById("gender").disabled = isSubmitting;
  spinner.classList.toggle("hidden", !isSubmitting);
}

function showProgress(show) {
  uploadProgress.classList.toggle("hidden", !show);
}

function updateProgress(percent) {
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
}

function showSuccess(message) {
  successMessage.textContent = message;
  successToast.classList.remove("hidden");
  setTimeout(() => successToast.classList.add("hidden"), 8000);
}

function showError(message) {
  errorMessage.textContent = message;
  errorToast.classList.remove("hidden");
  setTimeout(() => errorToast.classList.add("hidden"), 12000);
}

function hideToasts() {
  successToast.classList.add("hidden");
  errorToast.classList.add("hidden");
}

function validateFile(file) {
  if (!file) return "Please select an audio file.";

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Audio file is too large. Maximum allowed is ${formatBytes(MAX_FILE_SIZE_BYTES)}. Selected: ${formatBytes(file.size)}.`;
  }

  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
    return "Please upload a valid audio file (e.g., MP3, WAV, OGG, AAC, M4A, WEBM).";
  }

  return null;
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  hideToasts();

  if (!selectedFile) {
    fileInfo.classList.add("hidden");
    fileWarning.textContent = "";
    fileWarning.classList.add("hidden");
    submitBtn.disabled = true;
    return;
  }

  fileInfo.classList.remove("hidden");
  fileSize.textContent = formatBytes(selectedFile.size);

  const error = validateFile(selectedFile);
  if (error) {
    fileWarning.textContent = error;
    fileWarning.classList.remove("hidden");
    submitBtn.disabled = true;
    fileInput.value = "";
    selectedFile = null;
    fileInfo.classList.add("hidden");
  } else {
    fileWarning.textContent = "";
    fileWarning.classList.add("hidden");
    submitBtn.disabled = false;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("full-name").value.trim();
  const email = document.getElementById("email").value.trim();
  const age = parseInt(document.getElementById("age").value, 10);
  const gender = document.getElementById("gender").value;

  if (!fullName || !email || !gender) {
    showError("Please fill in all required fields.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  if (Number.isNaN(age) || age < 18 || age > 99) {
    showError("Please enter a valid age between 18 and 99.");
    return;
  }

  const fileError = validateFile(selectedFile);
  if (fileError) {
    showError(fileError);
    return;
  }

  setSubmitting(true);
  showProgress(true);
  updateProgress(0);

  try {
    const [geo, upload] = await Promise.all([
      getGeoData(),
      uploadAudio(selectedFile, (percent) => updateProgress(percent)),
    ]);

    const record = {
      full_name: fullName,
      email: email,
      age: age,
      gender: gender,
      audio_file_path: upload.filePath,
      ip_address: geo.ip,
      city: geo.city,
      country: geo.country,
      submitted_at: new Date().toISOString(),
    };

    const saved = await insertApplication(record);

    updateProgress(100);
    showSuccess(
      `Application submitted successfully. Reference ID: ${saved.id}. We will be in touch soon.`
    );
    form.reset();
    selectedFile = null;
    fileInfo.classList.add("hidden");
    fileWarning.classList.add("hidden");
    submitBtn.disabled = true;
  } catch (err) {
    console.error("Submission error:", err);
    showError(
      `Submission failed: ${err.message || "An unexpected error occurred. Please try again or contact support."}`
    );
  } finally {
    setSubmitting(false);
    setTimeout(() => {
      showProgress(false);
      updateProgress(0);
    }, 1500);
  }
});

closeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".toast").classList.add("hidden");
  });
});
