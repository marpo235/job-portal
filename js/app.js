/**
 * app.js
 * Main form controller: validation, multi-file audio upload,
 * applicant ID generation, geolocation, and feedback states.
 */

import { uploadAudioFile, insertApplication } from "./supabase.js";
import { getGeoData } from "./geo.js";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB total batch
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/webm",
];

let selectedFiles = [];

const form = document.getElementById("application-form");
const fileInput = document.getElementById("audioFile");
const fileList = document.getElementById("file-list");
const fileItems = document.getElementById("file-items");
const totalSize = document.getElementById("total-size");
const fileWarning = document.getElementById("file-warning");
const uploadProgress = document.getElementById("upload-progress");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const progressLabel = document.getElementById("progress-label");
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

function setProgressLabel(text) {
  if (progressLabel) progressLabel.textContent = text;
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
  if (!file) return "Please select at least one audio file.";

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `One or more files are too large. Max per file is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`;
  }

  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
    return "Please upload valid audio files (e.g., MP3, WAV, OGG, AAC, M4A, WEBM).";
  }

  return null;
}

function validateFiles(files) {
  if (!files.length) return "Please select at least one audio file.";

  let total = 0;
  for (const file of files) {
    const err = validateFile(file);
    if (err) return err;
    total += file.size;
  }

  if (total > MAX_TOTAL_SIZE_BYTES) {
    return `Total upload size is too large. Max allowed is ${formatBytes(MAX_TOTAL_SIZE_BYTES)}. Selected: ${formatBytes(total)}.`;
  }

  return null;
}

function renderFileList(files) {
  if (!files.length) {
    fileList.classList.add("hidden");
    return;
  }

  fileItems.innerHTML = "";
  let total = 0;

  files.forEach((file, index) => {
    total += file.size;
    const li = document.createElement("li");
    li.className = "flex items-center justify-between";
    li.innerHTML = `<span class="truncate mr-2">${escapeHtml(file.name)}</span><span class="shrink-0 text-slate-500">${formatBytes(file.size)}</span>`;
    fileItems.appendChild(li);
  });

  totalSize.textContent = formatBytes(total);
  fileList.classList.remove("hidden");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function generateApplicantId() {
  // 3-digit zero-padded short ID from the last 3 digits of the current timestamp
  const timestamp = Date.now();
  return String(timestamp % 1000).padStart(3, "0");
}

function getFileExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "mp3";
}

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files || []);
  hideToasts();
  renderFileList(selectedFiles);

  const error = validateFiles(selectedFiles);
  if (error) {
    fileWarning.textContent = error;
    fileWarning.classList.remove("hidden");
    submitBtn.disabled = true;
    fileInput.value = "";
    selectedFiles = [];
    fileList.classList.add("hidden");
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

  const fileError = validateFiles(selectedFiles);
  if (fileError) {
    showError(fileError);
    return;
  }

  setSubmitting(true);
  showProgress(true);
  updateProgress(0);
  setProgressLabel("Preparing upload...");

  try {
    const geo = await getGeoData();
    const applicantId = generateApplicantId();
    const uploadedPaths = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const ext = getFileExtension(file.name);
      const path = `${applicantId}_f${i + 1}.${ext}`;

      setProgressLabel(`Uploading file ${i + 1} of ${selectedFiles.length}...`);

      const { filePath } = await uploadAudioFile(file, path, (percent) =>
        updateProgress(percent)
      );

      uploadedPaths.push(filePath);
    }

    const record = {
      full_name: fullName,
      email: email,
      age: age,
      gender: gender,
      audio_file_path: uploadedPaths[0],
      audio_files: uploadedPaths,
      ip_address: geo.ip,
      city: geo.city,
      country: geo.country,
      submitted_at: new Date().toISOString(),
    };

    const saved = await insertApplication(record);

    updateProgress(100);
    setProgressLabel("Upload complete");
    showSuccess(
      `Application submitted successfully. Reference ID: ${saved.id}. Applicant: ${applicantId}.`
    );
    form.reset();
    selectedFiles = [];
    fileInput.value = "";
    renderFileList([]);
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
      setProgressLabel("Uploading audio...");
    }, 1500);
  }
});

closeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".toast").classList.add("hidden");
  });
});
