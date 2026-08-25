"use client";

import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";

interface WhatsAppMenuItem {
  label: string;
  action: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface WhatsAppMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  items: WhatsAppMenuItem[];
  onAction: (action: string, context?: any) => void;
  context?: any;
  anchorReference?: "anchorEl" | "anchorPosition" | "none";
  anchorPosition?: { top: number; left: number };
  transformOrigin?: { horizontal: "left" | "center" | "right"; vertical: "top" | "center" | "bottom" };
  anchorOrigin?: { horizontal: "left" | "center" | "right"; vertical: "top" | "center" | "bottom" };
  sx?: Record<string, unknown>;
}

const WhatsAppMenu = ({
  anchorEl,
  open,
  onClose,
  items = [],
  onAction,
  context,
  anchorReference = "anchorEl",
  anchorPosition,
  transformOrigin = { horizontal: "right", vertical: "top" },
  anchorOrigin = { horizontal: "right", vertical: "bottom" },
  sx = {},
}: WhatsAppMenuProps) => {
  const handleClick = (action: string) => {
    onClose?.();
    onAction?.(action, context);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorReference={anchorReference}
      anchorPosition={anchorPosition}
      onClick={(e) => e.stopPropagation()}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            minWidth: 180,
            borderRadius: 2,
            py: 0.5,
            boxShadow:
              "0px 6px 18px rgba(0,0,0,0.12), 0px 3px 6px rgba(0,0,0,0.08)",
            backgroundColor: "background.paper",
            ...sx,
          },
        },
      }}
      transformOrigin={transformOrigin}
      anchorOrigin={anchorOrigin}
    >
      {items.map((item, index) =>
        item.divider ? (
          <Divider key={index} sx={{ my: 0.5, borderColor: "divider" }} />
        ) : (
          <MenuItem
            key={item.action || index}
            onClick={() => handleClick(item.action)}
            sx={{
              py: 1.1,
              px: 2,
              mb: 0.5,
              borderRadius: 1.5,
              transition: "all 0.2s ease",
              color: item.danger ? "error.main" : "text.primary",
              "&:hover": {
                backgroundColor: item.danger
                  ? "rgba(255,0,0,0.08)"
                  : "action.hover",
                transform: "translateX(3px)",
              },
            }}
          >
            {item.icon && (
              <ListItemIcon sx={{ minWidth: "30px !important" }}>
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={item.label}
              sx={{
                margin: 0,
                "& .MuiTypography-root": {
                  fontSize: 14,
                  fontWeight: 500,
                  color: "text.primary",
                },
              }}
            />
          </MenuItem>
        )
      )}
    </Menu>
  );
};

export default WhatsAppMenu;
