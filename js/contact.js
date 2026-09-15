/**
 * contact.js
 * Contact form controller: validates the form, inserts into Supabase,
 * shows success/error toasts, and offers an optional client-side email copy.
 */

import { supabase } from "./supabase.js";

const form = document.getElementById("contact-form");
const submitBtn = document.getElementById("submit-btn");
const spinner = document.getElementById("spinner");
const successToast = document.getElementById("success-toast");
const successMessage = document.getElementById("success-message");
const errorToast = document.getElementById("error-toast");
const errorMessage = document.getElementById("error-message");
const closeButtons = document.querySelectorAll(".toast-close");

function showSuccess(message) {
  successMessage.textContent = message;
  successToast.classList.remove("hidden");
  setTimeout(() => successToast.classList.add("hidden"), 10000);
}

function showError(message) {
  errorMessage.textContent = message;
  errorToast.classList.remove("hidden");
  setTimeout(() => errorToast.classList.add("hidden"), 12000);
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  document.getElementById("fullName").disabled = isSubmitting;
  document.getElementById("email").disabled = isSubmitting;
  document.getElementById("interest").disabled = isSubmitting;
  document.getElementById("message").disabled = isSubmitting;
  spinner.classList.toggle("hidden", !isSubmitting);
}

function dispatchEmailCopy(record) {
  try {
    const subject = `Contact Query: ${record.service_interest}`;
    const body = [
      `Name: ${record.full_name}`,
      `Email: ${record.email}`,
      `Subject: ${record.service_interest}`,
      "Message:",
      record.message,
    ].join("\n");

    const mailto = `mailto:vr@stealthtranslations.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const a = document.createElement("a");
    a.href = mailto;
    a.target = "_blank";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.warn("Could not open email client:", e);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const serviceInterest = document.getElementById("interest").value;
  const message = document.getElementById("message").value.trim();

  if (!fullName || !email || !serviceInterest || !message) {
    showError("Please fill in all required fields.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  setSubmitting(true);

  const record = {
    full_name: fullName,
    email: email,
    service_interest: serviceInterest,
    message: message,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("contact_queries")
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    showSuccess(
      "Thank you! Your inquiry has been received. Our team will contact you shortly."
    );
    form.reset();

    // Optional client-side email copy hook
    dispatchEmailCopy(record);
  } catch (err) {
    console.error("Contact submission error:", err);
    showError(
      `Submission failed: ${err.message || "An unexpected error occurred. Please try again or email us directly at vr@stealthtranslations.com."}`
    );
  } finally {
    setSubmitting(false);
  }
});

closeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".toast").classList.add("hidden");
  });
});
