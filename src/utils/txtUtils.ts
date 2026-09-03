"use client";

// ── Text file loading helpers ────────────────────────────────────────────────
// Shared URL resolution + fetch logic for .txt / .log / .csv / .json / .md
// preview.  Uses the same proxy + direct-fetch strategy as PDFs to avoid CORS.

import { resolveMediaUrl } from "./pdfUtils";

/**
 * Load a text file from a URL and return its contents as a string.
 *
 * Uses a two-tier strategy (same as PDFs):
 *  1. Server-side proxy (`/api/pdf-proxy?url=...`) — no CORS restrictions.
 *  2. Direct `fetch()` fallback — works if the upstream has permissive CORS.
 */
export async function loadTextFile(url: string): Promise<string> {
  const resolvedUrl = resolveMediaUrl(url);

  // Blob / data URLs — fetch directly (same-origin)
  if (resolvedUrl.startsWith("blob:") || resolvedUrl.startsWith("data:")) {
    const res = await fetch(resolvedUrl);
    if (!res.ok) throw new Error(`Failed to fetch text: ${res.status}`);
    return await res.text();
  }

  // ── Tier 1: Server-side proxy ──────────────────────────────────────────
  try {
    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(resolvedUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // fall through to direct fetch
  }

  // ── Tier 2: Direct fetch ───────────────────────────────────────────────
  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch text: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/**
 * Check if a filename/mimeType indicates a previewable text file.
 */
export function isTextFile(filename?: string, mimeType?: string): boolean {
  const name = (filename || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "application/xml") return true;

  const textExtensions = [
    ".txt", ".log", ".csv", ".json", ".xml", ".md", ".markdown",
    ".yaml", ".yml", ".ini", ".conf", ".cfg", ".properties",
    ".sh", ".bat", ".ps1", ".sql", ".env", ".gitignore",
  ];
  return textExtensions.some((ext) => name.endsWith(ext));
}
