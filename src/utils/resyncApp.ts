// resyncApp — full data resync WITHOUT logging out.
//
// Wipes the per-user IndexedDB (conversation list, messages, group members,
// drafts cache) and CacheStorage, then hard-reloads the app. sessionStorage
// and cookies are left untouched, so the session survives the reload and the
// app re-fetches everything fresh from the API on boot — same effect as
// logout→login for stale data, without dropping the session.
//
// Use for: "messages arrived via socket but don't show after reload",
// stale avatars/profile images, or any state that only fresh API data fixes.

import { deleteDb } from "../db/tecoDb";
import { hardReloadWithCacheBust } from "./versionManager";

export async function resyncApp(authId: string | number | undefined | null): Promise<void> {
  try {
    await deleteDb(authId);
  } catch {
    /* proceed — partial wipe is still better than none */
  }
  await hardReloadWithCacheBust();
}
