"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Sidebar } from "@/src/components/Sidebar/Sidebar";
import { useIsMobile, useIsTablet } from "@/src/hooks/useIsMobile";
import "./AppLayout.scss";

// Context to share the mobile menu trigger node with children (e.g. CustomerLists)
export const MobileTriggerContext = createContext<React.ReactNode>(null);
export const useMobileTrigger = () => useContext(MobileTriggerContext);

interface AppLayoutProps {
  children: React.ReactNode;
  /** Optional: render a custom mobile menu trigger */
  mobileMenuTrigger?: (open: () => void) => React.ReactNode;
  /** When the right-side details panel opens, auto-collapse the sidebar */
  detailsPanelOpen?: boolean;
}

export const AppLayout = ({ children, mobileMenuTrigger, detailsPanelOpen = false }: AppLayoutProps) => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet(); // <= 1024px
  // Tablet and Desktop will show Sidebar. Mobile (<= 768px) shows bottom nav.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // default mini mode
  const [breakpointCollapsed, setBreakpointCollapsed] = useState(false);

  // Track breakpoint collapse
  useEffect(() => {
    const check = () => setBreakpointCollapsed(window.innerWidth <= 1440);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-collapse sidebar when the details panel opens (only on desktop,
  // and only if the user hasn't manually expanded). Restore when it closes.
  const prevDetailsOpenRef = useRef(false);
  useEffect(() => {
    if (!isMobile && detailsPanelOpen && !prevDetailsOpenRef.current) {
      setSidebarCollapsed(true);
    }
    prevDetailsOpenRef.current = detailsPanelOpen;
  }, [detailsPanelOpen, isMobile]);

  // Close mobile sidebar when CLOSE_MOBILE_SIDEBAR event is dispatched
  // (e.g. when user clicks logout)
  useEffect(() => {
    const handleClose = () => setMobileSidebarOpen(false);
    window.addEventListener("CLOSE_MOBILE_SIDEBAR", handleClose);
    return () => window.removeEventListener("CLOSE_MOBILE_SIDEBAR", handleClose);
  }, []);

  const isCollapsedEffective = !isMobile && (sidebarCollapsed || breakpointCollapsed);
  const sidebarWidth = isMobile ? 0 : isCollapsedEffective ? 76 : 260;

  // On mobile, build the trigger node and share it via context so children
  // (e.g. CustomerLists) can render it inside their own header.
  const mobileTriggerNode = isMobile && mobileMenuTrigger
    ? mobileMenuTrigger(() => setMobileSidebarOpen(true))
    : null;

  return (
    <div className={`app-layout ${isCollapsedEffective ? "app-layout--sidebar-collapsed" : ""}`}>
      {/* Sidebar on desktop and tablet (>768px). On mobile the layout is
          WhatsApp-like: no sidebar, bottom nav, profile avatar in the header. */}
      {!isMobile && (
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />
      )}
      <main
        className="app-layout__content"
        style={{
          marginLeft: isMobile ? 0 : sidebarWidth,
        }}
      >
        {isMobile && mobileTriggerNode ? (
          <MobileTriggerContext.Provider value={mobileTriggerNode}>
            {children}
          </MobileTriggerContext.Provider>
        ) : (
          children
        )}
      </main>
    </div>
  );
};
