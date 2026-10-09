// Auto-bump public/version.json on every production build.
// The version-check hook (src/hooks/useVersionCheck.ts) polls /version.json
// and compares semver — bumping the patch on each build guarantees every
// deployed device detects the update and shows the refresh popup.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const versionFile = join(root, "public", "version.json");

let current = "0.1.0";
try {
  const data = JSON.parse(readFileSync(versionFile, "utf8"));
  if (typeof data.version === "string" && data.version) current = data.version;
} catch {
  // file missing/malformed — start from default
}

const parts = current.split(".").map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1; // bump patch

const next = {
  version: parts.join("."),
  buildTime: new Date().toISOString(),
};

writeFileSync(versionFile, JSON.stringify(next, null, 2) + "\n", "utf8");
console.log(`[generate-version] ${current} -> ${next.version} (${next.buildTime})`);
