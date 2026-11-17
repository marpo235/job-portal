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
  ispOrg: "Unknown",
  networkFlag: "unknown",
};

// Substring match on the network org/ASN name — flags VPN brands, proxies,
// Tor exits, and cloud/datacenter providers (source of most fraudulent
// registrations). This is a screening flag, not a verdict.
const SUSPICIOUS_NETWORK = [
  "vpn", "proxy", "tor exit", "tor ", "nordvpn", "expressvpn", "surfshark",
  "mullvad", "protonvpn", "proton ag", "private internet access", "vyprvpn",
  "tunnelbear", "windscribe", "cyberghost", "purevpn", "ipvanish", "torguard",
  "hotspot shield", "hide.me", "hidemyass", "atlas vpn",
  "m247", "datacamp", "leaseweb", "digitalocean", "digital ocean", "vultr",
  "linode", "akamai", "hetzner", "ovh", "oracle cloud", "microsoft azure",
  "azure", "google cloud", "amazon", "aws", "alibaba", "tencent", "choopa",
  "kamatera", "hostinger", "contabo", "servers.com", "worldstream", "gcore",
  "psychz", "sharktech", "hostwinds", "cloudflare",
  "data center", "datacenter", "hosting", "server",
];

export function classifyNetwork(org) {
  if (!org || org === "Unknown") return "unknown";
  const s = org.toLowerCase();
  return SUSPICIOUS_NETWORK.some((k) => s.includes(k))
    ? "vpn_or_datacenter"
    : "clean";
}

/**
 * @returns {Promise<{ip: string, city: string, region: string, country: string, ispOrg: string, networkFlag: string}>}
 */
export async function getGeoData() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("ipapi returned a non-OK response");

    const data = await res.json();
    const ispOrg = data.org || DEFAULT_GEO.ispOrg;
    return {
      ip: data.ip || DEFAULT_GEO.ip,
      city: data.city || DEFAULT_GEO.city,
      region: data.region || DEFAULT_GEO.region,
      country: data.country_name || DEFAULT_GEO.country,
      ispOrg,
      networkFlag: classifyNetwork(ispOrg),
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
      ispOrg: DEFAULT_GEO.ispOrg,
      networkFlag: DEFAULT_GEO.networkFlag,
    };
  } catch (e) {
    console.warn("ipify also failed:", e);
    return { ...DEFAULT_GEO };
  }
}
