import { NextRequest, NextResponse } from "next/server";

// ── PDF Proxy Route ───────────────────────────────────────────────────────────
// Fetches a PDF from a remote URL server-side and streams it back to the
// browser. This avoids CORS errors because the fetch happens on the Next.js
// server (no browser cross-origin restrictions).
//
// Usage:  GET /api/pdf-proxy?url=<encoded-pdf-url>
//
// The route:
//   1. Validates the `url` query param is present and is an http(s) URL.
//   2. Fetches the PDF from the server (with redirect follow).
//   3. Streams the response body back with `application/pdf` content-type
//      and permissive CORS headers.
//   4. Returns 400/500 on error.

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  // ── Resolve the URL to an absolute http(s) URL ────────────────────────
  // The client should already resolve relative URLs, but handle them here
  // as a safety net.  Relative paths are resolved against the API base URL
  // (from env vars, same logic as src/API/InitialApi/Config.ts).
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
    // Fetch the PDF server-side — no CORS restrictions here
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        // Forward a generic user-agent so the server doesn't block us
        "User-Agent": "TecoChat-PDFProxy/1.0",
        Accept: "application/pdf,*/*",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    // Stream the body back to the client
    const contentType =
      upstream.headers.get("content-type") || "application/pdf";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    });

    // content-length if the upstream provided it
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
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
