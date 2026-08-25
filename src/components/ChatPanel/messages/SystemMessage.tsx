"use client";

import { memo } from "react";
import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

interface SystemMessageProps {
  message?: string;
}

const SystemMessageComponent = ({ message }: SystemMessageProps) => {
  const theme = useTheme();

  if (!message) return null;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        margin: "16px auto",
        width: "100%",
        padding: "0 20px",
      }}
    >
      <Box
        sx={{
          backgroundColor: alpha(theme.palette.action.disabledBackground, 0.03),
          color: alpha(theme.palette.text.secondary, 0.85),
          padding: "4px 12px",
          borderRadius: "16px",
          fontSize: "0.6rem",
          fontWeight: 400,
          maxWidth: "85%",
          textAlign: "center",
          lineHeight: "1.4",
          letterSpacing: "0.05em",
        }}
      >
        {message}
      </Box>
    </Box>
  );
};

export default memo(SystemMessageComponent);
