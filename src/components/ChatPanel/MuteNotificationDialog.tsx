"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { BellOff, Check, Loader2 } from "lucide-react";
import type { MuteDuration } from "../../API/ConversationMute/MuteConversationApi";

interface MuteNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (duration: MuteDuration) => Promise<void> | void;
  conversationName?: string;
  isGroup?: boolean;
  loading?: boolean;
}

const DURATION_OPTIONS: { value: MuteDuration; label: string; sublabel: string }[] = [
  { value: "8h", label: "8 hours", sublabel: "Mute for 8 hours" },
  { value: "1w", label: "1 week", sublabel: "Mute for 7 days" },
  { value: "always", label: "Always", sublabel: "Mute until you unmute" },
];

const MuteNotificationDialog = ({
  open,
  onClose,
  onConfirm,
  conversationName,
  isGroup = false,
  loading = false,
}: MuteNotificationDialogProps) => {
  const [selected, setSelected] = useState<MuteDuration>("8h");

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) setSelected("8h");
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = () => {
    if (loading) return;
    onClose();
  };

  const handleConfirm = () => {
    if (loading) return;
    onConfirm(selected);
  };

  const title = conversationName
    ? `Mute ${isGroup ? "group" : "chat"} notifications`
    : "Mute notifications";

  return createPortal(
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-wa-overlay-bg)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "var(--font-family)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-wa-modal-bg)",
          color: "var(--color-wa-modal-text)",
          fontFamily: "var(--font-family)",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "380px",
          padding: "28px 24px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-primary-light)",
              color: "var(--color-primary)",
            }}
          >
            <BellOff size={26} />
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              textAlign: "center",
              color: "var(--color-wa-modal-text)",
              fontFamily: "var(--font-family)",
            }}
          >
            {title}
          </h2>
          {conversationName && (
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "var(--color-wa-text-secondary)",
                textAlign: "center",
                fontFamily: "var(--font-family)",
              }}
            >
              {conversationName}
            </p>
          )}
        </div>

        {/* Duration options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {DURATION_OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !loading && setSelected(opt.value)}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: `2px solid ${isSelected ? "var(--color-primary)" : "transparent"}`,
                  background: isSelected
                    ? "var(--color-primary-light)"
                    : "var(--color-wa-surface-3)",
                  color: "var(--color-wa-text-primary)",
                  fontFamily: "var(--font-family)",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                  outline: "none",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !loading)
                    e.currentTarget.style.background = "var(--color-wa-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "var(--color-wa-surface-3)";
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ fontSize: "12px", color: "var(--color-wa-text-secondary)" }}>
                    {opt.sublabel}
                  </span>
                </div>
                {isSelected && (
                  <Check size={20} style={{ color: "var(--color-primary)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 24px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "15px",
              fontFamily: "var(--font-family)",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              background: "var(--color-wa-surface-3)",
              color: "var(--color-wa-text-secondary)",
              transition: "background 0.2s ease",
              outline: "none",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 24px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "15px",
              fontFamily: "var(--font-family)",
              cursor: loading ? "not-allowed" : "pointer",
              border: "none",
              color: "#fff",
              background: "var(--color-primary)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              transition: "all 0.25s ease",
              outline: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : "Mute"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MuteNotificationDialog;
