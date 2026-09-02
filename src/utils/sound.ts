// Ported from OldChatReactCode/src/utils/sound.js
// Uses /pop_sound.mp3 from public folder (copied from old project's assets).

const POP_SOUND_URL = "/pop_sound.mp3";
let isAudioUnlocked = false;

// ── Global sound throttle ──────────────────────────────────────────────────
// Prevents notification sound spam when many messages arrive in rapid
// succession (e.g. a user sending 10-20 messages in 1 second). Only one
// sound plays per SOUND_THROTTLE_MS window, regardless of how many messages
// arrive or which conversation they come from. Matches WhatsApp Web behavior.
let lastSoundPlayedAt = 0;
const SOUND_THROTTLE_MS = 1500;

// Shared Audio instance for playing the notification sound
let sharedAudio: HTMLAudioElement | null = null;

const getSharedAudio = (): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    try {
      sharedAudio = new Audio(POP_SOUND_URL);
      sharedAudio.preload = "auto";
    } catch {
      return null;
    }
  }
  return sharedAudio;
};

/**
 * Unlock audio playback on first user interaction.
 * Browsers block audio until the user interacts with the page.
 * We play the actual sound file silently (volume=0) to unlock it.
 */
export const unlockAudio = () => {
  if (isAudioUnlocked) return;
  if (typeof window === "undefined") return;

  try {
    const audio = getSharedAudio();
    if (!audio) return;

    // Play at volume 0 to unlock audio without being intrusive
    audio.volume = 0;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isAudioUnlocked = true;
          audio.volume = 1; // Restore volume for future plays
          audio.currentTime = 0;
          console.log("[SOUND] Audio unlocked successfully");
        })
        .catch(() => {
          // Still locked — will retry on next interaction
          audio.volume = 1; // Restore volume
        });
    }
  } catch {
    // ignore
  }
};

export const playNotificationSound = () => {
  if (typeof window === "undefined") return;

  // Throttle: skip if we already played within the throttle window.
  // This coalesces rapid-fire messages into a single audible alert.
  const now = Date.now();
  if (now - lastSoundPlayedAt < SOUND_THROTTLE_MS) {
    return;
  }
  lastSoundPlayedAt = now;

  try {
    const audio = getSharedAudio();
    if (!audio) {
      console.warn("[SOUND] Could not create audio element");
      return;
    }

    // Reset to start in case it's still playing
    audio.currentTime = 0;
    audio.volume = 1;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("[SOUND] Notification sound played");
        })
        .catch((error) => {
          console.warn("[SOUND] Playback prevented:", error.message);
          // Audio not unlocked yet — will unlock on next interaction
          isAudioUnlocked = false;
        });
    }
  } catch (error) {
    console.error("[SOUND] Error playing notification sound:", error);
  }
};
