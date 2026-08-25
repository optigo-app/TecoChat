// Ported from OldChatReactCode/src/hooks/Conversaction/useHeaderMenu.js

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Info,
  CheckSquare,
  BellOff,
  Bell,
  X,
  Trash2,
  LogOut,
  Star,
  CircleMinus,
} from "lucide-react";

export interface HeaderMenuItem {
  label: string;
  action: string;
  icon: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface UseHeaderMenuParams {
  selectedCustomer: any;
  isFavorite: boolean;
  isRemovedFromGroup: boolean;
  isMuted?: boolean;
}

export const useHeaderMenu = ({
  selectedCustomer,
  isFavorite,
  isRemovedFromGroup,
  isMuted = false,
}: UseHeaderMenuParams) => {
  const [headerMenuAnchorEl, setHeaderMenuAnchorEl] =
    useState<HTMLElement | null>(null);

  const headerMenuItems = useMemo<HeaderMenuItem[]>(() => {
    const items: HeaderMenuItem[] = [
      {
        label:
          selectedCustomer?.IsGroup === 1 ? "Group Info" : "Contact Info",
        action: "groupInfo",
        icon: <Info size={18} />,
      },
      {
        label: "Select messages",
        action: "selectMessages",
        icon: <CheckSquare size={18} />,
      },
      {
        label: isMuted ? "Unmute notification" : "Mute notification",
        action: "mute",
        icon: isMuted ? <Bell size={18} /> : <BellOff size={18} />,
      },
      {
        label: isFavorite ? "Remove from favourite" : "Add to favourite",
        action: "favourite",
        icon: (
          <Star
            size={18}
            fill={isFavorite ? "#FFD700" : "none"}
            color={isFavorite ? "#FFD700" : "currentColor"}
          />
        ),
      },
      { label: "Close chat", action: "close", icon: <X size={18} /> },
      { divider: true, label: "", action: "", icon: null },
      {
        label: "Clear chat",
        action: "clearChat",
        icon: <CircleMinus size={18} />,
      },
    ];

    if (selectedCustomer?.IsGroup === 1) {
      if (isRemovedFromGroup) {
        items.push({
          label: "Delete group",
          action: "deleteGroup",
          icon: <Trash2 size={18} />,
          danger: true,
        });
      } else {
        items.push({
          label: "Exit group",
          action: "exitGroup",
          icon: <LogOut size={18} />,
          danger: true,
        });
      }
    } else {
      items.push({
        label: "Delete chat",
        action: "deleteChat",
        icon: <Trash2 size={18} />,
        danger: true,
      });
    }

    return items;
  }, [selectedCustomer?.IsGroup, isFavorite, isRemovedFromGroup, isMuted]);

  const openMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setHeaderMenuAnchorEl(event.currentTarget);
  }, []);

  const closeMenu = useCallback(() => {
    setHeaderMenuAnchorEl(null);
  }, []);

  return {
    headerMenuAnchorEl,
    headerMenuItems,
    openMenu,
    closeMenu,
  };
};
