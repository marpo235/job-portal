/**
 * talent.js — general talent-database registration form.
 * No file upload; captures IP/location in the background for fraud checks.
 */

import { insertTalentApplication } from "./talent-supabase.js";
import { getGeoData } from "./geo.js";

const form = document.getElementById("application-form");
const submitBtn = document.getElementById("submit-btn");
const spinner = document.getElementById("spinner");
const successToast = document.getElementById("success-toast");
const successMessage = document.getElementById("success-message");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");
const closeButtons = document.querySelectorAll(".toast-close");

const accentSelect = document.getElementById("accent");
const accentOther = document.getElementById("accent-other");
const deviceSelect = document.getElementById("device");
const deviceOther = document.getElementById("device-other");

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  document.querySelectorAll("#application-form input, #application-form select, #application-form textarea").forEach((el) => {
    el.disabled = isSubmitting;
  });
  spinner.classList.toggle("hidden", !isSubmitting);
}

function showSuccess(m) { successMessage.textContent = m; successToast.classList.remove("hidden"); setTimeout(() => successToast.classList.add("hidden"), 8000); }
function showError(m) { errorMessage.textContent = m; errorToast.classList.remove("hidden"); setTimeout(() => errorToast.classList.add("hidden"), 12000); }
function hideToasts() { successToast.classList.add("hidden"); errorToast.classList.add("hidden"); }
function escapeHtml(text) { const d = document.createElement("div"); d.textContent = text; return d.innerHTML; }
void escapeHtml;
function generateApplicantRef() { return String(Date.now() % 1000).padStart(3, "0"); }

function wireOtherToggle(selectEl, otherEl) {
  selectEl.addEventListener("change", () => {
    const isOther = selectEl.value === "other";
    otherEl.classList.toggle("hidden", !isOther);
    otherEl.required = isOther;
    if (!isOther) otherEl.value = "";
  });
}
wireOtherToggle(accentSelect, accentOther);
wireOtherToggle(deviceSelect, deviceOther);

// --- Location verification (anti-fraud) -------------------------------------
// Compares the claimed country of residence with the IP-derived country.
function normalizeCountry(v) {
  const s = (v || "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  const aliases = {
    "united states": "united states", "united states of america": "united states",
    "usa": "united states", "us": "united states", "america": "united states",
    "uk": "united kingdom", "great britain": "united kingdom", "britain": "united kingdom",
    "england": "united kingdom", "scotland": "united kingdom", "wales": "united kingdom",
    "northern ireland": "united kingdom", "uae": "united arab emirates",
    "south korea": "korea republic of", "korea": "korea republic of",
    "czech republic": "czechia", "holland": "netherlands",
  };
  return aliases[s] || s;
}

function computeLocationFlag(claimedCountry, detectedCountry) {
  if (!claimedCountry || !detectedCountry || detectedCountry === "Unknown") return "unknown";
  return normalizeCountry(claimedCountry) === normalizeCountry(detectedCountry)
    ? "match" : "mismatch";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideToasts();

  const required = {
    "full-name": "Full name",
    "email": "Email",
    "age": "Age",
    "accent": "Accent",
    "country-origin": "Country of origin",
    "state-origin": "State / region of origin",
    "country-residence": "Country of residence",
    "state-residence": "State / region of residence",
    "native-languages": "Native language(s)",
    "device": "Primary recording device",
    "home-studio": "Home office or studio access",
  };
  const vals = {};
  const missing = [];
  for (const [id, label] of Object.entries(required)) {
    vals[id] = document.getElementById(id).value.trim();
    if (!vals[id]) missing.push(label);
  }

  const interests = Array.from(document.querySelectorAll('input[name="project_interest"]:checked'))
    .map((cb) => cb.value);
  if (!interests.length) missing.push("Projects you'd like to hear about");

  const weekly = document.querySelector('input[name="weekly_hours"]:checked');
  if (!weekly) missing.push("Weekly availability");

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
  let device = vals.device;
  if (device === "other") {
    device = deviceOther.value.trim();
    if (!device) { showError("Please specify your device."); return; }
  }

  const age = parseInt(vals.age, 10);
  if (Number.isNaN(age) || age < 18 || age > 99) { showError("Please enter a valid age between 18 and 99."); return; }

  setSubmitting(true);

  try {
    const geo = await getGeoData();
    const applicantRef = generateApplicantRef();
    const locationFlag = computeLocationFlag(vals["country-residence"], geo.country);

    const record = {
      full_name: vals["full-name"],
      email: vals.email,
      age,
      accent,
      country_of_origin: vals["country-origin"],
      state_of_origin: vals["state-origin"],
      country_of_residence: vals["country-residence"],
      state_of_residence: vals["state-residence"],
      native_languages: vals["native-languages"],
      other_languages: document.getElementById("other-languages").value.trim(),
      project_interests: interests,
      weekly_hours: weekly.value,
      device,
      home_studio: vals["home-studio"] === "yes",
      comments: document.getElementById("comments").value.trim(),
      ip_address: geo.ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      location_flag: locationFlag,
      applicant_ref: applicantRef,
      submitted_at: new Date().toISOString(),
    };

    await insertTalentApplication(record);
    showSuccess(`Registration submitted successfully. Your reference: ${applicantRef}.`);
    form.reset();
    accentOther.classList.add("hidden");
    deviceOther.classList.add("hidden");
  } catch (err) {
    console.error("Submission error:", err);
    showError(`Submission failed: ${err.message || "An unexpected error occurred."}`);
  } finally {
    setSubmitting(false);
  }
});

closeButtons.forEach((btn) => {
  btn.addEventListener("click", () => { btn.closest(".toast").classList.add("hidden"); });
});
