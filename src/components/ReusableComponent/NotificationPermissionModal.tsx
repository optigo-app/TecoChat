"use client";

// Ported from OldChatReactCode/src/components/_ui/NotificationPermissionModal.js
// Shows a modal guiding the user to enable notifications, or explaining
// how to unblock if permission was denied.

import { Box, Typography, Button, Modal, Fade, Backdrop } from "@mui/material";
import { ArrowUpLeft } from "lucide-react";
import { useNotificationManager } from "../../contexts/NotificationContext";

export const NotificationPermissionModal = () => {
  const { showGuide, setShowGuide, executeNativeRequest, permissionStatus } =
    useNotificationManager();

  const isBlocked = permissionStatus === "denied";

  const handleOk = () => {
    executeNativeRequest(true);
  };

  return (
    <Modal
      open={showGuide}
      onClose={() => setShowGuide(false)}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 500,
          sx: { backgroundColor: "rgba(11, 20, 26, 0.85)" },
        },
      }}
    >
      <Fade in={showGuide}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "auto",
            minWidth: 320,
            maxWidth: 450,
            bgcolor: "transparent",
            outline: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            color: "white",
            px: 2,
          }}
        >
          <Box
            sx={{
              backgroundColor: isBlocked
                ? "rgba(234, 84, 85, 0.15)"
                : "rgba(115, 103, 240, 0.15)",
              borderRadius: "50%",
              p: 2,
              mb: 3,
              border: isBlocked
                ? "1px solid rgba(234, 84, 85, 0.3)"
                : "1px solid rgba(115, 103, 240, 0.3)",
            }}
          >
            <ArrowUpLeft
              size={48}
              color={isBlocked ? "#ea5455" : "#7367f0"}
              strokeWidth={3}
            />
          </Box>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              mb: 2,
              letterSpacing: "-0.5px",
            }}
          >
            {isBlocked ? "Notifications are blocked" : "Allow notifications"}
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "rgba(255, 255, 255, 0.7)",
              mb: 4,
              px: 2,
              lineHeight: 1.6,
            }}
          >
            {isBlocked ? (
              <>
                We cannot ask for permission because it was blocked.
                <br />
                Please click the <strong>Lock icon</strong> in your address bar,
                find <strong>Notifications</strong>, and select{" "}
                <strong>Allow</strong>. Then refresh the page.
              </>
            ) : (
              <>
                To get notifications for new messages, click{" "}
                <strong>Allow</strong> above.
              </>
            )}
          </Typography>

          <Button
            onClick={handleOk}
            variant="contained"
            sx={{
              backgroundColor: isBlocked ? "#ea5455" : "#7367f0",
              color: "white",
              borderRadius: "50px",
              px: 5,
              py: 1,
              fontWeight: 600,
              textTransform: "none",
              fontSize: "1rem",
              "&:hover": {
                backgroundColor: isBlocked ? "#d34344" : "#685dd8",
                boxShadow: isBlocked
                  ? "0 4px 12px rgba(234, 84, 85, 0.4)"
                  : "0 4px 12px rgba(115, 103, 240, 0.4)",
              },
            }}
          >
            {isBlocked ? "Allow" : "OK"}
          </Button>
        </Box>
      </Fade>
    </Modal>
  );
};

export default NotificationPermissionModal;
