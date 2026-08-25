"use client";

// Ported from OldChatReactCode/src/hooks/useFaviconBadge.js
// Draws a badge count on the favicon using canvas, and updates the document
// title with the unread count. Restores the original favicon when count is 0.
//
// Next.js note: The metadata API injects <link rel="icon"> tags which can be
// reset on re-render. We re-apply the badge on a short interval to handle
// this without causing a MutationObserver feedback loop.

import { useEffect, useRef } from "react";

export const useFaviconBadge = (count: number) => {
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current = Number.isFinite(Number(count)) ? Number(count) : 0;
  }, [count]);

  useEffect(() => {
    const drawBadge = (badgeCount: number): string | null => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, 64, 64);

      // 1. Base bubble (#685dd8 — project purple)
      const centerX = 32;
      const centerY = 32;
      const radius = 30;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#685dd8";
      ctx.fill();

      // 2. WhatsApp-style tail
      ctx.beginPath();
      ctx.moveTo(12, 52);
      ctx.lineTo(4, 62);
      ctx.lineTo(22, 58);
      ctx.fillStyle = "#685dd8";
      ctx.fill();

      // 3. Count text
      const label = badgeCount > 99 ? "99+" : String(badgeCount);
      const fontSize = label.length === 1 ? 48 : label.length === 2 ? 38 : 28;

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Faded inner ring for single-digit counts
      if (label.length === 1) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 3, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillText(label, centerX, centerY + 2);

      return canvas.toDataURL("image/png");
    };

    // ── Cache the badge data URL so we don't redraw every interval ─────────
    let badgeHref: string | null = null;
    let lastAppliedCount = -1;

    const applyBadge = () => {
      const safeCount = countRef.current;

      // Find all favicon links
      const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ];
      let favicons: HTMLLinkElement[] = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLLinkElement) favicons.push(el);
        });
      }

      // Create one if none exists
      if (favicons.length === 0) {
        const fav = document.createElement("link");
        fav.rel = "icon";
        fav.href = "/favicon.ico";
        document.head.appendChild(fav);
        favicons = [fav];
      }

      // Save original hrefs (only once per element)
      for (const fav of favicons) {
        if (!fav.dataset.originalHref) {
          const currentHref = fav.getAttribute("href") || fav.href || "/favicon.ico";
          fav.dataset.originalHref = currentHref;
        }
      }

      if (safeCount <= 0) {
        // Restore original favicons — only if currently showing a badge
        if (lastAppliedCount > 0) {
          for (const fav of favicons) {
            const orig = fav.dataset.originalHref;
            if (orig && fav.href !== orig) fav.href = orig;
          }
          document.title = document.title.replace(/^\(\d+\+?\)\s/, "");
          lastAppliedCount = 0;
        }
        return;
      }

      // Only redraw canvas if count changed
      if (safeCount !== lastAppliedCount) {
        badgeHref = drawBadge(safeCount);
        lastAppliedCount = safeCount;
      }

      if (!badgeHref) return;

      // Apply to ALL icon links — only update if href differs (avoids loops)
      let changed = false;
      for (const fav of favicons) {
        if (fav.href !== badgeHref) {
          fav.href = badgeHref;
          changed = true;
        }
      }

      if (changed) {
        const label = safeCount > 99 ? "99+" : String(safeCount);
        const cleanTitle = document.title.replace(/^\(\d+\+?\)\s/, "");
        document.title = `(${label}) ${cleanTitle}`;
      }
    };

    applyBadge();

    // Re-apply periodically to handle Next.js head re-renders.
    // Interval is lightweight — canvas is cached, href comparison skips no-ops.
    const interval = setInterval(applyBadge, 2000);

    return () => clearInterval(interval);
  }, []);
};

export default useFaviconBadge;
