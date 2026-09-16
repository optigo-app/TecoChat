// ── useSafeLink.ts ───────────────────────────────────────────────────────────
// React hook that inspects a URL before opening it. If the URL is suspicious,
// it shows the existing ConfirmationDialog so the user can confirm or cancel.

"use client";

import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { inspectUrl, type UrlInspectionResult } from "../utils/urlSecurity";
import { getConfirmProps } from "./confirmConfig";

interface SafeLinkDialogState {
  isOpen: boolean;
  inspection: UrlInspectionResult | null;
  title: string;
  description: string;
  confirmText: string;
}

const INITIAL_DIALOG: SafeLinkDialogState = {
  isOpen: false,
  inspection: null,
  title: "",
  description: "",
  confirmText: "",
};

export function useSafeLink() {
  const [dialog, setDialog] = useState<SafeLinkDialogState>(INITIAL_DIALOG);
  const [isConfirming, setIsConfirming] = useState(false);

  const close = useCallback(() => {
    setDialog(INITIAL_DIALOG);
    setIsConfirming(false);
  }, []);

  const openLinkSafely = useCallback(
    (rawUrl: string) => {
      const result = inspectUrl(rawUrl);

      if (result.safe) {
        window.open(result.href, "_blank", "noopener,noreferrer");
        return;
      }

      const config = getConfirmProps("suspiciousLink");
      const description = (config.description ?? "{n}").replaceAll(
        "{n}",
        result.reasons.map((r) => `• ${r}`).join("\n")
      );

      setDialog({
        isOpen: true,
        inspection: result,
        title: config.title || "This link may be unsafe",
        description,
        confirmText: config.confirmText || "Open Anyway",
      });
    },
    []
  );

  const confirm = useCallback(() => {
    if (!dialog.inspection || isConfirming) return;
    setIsConfirming(true);
    window.open(dialog.inspection.href, "_blank", "noopener,noreferrer");
    setDialog(INITIAL_DIALOG);
    setIsConfirming(false);
  }, [dialog.inspection, isConfirming]);

  return {
    linkDialog: {
      isOpen: dialog.isOpen,
      close,
      confirm,
      title: dialog.title,
      description: dialog.description,
      confirmText: dialog.confirmText,
      loading: isConfirming,
      icon: <AlertTriangle />,
      variant: "danger" as const,
    },
    openLinkSafely,
  };
}
