// Type definitions for the custom theme palette fields used across the app.
// We avoid module augmentation with indexed interface syntax (which this
// TypeScript version does not support) and instead define a custom AppTheme
// type that extends the base MUI Theme with our extra palette fields.

import type { Theme, Palette, PaletteOptions } from "@mui/material/styles";

export interface CustomPrimaryPalette {
  gradient?: string;
  blue?: string;
  secondary?: string;
}

export interface CustomBackgroundPalette {
  hightlight?: string;
}

export interface CustomTextPalette {
  dark?: string;
  light?: string;
  extraLight?: string;
}

export interface CustomStatusPalette {
  lightBg?: string;
}

export interface CustomBorderColorPalette {
  main: string;
  light: string;
  dark: string;
  secondary: string;
  extraLight: string;
  contrastText: string;
}

export interface CustomButtonPalette {
  background: string;
  color: string;
  hilightColor: string;
  hoverColor: string;
  activeColor: string;
  disabledColor: string;
  focusColor: string;
  selectedColor: string;
}

export interface CustomImportancePalette {
  high: { background: string; text: string };
  low: { background: string; text: string };
}

export interface CustomShadowPalette {
  boxShadow: string;
  boxShadow1: string;
}

export interface AppPalette extends Palette {
  primary: Palette["primary"] & CustomPrimaryPalette;
  background: Palette["background"] & CustomBackgroundPalette;
  text: Palette["text"] & CustomTextPalette;
  success: Palette["success"] & CustomStatusPalette;
  error: Palette["error"] & CustomStatusPalette;
  warning: Palette["warning"] & CustomStatusPalette;
  info: Palette["info"] & CustomStatusPalette;
  borderColor?: CustomBorderColorPalette;
  button?: CustomButtonPalette;
  importance?: CustomImportancePalette;
  shadow?: CustomShadowPalette;
}

export interface AppTheme extends Theme {
  palette: AppPalette;
}

// Helper to cast a created theme (with custom palette fields) to AppTheme
export const asAppTheme = (theme: Theme): AppTheme => theme as AppTheme;
