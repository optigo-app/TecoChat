"use client";

import { Menu } from "lucide-react";
import { IconButton } from "@mui/material";
import Image from "next/image";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import { ProfileAvatar } from "@/src/components/ProfileAvatar/ProfileAvatar";
import { useLoginContext } from "@/src/context/LoginData";
import "./Header.scss";

interface HeaderProps {
  /** Mobile sidebar toggle callback. */
  onMenuClick?: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const isMobile = useIsMobile();
  const { auth } = useLoginContext();

  return (
    <header className="header_mainDiv app-header no-select">
      <div className="header_main">
        {/* Left: hamburger (mobile) + logo + username */}
        <div className="header_left">
          {isMobile && (
            <IconButton
              className="header-hamburger tap-target"
              size="small"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </IconButton>
          )}
          <div className="header_brand">
            <Image
              src="/icons/brand/logo.png"
              alt="TeCoChat logo"
              width={120}
              height={36}
              className="header_left_logo"
              draggable={false}
              priority
            />
          </div>
        </div>

        {/* Right: profile only (theme toggle is inside profile menu) */}
        <div className="header_right">
          <ProfileAvatar />
        </div>
      </div>
    </header>
  );
};
