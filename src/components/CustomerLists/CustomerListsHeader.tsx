"use client";

import React from "react";
import { TextField, InputAdornment, IconButton, Box, Typography, Tooltip } from "@mui/material";
import { Search, X, MessageSquarePlus, Users, ArrowLeft, WifiOff } from "lucide-react";

interface CustomerListsHeaderProps {
  isArchiveOpen: boolean;
  searchTerm: string;
  searchLoading: boolean;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  onBack: () => void;
  onNewChat: () => void;
  onCreateGroup: () => void;
  mobileMenuTrigger?: React.ReactNode;
  isOffline?: boolean;
}

export const CustomerListsHeader = ({
  isArchiveOpen,
  searchTerm,
  searchLoading,
  handleSearchChange,
  handleKeyDown,
  onBack,
  onNewChat,
  onCreateGroup,
  mobileMenuTrigger,
  isOffline = false,
}: CustomerListsHeaderProps) => {
  return (
    <>
      {/* Title row */}
      <div className="customer_lists_header">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          {mobileMenuTrigger}
          {isArchiveOpen && (
            <Tooltip title="Back" arrow placement="top">
              <IconButton size="small" onClick={onBack} className="back-button" aria-label="Back">
                <ArrowLeft size={18} />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h6" className="header_title">
            {isArchiveOpen ? "Archived Chats" : "Chats"}
          </Typography>
        </Box>

        <div className="add_conv_box">
          {isOffline && (
            <Tooltip title="You're offline. Viewing saved chats. New messages will be sent when you reconnect." arrow placement="top">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "rgba(211, 47, 47, 0.12)",
                  color: "var(--color-error, #d32f2f)",
                  flexShrink: 0,
                }}
              >
                <WifiOff size={18} />
              </Box>
            </Tooltip>
          )}
          {!isArchiveOpen && (
            <>
              <Tooltip title={isOffline ? "You're offline — new chat unavailable" : "New Chat"} arrow placement="top">
                <span>
                  <IconButton
                    size="small"
                    className="add_conv"
                    onClick={onNewChat}
                    disabled={isOffline}
                    aria-label="New chat"
                  >
                    <MessageSquarePlus size={20} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isOffline ? "You're offline — group creation unavailable" : "Create Group"} arrow placement="top">
                <span>
                  <IconButton
                    size="small"
                    className="add_conv"
                    onClick={onCreateGroup}
                    disabled={isOffline}
                    aria-label="Create group"
                  >
                    <Users size={20} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Search row */}
      <div className="customer_lists_search">
        <TextField
          fullWidth
          size="small"
          placeholder={isArchiveOpen ? "Search archived..." : "Search chats..."}
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} style={{ color: "var(--color-text-2nd)" }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <Tooltip title="Clear" arrow placement="top">
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleSearchChange({
                          target: { value: "" },
                        } as React.ChangeEvent<HTMLInputElement>)
                      }
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : searchLoading ? (
                <InputAdornment position="end">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(115,103,240,0.2)",
                      borderTopColor: "var(--color-primary)",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                </InputAdornment>
              ) : null,
            },
          }}
        />
      </div>
    </>
  );
};
