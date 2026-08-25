"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Typography,
} from "@mui/material";
import useLazyLoading from "./useLazyLoading";
import { Download, FileText } from "lucide-react";

interface DocItem {
  Id?: string | number;
  src?: string;
  FileUrl?: string;
  name?: string;
  FileName?: string;
  type?: string;
  MimeType?: string;
  [key: string]: unknown;
}

interface DocumentsSectionProps {
  documents: DocItem[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: (() => void) | null;
  onDocumentClick: (doc: DocItem) => void;
  onDownload: (url: string, name: string) => void;
  paginationFlag: boolean;
}

const DocumentsSection = ({
  documents,
  isLoading,
  hasMore,
  onLoadMore,
  onDocumentClick,
  onDownload,
  paginationFlag,
}: DocumentsSectionProps) => {
  // Lazy loading hook
  const lastDocumentElementRef = useLazyLoading(onLoadMore, hasMore && paginationFlag, isLoading);

  // Smooth empty-state transition
  const [showEmptyState, setShowEmptyState] = useState(false);
  useEffect(() => {
    if (!isLoading && documents.length === 0) {
      const timer = setTimeout(() => setShowEmptyState(true), 180);
      return () => clearTimeout(timer);
    } else {
      setShowEmptyState(false);
    }
  }, [isLoading, documents.length]);

  const renderSkeletons = () => (
    <Box>
      <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 500, mb: 1 }}>
        Documents
      </Typography>
      <List disablePadding>
        {Array.from({ length: 6 }).map((_, idx) => (
          <ListItem
            key={`doc-skel-${idx}`}
            disableGutters
            secondaryAction={
              <Skeleton variant="rounded" width={28} height={28} sx={{ borderRadius: 2 }} />
            }
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Skeleton variant="rounded" width={32} height={32} sx={{ borderRadius: 2 }} />
            </ListItemIcon>
            <ListItemText
              primary={<Skeleton variant="text" width="70%" />}
              secondary={<Skeleton variant="text" width="45%" />}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  // Show nothing if loading and no items
  if (isLoading && documents.length === 0) {
    return renderSkeletons();
  }

  // Show "No items" message if no items after loading
  if (documents.length === 0) {
    if (!showEmptyState) {
      return renderSkeletons();
    }
    return (
      <Box
        sx={{
          py: 4,
          textAlign: "center",
          color: "text.secondary",
          animation: "fadeIn 280ms ease-out",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5, opacity: 0.5 }}>
          <FileText size={44} />
        </Box>
        <Typography sx={{ fontWeight: 600, color: "text.primary" }}>No Document found</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
          Shared Document will appear here
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 500, mb: 1 }}>
        {documents.length} documents
      </Typography>
      <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {documents.map((doc, index) => {
          const isLastElement = index === documents.length - 1;
          const name = doc.name || doc.FileName || `Document ${doc.Id}`;
          const type = doc.type || doc.MimeType || "Document";
          const url = doc.src || doc.FileUrl || "";

          return (
            <Box key={doc.Id} ref={isLastElement ? lastDocumentElementRef : null}>
              <ListItem disableGutters disablePadding>
                <ListItemButton
                  onClick={() => onDocumentClick(doc)}
                  sx={{ borderRadius: 2 }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
                    <FileText size={18} />
                  </ListItemIcon>
                  <ListItemText
                    primary={name}
                    secondary={type}
                    slotProps={{
                      primary: {
                        noWrap: true,
                        title: name,
                        sx: { fontWeight: 500 },
                      },
                      secondary: { noWrap: true, title: type },
                    }}
                  />
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(url, name);
                    }}
                    title="Download document"
                    sx={{
                      ml: 1,
                      color: "text.secondary",
                      "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                    }}
                  >
                    <Download size={18} />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            </Box>
          );
        })}
      </List>

      {!paginationFlag && hasMore ? (
        <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
          <Button variant="outlined" onClick={onLoadMore || undefined} disabled={isLoading} size="small">
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default DocumentsSection;
