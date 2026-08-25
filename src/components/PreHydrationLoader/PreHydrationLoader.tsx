/**
 * Raw HTML string for the pre-hydration background.
 *
 * Full-screen div with [data-theme] CSS selectors that gets the correct
 * theme colors immediately (the no-flash script in <head> sets data-theme
 * before the body renders). Prevents the white flash during reload in
 * dark mode.
 *
 * Colors are hardcoded to match app/globals.css exactly:
 *   Light: --color-background (#f5f5f5) → --color-surface-elevated (#ffffff)
 *   Dark:  --color-background (#161622) → --color-surface-elevated (#303045)
 *
 * PreHydrationLoaderMount removes this after hydration.
 */
export const preHydrationLoaderHTML = `
<div id="pre-hydration-bg" class="pre-hydration-bg">
  <style>
    .pre-hydration-bg {
      position: fixed;
      inset: 0;
      z-index: 99998;
      /* Light mode (matches --color-background → --color-surface-elevated) */
      background: linear-gradient(160deg, #f5f5f5 0%, #ffffff 100%);
    }
    /* Dark mode — data-theme set by no-flash script before hydration */
    [data-theme="dark"] .pre-hydration-bg {
      background: linear-gradient(160deg, #161622 0%, #303045 100%);
    }
    .pre-hydration-bg.fade-out {
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }
  </style>
</div>
`;
