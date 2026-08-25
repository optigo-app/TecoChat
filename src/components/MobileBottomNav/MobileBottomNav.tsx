"use client";

import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { useIsMobile } from "../../hooks/useIsMobile";

export interface MobileNavItem {
  key: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  badge?: number;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  activeKey: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  items,
  activeKey,
}) => {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <Box
      className="app-bottom-nav no-select"
      sx={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: "var(--app-bottom-nav-height)",
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
        zIndex: 1100,
      }}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const icon = isActive ? (item.activeIcon ?? item.icon) : item.icon;
        return (
          <Box
            key={item.key}
            component="button"
            onClick={item.onClick}
            className="tap-target"
            sx={{
              all: "unset",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              cursor: "pointer",
              flex: 1,
              height: "100%",
              color: isActive ? "primary.main" : "text.secondary",
              transition: "color 150ms ease",
              position: "relative",
              "&:active": {
                transform: "scale(0.95)",
              },
            }}
          >
            <Box sx={{ position: "relative" }}>
              {icon}
              {item.badge != null && item.badge > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -6,
                    right: -10,
                    minWidth: 16,
                    height: 16,
                    px: "4px",
                    borderRadius: "8px",
                    bgcolor: "error.main",
                    color: "error.contrastText",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </Box>
              )}
            </Box>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
              }}
            >
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};
