import { NextRequest, NextResponse } from "next/server";

// ── PDF Proxy Route ───────────────────────────────────────────────────────────
const MAX_CACHEABLE_BYTES = 50 * 1024 * 1024; // 50MB per file
const CACHE_MAX_BYTES = 256 * 1024 * 1024; // 256MB total across all entries
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 30_000;

interface CacheEntry {
  data: ArrayBuffer;
  contentType: string;
  contentLength: string | null;
  expiresAt: number;
  bytes: number;
}

const pdfCache = new Map<string, CacheEntry>();
let cacheBytes = 0;

// Deduplicates concurrent requests for the same URL — concurrent viewers share
// a single upstream fetch instead of each triggering their own.
const inflight = new Map<string, Promise<CacheEntry>>();

class UpstreamError extends Error {
  status: number;
  constructor(status: number) {
    super(`Upstream returned ${status}`);
    this.status = status;
  }
}

function cachePut(url: string, entry: CacheEntry) {
  // Evict oldest entries until the new one fits (Map preserves insertion order).
  while (cacheBytes + entry.bytes > CACHE_MAX_BYTES && pdfCache.size > 0) {
    const oldestKey = pdfCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = pdfCache.get(oldestKey);
    pdfCache.delete(oldestKey);
    if (oldest) cacheBytes -= oldest.bytes;
  }
  pdfCache.set(url, entry);
  cacheBytes += entry.bytes;
}

async function loadPdf(url: string): Promise<CacheEntry> {
  const now = Date.now();
  const hit = pdfCache.get(url);
  if (hit) {
    if (hit.expiresAt > now) {
      // LRU touch — refresh insertion order so hot files survive eviction.
      pdfCache.delete(url);
      pdfCache.set(url, hit);
      return hit;
    }
    pdfCache.delete(url);
    cacheBytes -= hit.bytes;
  }

  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async (): Promise<CacheEntry> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const upstream = await fetch(url, {
        headers: {
          // Forward a generic user-agent so the server doesn't block us
          "User-Agent": "TecoChat-PDFProxy/1.0",
          Accept: "application/pdf,*/*",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!upstream.ok) {
        throw new UpstreamError(upstream.status);
      }

      const contentType =
        upstream.headers.get("content-type") || "application/pdf";
      const contentLength = upstream.headers.get("content-length");
      // Buffer once so the payload can be served to all subsequent clients
      // from memory instead of re-fetching upstream.
      const data = await upstream.arrayBuffer();

      const entry: CacheEntry = {
        data,
        contentType,
        contentLength,
        expiresAt: now + CACHE_TTL_MS,
        bytes: data.byteLength,
      };
      if (data.byteLength <= MAX_CACHEABLE_BYTES) {
        cachePut(url, entry);
      }
      return entry;
    } finally {
      clearTimeout(timeout);
    }
  })();

  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  // ── Resolve the URL to an absolute http(s) URL ────────────────────────
  let resolvedUrl = url;

  // Protocol-relative: //host/path → https://host/path
  if (resolvedUrl.startsWith("//")) {
    resolvedUrl = `https:${resolvedUrl}`;
  }

  // Relative path → resolve against API base URL
  if (!resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL_PROD ||
      process.env.NEXT_PUBLIC_API_URL_LOCAL ||
      "https://apilx.optigoapps.com/api";
    try {
      const apiOrigin = new URL(apiBase).origin;
      resolvedUrl = resolvedUrl.startsWith("/")
        ? `${apiOrigin}${resolvedUrl}`
        : `${apiOrigin}/${resolvedUrl}`;
    } catch {
      return NextResponse.json(
        { error: `Cannot resolve relative URL: ${url}` },
        { status: 400 }
      );
    }
  }

  // Validate the resolved URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(resolvedUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL" },
      { status: 400 }
    );
  }

  if (!parsedUrl.protocol.startsWith("http")) {
    return NextResponse.json(
      { error: "Only http(s) URLs are allowed" },
      { status: 400 }
    );
  }

  try {
    const entry = await loadPdf(parsedUrl.toString());

    const responseHeaders = new Headers({
      "Content-Type": entry.contentType,
      "Access-Control-Allow-Origin": "*",
      // Media is immutable — safe to cache at CDN/browser level for a day.
      "Cache-Control": "public, max-age=86400, immutable",
    });

    if (entry.contentLength) {
      responseHeaders.set("Content-Length", entry.contentLength);
    }

    return new NextResponse(entry.data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if ((error as Error)?.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream request timed out" },
        { status: 504 }
      );
    }
    console.error("[pdf-proxy] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PDF" },
      { status: 502 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
