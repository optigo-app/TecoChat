"use client";

import { memo } from "react";
import { Box, Button, Typography, LinearProgress, CircularProgress } from "@mui/material";
import { RefreshCw, Clock, ServerCog, AlertCircle } from "lucide-react";
import type { RetryPhase } from "../../hooks/useServiceRetry";
import "./MaintenancePage.scss";

/**
 * MaintenancePage
 *
 * Full-screen maintenance/error page with phased auto-retry.
 * Uses CSS variables for theme-aware styling (light/dark mode).
 */

interface MaintenancePageProps {
  message?: string;
  onRetry?: () => void;
  phase?: RetryPhase;
  attempt?: number;
  maxAttempts?: number;
  countdown?: number;
  countdownMax?: number;
  checking?: boolean;
}

const PHASE_LABELS: Record<RetryPhase, string> = {
  silent: "Checking connection...",
  "auto-1": "Auto-retrying (every 1 min)",
  "auto-5": "Auto-retrying (every 5 min)",
  stopped: "Auto-retry stopped",
  manual: "Retrying...",
};

function MaintenancePage({
  message = "Service is temporarily unavailable.",
  onRetry,
  phase = "auto-1",
  attempt = 0,
  maxAttempts = 3,
  countdown = 0,
  countdownMax = 60,
  checking = false,
}: MaintenancePageProps) {
  const isStopped = phase === "stopped";
  const progress = countdownMax > 0 ? ((countdownMax - countdown) / countdownMax) * 100 : 0;

  return (
    <Box
      className="maintenance-page"
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        // Fluid horizontal padding (safe-area insets handled in SCSS)
        px: "var(--space-lg)",
        py: "var(--space-xl)",
        // Theme-aware background via CSS variables
        background: "var(--color-surface)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-50%",
          left: "-10%",
          width: "60%",
          height: "120%",
          background: "radial-gradient(ellipse, var(--color-primary-light) 0%, transparent 70%)",
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: "-30%",
          right: "-10%",
          width: "50%",
          height: "100%",
          background: "radial-gradient(ellipse, var(--color-primary-light) 0%, transparent 70%)",
          pointerEvents: "none",
        },
      }}
    >
      {/* Animated gear icon */}
      <Box
        sx={{
          position: "relative",
          mb: 4,
          "& .gear-spin": {
            animation: checking ? "gearSpin 2s linear infinite" : "gearSpin 8s linear infinite",
          },
          "@keyframes gearSpin": {
            from: { transform: "rotate(0deg)" },
            to: { transform: "rotate(360deg)" },
          },
        }}
      >
        <Box
          className="maintenance-icon-box"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, var(--color-primary-light) 0%, transparent 100%)",
            border: "1px solid var(--color-border-light)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          }}
        >
          <Box className="gear-spin maintenance-icon-gear">
            <ServerCog size={56} color="var(--color-primary)" strokeWidth={1.5} />
          </Box>
        </Box>
      </Box>

      {/* Status badge */}
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 0.5,
          borderRadius: "20px",
          bgcolor: isStopped ? "rgba(239,68,68,0.08)" : "rgba(234,88,12,0.08)",
          border: `1px solid ${isStopped ? "rgba(239,68,68,0.15)" : "rgba(234,88,12,0.15)"}`,
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: isStopped ? "var(--color-error)" : "var(--color-warning)",
            animation: "pulseDot 2s ease-in-out infinite",
            "@keyframes pulseDot": {
              "0%,100%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.5, transform: "scale(0.8)" },
            },
          }}
        />
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: isStopped ? "var(--color-error)" : "var(--color-warning)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {isStopped ? "Auto-Retry Stopped" : "Service Unavailable"}
        </Typography>
      </Box>

      <Typography
        variant="h4"
        className="maintenance-title"
        sx={{
          fontWeight: 800,
          mb: 1.5,
          color: "var(--color-title)",
          letterSpacing: "-0.02em",
        }}
      >
        We&apos;ll be back soon
      </Typography>

      <Typography
        className="maintenance-message"
        sx={{
          color: "var(--color-text-2nd)",
          mb: 1,
          maxWidth: 440,
          lineHeight: 1.6,
        }}
      >
        {message}
      </Typography>

      <Typography
        className="maintenance-submessage"
        sx={{
          color: "var(--color-text-secondary)",
          mb: 4,
          maxWidth: 400,
        }}
      >
        {isStopped
          ? "Automatic retries have been exhausted. Please try again manually."
          : "Our team is working to restore service as quickly as possible. Thank you for your patience."}
      </Typography>

      {/* Retry status / countdown */}
      {!isStopped && (
        <Box sx={{ width: "100%", maxWidth: 320, mb: 3 }}>
          {/* Checking spinner */}
          {checking ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
              <CircularProgress size={14} sx={{ color: "var(--color-primary)" }} />
              <Typography sx={{ fontSize: "0.8125rem", color: "var(--color-text-2nd)" }}>
                Checking connection...
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  mb: 1,
                }}
              >
                <Clock size={14} color="var(--color-text-secondary)" />
                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {countdown > 0
                    ? `Auto-retry in ${countdown}s`
                    : "Retrying..."}
                </Typography>
              </Box>
              {countdownMax > 0 && countdown > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: "var(--color-border-light)",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 2,
                      background: "var(--color-primary-gradient)",
                    },
                  }}
                />
              )}
            </>
          )}
          {/* Attempt counter */}
          {maxAttempts > 0 && (
            <Typography
              sx={{
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                mt: 1,
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              {PHASE_LABELS[phase]} — Attempt {attempt}/{maxAttempts}
            </Typography>
          )}
        </Box>
      )}

      {/* Stopped indicator */}
      {isStopped && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, color: "var(--color-error)" }}>
          <AlertCircle size={18} />
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
            All retry attempts exhausted
          </Typography>
        </Box>
      )}

      <Button
        variant="contained"
        size="large"
        className="maintenance-retry-btn"
        onClick={() => {
          if (onRetry) onRetry();
        }}
        startIcon={checking ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <RefreshCw size={18} />}
        disabled={checking}
        sx={{
          bgcolor: "var(--color-primary)",
          color: "var(--color-text-white)",
          textTransform: "none",
          fontWeight: 600,
          borderRadius: "12px",
          py: 1.25,
          px: 4,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          "&:hover": {
            bgcolor: "var(--color-primary)",
            filter: "brightness(1.1)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
          },
          "&:disabled": {
            bgcolor: "var(--color-primary)",
            opacity: 0.5,
          },
        }}
      >
        {checking ? "Checking..." : "Try Again Now"}
      </Button>
    </Box>
  );
}

export default memo(MaintenancePage);
