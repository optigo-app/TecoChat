"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  MenuItem,
  Divider,
  IconButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Avatar,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  Tooltip,
} from "@mui/material";
import { LogOut as LogOutIcon, User, Sun, Moon, Monitor } from "lucide-react";
import { useLoginContext } from "@/src/contexts/LoginData";
import { useColorMode } from "@/src/theme/ThemeRegistry";
import type { ColorMode } from "@/src/theme/themes";
import { getWhatsAppAvatarConfig, isImageDead, markImageAsDead } from "@/src/utils/globalFunc";
import { eraseCookie } from "@/src/utils/cookieUtils";
import { disconnectSocket } from "@/src/socket";
import ConfirmationDialog from "@/src/components/ReusableComponent/ConfirmationDialog";
import { CONFIRM_CONFIG } from "@/src/hooks/confirmConfig";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import { deleteDb } from "@/src/db/tecoDb";
import { getAppVersion } from "@/src/utils/versionManager";
import "./ProfileAvatar.scss";

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
};

interface ProfileAvatarProps {
  collapsed?: boolean;
  /** When rendered in a top-bar header (instead of the sidebar), anchor the
   *  dropdown menu below-right of the avatar (WhatsApp-like) rather than the
   *  sidebar's bottom-left / desktop's center-right. */
  headerVariant?: boolean;
}

export const ProfileAvatar = ({ collapsed = false, headerVariant = false }: ProfileAvatarProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const open = Boolean(anchorEl);
  const router = useRouter();
  const isMobile = useIsMobile();
  const { auth, setAuth, setToken } = useLoginContext();
  const { mode, setMode } = useColorMode();

  // Responsive avatar size: 36px on mobile, 40px on desktop
  const avatarSize = isMobile ? 36 : 40;

  const username = auth?.username;
  const avatarConfig = getWhatsAppAvatarConfig(username || "User", avatarSize);

  // Profile image loading state (skeleton → loaded/error)
  const rawImageUrl = auth?.ProfileImageUrl as string | undefined;
  const imageUrl = isValidUrl(rawImageUrl) && !isImageDead(rawImageUrl) ? rawImageUrl : null;
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    imageUrl ? "loading" : "error"
  );

  useEffect(() => {
    if (imageUrl) {
      setImageState("loading");
      const img = new window.Image();
      img.src = imageUrl;
      if (img.complete) setImageState("loaded");
    } else {
      setImageState("error");
    }
  }, [imageUrl]);

  const handleImgLoad = () => setImageState("loaded");
  const handleImgError = () => {
    if (imageUrl) markImageAsDead(imageUrl);
    setImageState("error");
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    // Don't open the profile menu if the logout dialog is open
    if (logoutDialogOpen) return;
    // On mobile + tablet (headerVariant), open the full-screen ProfilePanel
    // (WhatsApp-like) instead of the dropdown. The panel is rendered by
    // CustomerLists which listens for the OPEN_PROFILE_PANEL event.
    if (headerVariant && isMobile) {
      window.dispatchEvent(new CustomEvent("OPEN_PROFILE_PANEL"));
      return;
    }
    // If already open, close instead of re-opening
    if (anchorEl) {
      setAnchorEl(null);
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleClose();
    window.dispatchEvent(new CustomEvent("CLOSE_MOBILE_SIDEBAR"));
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true);
    try {
      disconnectSocket(true);
      // Wipe the per-user IndexedDB before clearing sessionStorage so the
      // auth ID is still available for deleteDb().
      deleteDb(auth?.id).catch(() => {});
      sessionStorage.clear();
      eraseCookie("userData");
      eraseCookie("token");
      eraseCookie("remembered_creds");
      setAuth({ userId: "", username: "", ukey: "", token: "", id: "", ufcc: "" });
      setToken({ sv: "", yc: "" });
      router.replace("/login");
    } finally {
      setLogoutLoading(false);
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    if (logoutLoading) return;
    setLogoutDialogOpen(false);
  };

  return (
    <>
    <div
      className={`profile-menu ${collapsed ? "collapsed" : ""}`}
      onClick={handleClick}
    >
      <IconButton className="profile-avatar" size="large" aria-label="Profile menu">
        <div style={{ position: "relative", width: avatarSize, height: avatarSize }}>
          {imageUrl && imageState === "loading" && (
            <Skeleton
              variant="circular"
              width={avatarSize}
              height={avatarSize}
              animation="wave"
              sx={{ position: "absolute", top: 0, left: 0 }}
            />
          )}
          <Avatar
            alt={username || "User"}
            src={imageUrl || undefined}
            onLoad={handleImgLoad}
            onError={handleImgError}
            sx={{
              ...avatarConfig.sx,
              width: avatarSize,
              height: avatarSize,
              opacity: imageState === "loaded" || !imageUrl ? 1 : 0,
              position: "absolute",
              top: 0,
              left: 0,
              transition: "opacity 0.2s ease-in-out",
            }}
            slotProps={{ img: { draggable: false } }}
          >
            {avatarConfig.children}
          </Avatar>
        </div>
      </IconButton>
      {!collapsed && username && (
        <span className="profile-name" title={username}>
          {username}
        </span>
      )}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transitionDuration={0}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              // Wider on mobile (closer to viewport), 260px on desktop
              minWidth: isMobile ? "280px" : "260px",
              mt: 1.5,
              overflow: "hidden",
              // Safe-area insets on mobile (notched devices)
              ...(isMobile
                ? {
                    mb: "calc(var(--safe-bottom, 0px) + 8px)",
                  }
                : {}),
              // ── Glassmorphic menu surface ──────────────────────────────
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(35, 35, 51, 0.72)"
                  : "rgba(255, 255, 255, 0.72)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid",
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.5)",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)",
              "& .MuiMenuItem-root": {
                px: 1.5,
                py: 1.25,
                mx: 1,
                borderRadius: "10px",
                transition: "all 0.2s ease",
                gap: "12px",
                // Larger touch targets on mobile (48px), 44px on desktop
                minHeight: isMobile ? "48px" : "44px",
              },
              "& .MuiListItemIcon-root": {
                color: "text.secondary",
                transition: "all 0.2s ease",
                minWidth: "auto !important",
              },
              "& .MuiTypography-root": {
                fontWeight: 500,
                fontSize: "0.875rem",
              },
              // ── Glassmorphic icon wrappers inside menu items ───────────
              "& .glass-icon": {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // Slightly larger on mobile for better touch (32px mobile, 30px desktop)
                width: isMobile ? 32 : 30,
                height: isMobile ? 32 : 30,
                borderRadius: "50%",
                border: "1px solid",
                borderColor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.5)",
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.45)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.08)",
                transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
                "&:hover": {
                  borderColor: "primary.main",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(115,103,240,0.2)",
                },
              },
            },
          },
        }}
        // On mobile the sidebar is a drawer, so anchor the menu to the
        // bottom-left (above the button). On desktop keep center-right.
        // headerVariant (avatar in a top-bar): always anchor bottom-right so
        // the menu drops down below the avatar (WhatsApp-like).
        anchorOrigin={
          headerVariant
            ? { vertical: "bottom", horizontal: "right" }
            : isMobile
              ? { vertical: "bottom", horizontal: "left" }
              : { vertical: "center", horizontal: "right" }
        }
        transformOrigin={
          headerVariant
            ? { vertical: "top", horizontal: "right" }
            : isMobile
              ? { vertical: "bottom", horizontal: "left" }
              : { vertical: "center", horizontal: "left" }
        }
      >
        {/* ── User info header ──────────────────────────────────────────── */}
        <Box
          sx={{
            px: isMobile ? 1.5 : 2,
            py: isMobile ? 1.5 : 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <div style={{ position: "relative", width: avatarSize, height: avatarSize }}>
            {imageUrl && imageState === "loading" && (
              <Skeleton
                variant="circular"
                width={avatarSize}
                height={avatarSize}
                animation="wave"
                sx={{ position: "absolute", top: 0, left: 0 }}
              />
            )}
            <Avatar
              alt={username || "User"}
              src={imageUrl || undefined}
              onLoad={handleImgLoad}
              onError={handleImgError}
              sx={{
                ...avatarConfig.sx,
                width: avatarSize,
                height: avatarSize,
                fontSize: 15,
                border: "1px solid",
                borderColor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.6)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.1)",
                opacity: imageState === "loaded" || !imageUrl ? 1 : 0,
                position: "absolute",
                top: 0,
                left: 0,
                transition: "opacity 0.2s ease-in-out",
              }}
              slotProps={{ img: { draggable: false } }}
            >
              {avatarConfig.children}
            </Avatar>
          </div>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: isMobile ? "0.85rem" : "0.9rem",
                fontWeight: 600,
                color: "text.primary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {username || "User"}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "0.7rem" : "0.75rem",
                color: "text.secondary",
              }}
            >
              {auth?.ufcc || "TeCoChat User"}
            </Typography>
          </Box>
        </Box>

        <Divider
          sx={{
            borderColor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
          }}
        />

        {/* ── Menu items ────────────────────────────────────────────────── */}
        <Box sx={{ py: 0.5 }}>
          <MenuItem
            onClick={() => {
              handleClose();
              window.dispatchEvent(new CustomEvent("OPEN_PROFILE_PANEL"));
            }}
            sx={{
              "&:hover": {
                bgcolor: "primary.main",
                color: "#fff",
                "& .MuiListItemIcon-root": { color: "#fff" },
                "& .glass-icon": {
                  borderColor: "rgba(255,255,255,0.3)",
                  bgcolor: "rgba(255,255,255,0.15)",
                },
              },
            }}
          >
            <ListItemIcon>
              <span className="glass-icon">
                <User size={18} />
              </span>
            </ListItemIcon>
            <ListItemText primary="Profile" />
          </MenuItem>

        </Box>

        <Divider
          sx={{
            borderColor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
          }}
        />

        {/* ── Theme toggle (compact icon group: Light / Dark / System) ─────── */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            mx: 1,
            my: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "text.primary",
              mr: "auto",
            }}
          >
            Theme
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, value) => {
              if (value !== null) {
                setMode(value as ColorMode);
                handleClose();
              }
            }}
            size="small"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              p: 0.5,
              borderRadius: "10px",
              border: "1px solid",
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.06)",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.02)",
              "& .MuiToggleButtonGroup-grouped": {
                border: "none",
                borderRadius: "8px !important",
                p: 0,
                // Larger touch targets on mobile (32px), 30px on desktop
                width: isMobile ? 32 : 30,
                height: isMobile ? 32 : 30,
                minWidth: isMobile ? 32 : 30,
                minHeight: isMobile ? 32 : 30,
                color: "text.secondary",
                bgcolor: "transparent",
                transition: "all 180ms ease",
                "& svg": {
                  fontSize: "1.05rem",
                  transition: "transform 200ms ease",
                },
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.04)",
                  "& svg": {
                    transform: "scale(1.15)",
                  },
                },
                // Active state — light tinted bg, primary-colored icon
                "&.Mui-selected": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(115,103,240,0.2)"
                      : "rgba(115,103,240,0.12)",
                  color: "primary.main",
                  "&:hover": {
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(115,103,240,0.28)"
                        : "rgba(115,103,240,0.18)",
                  },
                  "& svg": {
                    color: "primary.main",
                  },
                },
              },
            }}
          >
            <Tooltip title="Light" arrow placement="top">
              <ToggleButton value="light" aria-label="Light theme">
                <Sun size={18} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Dark" arrow placement="top">
              <ToggleButton value="dark" aria-label="Dark theme">
                <Moon size={18} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="System" arrow placement="top">
              <ToggleButton value="system" aria-label="System theme">
                <Monitor size={18} />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Box>

        <Divider
          sx={{
            borderColor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
          }}
        />

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <Box sx={{ py: 0.5 }}>
          <MenuItem
            onClick={handleLogoutClick}
            sx={{
              color: "error.main",
              "&:hover": {
                bgcolor: "error.main",
                color: "#fff",
                "& .MuiListItemIcon-root": { color: "#fff" },
                "& .glass-icon": {
                  borderColor: "rgba(255,255,255,0.3)",
                  bgcolor: "rgba(255,255,255,0.15)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(211,47,47,0.3)",
                },
              },
            }}
          >
            <ListItemIcon sx={{ color: "error.main !important" }}>
              <span className="glass-icon">
                <LogOutIcon size={18} />
              </span>
            </ListItemIcon>
            <ListItemText primary="Log out" />
          </MenuItem>
        </Box>

        {/* ── App version (WhatsApp-style footer) ───────────────────────── */}
        {getAppVersion() !== "0.0.0" && (
          <Box
            sx={{
              px: 2,
              py: 1,
              textAlign: "center",
              borderTop: "1px solid",
              borderColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
            }}
          >
            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
              TeCoChat v{getAppVersion()}
            </Typography>
          </Box>
        )}
      </Menu>
    </div>

      {/* ── Logout confirmation dialog (reusable ConfirmationDialog) ─────── */}
      <ConfirmationDialog
        isOpen={logoutDialogOpen}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        title={CONFIRM_CONFIG.logout.title}
        description={CONFIRM_CONFIG.logout.description}
        confirmText={CONFIRM_CONFIG.logout.confirmText}
        variant={CONFIRM_CONFIG.logout.variant as "primary" | "danger"}
        showCancel={CONFIRM_CONFIG.logout.showCancel}
        loading={logoutLoading}
        icon={<LogOutIcon size={28} />}
      />
    </>
  );
};
