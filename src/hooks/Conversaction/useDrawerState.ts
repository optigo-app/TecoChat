// Ported from OldChatReactCode/src/hooks/Conversaction/useDrawerState.js

"use client";

import { useState, useEffect, useCallback } from "react";

export type DrawerViewState = "info" | "search" | "messageInfo";

export const useDrawerState = (conversationId: string | number | undefined) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerViewState, setDrawerViewState] =
    useState<DrawerViewState>("info");
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState<any>(null);
  const [infoMember, setInfoMember] = useState<any>(null);

  // Reset drawer when conversation changes
  useEffect(() => {
    setDrawerOpen(false);
    setDrawerViewState("info");
  }, [conversationId]);

  // Listen for member info events
  useEffect(() => {
    const handleShowInfo = (e: Event) => {
      const memberData = (e as CustomEvent).detail;
      setDrawerOpen(true);
      setDrawerViewState("info");
      setInfoMember(memberData);
    };
    window.addEventListener("SHOW_MEMBER_INFO", handleShowInfo);
    return () =>
      window.removeEventListener("SHOW_MEMBER_INFO", handleShowInfo);
  }, []);

  const openInfo = useCallback(() => {
    setDrawerViewState("info");
    setDrawerOpen(true);
  }, []);

  const openSearch = useCallback(() => {
    setDrawerViewState("search");
    setDrawerOpen(true);
  }, []);

  const openMessageInfo = useCallback((message: any) => {
    setSelectedMessageForInfo(message);
    setDrawerViewState("messageInfo");
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setInfoMember(null);
  }, []);

  return {
    drawerOpen,
    setDrawerOpen,
    drawerViewState,
    setDrawerViewState,
    selectedMessageForInfo,
    infoMember,
    openInfo,
    openSearch,
    openMessageInfo,
    closeDrawer,
  };
};
