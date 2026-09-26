import { SHA1 } from "crypto-js";
import Hex from "crypto-js/enc-hex";
import { downloadFileApi } from "../API/FileUpload/fileDownloadApi";

// ── Avatar helpers ───────────────────────────────────────────────────────────

const hashString = (value: string): number => {
  const str = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getInitials = (name: string): string => {
  const cleaned = String(name ?? "").trim();
  if (!cleaned) return "?";
  const numeric = cleaned.replace(/\D/g, "");
  if (numeric && numeric.length >= 2) return numeric.slice(-2);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export const getSoftAvatarColors = (seed: string): { bg: string; fg: string; fgDark: string } => {
  const h = hashString(seed) % 360;
  const s = 45 + (hashString(`${seed}-s`) % 11);
  const l = 86 + (hashString(`${seed}-l`) % 8);
  const fgS = Math.min(72, s + 18);
  const fgL = 26 + (hashString(`${seed}-fg`) % 10);
  // Dark-mode fg: higher lightness (55-65%) so it's visible on dark backgrounds
  const fgDarkL = 55 + (hashString(`${seed}-fgd`) % 11);
  return {
    bg: `hsl(${h}, ${s}%, ${l}%)`,
    fg: `hsl(${h}, ${fgS}%, ${fgL}%)`,
    fgDark: `hsl(${h}, ${fgS}%, ${fgDarkL}%)`,
  };
};

export interface AvatarConfig {
  sx: {
    bgcolor: string;
    color: string;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: number;
  };
  children: string;
}

export const getWhatsAppAvatarConfig = (name: string, size = 40): AvatarConfig => {
  const cleaned = String(name ?? "").trim();
  const { bg, fg } = getSoftAvatarColors(cleaned || "unknown");
  return {
    sx: {
      bgcolor: bg,
      color: fg,
      width: size,
      height: size,
      fontSize: Math.max(14, Math.round(size * 0.4)),
      fontWeight: 600,
    },
    children: getInitials(cleaned),
  };
};

// ── Customer / conversation display helpers ──────────────────────────────────

interface CustomerLike {
  MemberName?: string;
  ConversationName?: string;
  name?: string;
  UserName?: string;
  CustomerName?: string;
  Name?: string;
  SenderInfo?: string;
  FirstName?: string;
  LastName?: string;
  UserEmail?: string;
  SenderEmail?: string;
  [key: string]: unknown;
}

export const hasCustomerName = (customer: CustomerLike | null | undefined): boolean => {
  if (!customer) return false;
  const name = (
    customer.MemberName ??
    customer.ConversationName ??
    customer.name ??
    customer.UserName ??
    customer.CustomerName ??
    customer.Name ??
    customer.SenderInfo ??
    (customer.FirstName || customer.LastName
      ? `${customer.FirstName || ""} ${customer.LastName || ""}`.trim()
      : null)
  ) ?? "";
  return Boolean(String(name ?? "").trim());
};

export const getCustomerDisplayName = (customer: CustomerLike | null | undefined): string => {
  if (!customer) return "Unknown";
  const name = String(
    customer.MemberName ??
    customer.ConversationName ??
    customer.name ??
    customer.UserName ??
    customer.CustomerName ??
    customer.Name ??
    customer.SenderInfo ??
    (customer.FirstName || customer.LastName
      ? `${customer.FirstName || ""} ${customer.LastName || ""}`.trim()
      : "")
  ).trim();
  if (name) return name;

  const email = String(customer.UserEmail ?? customer.SenderEmail ?? "").trim();
  if (email) return email;

  return "Unknown";
};

export const getCustomerAvatarSeed = (customer: CustomerLike | null | undefined): string => {
  if (!customer) return "Unknown";
  const name = String(
    customer.MemberName ??
    customer.ConversationName ??
    customer.name ??
    customer.UserName ??
    customer.CustomerName ??
    customer.Name ??
    customer.SenderInfo ??
    (customer.FirstName || customer.LastName
      ? `${customer.FirstName || ""} ${customer.LastName || ""}`.trim()
      : "")
  ).trim();
  if (name) return name;

  const email = String(customer.UserEmail ?? customer.SenderEmail ?? "").trim();
  if (email) return email;

  return "Unknown";
};

// ── Dead image cache (prevents flicker from stale 404 URLs) ──────────────────

const deadImageCache = new Set<string>();

export const markImageAsDead = (url: string): void => {
  if (!url || typeof url !== "string") return;
  deadImageCache.add(url);
};

export const isImageDead = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  return deadImageCache.has(url);
};

// ── Password hashing ─────────────────────────────────────────────────────────

// convert password to sha1 (HTTP + HTTPS safe)
export function passwordToSha1(password: string | null | undefined): string {
  if (password === null || password === undefined) return "";
  return SHA1(password.toString()).toString(Hex);
}

// for public ip address
let cachedIpAddress: string | null = null;

export const getClientIpAddress = async (): Promise<string> => {
  try {
    if (typeof window === "undefined") return "";

    if (cachedIpAddress) return cachedIpAddress;

    const sessionStorageIp = sessionStorage.getItem("clientIpAddress");
    if (sessionStorageIp) {
      cachedIpAddress = sessionStorageIp;
      return sessionStorageIp;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    const ip = data?.ip || "";

    cachedIpAddress = ip;
    sessionStorage.setItem("clientIpAddress", ip);
    return ip;
  } catch (error) {
    console.error("Error fetching IP address:", error);
    return "";
  }
};

export const normalizeMessageText = (text: string | null | undefined): string => {
  if (!text || typeof text !== "string") return text || "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\([\\*_[\]()~`>#+\-=|.!])/g, "$1");
};

export const stripMarkdownFormatting = (text: string | null | undefined): string => {
  if (!text || typeof text !== "string") return text || "";

  // Same capture order as messageTextRenderer: longest/most-specific first.
  const regex =
    /(```[\s\S]*?```|`[^`]+`|\*\*\*\S(?:.*?\S)?\*\*\*|\*\*\S(?:.*?\S)?\*\*|\*_\S(?:.*?\S)?_\*|___\S(?:.*?\S)?___|__\S(?:.*?\S)?__|_\*\S(?:.*?\S)?\*_|\*\S(?:.*?\S)?\*|_\S(?:.*?\S)?_|~~\S(?:.*?\S)?~~|~\S(?:.*?\S)?~|\[[^\]]+\]\([^)]+\))/g;

  return text
    .split(regex)
    .map((part) => {
      if (!part) return "";

      // Code blocks / inline code — keep literal content only
      if (part.startsWith("```") && part.endsWith("```")) {
        return part.slice(3, -3);
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return part.slice(1, -1);
      }

      // Links — show link text only
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) return linkMatch[1];

      // Nested/recursive inline formatting
      if (part.startsWith("***") && part.endsWith("***")) {
        return stripMarkdownFormatting(part.slice(3, -3));
      }
      if (part.startsWith("___") && part.endsWith("___")) {
        return stripMarkdownFormatting(part.slice(3, -3));
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return stripMarkdownFormatting(part.slice(2, -2));
      }
      if (part.startsWith("__") && part.endsWith("__")) {
        return stripMarkdownFormatting(part.slice(2, -2));
      }
      if (part.startsWith("*_") && part.endsWith("_*")) {
        return stripMarkdownFormatting(part.slice(2, -2));
      }
      if (part.startsWith("_\*") && part.endsWith("*_")) {
        return stripMarkdownFormatting(part.slice(2, -2));
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return stripMarkdownFormatting(part.slice(1, -1));
      }
      if (part.startsWith("_") && part.endsWith("_")) {
        return stripMarkdownFormatting(part.slice(1, -1));
      }
      if (part.startsWith("~~") && part.endsWith("~~")) {
        return stripMarkdownFormatting(part.slice(2, -2));
      }
      if (part.startsWith("~") && part.endsWith("~")) {
        return stripMarkdownFormatting(part.slice(1, -1));
      }

      return part;
    })
    .join("");
};

export const isMessageEditable = (message: { Date?: string; Time?: string; DateTime?: string } | null | undefined, timeLimit = 15): boolean => {
  if (!message) return false;
  const sentTime = message.DateTime
    ? new Date(message.DateTime).getTime()
    : message.Date && message.Time
      ? new Date(`${message.Date} ${message.Time}`).getTime()
      : NaN;
  if (isNaN(sentTime)) return false;
  const currentTime = Date.now();
  const diffInMinutes = (currentTime - sentTime) / (1000 * 60);
  return diffInMinutes <= timeLimit;
};

const DOWNLOAD_ZIP_THRESHOLD = 4;

interface DownloadMessage {
  mediaItems?: Array<{ url?: string; filename?: string; name?: string }>;
  FileUrl?: string;
  src?: string;
  FileName?: string;
  name?: string;
}

interface DownloadOptions {
  isRecursive?: boolean;
}

export const handleDownloadFile = async (
  fileUrlOrMessage: string | DownloadMessage | null | undefined,
  filename: string | null | undefined,
  options: DownloadOptions = {}
): Promise<{ success: boolean; filename?: string; error?: string; fallback?: boolean }> => {
  // ── Object (message) with possible multiple mediaItems → zip if needed ──
  if (
    typeof fileUrlOrMessage === "object" &&
    fileUrlOrMessage !== null &&
    !options?.isRecursive
  ) {
    const msg = fileUrlOrMessage;
    const mediaItems = Array.isArray(msg?.mediaItems) ? msg.mediaItems : [];

    // Single media item or legacy single-URL message → direct download
    if (
      mediaItems.length === 1 ||
      (!mediaItems.length && (msg.FileUrl || msg.src))
    ) {
      const url = mediaItems[0]?.url || msg.FileUrl || msg.src;
      const name = mediaItems[0]?.filename || msg.FileName || msg.name || filename;
      return handleDownloadFile(url, name, { ...options, isRecursive: true });
    }

    // ≤4 items → download each file individually
    if (mediaItems.length > 1 && mediaItems.length <= DOWNLOAD_ZIP_THRESHOLD) {
      const results: Array<{ success: boolean; filename?: string }> = [];
      for (const item of mediaItems) {
        if (item.url) {
          const r = await handleDownloadFile(item.url, item.filename || item.name, {
            ...options,
            isRecursive: true,
          });
          results.push(r);
        }
      }
      return { success: results.some((r) => r.success), filename: undefined };
    }

    // >4 items → zip them into a single .zip download
    if (mediaItems.length > DOWNLOAD_ZIP_THRESHOLD) {
      try {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        const timestamp = Date.now();
        const zipFileName = `attachments_${timestamp}.zip`;

        await Promise.all(
          mediaItems.map(async (item, idx) => {
            try {
              const url = item.url;
              if (!url) return;
              const name =
                item.filename ||
                item.name ||
                `file_${idx + 1}${getFileExt(url) ? "." + getFileExt(url) : ""}`;
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                zip.file(name, blob);
              } catch (err) {
                console.warn("CORS or Download blocked for:", url, err);
              }
            } catch (err) {
              console.error(`Failed to add item ${idx} to ZIP:`, err);
            }
          })
        );

        const content = await zip.generateAsync({ type: "blob" });
        const zipUrl = window.URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = zipFileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(zipUrl);
        return { success: true, filename: zipFileName };
      } catch (error) {
        console.error("Bulk download ZIP creation failed:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  }

  // ── String URL → single file download ──────────────────────────────────
  const fileUrl =
    typeof fileUrlOrMessage === "string"
      ? fileUrlOrMessage
      : (fileUrlOrMessage as DownloadMessage | null)?.FileUrl ||
        (fileUrlOrMessage as DownloadMessage | null)?.src;

  if (!fileUrl) return { success: false, error: "No URL provided" };

  let resolvedFileUrl = fileUrl;

  // Generate filename with timestamp (matches old code)
  const timestamp = Date.now();
  let finalFilename: string;
  if (!filename) {
    const extensionMatch = fileUrl.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
    const extension = extensionMatch?.[1] || "jpg";
    finalFilename = `generated-${timestamp}.${extension}`;
  } else {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0) {
      const nameWithoutExt = filename.substring(0, lastDotIndex);
      const ext = filename.substring(lastDotIndex);
      finalFilename = `${nameWithoutExt}_${timestamp}${ext}`;
    } else {
      finalFilename = `${filename}_${timestamp}`;
    }
  }

  // Try download API first (can return a resolved file URL)
  try {
    const apiResponse = await downloadFileApi({ fileUrl, fileName: finalFilename });
    const apiData = apiResponse?.data;
    const apiResolvedUrl =
      apiData?.Data?.rd?.[0]?.FileUrl ||
      apiData?.Data?.rd?.[0]?.fileUrl ||
      apiData?.Data?.rd?.[0]?.Url ||
      apiData?.Data?.rd?.[0]?.url ||
      apiData?.FileUrl ||
      apiData?.fileUrl ||
      apiData?.Url ||
      apiData?.url;
    if (apiResolvedUrl) {
      resolvedFileUrl = apiResolvedUrl;
    }
  } catch (apiError) {
    console.warn("downloadFileApi failed, falling back to direct URL download:", apiError);
  }

  // Try fetch blob first
  try {
    const response = await fetch(resolvedFileUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = finalFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return { success: true, filename: finalFilename };
  } catch {
    // Fallback to direct anchor download
    try {
      const anchor = document.createElement("a");
      anchor.href = resolvedFileUrl;
      anchor.download = finalFilename;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return { success: true, filename: finalFilename, fallback: true };
    } catch (fallbackError) {
      console.error("Fallback download failed:", fallbackError);
      return { success: false, error: (fallbackError as Error).message };
    }
  }
};

// ── Document metadata helper ─────────────────────────────────────────────────

export const getFileExt = (filename: string): string => {
  const parts = String(filename || "").split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
};

interface DocumentMeta {
  iconName: string;
  label: string;
  tone: string;
  iconUrl?: string;
}

const DOC_ICON_MAP: Record<string, DocumentMeta> = {
  pdf: { iconName: "FileText", label: "PDF", tone: "pdf", iconUrl: "/icons/filetypes/pdf.png" },
  doc: { iconName: "FileText", label: "DOCS", tone: "doc", iconUrl: "/icons/filetypes/doc.png" },
  docx: { iconName: "FileText", label: "DOCS", tone: "doc", iconUrl: "/icons/filetypes/doc.png" },
  dcs: { iconName: "FileText", label: "DOCS", tone: "doc", iconUrl: "/icons/filetypes/doc.png" },
  rtf: { iconName: "FileText", label: "DOCS", tone: "doc", iconUrl: "/icons/filetypes/doc.png" },
  txt: { iconName: "FileText", label: "TEXT", tone: "default", iconUrl: "/icons/filetypes/txt.png" },
  log: { iconName: "FileText", label: "TEXT", tone: "default", iconUrl: "/icons/filetypes/txt.png" },
  md: { iconName: "FileText", label: "TEXT", tone: "default", iconUrl: "/icons/filetypes/txt.png" },
  xls: { iconName: "FileSpreadsheet", label: "EXCEL", tone: "sheet", iconUrl: "/icons/filetypes/xls.png" },
  xlsx: { iconName: "FileSpreadsheet", label: "EXCEL", tone: "sheet", iconUrl: "/icons/filetypes/xls.png" },
  csv: { iconName: "FileSpreadsheet", label: "EXCEL", tone: "sheet", iconUrl: "/icons/filetypes/xls.png" },
  ppt: { iconName: "FileType", label: "PPT", tone: "ppt", iconUrl: "/icons/filetypes/ppt.png" },
  pptx: { iconName: "FileType", label: "PPT", tone: "ppt", iconUrl: "/icons/filetypes/ppt.png" },
  zip: { iconName: "FileArchive", label: "ZIP", tone: "archive", iconUrl: "/icons/filetypes/zip.png" },
  rar: { iconName: "FileArchive", label: "RAR", tone: "archive", iconUrl: "/icons/filetypes/rar.png" },
  "7z": { iconName: "FileArchive", label: "7Z", tone: "archive", iconUrl: "/icons/filetypes/7z.png" },
  psd: { iconName: "FileType", label: "PSD", tone: "psd", iconUrl: "/icons/filetypes/psd-file.png" },
  apk: { iconName: "Smartphone", label: "APK", tone: "apk", iconUrl: "/icons/filetypes/apk.png" },
  js: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/java-script.png" },
  ts: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/java-script.png" },
  jsx: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/java-script.png" },
  tsx: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/java-script.png" },
  json: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/json-file.webp" },
  xml: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/xml.png" },
  html: { iconName: "FileCode", label: "HTML", tone: "code", iconUrl: "/icons/filetypes/html.png" },
  htm: { iconName: "FileCode", label: "HTML", tone: "code", iconUrl: "/icons/filetypes/html.png" },
  css: { iconName: "FileCode", label: "CODE", tone: "code", iconUrl: "/icons/filetypes/css-3.png" },
  py: { iconName: "FileCode", label: "PYTHON", tone: "code", iconUrl: "/icons/filetypes/python.png" },
  sql: { iconName: "FileCode", label: "DATABASE", tone: "code", iconUrl: "/icons/filetypes/database.png" },
  svg: { iconName: "FileImage", label: "SVG", tone: "image", iconUrl: "/icons/filetypes/svg.png" },
  eps: { iconName: "FileImage", label: "SVG", tone: "image", iconUrl: "/icons/filetypes/svg.png" },
  mp3: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  wav: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  ogg: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  m4a: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  flac: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  aac: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  wma: { iconName: "FileAudio", label: "AUDIO", tone: "audio", iconUrl: "/icons/filetypes/audio.png" },
  mp4: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  mov: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  avi: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  mkv: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  flv: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  wmv: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  m4v: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
  webm: { iconName: "FileVideo", label: "VIDEO", tone: "video", iconUrl: "/icons/filetypes/video.png" },
};

export const getDocumentMeta = (filename: string): DocumentMeta => {
  const ext = getFileExt(filename);
  return DOC_ICON_MAP[ext] || { iconName: "File", label: ext.toUpperCase() || "FILE", tone: "default", iconUrl: "/icons/filetypes/doc.png" };
};

// ── Image compression ────────────────────────────────────────────────────────

interface CompressedImageResult {
  id: string;
  originalName: string;
  originalSize: number;
  compressedName: string;
  compressedSize: number;
  blob: Blob;
  previewUrl: string;
}

// ── Media folder name generator (ported from old globalFunc.js) ──────────────

export const generateMediaFolderName = (
  conversationId: string | number | null | undefined,
  category = "docs"
): string => {
  const sanitizeSegment = (value: string) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return raw
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .join("_")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
  };

  const conv = sanitizeSegment(String(conversationId ?? "unknown"));
  const cat = sanitizeSegment(category || "docs") || "docs";
  return `tecochat/conv_${conv}/${cat}`;
};

export async function compressImagesToWebP(
  files: File | File[],
  customOptions: Record<string, unknown> = {}
): Promise<CompressedImageResult[]> {
  const inputFiles = Array.isArray(files) ? files : [files];

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
    ...customOptions,
  };

  const results: CompressedImageResult[] = [];

  const { default: imageCompression } = await import("browser-image-compression");

  for (const file of inputFiles) {
    if (!file?.type?.startsWith("image/")) continue;

    const compressedFile = await imageCompression(file, options as any);

    results.push({
      id: `${file.name}-${Date.now()}`,
      originalName: file.name,
      originalSize: file.size,
      compressedName: file.name.replace(/\.[^/.]+$/, "") + ".webp",
      compressedSize: compressedFile.size,
      blob: compressedFile,
      previewUrl: URL.createObjectURL(compressedFile),
    });
  }

  return results;
}

