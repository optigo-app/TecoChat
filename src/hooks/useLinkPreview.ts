"use client";

import { useEffect, useRef, useState } from "react";
import type { LinkPreviewData } from "../types/message";

// ── useLinkPreview ───────────────────────────────────────────────────────────
// Detects the first URL in a text string, fetches its OpenGraph metadata via
// the /api/link-preview route, and returns the preview data.
//
// Features:
// - Debounced 500ms before fetching (avoids spam while typing)
// - In-memory cache (Map) — survives re-renders, shared across hook instances
// - sessionStorage cache — survives page reloads
// - Only fetches http(s) URLs
// - Smart URL boundary detection — text typed right after a URL (without a
//   space) is NOT included as part of the URL
// - Shows skeleton (loading=true, data=null) when URL changes and new data
//   is being fetched — old preview is cleared immediately on URL change

// URL regex — matches http(s):// or www. followed by valid URL characters.
// Stops at whitespace AND at characters that are unlikely to be part of a
// URL (e.g. CJK characters, curly quotes, etc.).
// Valid URL chars: letters, digits, - _ ~ . : / ? # @ ! $ & ' ( ) * + , ; = %
const URL_REGEX = /(?:https?:\/\/|www\.)[a-zA-Z0-9\-_~:\/?#@!$&'()*+,;=%.\[\]]+/i;

// Module-level cache — shared across all hook instances
const memoryCache = new Map<string, LinkPreviewData>();
const SESSION_KEY_PREFIX = "link-preview:";

function getSessionCache(url: string): LinkPreviewData | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${url}`);
    if (!raw) return null;
    return JSON.parse(raw) as LinkPreviewData;
  } catch {
    return null;
  }
}

function setSessionCache(url: string, data: LinkPreviewData): void {
  try {
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${url}`, JSON.stringify(data));
  } catch {
    // sessionStorage may be full — ignore
  }
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (!match) return null;
  let url = match[0];

  // Strip trailing punctuation that's commonly not part of the URL
  // e.g. "Check this: https://example.com." → strip the trailing "."
  url = url.replace(/[\)\]\}>,.!?:;'"`]+$/, "");

  // If the URL has unbalanced parentheses, strip the trailing ")"
  // e.g. "(see https://example.com)" → the regex grabs "https://example.com)"
  const openParens = (url.match(/\(/g) || []).length;
  const closeParens = (url.match(/\)/g) || []).length;
  if (closeParens > openParens) {
    url = url.replace(/\)+$/, "");
  }

  // Normalize www. → https://
  if (url.startsWith("www.")) url = `https://${url}`;

  // Only fetch http(s)
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  // Validate the URL is parseable — rejects malformed URLs
  try {
    new URL(url);
  } catch {
    return null;
  }

  return url;
}

export function useLinkPreview(text: string | null | undefined) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  // Track the current URL so we detect URL changes and clear old data
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = text ? extractFirstUrl(text) : null;

    // No URL — clear everything
    if (!url) {
      currentUrlRef.current = null;
      setData(null);
      setLoading(false);
      return;
    }

    // URL changed — clear old preview immediately so skeleton shows
    if (currentUrlRef.current !== url) {
      currentUrlRef.current = url;
      setData(null);
    }

    // Check in-memory cache first
    if (memoryCache.has(url)) {
      setData(memoryCache.get(url)!);
      setLoading(false);
      return;
    }

    // Check sessionStorage cache
    const sessionCached = getSessionCache(url);
    if (sessionCached) {
      memoryCache.set(url, sessionCached);
      setData(sessionCached);
      setLoading(false);
      return;
    }

    // Not cached — show skeleton while fetching
    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          setData(null);
          setLoading(false);
          return;
        }

        const json = (await res.json()) as LinkPreviewData;
        if (cancelled) return;

        // Cache in both memory and sessionStorage
        memoryCache.set(url, json);
        setSessionCache(url, json);
        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  return { data, loading };
}
