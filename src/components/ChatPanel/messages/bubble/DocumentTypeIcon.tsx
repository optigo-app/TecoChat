"use client";

import { useState, memo } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Smartphone,
  FileImage,
  FileVideo,
  FileAudio,
} from "lucide-react";
import { getDocumentMeta } from "../../../../utils/globalFunc";

// ─────────────────────────────────────────────────────────────────────────────
// DocumentTypeIcon — renders a file-type icon with automatic fallback.
//
// Tries the PNG icon from /icons/filetypes/*.png first (nicer, colored).
// If the PNG fails to load (e.g. offline, missing file, CDN down), falls
// back to the matching lucide-react SVG icon so the UI never shows a
// broken-image placeholder.
//
// Usage:
//   <DocumentTypeIcon filename="report.pdf" size={32} />
//   <DocumentTypeIcon filename="report.pdf" size={32} forceSvg />  // skip PNG
// ─────────────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>> = {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Smartphone,
  FileImage,
  FileVideo,
  FileAudio,
};

interface DocumentTypeIconProps {
  filename: string;
  size?: number;
  /** Skip the PNG attempt and always render the SVG icon. */
  forceSvg?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function DocumentTypeIconComponent({
  filename,
  size = 32,
  forceSvg = false,
  className,
  style,
}: DocumentTypeIconProps) {
  const meta = getDocumentMeta(filename);
  const [pngFailed, setPngFailed] = useState(false);
  const DocIcon = ICON_MAP[meta.iconName] || File;

  // Skip PNG if explicitly requested or if it already failed
  if (forceSvg || !meta.iconUrl || pngFailed) {
    return <DocIcon size={size} className={className} style={style} />;
  }

  return (
    <img
      src={meta.iconUrl}
      alt={meta.label}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
      onError={() => setPngFailed(true)}
    />
  );
}

export const DocumentTypeIcon = memo(DocumentTypeIconComponent);
export default DocumentTypeIcon;
