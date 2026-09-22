"use client";

import { memo, useCallback } from "react";
import { Popover, useTheme, alpha } from "@mui/material";
import { MobileDatePicker, DateCalendar } from "@mui/x-date-pickers";

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

  if (isMobile) {
    return (
      <MobileDatePicker
        open={open}
        onClose={onClose}
        onAccept={onAccept}
        value={null}
        onChange={() => {}}
        maxDate={new Date()}
        closeOnSelect={false}
        slotProps={{
          textField: { sx: { display: "none" } },
          mobilePaper: {
            sx: {
              borderRadius: "16px 16px 0 0",
              backgroundColor: "var(--color-surface-elevated)",
              pb: "var(--safe-bottom)",
              overflow: "hidden",
            },
          },
          dialog: {
            sx: {
              "& .MuiDialog-paper": {
                borderRadius: "16px 16px 0 0 !important",
                overflow: "hidden",
              },
            },
          },
        }}
      />
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
            "& .MuiDateCalendar-root": {
              width: 320,
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
