"use client";

import { Tabs, Tab } from "@mui/material";
import MediaSection from "./MediaSection";
import DocumentsSection from "./DocumentsSection";

interface MediaItem {
  [key: string]: unknown;
}

interface MediaItems {
  images?: MediaItem[];
  videos?: MediaItem[];
  documents?: MediaItem[];
}

interface PaginationState {
  page: number;
  hasMore: boolean;
  isLoading: boolean;
}

interface Pagination {
  images: PaginationState;
  videos: PaginationState;
  documents: PaginationState;
}

interface MediaPanelViewProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mediaItems: MediaItems;
  pagination: Pagination;
  onLoadMoreMedia: (() => void) | null;
  onLoadMoreDocuments: (() => void) | null;
  onMediaClick: (media: MediaItem) => void;
  onDownload: (url: string, name: string) => void;
  enablePagination: boolean;
}

const MediaPanelView = ({
  activeTab,
  setActiveTab,
  mediaItems,
  pagination,
  onLoadMoreMedia,
  onLoadMoreDocuments,
  onMediaClick,
  onDownload,
  enablePagination,
}: MediaPanelViewProps) => {
  // The API returns all media types in a single call (fetched via "images"),
  // so when the initial images fetch is loading, all tabs should show skeletons
  // even though only pagination.images.isLoading is true.
  const initialFetchLoading =
    pagination.images.isLoading &&
    (mediaItems.images?.length || 0) === 0 &&
    (mediaItems.videos?.length || 0) === 0 &&
    (mediaItems.documents?.length || 0) === 0;

  return (
    <div className="media-panel-view">
      <Tabs
        value={activeTab}
        onChange={(e, val) => setActiveTab(val)}
        variant="fullWidth"
        className="mui-tabs-container"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": {
            minHeight: "48px",
            textTransform: "uppercase",
            fontWeight: 600,
            fontSize: "14px",
            letterSpacing: "0.5px",
            color: "var(--color-text-secondary)",
            "&.Mui-selected": {
              color: "primary.main",
            },
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "primary.main",
            height: 3,
          },
        }}
      >
        <Tab label="Media" value="media" />
        <Tab label="Docs" value="docs" />
        <Tab label="Video" value="videos" />
      </Tabs>
      <div className="tab-content">
        {activeTab === "media" && (
          <MediaSection
            mediaItems={{ images: mediaItems.images, videos: [] }}
            isLoading={pagination.images.isLoading || initialFetchLoading}
            hasMore={pagination.images.hasMore}
            onLoadMore={onLoadMoreMedia}
            onMediaClick={onMediaClick}
            paginationFlag={enablePagination}
          />
        )}
        {activeTab === "docs" && (
          <DocumentsSection
            documents={mediaItems.documents || []}
            isLoading={pagination.documents.isLoading || initialFetchLoading}
            hasMore={pagination.documents.hasMore}
            onLoadMore={onLoadMoreDocuments}
            onDocumentClick={onMediaClick}
            onDownload={onDownload}
            paginationFlag={enablePagination}
          />
        )}
        {activeTab === "videos" && (
          <MediaSection
            mediaItems={{ images: [], videos: mediaItems.videos }}
            isLoading={pagination.videos.isLoading || initialFetchLoading}
            onLoadMore={onLoadMoreMedia}
            onMediaClick={onMediaClick}
            paginationFlag={enablePagination}
            hasMore={pagination.videos.hasMore}
          />
        )}
      </div>
    </div>
  );
};

export default MediaPanelView;
