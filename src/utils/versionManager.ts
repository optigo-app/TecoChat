// Version manager — ported from OldChatReactCode/src/utils/versionManager.js
// Handles app version checking, comparison, multi-tab sync, and SW cleanup.

const VERSION_URL = "/version.json";
const STORAGE_KEY = "app_version_current";
const BROADCAST_CHANNEL_NAME = "app_version_sync";
const BROADCAST_MSG_NEW_VERSION = "NEW_VERSION_DETECTED";

const cacheBustUrl = () => `${VERSION_URL}?t=${Date.now()}`;

export interface VersionInfo {
  version: string;
  buildTime: string;
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export async function fetchServerVersion(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(cacheBustUrl(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.version !== "string") return null;
    return { version: data.version, buildTime: data.buildTime || "" };
  } catch (err) {
    console.warn("[versionManager] Failed to fetch version.json:", err);
    return null;
  }
}

// ── Comparison ────────────────────────────────────────────────────────────────

export function compareVersions(a: string, b: string): number {
  if (!a || !b) return 0;
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function isNewerVersion(serverVersion: string, currentVersion: string): boolean {
  return compareVersions(serverVersion, currentVersion) > 0;
}

// ── LocalStorage persistence ──────────────────────────────────────────────────

export function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function getAppVersion(): string {
  return getStoredVersion() || "0.0.0";
}

export function setStoredVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* ignore */
  }
}

// ── Multi-tab synchronization ─────────────────────────────────────────────────

type VersionCallback = (info: VersionInfo) => void;
const broadcastListeners = new Set<VersionCallback>();
let broadcastChannel: BroadcastChannel | false | null = null;

function getBroadcastChannel(): BroadcastChannel | false {
  if (broadcastChannel !== null) return broadcastChannel;
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === BROADCAST_MSG_NEW_VERSION) {
        const { version, buildTime } = event.data as VersionInfo & { type: string };
        broadcastListeners.forEach((cb) => {
          try {
            cb({ version, buildTime });
          } catch {
            /* ignore */
          }
        });
      }
    };
    return broadcastChannel;
  } catch {
    broadcastChannel = false;
    return false;
  }
}

export function onCrossTabVersionNotification(callback: VersionCallback): () => void {
  broadcastListeners.add(callback);
  const channel = getBroadcastChannel();

  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        callback({ version: event.newValue, buildTime: "" });
      } catch {
        /* ignore */
      }
    }
  };

  if (!channel) {
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    broadcastListeners.delete(callback);
    if (!channel) {
      window.removeEventListener("storage", storageHandler);
    }
  };
}

export function notifyOtherTabs(info: VersionInfo): void {
  const channel = getBroadcastChannel();
  if (channel) {
    channel.postMessage({
      type: BROADCAST_MSG_NEW_VERSION,
      version: info.version,
      buildTime: info.buildTime,
    });
  }
  setStoredVersion(info.version);
}

// ── Service worker cleanup ────────────────────────────────────────────────────

export async function unregisterStaleServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;

    console.info(
      `[versionManager] Found ${registrations.length} service worker(s) — unregistering to prevent stale cache issues.`
    );

    await Promise.all(
      registrations.map(async (reg) => {
        try {
          await reg.unregister();
          console.info("[versionManager] Unregistered SW:", reg.scope);
        } catch (err) {
          console.warn("[versionManager] Failed to unregister SW:", err);
        }
      })
    );

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      if (cacheNames.length > 0) {
        console.info(`[versionManager] Cleared ${cacheNames.length} cache(s).`);
      }
    }
  } catch (err) {
    console.warn("[versionManager] SW cleanup error:", err);
  }
}
