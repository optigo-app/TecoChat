"use client";

// ── PDF.js setup & helpers ───────────────────────────────────────────────────
// Centralised configuration so every component that renders PDFs shares the
// same worker + document-loading logic.
//
// IMPORTANT: pdfjs-dist must NOT be imported at module top-level because it
// references browser-only globals (DOMMatrix) that don't exist in Node.js,
// which breaks Next.js SSR / prerendering.  We lazy-load it inside a function
// that only runs in the browser.

import type * as PdfjsLibType from "pdfjs-dist";

let pdfjsLibPromise: Promise<typeof PdfjsLibType> | null = null;

/** Lazy-load pdfjs-dist and configure the worker — browser only. */
async function getPdfjs(): Promise<typeof PdfjsLibType> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      // Use workerPort with a module worker — more reliable than workerSrc
      // in Next.js/Turbopack which can mangle static URL worker loading.
      if (typeof window !== "undefined" && typeof Worker !== "undefined") {
        try {
          const worker = new Worker("/pdf.worker.min.mjs", { type: "module" });
          lib.GlobalWorkerOptions.workerPort = worker;
        } catch {
          // Fallback to workerSrc if Worker constructor fails
          lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }
      } else {
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export type PdfDocument = Awaited<ReturnType<typeof PdfjsLibType["getDocument"]>["promise"]>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

/**
 * Load a PDF document from a URL.
 *
 * Uses a two-tier strategy to avoid CORS errors:
 *
 *  1. **Proxy route** (primary): Fetches the PDF through the Next.js server
 *     route `/api/pdf-proxy?url=...`. The server fetches the file — no
 *     browser cross-origin restrictions. This always works regardless of
 *     the upstream server's CORS headers.
 *
 *  2. **Direct fetch** (fallback): If the proxy fails (e.g. server-side
 *     network issue), tries a plain `fetch(url)` without credentials.
 *     This works if the upstream server has permissive CORS headers.
 *
 * Images don't have this problem because `<img src>` doesn't trigger CORS,
 * but `fetch()` does — which is why only PDFs were affected.
 */
export async function loadPdf(url: string): Promise<PdfDocument> {
  const pdfjs = await getPdfjs();
  const data = await fetchPdfData(url);
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

/**
 * Resolve a media URL to an absolute http(s) URL.
 *
 * Media URLs from the API can be:
 *  - Full URLs:      `https://apilx.optigoapps.com/uploads/file.pdf`
 *  - Protocol-relative: `//apilx.optigoapps.com/uploads/file.pdf`
 *  - Relative paths: `/uploads/file.pdf`  or  `uploads/file.pdf`
 *  - Blob URLs:      `blob:http://localhost:6026/...` (optimistic messages)
 *
 * Images work with any of these because `<img src>` resolves them
 * automatically.  But `fetch()` + the proxy need an absolute URL.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;

  // Blob URLs — same-origin, fetch directly (no proxy needed)
  if (url.startsWith("blob:")) return url;

  // Data URLs — inline, fetch directly
  if (url.startsWith("data:")) return url;

  // Already absolute http(s) URL
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Protocol-relative: //host/path → https://host/path
  if (url.startsWith("//")) return `https:${url}`;

  // Relative path — resolve against the API base URL.
  // The API base is like `http://newnextjs.web/api` or `https://apilx.optigoapps.com/api`.
  // We need the origin (without `/api`).
  if (typeof window !== "undefined") {
    // Check if it's a same-origin relative path (starts with /)
    // For cross-origin relative paths, we need the API origin.
    // The API base URL is derived from Config.ts logic:
    //   local:  process.env.NEXT_PUBLIC_API_URL_LOCAL  (fallback http://newnextjs.web/api)
    //   prod:   process.env.NEXT_PUBLIC_API_URL_PROD   (fallback https://apilx.optigoapps.com/api)
    const localHosts = (process.env.NEXT_PUBLIC_LOCAL_HOSTS || "localhost,nzen,tecochat.web,web")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    const isLocal = localHosts.includes(window.location.hostname);
    const apiBase = isLocal
      ? (process.env.NEXT_PUBLIC_API_URL_LOCAL || "http://newnextjs.web/api")
      : (process.env.NEXT_PUBLIC_API_URL_PROD || "https://apilx.optigoapps.com/api");

    try {
      const apiOrigin = new URL(apiBase).origin;
      // If url starts with /, append to origin; otherwise append with /
      return url.startsWith("/") ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`;
    } catch {
      // Fallback: resolve against current page origin
      return new URL(url, window.location.origin).href;
    }
  }

  return url;
}

/**
 * Fetch PDF bytes — tries the proxy route first, then direct fetch.
 * Returns an ArrayBuffer on success, throws on failure.
 */
async function fetchPdfData(url: string): Promise<ArrayBuffer> {
  const resolvedUrl = resolveMediaUrl(url);
  console.log("[pdfUtils] Loading PDF:", { original: url, resolved: resolvedUrl });

  // Blob/data URLs — fetch directly (same-origin, no CORS issue)
  if (resolvedUrl.startsWith("blob:") || resolvedUrl.startsWith("data:")) {
    const res = await fetch(resolvedUrl);
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    return await res.arrayBuffer();
  }

  // ── Tier 1: Server-side proxy (no CORS) ────────────────────────────────
  try {
    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(resolvedUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      console.log("[pdfUtils] Proxy fetch OK, size:", (await res.clone().arrayBuffer()).byteLength);
      return await res.arrayBuffer();
    }
    const errText = await res.text().catch(() => "");
    console.warn(`[pdfUtils] Proxy returned ${res.status}: ${errText}, trying direct fetch`);
  } catch (err) {
    console.warn("[pdfUtils] Proxy fetch failed, trying direct fetch:", err);
  }

  // ── Tier 2: Direct fetch without credentials ───────────────────────────
  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
}

/**
 * Render a single PDF page to a canvas element.
 *
 * @param page        — the pdfjs page proxy
 * @param canvas      — target canvas element
 * @param targetWidth — desired CSS width in px (height is auto from aspect ratio)
 * @returns the render task (has `.cancel()`) and a promise that resolves with dimensions
 */
export function renderPageToCanvas(
  page: PdfPage,
  canvas: HTMLCanvasElement,
  targetWidth: number
): { promise: Promise<{ width: number; height: number }>; cancel: () => void } {
  const viewport0 = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport0.width;
  const viewport = page.getViewport({ scale });

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderTask = page.render({ canvas, viewport });

  const promise = renderTask.promise.then(() => ({
    width: viewport.width,
    height: viewport.height,
  }));

  return {
    promise,
    cancel: () => {
      try {
        renderTask.cancel();
      } catch {
        // Ignore cancel errors
      }
    },
  };
}
