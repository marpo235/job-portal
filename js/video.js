/**
 * video.js — US English video recording job application form.
 */

import { uploadVideoFile, insertVideoApplication } from "./video-supabase.js";
import { getGeoData } from "./geo.js";

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB per file
const MAX_TOTAL_SIZE_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB total
const ALLOWED_TYPES = ["video/mp4", "video/quicktime"];

let selectedFiles = [];

const form = document.getElementById("application-form");
const fileInput = document.getElementById("videoFile");
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
  document.querySelectorAll("#application-form input, #application-form select").forEach((el) => {
    el.disabled = isSubmitting;
  });
  spinner.classList.toggle("hidden", !isSubmitting);
}

function showProgress(show) { uploadProgress.classList.toggle("hidden", !show); }
function updateProgress(p) { progressBar.style.width = `${p}%`; progressText.textContent = `${p}%`; }
function setProgressLabel(t) { if (progressLabel) progressLabel.textContent = t; }
function showSuccess(m) { successMessage.textContent = m; successToast.classList.remove("hidden"); setTimeout(() => successToast.classList.add("hidden"), 8000); }
function showError(m) { errorMessage.textContent = m; errorToast.classList.remove("hidden"); setTimeout(() => errorToast.classList.add("hidden"), 12000); }
function hideToasts() { successToast.classList.add("hidden"); errorToast.classList.add("hidden"); }

function validateFile(file) {
  if (!file) return "Please select at least one video file.";
  if (file.size > MAX_FILE_SIZE_BYTES) return `One or more files are too large. Max per file is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`;
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith(".mp4")) {
    return "Please upload MP4 video files only.";
  }
  return null;
}

function validateFiles(files) {
  if (!files.length) return "Please select at least one video file.";
  let total = 0;
  for (const file of files) {
    const err = validateFile(file);
    if (err) return err;
    total += file.size;
  }
  if (total > MAX_TOTAL_SIZE_BYTES) return `Total upload size is too large. Max allowed is ${formatBytes(MAX_TOTAL_SIZE_BYTES)}.`;
  return null;
}

function renderFileList(files) {
  if (!files.length) { fileList.classList.add("hidden"); return; }
  fileItems.innerHTML = "";
  let total = 0;
  files.forEach((file) => {
    total += file.size;
    const li = document.createElement("li");
    li.className = "flex items-center justify-between";
    li.innerHTML = `<span class="truncate mr-2">${escapeHtml(file.name)}</span><span class="shrink-0 text-slate-500">${formatBytes(file.size)}</span>`;
    fileItems.appendChild(li);
  });
  totalSize.textContent = formatBytes(total);
  fileList.classList.remove("hidden");
}

function escapeHtml(text) { const d = document.createElement("div"); d.textContent = text; return d.innerHTML; }
function generateApplicantId() { return String(Date.now() % 1000).padStart(3, "0"); }
function getFileExtension(filename) { const p = filename.split("."); return p.length > 1 ? p.pop().toLowerCase() : "mp4"; }

const accentSelect = document.getElementById("accent");
const accentOther = document.getElementById("accent-other");

accentSelect.addEventListener("change", () => {
  const isOther = accentSelect.value === "other";
  accentOther.classList.toggle("hidden", !isOther);
  accentOther.required = isOther;
  if (!isOther) accentOther.value = "";
});

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
  const required = {
    "full-name": "Full Name",
    "email": "Email Address",
    "age": "Age",
    "gender": "Gender",
    "country-origin": "Country of origin",
    "state-origin": "State of origin",
    "country-residence": "Country of residence",
    "state-residence": "State of residence",
    "home-studio": "Access to home studio",
    "accent": "Accent",
  };
  const vals = {};
  const missing = [];
  for (const [id, label] of Object.entries(required)) {
    vals[id] = document.getElementById(id).value.trim();
    if (!vals[id]) missing.push(label);
  }
  if (missing.length) {
    showError(`Please fill in the required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email)) { showError("Please enter a valid email address."); return; }

  let accent = vals.accent;
  if (accent === "other") {
    accent = accentOther.value.trim();
    if (!accent) { showError("Please specify your accent."); return; }
  }

  const age = parseInt(vals.age, 10);
  if (Number.isNaN(age) || age < 18 || age > 99) { showError("Please enter a valid age between 18 and 99."); return; }
  const fileError = validateFiles(selectedFiles);
  if (fileError) { showError(fileError); return; }

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
      const path = `${applicantId}_v${i + 1}.${ext}`;
      setProgressLabel(`Uploading file ${i + 1} of ${selectedFiles.length}...`);
      const { filePath } = await uploadVideoFile(file, path, (p) => updateProgress(p));
      uploadedPaths.push(filePath);
    }

    const record = {
      full_name: vals["full-name"],
      email: vals.email,
      age,
      gender: vals.gender,
      country_of_origin: vals["country-origin"],
      state_of_origin: vals["state-origin"],
      country_of_residence: vals["country-residence"],
      state_of_residence: vals["state-residence"],
      home_studio: vals["home-studio"] === "yes",
      accent: accent,
      video_file_path: uploadedPaths[0],
      video_files: uploadedPaths,
      ip_address: geo.ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp_org: geo.ispOrg,
      network_flag: geo.networkFlag,
      submitted_at: new Date().toISOString(),
    };

    await insertVideoApplication(record);
    updateProgress(100);
    setProgressLabel("Upload complete");
    showSuccess(`Application submitted successfully. Your applicant reference: ${applicantId}.`);
    form.reset();
    selectedFiles = [];
    fileInput.value = "";
    renderFileList([]);
    fileWarning.classList.add("hidden");
    submitBtn.disabled = true;
  } catch (err) {
    console.error("Submission error:", err);
    showError(`Submission failed: ${err.message || "An unexpected error occurred."}`);
  } finally {
    setSubmitting(false);
    setTimeout(() => { showProgress(false); updateProgress(0); setProgressLabel("Uploading video..."); }, 1500);
  }
});

closeButtons.forEach((btn) => {
  btn.addEventListener("click", () => { btn.closest(".toast").classList.add("hidden"); });
});
