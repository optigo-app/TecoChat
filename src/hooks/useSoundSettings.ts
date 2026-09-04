"use client";

import { useCallback, useState } from "react";
import {
  getSoundSettings,
  setSoundSettings as persistSettings,
  testSound,
  type SoundType,
} from "../utils/sound";

/**
 * React hook for reading and updating sound settings.
 * Settings are persisted to localStorage by the SoundManager.
 */
export function useSoundSettings() {
  const [settings, setSettings] = useState(getSoundSettings());

  const update = useCallback(
    (partial: Partial<Parameters<typeof persistSettings>[0]>) => {
      persistSettings(partial);
      setSettings(getSoundSettings());
    },
    []
  );

  const test = useCallback((type: SoundType) => {
    testSound(type);
  }, []);

  return { settings, update, test };
}
