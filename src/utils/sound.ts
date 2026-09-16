// ─── SoundManager ───────────────────────────────────────────────────────────
// Web Audio API-based sound system. No audio files needed.
// Generates WhatsApp-style sounds programmatically using oscillators.
//
// Platform support:
// - Chrome/Firefox/Edge/Safari (desktop): Full support
// - Chrome/Samsung (Android): Full support
// - Safari (iOS 16.4+): Full support, silent switch bypassed via AudioSession API
// - Safari (iOS < 16.4): Silent WAV fallback for unlock, but silent switch mutes
// - PWA (iOS, foreground): Same as Safari
// - PWA (iOS, background): NOT supported (iOS platform limitation)
//
// iOS handling:
// - AudioContext must be created/resumed inside a user gesture (click/touchend/keyup)
// - navigator.audioSession.type = "playback" bypasses the hardware silent switch
// - AudioContext can become "zombie" after sleep/wake — recreated on visibilitychange
// - Silent WAV data URL used as fallback for old iOS without AudioSession API

// ── Types ───────────────────────────────────────────────────────────────────

export type SoundType = "notification" | "send" | "delivered" | "read";

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0–1
  notification: boolean;
  send: boolean;
  delivered: boolean;
  read: boolean;
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.7,
  notification: true,
  send: true,
  delivered: false,
  read: false,
};

const SETTINGS_KEY = "tecochat-sound-settings";

// ── Throttle per sound type (ms) ────────────────────────────────────────────
const THROTTLE_MS: Record<SoundType, number> = {
  notification: 1500,
  send: 300,
  delivered: 500,
  read: 500,
};

const lastPlayedAt: Record<SoundType, number> = {
  notification: 0,
  send: 0,
  delivered: 0,
  read: 0,
};

// ── Silent WAV (16-byte) for old iOS fallback ───────────────────────────────
// Minimal valid WAV: 44-byte header + 0 data bytes. Plays silence.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// ── AudioContext singleton ──────────────────────────────────────────────────

let audioContext: AudioContext | null = null;
let isUnlocked = false;
let needsGesture = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  // Handle closed context (can happen after iOS background/lifecycle events)
  if (audioContext?.state === "closed") {
    audioContext = null;
  }

  if (!audioContext) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      audioContext = new AudioContextCtor();
      // Re-apply audio session type whenever a new context is created
      setAudioSessionPlayback();
    } catch {
      return null;
    }
  }

  return audioContext;
}

/**
 * Recreate the AudioContext. Safari's context can become a zombie after
 * sleep/wake — reports state==="running" but produces no audio.
 */
function recreateAudioContext(): void {
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  getAudioContext();
  needsGesture = true;
}

// ── AudioSession API (iOS silent switch bypass) ─────────────────────────────

/**
 * Set the audio session type to "playback" so the iOS hardware silent switch
 * does not mute Web Audio output. Feature-detected — no-op on browsers without
 * the AudioSession API (non-WebKit, older iOS).
 *
 * Safe for this app: camera uses { video: true } only (no microphone).
 * If microphone capture is ever added, switch to "play-and-record" dynamically.
 */
function setAudioSessionPlayback(): void {
  try {
    if (
      typeof navigator !== "undefined" &&
      "audioSession" in navigator &&
      (navigator as unknown as { audioSession?: { type: string } }).audioSession
    ) {
      (navigator as unknown as { audioSession: { type: string } }).audioSession.type = "playback";
    }
  } catch {
    // Ignore — not supported on this browser
  }
}

// ── Silent WAV fallback (old iOS < 16.4) ────────────────────────────────────

let fallbackAudio: HTMLAudioElement | null = null;

function unlockWithSilentWav(): void {
  if (typeof window === "undefined") return;
  if (!fallbackAudio) {
    try {
      fallbackAudio = new Audio(SILENT_WAV);
      fallbackAudio.preload = "auto";
    } catch {
      return;
    }
  }
  try {
    fallbackAudio.muted = true;
    fallbackAudio.currentTime = 0;
    const p = fallbackAudio.play();
    if (p !== undefined) {
      p.then(() => {
        if (fallbackAudio) {
          fallbackAudio.muted = false;
          fallbackAudio.pause();
          fallbackAudio.currentTime = 0;
        }
      }).catch(() => {
        if (fallbackAudio) fallbackAudio.muted = false;
      });
    }
  } catch {
    // ignore
  }
}

// ── Settings persistence ────────────────────────────────────────────────────

function loadSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Validate each field with type/range checks to prevent corrupted settings
    const bool = (v: unknown, def: boolean): boolean =>
      typeof v === "boolean" ? v : def;
    const num = (v: unknown, def: number): number => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 1 ? n : def;
    };
    return {
      enabled: bool(parsed.enabled, DEFAULT_SETTINGS.enabled),
      volume: num(parsed.volume, DEFAULT_SETTINGS.volume),
      notification: bool(parsed.notification, DEFAULT_SETTINGS.notification),
      send: bool(parsed.send, DEFAULT_SETTINGS.send),
      delivered: bool(parsed.delivered, DEFAULT_SETTINGS.delivered),
      read: bool(parsed.read, DEFAULT_SETTINGS.read),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: SoundSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

let currentSettings: SoundSettings = loadSettings();

// ── Core: play a synthesized tone ───────────────────────────────────────────

interface ToneOptions {
  type: OscillatorType;
  frequency: number;
  frequencyEnd?: number; // for pitch sweep
  durationMs: number;
  attackMs?: number;
  volume?: number; // 0–1, multiplied by global volume
  delayMs?: number; // delay before this tone (for multi-pulse sounds)
}

async function playTone(opts: ToneOptions): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Ensure context is running (resume if suspended)
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {
      // Autoplay blocked — no-op
    });
  }

  // Guard: don't create nodes if context is still suspended
  if (ctx.state !== "running") return;

  const {
    type,
    frequency,
    frequencyEnd,
    durationMs,
    attackMs = 5,
    volume = 0.3,
    delayMs = 0,
  } = opts;

  const now = ctx.currentTime + delayMs / 1000;
  const duration = durationMs / 1000;
  const attack = attackMs / 1000;
  const globalVol = currentSettings.volume;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  if (frequencyEnd !== undefined && frequencyEnd !== frequency) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, frequencyEnd),
      now + duration
    );
  }

  // Envelope: quick attack, exponential decay to silence
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume * globalVol, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.05); // small buffer to avoid click

  // Disconnect nodes after playback to prevent memory leaks over long sessions
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // ignore — nodes may already be disconnected
    }
  };
}

// ── Sound definitions ───────────────────────────────────────────────────────

async function playNotificationTone(): Promise<void> {
  // Incoming message: sine wave 880Hz → 440Hz, 150ms, pleasant "pop"
  await playTone({
    type: "sine",
    frequency: 880,
    frequencyEnd: 440,
    durationMs: 150,
    attackMs: 5,
    volume: 0.35,
  });
}

async function playSendTone(): Promise<void> {
  // Outgoing message: triangle 600Hz → 200Hz, 100ms, subtle "whoosh"
  await playTone({
    type: "triangle",
    frequency: 600,
    frequencyEnd: 200,
    durationMs: 100,
    attackMs: 5,
    volume: 0.25,
  });
}

async function playDeliveredTone(): Promise<void> {
  // Delivered: two short square clicks at 1200Hz, 50ms each
  await playTone({
    type: "square",
    frequency: 1200,
    durationMs: 50,
    attackMs: 2,
    volume: 0.2,
    delayMs: 0,
  });
  await playTone({
    type: "square",
    frequency: 1200,
    durationMs: 50,
    attackMs: 2,
    volume: 0.2,
    delayMs: 80,
  });
}

async function playReadTone(): Promise<void> {
  // Read: single soft sine click at 1000Hz, 60ms
  await playTone({
    type: "sine",
    frequency: 1000,
    durationMs: 60,
    attackMs: 2,
    volume: 0.2,
  });
}

const TONE_PLAYERS: Record<SoundType, () => Promise<void>> = {
  notification: playNotificationTone,
  send: playSendTone,
  delivered: playDeliveredTone,
  read: playReadTone,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Unlock audio playback on first user interaction.
 * MUST be called from inside a user gesture handler (click, touchend, keyup).
 *
 * Does three things:
 * 1. Creates/resumes the AudioContext (required by all browsers)
 * 2. Sets navigator.audioSession.type = "playback" (bypasses iOS silent switch)
 * 3. Plays a silent WAV via HTMLAudioElement (fallback for old iOS)
 */
export const unlockAudio = (): void => {
  if (typeof window === "undefined") return;

  // Always try to resume — context may have been suspended after sleep/wake
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume()
      .then(() => {
        isUnlocked = true;
        needsGesture = false;
      })
      .catch(() => {
        // Still blocked — will retry on next interaction
      });
  } else if (ctx && ctx.state === "running") {
    isUnlocked = true;
    needsGesture = false;
  }

  // Set audio session to playback (bypasses iOS silent switch)
  setAudioSessionPlayback();

  // Silent WAV fallback for old iOS without AudioSession API
  unlockWithSilentWav();
};

/**
 * Play a sound of the given type.
 * Respects settings (enabled + per-type toggle) and throttle.
 * Silent no-op if audio is not unlocked or settings disable it.
 * Attempts to unlock audio on the first call from a user gesture.
 */
export const playSound = (type: SoundType): void => {
  if (typeof window === "undefined") return;

  // Check global enabled flag
  if (!currentSettings.enabled) return;

  // Check per-type toggle
  if (!currentSettings[type]) return;

  // Throttle: skip if we already played this type within the throttle window
  const now = Date.now();
  if (now - lastPlayedAt[type] < THROTTLE_MS[type]) return;
  lastPlayedAt[type] = now;

  // Ensure audio is unlocked — playSound may be called from a user gesture
  // (e.g. send button click) before NotificationContext's window listener fires
  if (!isUnlocked) {
    unlockAudio();
  }

  // Play the tone (async, but we don't await — fire and forget)
  TONE_PLAYERS[type]().catch(() => {
    // Playback failed — likely autoplay blocked. Mark as needing gesture.
    needsGesture = true;
  });
};

/**
 * Force-play a sound regardless of settings (for the settings UI test button).
 * Still respects throttle to prevent audio spam.
 * Attempts to unlock audio since the test button is a user gesture.
 */
export const testSound = (type: SoundType): void => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt[type] < 300) return; // shorter throttle for test
  lastPlayedAt[type] = now;

  // Ensure audio is unlocked — test button is always a user gesture
  if (!isUnlocked) {
    unlockAudio();
  }

  TONE_PLAYERS[type]().catch(() => {
    needsGesture = true;
  });
};

// ── Backward-compatible exports (for existing code) ─────────────────────────

/** Alias for playSound("notification") — backward compatibility */
export const playNotificationSound = (): void => playSound("notification");

// ── Settings API ────────────────────────────────────────────────────────────

export const getSoundSettings = (): SoundSettings => ({ ...currentSettings });

export const setSoundSettings = (partial: Partial<SoundSettings>): void => {
  currentSettings = { ...currentSettings, ...partial };
  saveSettings(currentSettings);
};

export const isSoundEnabled = (type: SoundType): boolean =>
  currentSettings.enabled && currentSettings[type];

export const isAudioUnlocked = (): boolean => isUnlocked;

export const needsUserGesture = (): boolean => needsGesture;

// ── Wake/sleep detection ────────────────────────────────────────────────────
// Safari's AudioContext can become a zombie after sleep/wake.
// Recreate it when the page becomes visible again.
//
// Listeners/interval are stored at module scope so destroySoundManager() can
// remove them explicitly (HMR, unit tests, SPA teardown). pagehide still acts
// as a safety-net auto-cleanup.

let pageshowHandler: ((e: PageTransitionEvent) => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let timeJumpInterval: ReturnType<typeof setInterval> | null = null;
let pagehideCleanup: (() => void) | null = null;

if (typeof window !== "undefined") {
  // pageshow fires on bfcache restore and some wake scenarios
  pageshowHandler = (e: PageTransitionEvent) => {
    if (e.persisted) {
      recreateAudioContext();
    }
  };
  window.addEventListener("pageshow", pageshowHandler);

  // visibilitychange catches most desktop Safari wake scenarios
  visibilityHandler = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible" && audioContext) {
      // Try to resume first — if it's just suspended, this fixes it
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {
          // If resume fails, recreate
          recreateAudioContext();
        });
      } else if (audioContext.state === "closed") {
        recreateAudioContext();
      }
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  // Time-jump detection: if the system clock jumps forward by more than 5
  // seconds in a single event loop tick, the device likely went to sleep.
  let lastTimeCheck = Date.now();
  timeJumpInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastTimeCheck > 10000) {
      // Clock jumped — device likely slept and woke
      if (audioContext) recreateAudioContext();
    }
    lastTimeCheck = now;
  }, 5000);

  // Safety-net auto-cleanup on pagehide to prevent leaks
  // (important for HMR, unit tests, and SPA navigation)
  pagehideCleanup = () => {
    destroySoundManager();
  };
  window.addEventListener("pagehide", pagehideCleanup);
}

/**
 * Tear down all module-level listeners, clear the time-jump interval, and
 * close the AudioContext. Safe to call multiple times. Intended for HMR,
 * unit tests, and explicit SPA teardown — pagehide auto-calls this too.
 */
export const destroySoundManager = (): void => {
  if (typeof window !== "undefined") {
    if (pageshowHandler) {
      window.removeEventListener("pageshow", pageshowHandler);
      pageshowHandler = null;
    }
    if (pagehideCleanup) {
      window.removeEventListener("pagehide", pagehideCleanup);
      pagehideCleanup = null;
    }
  }
  if (typeof document !== "undefined" && visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  if (timeJumpInterval !== null) {
    clearInterval(timeJumpInterval);
    timeJumpInterval = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  isUnlocked = false;
};
