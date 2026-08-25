"use client";

import { useEffect, useState } from "react";
import PreHydrationLoader from "./PreHydrationLoaderAnimation";

/**
 * Manages the pre-hydration loader lifecycle:
 *
 * 1. Raw #pre-hydration-bg div (injected via dangerouslySetInnerHTML in
 *    layout.tsx) provides the correct theme background immediately via
 *    [data-theme] CSS selectors — no white flash.
 * 2. This client component renders the PreHydrationLoader (SVG animation)
 *    on top of that background once React hydrates.
 * 3. After a short delay, fades out both the animation and the raw background,
 *    then removes the raw background from the DOM.
 */
export default function PreHydrationLoaderMount() {
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    // Keep the loader visible briefly after hydration so the user sees
    // the animation, then fade it out.
    const fadeTimer = setTimeout(() => {
      setShowLoader(false);
    }, 300);

    // Remove the raw background after the fade-out transition completes
    const removeTimer = setTimeout(() => {
      const bg = document.getElementById("pre-hydration-bg");
      if (bg) {
        bg.classList.add("fade-out");
      }
    }, 700);

    // Fully remove the raw background from the DOM
    const cleanupTimer = setTimeout(() => {
      const bg = document.getElementById("pre-hydration-bg");
      if (bg && bg.parentNode) {
        bg.parentNode.removeChild(bg);
      }
    }, 1200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      clearTimeout(cleanupTimer);
    };
  }, []);

  return <PreHydrationLoader show={showLoader} />;
}
