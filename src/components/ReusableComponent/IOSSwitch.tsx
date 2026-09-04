"use client";

import { styled, Switch } from "@mui/material";

/**
 * Apple/iOS-style toggle switch used across the app (group permissions,
 * notification settings, etc.). Uses CSS variables for theming:
 * - --color-toggle-knob: the knob color when ON
 * - --color-toggle-off: the track color when OFF
 */
const IOSSwitch = styled((props: any) => (
  <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
))(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 0,
    margin: 2,
    transitionDuration: "300ms",
    "&.Mui-checked": {
      transform: "translateX(16px)",
      color: "var(--color-toggle-knob)",
      "& + .MuiSwitch-track": {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
        border: 0,
      },
    },
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    width: 22,
    height: 22,
  },
  "& .MuiSwitch-track": {
    borderRadius: 13,
    backgroundColor: "var(--color-toggle-off)",
    opacity: 1,
  },
}));

export default IOSSwitch;
