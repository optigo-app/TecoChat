import { createTheme } from "@mui/material/styles";
import { asAppTheme, type AppTheme } from "./theme-types";

// Font family — Poppins is loaded via <link> in app/layout.tsx and exposed
// as the --font-family CSS variable in app/globals.css. MUI needs the literal
// stack (it can't read a CSS var at theme-creation time), so we duplicate it
// here. Keep in sync with the --font-family definition in globals.css.
const poppinsFont =
  "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

// ColorMode = the user's preference (stored in localStorage).
// ResolvedColorMode = the actual theme applied ("light" or "dark").
export type ColorMode = "light" | "dark" | "system";
export type ResolvedColorMode = "light" | "dark";

// Common typography + component overrides shared by both modes.
const getCommonOptions = (mode: ResolvedColorMode) => ({
  typography: {
    fontFamily: poppinsFont,
    h1: { fontFamily: poppinsFont, fontWeight: 700, fontSize: "2.5rem", lineHeight: 1.2 },
    h2: { fontFamily: poppinsFont, fontWeight: 600, fontSize: "2rem", lineHeight: 1.3 },
    h3: { fontFamily: poppinsFont, fontWeight: 600, fontSize: "1.75rem", lineHeight: 1.3 },
    h4: { fontFamily: poppinsFont, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1.4 },
    h5: { fontFamily: poppinsFont, fontWeight: 600, fontSize: "1.25rem", lineHeight: 1.4 },
    h6: { fontFamily: poppinsFont, fontWeight: 600, fontSize: "1.125rem", lineHeight: 1.4 },
    subtitle1: { fontFamily: poppinsFont, fontWeight: 500, fontSize: "1rem", lineHeight: 1.5 },
    subtitle2: { fontFamily: poppinsFont, fontWeight: 500, fontSize: "0.875rem", lineHeight: 1.5 },
    body1: { fontFamily: poppinsFont, fontWeight: 400, fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontFamily: poppinsFont, fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.5 },
    button: { fontFamily: poppinsFont, fontWeight: 500, fontSize: "0.875rem", lineHeight: 1.75, textTransform: "none" as const },
    caption: { fontFamily: poppinsFont, fontWeight: 400, fontSize: "0.75rem", lineHeight: 1.66 },
    overline: { fontFamily: poppinsFont, fontWeight: 400, fontSize: "0.75rem", lineHeight: 2.66, textTransform: "uppercase" as const },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: poppinsFont },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: poppinsFont,
          fontWeight: 500,
          textTransform: "none",
          borderRadius: 8,
          padding: "8px 16px",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": { fontFamily: poppinsFont },
          "& .MuiInputLabel-root": { fontFamily: poppinsFont },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { fontFamily: poppinsFont, fontWeight: 500 } },
    },
    MuiTypography: {
      styleOverrides: { root: { fontFamily: poppinsFont } },
    },
    MuiIconButton: {
      styleOverrides: { root: { fontFamily: poppinsFont } },
    },
    MuiPaper: {
      styleOverrides: { root: { fontFamily: poppinsFont } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

// Brand colors shared between modes
const PRIMARY = "#7367f0";
const PRIMARY_GRADIENT =
  "linear-gradient(270deg, rgba(115, 103, 240, 0.7) 0%, #7367f0 100%)";

// Custom palette fields (gradient, blue, lightBg, borderColor, button,
// importance, shadow, etc.) are not in MUI's PaletteOptions type.
// We type the options as `any` to allow them; the resulting theme is
// typed via AppTheme (see theme-types.ts).
const lightOptions: any = {
  palette: {
    mode: "light",
    primary: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      gradient: PRIMARY_GRADIENT,
      blue: "#007bfc",
      secondary: "#7D7f85",
      contrastText: "#ffffff",
    },
    secondary: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      contrastText: "#ffffff",
    },
    success: {
      main: "#1d9051ff",
      light: "#c8e6c9",
      lightBg: "rgba(40, 199, 111, 0.16)",
    },
    error: {
      main: "#d32f2f",
      light: "#ffcdd2",
      lightBg: "rgba(211, 47, 47, 0.16)",
    },
    warning: {
      main: "#f57c00",
      light: "#ffe0b2",
      lightBg: "rgba(245, 124, 0, 0.16)",
    },
    info: {
      main: "#00CFE8",
      light: "#b3e5fc",
      lightBg: "rgba(0, 207, 232, 0.16)",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
      hightlight: PRIMARY,
    },
    text: {
      primary: "#444050",
      secondary: "#7D7f85",
      disabled: "#9e9e9e",
      dark: "#0A0A0A",
      light: "#bebebeff",
      extraLight: "#f1f1f1",
    },
    borderColor: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      secondary: "#7D7f85",
      extraLight: "#5a5a5a0e",
      contrastText: "#ffffff",
    },
    button: {
      background: PRIMARY_GRADIENT,
      color: "#ffffff",
      hilightColor: PRIMARY,
      hoverColor: PRIMARY,
      activeColor: PRIMARY,
      disabledColor: PRIMARY,
      focusColor: PRIMARY,
      selectedColor: PRIMARY,
    },
    importance: {
      high: { background: PRIMARY_GRADIENT, text: "#444050" },
      low: { background: "linear-gradient(135deg, #f7f7f7 0%, #e5e5e5 100%)", text: "#444050" },
    },
    shadow: {
      boxShadow: "rgba(0, 0, 0, 0.05) 0px 6px 24px, rgba(0, 0, 0, 0.03) 0px 0px 0px 1px;",
      boxShadow1: "0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.08)",
    },
    grey: {
      50: "#fafafa", 100: "#f5f5f5", 200: "#eeeeee", 300: "#e0e0e0",
      400: "#bdbdbd", 500: "#9e9e9e", 600: "#757575", 700: "#616161",
      800: "#424242", 900: "#212121",
    },
  },
  ...getCommonOptions("light"),
};

const darkOptions: any = {
  palette: {
    mode: "dark",
    primary: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      gradient: PRIMARY_GRADIENT,
      blue: "#3d9bff",
      secondary: "#9D9fA5",
      contrastText: "#ffffff",
    },
    secondary: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      contrastText: "#ffffff",
    },
    success: {
      main: "#28C76F",
      light: "#1e6b42",
      lightBg: "rgba(40, 199, 111, 0.16)",
    },
    error: {
      main: "#ff4d4f",
      light: "#5c1f1f",
      lightBg: "rgba(255, 77, 79, 0.16)",
    },
    warning: {
      main: "#ffb74d",
      light: "#5c3a10",
      lightBg: "rgba(255, 183, 77, 0.16)",
    },
    info: {
      main: "#29d4f0",
      light: "#0d4a52",
      lightBg: "rgba(41, 212, 240, 0.16)",
    },
    background: {
      default: "#161622",
      paper: "#232333",
      hightlight: PRIMARY,
    },
    text: {
      primary: "#E4E4EF",
      secondary: "#A0A0B5",
      disabled: "#8a8a9e",
      dark: "#FFFFFF",
      light: "#5a5a6e",
      extraLight: "#34343f",
    },
    borderColor: {
      main: PRIMARY,
      light: PRIMARY,
      dark: PRIMARY,
      secondary: "#9D9fA5",
      extraLight: "rgba(255,255,255,0.08)",
      contrastText: "#ffffff",
    },
    button: {
      background: PRIMARY_GRADIENT,
      color: "#ffffff",
      hilightColor: PRIMARY,
      hoverColor: PRIMARY,
      activeColor: PRIMARY,
      disabledColor: PRIMARY,
      focusColor: PRIMARY,
      selectedColor: PRIMARY,
    },
    importance: {
      high: { background: PRIMARY_GRADIENT, text: "#E4E4EF" },
      low: { background: "linear-gradient(135deg, #2a2a3a 0%, #1c1c2a 100%)", text: "#E4E4EF" },
    },
    shadow: {
      boxShadow: "rgba(0, 0, 0, 0.4) 0px 6px 24px, rgba(0, 0, 0, 0.3) 0px 0px 0px 1px;",
      boxShadow1: "0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)",
    },
    grey: {
      50: "#1e1e2a", 100: "#232333", 200: "#2a2a3d", 300: "#34344a",
      400: "#45455c", 500: "#5a5a72", 600: "#75758c", 700: "#9a9aae",
      800: "#c2c2d0", 900: "#e4e4ef",
    },
  },
  ...getCommonOptions("dark"),
};

const lightTheme = createTheme(lightOptions);
const darkTheme = createTheme(darkOptions);

export const getTheme = (mode: ResolvedColorMode): AppTheme =>
  asAppTheme(mode === "dark" ? darkTheme : lightTheme);
