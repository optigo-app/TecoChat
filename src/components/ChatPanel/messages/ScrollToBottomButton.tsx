"use client";

import { memo, useState, useRef, useCallback } from "react";
import {
  IconButton,
  Badge,
  useTheme,
  alpha,
  Zoom,
  Popover,
  Box,
  Typography,
} from "@mui/material";
import { ArrowDown, ChevronsDown, ChevronDown } from "lucide-react";

interface ScrollToBottomButtonProps {
  open: boolean;
  onClick: () => void;
  right?: number;
  bottom?: number;
  unreadCount?: number;
  /** When true, clicking shows a menu instead of scrolling directly */
  showMenu?: boolean;
  /** Jump directly to the latest messages (one API call) */
  onJumpToLatest?: () => void;
  /** Load one page of newer messages (progressive scroll) */
  onLoadOnePage?: () => void;
}

const ScrollToBottomButtonComponent = ({
  open,
  onClick,
  right = 30,
  bottom = 25,
  unreadCount = 0,
  showMenu = false,
  onJumpToLatest,
  onLoadOnePage,
}: ScrollToBottomButtonProps) => {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (showMenu) {
        setMenuAnchor(e.currentTarget);
      } else {
        onClick();
      }
    },
    [showMenu, onClick]
  );

  const handleClose = useCallback(() => setMenuAnchor(null), []);

  const handleJumpToLatest = useCallback(() => {
    setMenuAnchor(null);
    onJumpToLatest?.();
  }, [onJumpToLatest]);

  const handleLoadOnePage = useCallback(() => {
    setMenuAnchor(null);
    onLoadOnePage?.();
  }, [onLoadOnePage]);

  const menuOpen = Boolean(menuAnchor);

  return (
    <>
      <Zoom in={open} timeout={200} unmountOnExit>
        <Badge
          color="error"
          badgeContent={unreadCount > 0 ? unreadCount : undefined}
          sx={{
            position: "absolute",
            right: `${right}px`,
            bottom: `${bottom}px`,
            zIndex: 15,
            "& .MuiBadge-badge": {
              top: -4,
              right: -4,
              fontSize: 11,
              height: 20,
              minWidth: 20,
              borderRadius: 10,
            },
          }}
        >
          <IconButton
            ref={btnRef}
            onClick={handleClick}
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: theme.palette.primary.main,
              boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, 0.25)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              userSelect: "none",
              transition: "transform 160ms ease, box-shadow 200ms ease, background-color 200ms ease",
              animation: "scrollToBottomPulse 2.2s ease-in-out infinite",
              "&:hover": {
                backgroundColor: theme.palette.primary.main,
                transform: "translateY(-2px) scale(1.05)",
                boxShadow: `0 14px 34px ${alpha(theme.palette.common.black, 0.28)}`,
              },
              "&:active": {
                transform: "translateY(0px) scale(0.98)",
              },
            }}
          >
            <ArrowDown size={20} color="#fff" />
          </IconButton>
        </Badge>
      </Zoom>

      <Popover
        open={menuOpen}
        anchorEl={menuAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              borderRadius: "12px",
              minWidth: 200,
              py: 0.5,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.18)}`,
            },
          },
        }}
        sx={{ zIndex: 1600 }}
      >
        <Box
          onClick={handleJumpToLatest}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.5,
            cursor: "pointer",
            borderRadius: "8px",
            mx: 0.5,
            transition: "background-color 0.12s ease",
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ChevronsDown size={18} color={theme.palette.primary.main} />
          <Box>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: theme.palette.text.primary }}>
              Jump to latest
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Skip to the newest messages
            </Typography>
          </Box>
        </Box>

        <Box
          onClick={handleLoadOnePage}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.5,
            cursor: "pointer",
            borderRadius: "8px",
            mx: 0.5,
            transition: "background-color 0.12s ease",
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ChevronDown size={18} color={theme.palette.text.secondary} />
          <Box>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: theme.palette.text.primary }}>
              Load one page
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: theme.palette.text.secondary }}>
              Scroll through gradually
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default memo(ScrollToBottomButtonComponent);
