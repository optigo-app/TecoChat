"use client";

import type * as PdfjsLibType from "pdfjs-dist";

let pdfjsLibPromise: Promise<typeof PdfjsLibType> | null = null;

async function getPdfjs(): Promise<typeof PdfjsLibType> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist").then((lib) => {
      if (typeof window !== "undefined") {
        lib.GlobalWorkerOptions.workerSrc = "/lib/pdf.worker.min.mjs";
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export type PdfDocument = Awaited<ReturnType<typeof PdfjsLibType["getDocument"]>["promise"]>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

export async function loadPdf(url: string): Promise<PdfDocument> {
  const pdfjs = await getPdfjs();
  const data = await fetchPdfData(url);
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

export function resolveMediaUrl(url: string): string {
  if (!url) return url;

  if (url.startsWith("blob:")) return url;

  if (url.startsWith("data:")) return url;

  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  if (url.startsWith("//")) return `https:${url}`;
  if (typeof window !== "undefined") {
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
      return url.startsWith("/") ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`;
    } catch {
      return new URL(url, window.location.origin).href;
    }
  }
  return url;
}

async function fetchPdfData(url: string): Promise<ArrayBuffer> {
  const resolvedUrl = resolveMediaUrl(url);
  console.log("[pdfUtils] Loading PDF:", { original: url, resolved: resolvedUrl });

  if (resolvedUrl.startsWith("blob:") || resolvedUrl.startsWith("data:")) {
    const res = await fetch(resolvedUrl);
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    return await res.arrayBuffer();
  }

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

  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
}

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
