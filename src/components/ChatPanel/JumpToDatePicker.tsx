"use client";

import { memo, useCallback } from "react";
import { Dialog, Popover, useTheme, alpha } from "@mui/material";
import { DateCalendar } from "@mui/x-date-pickers";

interface JumpToDatePickerProps {
  open: boolean;
  onClose: () => void;
  onAccept: (value: Date | null) => void;
  isMobile: boolean;
  anchorEl?: HTMLElement | null;
}

const JumpToDatePickerComponent = ({
  open,
  onClose,
  onAccept,
  isMobile,
  anchorEl,
}: JumpToDatePickerProps) => {
  const theme = useTheme();

  const handleChange = useCallback(
    (newValue: Date | null) => {
      if (newValue) {
        onAccept(newValue);
      }
      onClose();
    },
    [onAccept, onClose]
  );

  // Shared calendar chrome — dark/light aware via theme + CSS vars.
  const calendarSx = {
    "& .MuiDateCalendar-root": {
      width: "min(320px, 100%)",
      height: 320,
      backgroundColor: "transparent",
      color: "var(--color-title)",
    },
    "& .MuiDayCalendar-weekDayLabel": {
      color: "var(--color-text-secondary)",
    },
    "& .MuiPickerDay-today": {
      borderColor: theme.palette.primary.main,
    },
    "& .MuiPickerDay-root:not(.Mui-selected):not(.Mui-disabled):hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.15),
    },
    "& .Mui-selected": {
      backgroundColor: `${theme.palette.primary.main} !important`,
      color: "#fff !important",
    },
    "& .MuiPickersCalendarHeader-label": {
      color: "var(--color-title)",
    },
    "& .MuiPickersArrowSwitcher-button": {
      color: "var(--color-text-secondary)",
    },
  };

  // Mobile: a centered Dialog with the same DateCalendar — tapping a day
  // fires onChange → accept + close, same as desktop. (MobileDatePicker was
  // broken: controlled value={null} + noop onChange meant OK always
  // returned null, so the date search never ran.)
  if (isMobile) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              backgroundColor: "var(--color-surface-elevated)",
              border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
              boxShadow: "var(--shadow-picker)",
              overflow: "hidden",
              p: 0,
              m: 2,
              ...calendarSx,
            },
          },
        }}
      >
        <DateCalendar
          value={null}
          onChange={handleChange}
          maxDate={new Date()}
          openTo="day"
          sx={{ backgroundColor: "transparent" }}
        />
      </Dialog>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      transitionDuration={0}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            backgroundColor: "var(--color-surface-elevated)",
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            boxShadow: "var(--shadow-picker)",
            overflow: "hidden",
            p: 0,
            ...calendarSx,
          },
        },
      }}
    >
      <DateCalendar
        value={null}
        onChange={handleChange}
        maxDate={new Date()}
        openTo="day"
        sx={{ backgroundColor: "transparent" }}
      />
    </Popover>
  );
};

export const JumpToDatePicker = memo(JumpToDatePickerComponent);
export default JumpToDatePicker;
