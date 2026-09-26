"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { getTheme, type ColorMode, type ResolvedColorMode } from "./themes";

interface ColorModeContextValue {
  /** User's preference: "light" | "dark" | "system" */
  mode: ColorMode;
  /** The actual applied theme: "light" | "dark" (resolved from system if mode is "system") */
  resolvedMode: ResolvedColorMode;
  toggleMode: () => void;
  setMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "system",
  resolvedMode: "light",
  toggleMode: () => {},
  setMode: () => {},
});

export const useColorMode = (): ColorModeContextValue => useContext(ColorModeContext);

const STORAGE_KEY = "tecochat-color-mode";

function getSystemPreference(): ResolvedColorMode {
  if (typeof window === "undefined") return "light";
  try {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    // ignore
  }
  return "light";
}

function getInitialMode(): ColorMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // ignore
  }
  return "system";
}

function resolveMode(mode: ColorMode): ResolvedColorMode {
  if (mode === "system") return getSystemPreference();
  return mode;
}

export const ThemeRegistry = ({ children }: { children: React.ReactNode }) => {
  // Initialize synchronously from localStorage so the correct value is present
  // on the very first render. This prevents the persist effect from overwriting
  // the saved preference with the default "system" before the mount effect
  // has a chance to read it.
  // (This is a "use client" component, so the initializer runs in the browser
  // where localStorage and matchMedia are available.)
  // Read the stored preference once — both state initializers share the same
  // value so getInitialMode() (which hits localStorage) runs a single time.
  const [mode, setModeState] = useState<ColorMode>(() => getInitialMode());
  const [resolvedMode, setResolvedMode] = useState<ResolvedColorMode>(() =>
    resolveMode(mode)
  );

  // Apply data-theme to <html> + persist whenever mode or resolvedMode changes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", resolvedMode);
    document.documentElement.style.colorScheme = resolvedMode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode, resolvedMode]);

  // Recompute resolved mode when user's preference changes
  useEffect(() => {
    setResolvedMode(resolveMode(mode));
  }, [mode]);

  // Listen to system preference changes — only re-resolve when mode is "system"
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (mode !== "system") return; // user has an explicit choice
      setResolvedMode(e.matches ? "dark" : "light");
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [mode]);

  const colorMode = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      resolvedMode,
      toggleMode: () =>
        setModeState((prev) =>
          prev === "light" ? "dark" : prev === "dark" ? "system" : "light"
        ),
      setMode: (m) => setModeState(m),
    }),
    [mode, resolvedMode]
  );

  const theme = useMemo(() => getTheme(resolvedMode), [resolvedMode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

/**
 * Inline script string that runs before hydration to:
 * 1. Set data-theme on <html> from localStorage / system preference
 *    (prevents a flash of the wrong theme).
 * 2. Set data-keyboard on <html> when the mobile keyboard opens/closes
 *    (enables CSS rules like .hide-on-keyboard).
 * Inject this in <head> via next/script or a <script dangerouslySetInnerHTML>.
 */
export const themeNoFlashScript = `(function(){try{var k='tecochat-color-mode';var s=localStorage.getItem(k);var resolved;if(s==='light'||s==='dark'){resolved=s;}else{resolved=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}var d=document.documentElement;d.setAttribute('data-theme',resolved);d.style.colorScheme=resolved;}catch(e){}})();(function(){if(window.__tecochatKeyboardInit)return;window.__tecochatKeyboardInit=true;var d=document.documentElement;var base=window.innerHeight;function upd(){if(window.innerWidth>768){d.removeAttribute('data-keyboard');base=window.innerHeight;return;}base=Math.max(base,window.innerHeight);var open;if(window.visualViewport){open=Math.min(window.visualViewport.height,window.innerHeight)<base*0.75;}else{var nh=window.innerHeight;open=nh<base*0.7;}if(open){d.setAttribute('data-keyboard','open');}else{d.removeAttribute('data-keyboard');base=window.innerHeight;}}window.addEventListener('resize',upd);window.addEventListener('orientationchange',function(){base=window.innerHeight;upd();});if(window.visualViewport){window.visualViewport.addEventListener('resize',upd);}document.addEventListener('focusout',function(){setTimeout(function(){var a=document.activeElement;if(!(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable))){d.removeAttribute('data-keyboard');}},50);});window.addEventListener('pagehide',function(){window.removeEventListener('resize',upd);window.removeEventListener('orientationchange',upd);if(window.visualViewport){window.visualViewport.removeEventListener('resize',upd);}delete window.__tecochatKeyboardInit;});})();`;
