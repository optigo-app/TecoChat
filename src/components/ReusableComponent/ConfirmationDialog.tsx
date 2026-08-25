"use client";

import { createPortal } from "react-dom";
import { X, Check, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useTheme, alpha } from "@mui/material";
import "./ConfirmationDialog.scss";

interface ConfirmAction {
  label: string;
  onClick?: () => void;
  variant?: string;
  danger?: boolean;
  autoClose?: boolean;
  loading?: boolean;
}

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "danger" | "success";
  showCancel?: boolean;
  actions?: ConfirmAction[];
  children?: React.ReactNode;
  /** When true, confirm button shows a spinner and cancel/backdrop is disabled */
  loading?: boolean;
}

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  icon: Icon,
  variant = "primary",
  showCancel = true,
  actions = [],
  children,
  loading = false,
}: ConfirmationDialogProps) => {
  const theme = useTheme();
  if (!isOpen) return null;

  const isDanger = variant === "danger";
  const isVertical = actions.length > 2;

  const handleOverlayClick = () => {
    if (loading) return;
    onClose();
  };

  // ── Inline styles (guaranteed to apply — not dependent on SCSS specificity) ──

  const iconBg =
    isDanger
      ? alpha(theme.palette.error.main, 0.15)
      : variant === "success"
        ? alpha(theme.palette.success.main, 0.12)
        : alpha(theme.palette.primary.main, 0.1);

  const iconColor =
    isDanger
      ? theme.palette.error.main
      : variant === "success"
        ? theme.palette.success.main
        : theme.palette.primary.main;

  const getActionStyle = (action: ConfirmAction): React.CSSProperties => {
    if (isVertical) {
      // Vertical layout (delete message: Delete for everyone / Delete for me / Cancel)
      if (action.danger) {
        return {
          width: "100%",
          padding: "14px 20px",
          borderRadius: "16px",
          fontWeight: 600,
          fontSize: "15px",
          cursor: "pointer",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          outline: "none",
          background: alpha(theme.palette.error.main, 0.12),
          color: theme.palette.error.main,
          transition: "background 0.2s ease",
        };
      }
      // Cancel in vertical layout
      return {
        width: "100%",
        padding: "14px 20px",
        borderRadius: "16px",
        fontWeight: 500,
        fontSize: "15px",
        cursor: "pointer",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        outline: "none",
        background: theme.palette.action.hover,
        color: theme.palette.text.secondary,
        transition: "background 0.2s ease",
      };
    }
    // Horizontal layout
    return {
      flex: 1,
      padding: "12px 24px",
      borderRadius: "16px",
      fontWeight: 600,
      fontSize: "15px",
      cursor: "pointer",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      outline: "none",
      background: action.danger
        ? alpha(theme.palette.error.main, 0.12)
        : theme.palette.action.hover,
      color: action.danger ? theme.palette.error.main : theme.palette.primary.main,
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  };

  const getActionHoverBg = (action: ConfirmAction): string => {
    if (action.danger) return alpha(theme.palette.error.main, 0.22);
    return theme.palette.action.selected;
  };

  const renderActions = () => {
    if (actions && actions.length > 0) {
      return actions.map((action, index) => {
        const baseStyle = getActionStyle(action);
        return (
          <button
            key={index}
            className={`btn-action ${action.variant || ""} ${action.danger ? "danger" : ""}`}
            style={baseStyle}
            disabled={action.loading || loading}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = getActionHoverBg(action);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = baseStyle.background as string;
            }}
            onClick={() => {
              action.onClick?.();
              if (action.autoClose !== false) onClose();
            }}
          >
            {action.loading ? (
              <Loader2 size={18} className="spin" />
            ) : (
              action.label
            )}
          </button>
        );
      });
    }

    return (
      <>
        {showCancel && (
          <button
            className="btn-cancel"
            style={{
              flex: 1,
              padding: "12px 24px",
              borderRadius: "16px",
              fontWeight: 600,
              fontSize: "15px",
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              outline: "none",
              background: theme.palette.action.hover,
              color: theme.palette.text.secondary,
              transition: "all 0.25s ease",
            }}
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
        )}
        <button
          className={`btn-confirm ${variant}`}
          style={{
            flex: 1,
            padding: "12px 24px",
            borderRadius: "16px",
            fontWeight: 600,
            fontSize: "15px",
            cursor: "pointer",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            outline: "none",
            color: "#fff",
            background: isDanger ? theme.palette.error.main : theme.palette.primary.main,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            transition: "all 0.25s ease",
          }}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={18} className="spin" />
          ) : (
            confirmText
          )}
        </button>
      </>
    );
  };

  return createPortal(
    <div className="confirmation-modal-overlay" onClick={handleOverlayClick}>
      <div className="confirmation-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn-top" onClick={onClose} disabled={loading}>
          <X size={20} />
        </button>

        <div
          className={`modal-icon-wrapper ${variant}`}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "8px auto 24px",
            background: iconBg,
            color: iconColor,
          }}
        >
          {Icon || (isDanger ? <Trash2 /> : variant === "success" ? <Check /> : <AlertTriangle />)}
        </div>

        <h2>{title}</h2>
        {description && <p>{description.replace(/\/n/g, "\n")}</p>}

        {children}

        <div
          className={`modal-actions ${isVertical ? "vertical" : ""}`}
          style={{
            display: "flex",
            gap: isVertical ? "10px" : "12px",
            justifyContent: "center",
            marginTop: 8,
            flexDirection: isVertical ? "column" : "row",
          }}
        >
          {renderActions()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationDialog;
