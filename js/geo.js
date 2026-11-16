/**
 * geo.js
 * Resolve IP address and approximate location from the client browser.
 * Primary: ipapi.co/json/  |  Fallback: ipify for IP only.
 */

const DEFAULT_GEO = {
  ip: "Blocked",
  city: "Unknown",
  region: "Unknown",
  country: "Unknown",
};

/**
 * @returns {Promise<{ip: string, city: string, region: string, country: string}>}
 */
export async function getGeoData() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("ipapi returned a non-OK response");

    const data = await res.json();
    return {
      ip: data.ip || DEFAULT_GEO.ip,
      city: data.city || DEFAULT_GEO.city,
      region: data.region || DEFAULT_GEO.region,
      country: data.country_name || DEFAULT_GEO.country,
    };
  } catch (e) {
    console.warn("ipapi failed, falling back to ipify:", e);
    return getIpifyFallback();
  }
}

async function getIpifyFallback() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) throw new Error("ipify returned a non-OK response");

    const data = await res.json();
    return {
      ip: data.ip || DEFAULT_GEO.ip,
      city: DEFAULT_GEO.city,
      region: DEFAULT_GEO.region,
      country: DEFAULT_GEO.country,
    };
  } catch (e) {
    console.warn("ipify also failed:", e);
    return { ...DEFAULT_GEO };
  }
}
