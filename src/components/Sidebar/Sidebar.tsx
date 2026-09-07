"use client";

import { useEffect, useState } from "react";
import { HomeIcon, ChevronLeft, Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconButton } from "@mui/material";
import logo from "@/src/assets/logo.png";
import { useIsMobile } from "@/src/hooks/useIsMobile";
import { ProfileAvatar } from "@/src/components/ProfileAvatar/ProfileAvatar";
import "./Sidebar.scss";

const ICON_PROPS = { size: 20, strokeWidth: 2 };

interface MenuItem {
  type: "internal";
  path: string;
  icon: React.ReactNode;
  label: string;
}

const menuItems: MenuItem[] = [
  { type: "internal", path: "/", icon: <HomeIcon {...ICON_PROPS} />, label: "Inbox" },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "internal_sidebar_collapsed";

interface SidebarProps {
  /** Controlled collapsed state (desktop). */
  isCollapsed?: boolean;
  /** Callback when collapse state changes (desktop). */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Mobile drawer open state (controlled from parent). */
  mobileOpen?: boolean;
  /** Callback to toggle mobile drawer. */
  onMobileOpenChange?: (open: boolean) => void;
}

export const Sidebar = ({
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) => {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Desktop manual collapse state (persisted in localStorage)
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Breakpoint auto-collapse (<= 1440px)
  const [breakpointCollapsed, setBreakpointCollapsed] = useState(false);

  // Init from localStorage + viewport
  // Default to collapsed (mini mode) unless the user has explicitly expanded
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      // No stored preference → default to collapsed (mini mode)
      setInternalCollapsed(stored == null ? true : stored === "true");
    } catch {
      setInternalCollapsed(true);
    }
    try {
      setBreakpointCollapsed(window.innerWidth <= 1440);
    } catch {
      /* ignore */
    }
  }, []);

  // Listen for viewport changes
  useEffect(() => {
    const handleResize = () => {
      setBreakpointCollapsed(window.innerWidth <= 1440);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Persist manual collapse
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(internalCollapsed));
    } catch {
      /* ignore */
    }
  }, [internalCollapsed]);

  // Use controlled or internal state
  const manualCollapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (v: boolean) => {
    if (onCollapsedChange) onCollapsedChange(v);
    else setInternalCollapsed(v);
  };

  // Effective collapsed = manual OR breakpoint (desktop only)
  const isCollapsedEffective = !isMobile && (manualCollapsed || breakpointCollapsed);

  // Close mobile drawer on route change
  useEffect(() => {
    if (onMobileOpenChange) onMobileOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleHeaderClick = () => {
    if (isMobile) {
      if (onMobileOpenChange) onMobileOpenChange(false);
      return;
    }
    if (isCollapsedEffective) {
      setCollapsed(false);
    }
  };

  // ── Mobile: render drawer + overlay ────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div className="sidebar-mobile-overlay" onClick={() => onMobileOpenChange?.(false)} />
        )}
        <aside
          className={`sidebar_mainDiv mobile ${mobileOpen ? "open" : ""}`}
          aria-hidden={!mobileOpen}
        >
          <div className="sidebar-content">
            <div className="sidebar-sections">
              <div className="agentic-chat-header">
                <div className="agentic-chat-header__icon" onClick={handleHeaderClick}>
                  <div className="icon-bg">
                    <Image src={logo} alt="TeCoChat" fill className="icon" draggable={false} priority sizes="40px" />
                  </div>
                  <h1 className="title">TeCoChat</h1>
                </div>
                <IconButton
                  className="sidebar-toggle mobile-close tap-target"
                  size="small"
                  onClick={() => onMobileOpenChange?.(false)}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </IconButton>
              </div>
              <div className="sidebar_main">
                <ul>
                  {menuItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.path}
                          className={`sidebar_main_link ${isActive ? "active" : ""}`}
                        >
                          <div className="sidebar-item-icon">{item.icon}</div>
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {/* Profile at bottom */}
            <div className="sidebar-profile">
              <ProfileAvatar collapsed={false} />
            </div>
            <div className="powered-by">
              <span>Powered by </span>
              <div className="optigo-logo">
                <Image src="/icons/brand/logo1.png" alt="Optigo logo" width={80} height={42} draggable={false} />
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // ── Desktop: fixed sidebar ─────────────────────────────────────────────
  return (
    <aside
      className={`sidebar_mainDiv ${isCollapsedEffective ? "collapsed" : ""}`}
      data-sidebar-width={isCollapsedEffective ? 76 : 260}
    >
      <div className="sidebar-content">
        <div className="sidebar-sections">
          <div className="agentic-chat-header">
            <div className="agentic-chat-header__icon" onClick={handleHeaderClick}>
              <div className="icon-bg">
                <Image src={logo} alt="TeCoChat" fill className="icon" draggable={false} priority sizes="40px" />
              </div>
              {!isCollapsedEffective && <h1 className="title">TeCoChat</h1>}
            </div>
            {!isCollapsedEffective && (
              <IconButton
                className="sidebar-toggle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(!manualCollapsed);
                }}
              >
                <ChevronLeft size={18} />
              </IconButton>
            )}
          </div>
          <div className="sidebar_main">
            <ul>
              {menuItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.path}
                      className={`sidebar_main_link ${isActive ? "active" : ""}`}
                    >
                      <div className="sidebar-item-icon">{item.icon}</div>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        {/* Profile at bottom */}
        <div className={`sidebar-profile ${isCollapsedEffective ? "collapsed" : ""}`}>
          <ProfileAvatar collapsed={isCollapsedEffective} />
        </div>
        <div className={`powered-by ${isCollapsedEffective ? "collapsed" : ""}`}>
          <span>Powered by </span>
          <div className="optigo-logo">
            <Image src="/icons/brand/logo1.png" alt="Optigo logo" width={80} height={42} draggable={false} />
          </div>
        </div>
      </div>
    </aside>
  );
};

// Export the hamburger button for use on mobile
export const SidebarMobileToggle: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <IconButton className="sidebar-hamburger tap-target" size="small" onClick={onClick} aria-label="Open menu">
    <Menu size={22} />
  </IconButton>
);
