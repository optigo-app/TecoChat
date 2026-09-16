import { toUnicode } from "punycode";

export type UrlRiskLevel = "safe" | "warning" | "danger";

export interface UrlInspectionResult {
  safe: boolean;
  level: UrlRiskLevel;
  reasons: string[];
  href: string;
}

const TRUSTED_DOMAINS: string[] = [
  "google.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "whatsapp.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "github.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "paypal.com",
  "netflix.com",
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "bankofamerica.com",
  "wellsfargo.com",
  "chase.com",
  "citibank.com",
  "wikipedia.org",
  "reddit.com",
  "tiktok.com",
  "snapchat.com",
  "telegram.org",
  "zoom.us",
  "dropbox.com",
  "stripe.com",
  "coinbase.com",
];

const SHORTENER_DOMAINS: Set<string> = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
  "cutt.ly",
  "rb.gy",
  "lnkd.in",
]);

const LOOKALIKE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0400, 0x04ff], // Cyrillic
  [0x0500, 0x052f], // Cyrillic Supplement
  [0x0370, 0x03ff], // Greek and Coptic
  [0x1d00, 0x1d7f], // Phonetic Extensions (small caps look-alikes)
  [0xff00, 0xffef], // Fullwidth Forms (Ａｐｐｌｅ)
  [0x2100, 0x214f], // Letter-like symbols
];

const isLatinLetter = (code: number): boolean =>
  (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);

const isLookalike = (code: number): boolean =>
  LOOKALIKE_RANGES.some(([lo, hi]) => code >= lo && code <= hi);

// Schemes that are dangerous and should be blocked entirely.
const DANGEROUS_SCHEMES = new Set(["javascript", "data", "vbscript", "file"]);

function normaliseHref(raw: string): string {
  const trimmed = raw.trim();

  // Detect explicit scheme.
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "http" || scheme === "https") return trimmed;
    // Dangerous schemes — return about:blank so inspectUrl flags them.
    if (DANGEROUS_SCHEMES.has(scheme)) return "about:blank";
    // Other schemes (mailto:, tel:, etc.) — pass through as-is.
    return trimmed;
  }

  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function getHostname(href: string): string | null {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Decode a punycode hostname back to Unicode so we can detect look-alike
// characters that were hidden by the browser's automatic ASCII conversion.
function toUnicodeHostname(hostname: string): string {
  try {
    // toUnicode handles both ASCII (xn--) and Unicode hostnames gracefully.
    return toUnicode(hostname).toLowerCase();
  } catch {
    return hostname;
  }
}

function detectMixedScript(hostname: string): string[] {
  const found: string[] = [];
  let hasLatin = false;
  let hasLookalike = false;

  for (const ch of hostname) {
    const code = ch.codePointAt(0)!;
    if (isLatinLetter(code)) hasLatin = true;
    else if (isLookalike(code)) {
      hasLookalike = true;
      found.push(ch);
    }
  }

  // Only flag as dangerous when Latin AND look-alike are mixed — that's
  // the actual homograph attack. All-non-Latin domains are legitimate IDNs.
  if (hasLatin && hasLookalike) return found;
  return [];
}

// Detect when a trusted domain name is embedded in a non-suffix position
// to impersonate it (e.g. "paypal.com.evil.com").
// Legitimate subdomains like "www.paypal.com" or "mail.google.com" are NOT flagged.
function detectTrustedImpersonation(hostname: string): string | null {
  const labels = hostname.split(".");

  for (const trusted of TRUSTED_DOMAINS) {
    const t = trusted.split(".");
    for (let i = 0; i <= labels.length - t.length; i++) {
      const slice = labels.slice(i, i + t.length).join(".");
      if (slice !== trusted) continue;
      const isSuffix = i + t.length === labels.length;
      if (isSuffix) return null; // legitimate — trusted domain IS the site
      return trusted;
    }
  }
  return null;
}

function isIpHostname(hostname: string): boolean {
  // IPv4 — validate octet ranges (0-255)
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    return ipv4Match.slice(1).every((octet) => {
      const n = parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 — URL() wraps in brackets
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  return false;
}

function countSubdomains(hostname: string): number {
  const parts = hostname.split(".");
  const registrableParts = parts.length >= 2 ? 2 : parts.length;
  return Math.max(0, parts.length - registrableParts);
}

export function inspectUrl(rawUrl: string): UrlInspectionResult {
  const reasons: string[] = [];
  let level: UrlRiskLevel = "safe";

  const href = normaliseHref(rawUrl);

  // Block dangerous schemes entirely.
  if (href === "about:blank") {
    return {
      safe: false,
      level: "danger",
      reasons: ["This link uses a dangerous type that could run code on your device."],
      href,
    };
  }

  const hostname = getHostname(href);

  if (!hostname) {
    // Non-HTTP schemes like mailto: / tel: have no hostname — allow them.
    const schemeMatch = rawUrl.trim().match(/^([a-z][a-z0-9+.-]*):/i);
    if (schemeMatch && !DANGEROUS_SCHEMES.has(schemeMatch[1].toLowerCase())) {
      return { safe: true, level: "safe", reasons: [], href: rawUrl.trim() };
    }
    return {
      safe: false,
      level: "danger",
      reasons: ["This link is not valid."],
      href,
    };
  }

  // Decode punycode to Unicode for look-alike character detection.
  const unicodeHost = toUnicodeHostname(hostname);

  const lookalikes = detectMixedScript(unicodeHost);
  if (lookalikes.length > 0) {
    reasons.push(
      "This link uses fake characters that look like real ones to trick you."
    );
    level = "danger";
  }

  const impersonated = detectTrustedImpersonation(hostname);
  if (impersonated) {
    reasons.push(
      `This link pretends to be "${impersonated}" but is actually a different website.`
    );
    level = "danger";
  }

  // Punycode / IDN warning — only if look-alike chars weren't already detected.
  if (hostname.includes("xn--") && lookalikes.length === 0) {
    reasons.push("This link uses special characters in its name.");
    if (level === "safe") level = "warning";
  }

  if (isIpHostname(hostname)) {
    reasons.push("This link uses a number address instead of a website name.");
    if (level === "safe") level = "warning";
  }

  const registrable = hostname.split(".").slice(-2).join(".");
  if (SHORTENER_DOMAINS.has(hostname) || SHORTENER_DOMAINS.has(registrable)) {
    reasons.push("This is a shortened link that hides where it really goes.");
    if (level === "safe") level = "warning";
  }

  try {
    const u = new URL(href);
    if (u.username || u.password) {
      reasons.push("This link has a login built into it, which is often used to steal info.");
      level = "danger";
    }
  } catch {
    /* already handled above */
  }

  const subCount = countSubdomains(hostname);
  if (subCount >= 4) {
    reasons.push("This link has too many parts in its name, which is unusual.");
    if (level === "safe") level = "warning";
  }

  if (!href.toLowerCase().startsWith("https://") && !href.toLowerCase().startsWith("http://")) {
    reasons.push("This link does not use a normal web address format.");
    if (level === "safe") level = "warning";
  } else if (href.toLowerCase().startsWith("http://")) {
    if (level === "safe") {
      reasons.push("This link is not secure (no HTTPS).");
      level = "warning";
    }
  }

  return {
    safe: reasons.length === 0,
    level,
    reasons,
    href,
  };
}
