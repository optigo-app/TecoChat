import { NextRequest, NextResponse } from "next/server";

// ── Link Preview API Route ───────────────────────────────────────────────────
// Fetches OpenGraph / Twitter / fallback metadata for a URL server-side.
// This avoids CORS restrictions since the fetch happens on the Next.js server.
//
// Usage:  GET /api/link-preview?url=<encoded-url>
//
// Returns JSON: { url, title, description, image, siteName }
//   - Parses og:* tags first, then twitter:* tags, then <title>/<meta description>
//   - Limits response body to 500KB to avoid downloading huge pages
//   - 5s timeout to prevent slow pages from blocking

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB — some sites (YouTube) have og: tags 700KB+ into the HTML
const FETCH_TIMEOUT_MS = 5000;

function extractMetaTag(html: string, patterns: string[]): string {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "i");
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1]
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
    }
  }
  return "";
}

function extractAllMetaTags(
  html: string,
  propertyNames: string[]
): string {
  for (const name of propertyNames) {
    // <meta property="og:title" content="...">
    // <meta name="twitter:title" content="...">
    // <meta name="description" content="...">
    const patterns = [
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
    ];
    const value = extractMetaTag(html, patterns);
    if (value) return value;
  }
  return "";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  // Resolve to absolute http(s) URL
  let resolvedUrl = url;
  if (resolvedUrl.startsWith("//")) {
    resolvedUrl = `https:${resolvedUrl}`;
  }
  if (!resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
    resolvedUrl = `https://${resolvedUrl}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(resolvedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!parsedUrl.protocol.startsWith("http")) {
    return NextResponse.json(
      { error: "Only http(s) URLs are allowed" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TecoChat-LinkPreview/1.0; +https://tecochat.app)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    // Read up to MAX_BODY_BYTES — we only need the <head> section
    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "Failed to read response body" },
        { status: 502 }
      );
    }

    let html = "";
    let totalBytes = 0;
    let headClosed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      html += new TextDecoder().decode(value, { stream: true });

      // Stop early once we have the full <head>
      if (/<\/head>/i.test(html)) {
        headClosed = true;
        break;
      }

      if (totalBytes >= MAX_BODY_BYTES) break;
    }

    // If we didn't find </head>, try to extract just the head portion
    if (!headClosed) {
      const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        html = headMatch[0];
      }
    }

    // Extract metadata in priority order
    const title =
      extractAllMetaTags(html, ["og:title", "twitter:title"]) ||
      extractMetaTag(html, ["<title[^>]*>([^<]*)</title>"]);

    const description = extractAllMetaTags(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);

    const image =
      extractAllMetaTags(html, ["og:image", "twitter:image", "og:image:secure_url"]) ||
      "";

    const siteName =
      extractAllMetaTags(html, ["og:site_name", "application:name"]) ||
      parsedUrl.hostname.replace(/^www\./, "");

    // If no title and no description, the page has no useful metadata
    if (!title && !description) {
      return NextResponse.json(
        { error: "No metadata found" },
        { status: 404 }
      );
    }

    // Resolve relative image URLs
    let resolvedImage = image;
    if (image && !image.startsWith("http") && !image.startsWith("data:")) {
      try {
        resolvedImage = new URL(image, parsedUrl.origin).href;
      } catch {
        resolvedImage = "";
      }
    }

    const data: LinkPreviewData = {
      url: parsedUrl.href,
      title: title || "",
      description: description || "",
      image: resolvedImage,
      siteName: siteName || parsedUrl.hostname.replace(/^www\./, ""),
    };

    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400", // 24h
      },
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 }
      );
    }
    console.error("[link-preview] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch URL" },
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
