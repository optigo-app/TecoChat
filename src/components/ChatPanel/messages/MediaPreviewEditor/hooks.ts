import { useCallback, useEffect, useMemo, useState } from "react";
import type { ToolMode, ImageEditState } from "./types";
import { createDefaultEditState } from "./constants";

type History = { past: ImageEditState[]; future: ImageEditState[] };

/** Keeps edits and undo/redo isolated per media item. */
export function useMediaEditHistory(currentIndex: number) {
  const [editStates, setEditStates] = useState<Record<number, ImageEditState>>({});
  const [historyMap, setHistoryMap] = useState<Record<number, History>>({});
  const currentState = useMemo(() => editStates[currentIndex] || createDefaultEditState(), [editStates, currentIndex]);

  const updateCurrentState = useCallback((updater: (prev: ImageEditState) => ImageEditState, recordHistory = true) => {
    setEditStates((prevAll) => {
      const prev = prevAll[currentIndex] || createDefaultEditState();
      const next = updater(prev);
      if (recordHistory) {
        setHistoryMap((prevHist) => {
          const currentHist = prevHist[currentIndex] || { past: [], future: [] };
          return { ...prevHist, [currentIndex]: { past: [...currentHist.past, prev], future: [] } };
        });
      }
      return { ...prevAll, [currentIndex]: next };
    });
  }, [currentIndex]);

  const canUndo = (historyMap[currentIndex]?.past.length || 0) > 0;
  const canRedo = (historyMap[currentIndex]?.future.length || 0) > 0;
  const handleUndo = useCallback(() => {
    const history = historyMap[currentIndex];
    if (!history?.past.length) return;
    const previousState = history.past[history.past.length - 1];
    const current = editStates[currentIndex] || createDefaultEditState();
    setHistoryMap((prev) => ({ ...prev, [currentIndex]: { past: history.past.slice(0, -1), future: [current, ...history.future] } }));
    setEditStates((prev) => ({ ...prev, [currentIndex]: previousState }));
  }, [currentIndex, historyMap, editStates]);
  const handleRedo = useCallback(() => {
    const history = historyMap[currentIndex];
    if (!history?.future.length) return;
    const nextState = history.future[0];
    const current = editStates[currentIndex] || createDefaultEditState();
    setHistoryMap((prev) => ({ ...prev, [currentIndex]: { past: [...history.past, current], future: history.future.slice(1) } }));
    setEditStates((prev) => ({ ...prev, [currentIndex]: nextState }));
  }, [currentIndex, historyMap, editStates]);

  const reset = useCallback(() => { setEditStates({}); setHistoryMap({}); }, []);
  const resetCurrent = useCallback(() => {
    setEditStates((prev) => ({ ...prev, [currentIndex]: createDefaultEditState() }));
    setHistoryMap((prev) => ({ ...prev, [currentIndex]: { past: [], future: [] } }));
  }, [currentIndex]);
  return { editStates, currentState, updateCurrentState, canUndo, canRedo, handleUndo, handleRedo, reset, resetCurrent };
}

interface UseKeyboardShortcutsArgs {
  open: boolean;
  activeTool: ToolMode;
  textInputActive: boolean;
  selectedElementId: string | null;
  showKeyboardHelp: boolean;
  mediaFilesLength: number;
  onClose: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  onSend: () => void;
  onApplyCrop?: () => void;
  updateCurrentState: (updater: (prev: ImageEditState) => ImageEditState, recordHistory?: boolean) => void;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolMode>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowKeyboardHelp: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setCanvasEmojiAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  mediaStageRef: React.RefObject<HTMLDivElement | null>;
  onCopy?: () => void;
}

/** WhatsApp-style keyboard shortcuts for the media preview editor. */
export function useKeyboardShortcuts({
  open,
  activeTool,
  textInputActive,
  selectedElementId,
  showKeyboardHelp,
  mediaFilesLength,
  onClose,
  handleUndo,
  handleRedo,
  onSend,
  onApplyCrop,
  updateCurrentState,
  setActiveTool,
  setSelectedElementId,
  setShowKeyboardHelp,
  setCurrentIndex,
  setCanvasEmojiAnchorEl,
  mediaStageRef,
  onCopy,
}: UseKeyboardShortcutsArgs) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip all shortcuts when a modal/dialog is open (confirmation, etc.)
      if (document.querySelector('[aria-modal="true"]')) return;

      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (isInput) return;

      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else if (activeTool !== "none") {
          setActiveTool("none");
          setSelectedElementId(null);
        } else {
          onClose();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementId) {
          e.preventDefault();
          updateCurrentState((prev) => ({
            ...prev,
            texts: prev.texts.filter((t) => t.id !== selectedElementId),
            shapes: prev.shapes.filter((s) => s.id !== selectedElementId),
            emojis: prev.emojis.filter((m) => m.id !== selectedElementId),
          }));
          setSelectedElementId(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "z")
      ) {
        e.preventDefault();
        handleRedo();
      } else if (key === "p") {
        setActiveTool((curr) => (curr === "pen" ? "none" : "pen"));
        setSelectedElementId(null);
      } else if (key === "m") {
        setActiveTool((curr) => (curr === "marker" ? "none" : "marker"));
        setSelectedElementId(null);
      } else if (key === "t") {
        setActiveTool((curr) => (curr === "text" ? "none" : "text"));
        setSelectedElementId(null);
      } else if (key === "c") {
        setActiveTool((curr) => (curr === "crop" ? "none" : "crop"));
        setSelectedElementId(null);
      } else if (key === "f") {
        setActiveTool((curr) => (curr === "filter" ? "none" : "filter"));
        setSelectedElementId(null);
      } else if (key === "s") {
        setActiveTool((curr) => (curr === "shapes" ? "none" : "shapes"));
        setSelectedElementId(null);
      } else if (key === "b") {
        setActiveTool((curr) => (curr === "blur" ? "none" : "blur"));
        setSelectedElementId(null);
      } else if (key === "e") {
        setCanvasEmojiAnchorEl(mediaStageRef.current);
      } else if ((e.ctrlKey || e.metaKey) && key === "c" && !e.shiftKey) {
        // Copy current edited image to clipboard — only when not in an input
        // and no text selection to copy. Prevent default to avoid copying
        // selected canvas text instead of the image.
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          e.preventDefault();
          onCopy?.();
        }
      } else if (key === "r" && activeTool === "crop") {
        updateCurrentState((prev) => ({
          ...prev,
          rotation: (prev.rotation + 90) % 360,
        }));
      } else if (key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowKeyboardHelp((v) => !v);
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((i) => Math.min(mediaFilesLength - 1, i + 1));
      } else if (e.key === "Enter") {
        if (activeTool === "crop" && onApplyCrop) {
          e.preventDefault();
          onApplyCrop();
        } else if (activeTool === "text" || textInputActive) {
          // In text mode, Enter should only commit text via the inline input's
          // own handler. When the input isn't focused, do nothing — never send.
          e.preventDefault();
        } else {
          // Enter sends when not focused in an input (e.g. in crop/draw mode)
          e.preventDefault();
          onSend();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    open,
    activeTool,
    textInputActive,
    selectedElementId,
    showKeyboardHelp,
    handleUndo,
    handleRedo,
    onSend,
    onApplyCrop,
    mediaFilesLength,
    onClose,
    updateCurrentState,
    setActiveTool,
    setSelectedElementId,
    setShowKeyboardHelp,
    setCurrentIndex,
    setCanvasEmojiAnchorEl,
    mediaStageRef,
  ]);
}
