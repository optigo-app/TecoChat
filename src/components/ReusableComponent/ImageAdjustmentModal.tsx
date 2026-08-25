"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  Tooltip,
} from "@mui/material";
import { X, RotateCw, ZoomIn, ZoomOut, Info } from "lucide-react";
import "./ImageAdjustmentModal.scss";

const CROP_SIZE = 300;

interface ImageAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  imageFile: File | null;
  onConfirm: (adjustedFile: File) => void;
  title?: string;
}

const ImageAdjustmentModal = ({
  open,
  onClose,
  imageFile,
  onConfirm,
  title = "Adjust Image",
}: ImageAdjustmentModalProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const getBaseDimensions = () => {
    if (!imageRef.current) return { w: CROP_SIZE, h: CROP_SIZE };
    const img = imageRef.current;
    const aspect = img.naturalWidth / img.naturalHeight;
    if (aspect > 1) {
      return { w: CROP_SIZE * aspect, h: CROP_SIZE };
    }
    return { w: CROP_SIZE, h: CROP_SIZE / aspect };
  };

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      setImageLoaded(false);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setIsDragging(false);
      setImageLoaded(false);
    }
  }, [open]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const getMaxOffset = (currentScale: number) => {
    const base = getBaseDimensions();
    const scaledWidth = base.w * currentScale;
    const scaledHeight = base.h * currentScale;
    const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
    const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);
    return { maxX, maxY };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;
    const { maxX, maxY } = getMaxOffset(scale);
    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    });
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clampPosition = (
    pos: { x: number; y: number },
    newScale: number
  ) => {
    const { maxX, maxY } = getMaxOffset(newScale);
    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y)),
    };
  };

  const handleZoomIn = () => {
    setScale((prev) => {
      const next = Math.min(prev + 0.1, 3);
      setPosition((p) => clampPosition(p, next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.1, 0.5);
      setPosition((p) => clampPosition(p, next));
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    setScale((prev) => {
      const next =
        e.deltaY < 0
          ? Math.min(prev + zoomIntensity, 3)
          : Math.max(prev - zoomIntensity, 0.5);
      setPosition((p) => clampPosition(p, next));
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "Enter":
          handleConfirm();
          break;
        case "ArrowUp":
          e.preventDefault();
          setPosition((prev) => clampPosition({ ...prev, y: prev.y - 10 }, scale));
          break;
        case "ArrowDown":
          e.preventDefault();
          setPosition((prev) => clampPosition({ ...prev, y: prev.y + 10 }, scale));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setPosition((prev) => clampPosition({ ...prev, x: prev.x - 10 }, scale));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPosition((prev) => clampPosition({ ...prev, x: prev.x + 10 }, scale));
          break;
        case "+":
        case "=":
          e.preventDefault();
          handleZoomIn();
          break;
        case "-":
          e.preventDefault();
          handleZoomOut();
          break;
        case "r":
        case "R":
          e.preventDefault();
          handleRotate();
          break;
        case "0":
          e.preventDefault();
          handleReset();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, scale, position]);

  const handleConfirm = async () => {
    if (!imageFile || !imageRef.current) return;

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        onConfirm(imageFile);
        return;
      }
      const img = new Image();

      img.onload = () => {
        const size = 640;
        canvas.width = size;
        canvas.height = size;

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);

        const cropSize = 300;
        const scaleFactor = size / cropSize;
        const imgAspect = img.width / img.height;
        let drawWidth: number, drawHeight: number;

        if (imgAspect > 1) {
          drawHeight = size;
          drawWidth = size * imgAspect;
        } else {
          drawWidth = size;
          drawHeight = size / imgAspect;
        }

        const offsetX = position.x * scaleFactor;
        const offsetY = position.y * scaleFactor;
        ctx.translate(offsetX, offsetY);
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              onConfirm(imageFile);
              return;
            }
            const adjustedFile = new File([blob], imageFile.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            onConfirm(adjustedFile);
          },
          "image/jpeg",
          0.95
        );
      };

      img.src = imageUrl || "";
    } catch (error) {
      console.error("Error processing image:", error);
      onConfirm(imageFile);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="image-adjustment-modal"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: "var(--color-wa-modal-bg)",
            color: "var(--color-wa-modal-text)",
            maxHeight: "90vh",
            boxShadow:
              "0px 5px 5px -3px rgba(0, 0, 0, 0.2), 0px 8px 10px 1px rgba(0, 0, 0, 0.14), 0px 3px 14px 2px rgba(0, 0, 0, 0.12)",
          },
        },
        backdrop: {
          sx: {
            backgroundColor: "var(--color-wa-overlay-bg)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.25s ease-out",
          },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.2,
          borderBottom: "1px solid var(--color-wa-modal-header-border)",
          bgcolor: "var(--color-wa-modal-bg)",
        }}
      >
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
        <Typography
          sx={{ fontFamily: "Poppins", fontWeight: 500, fontSize: "16px", color: "var(--color-wa-modal-text)" }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
          <IconButton
            onClick={handleZoomOut}
            size="small"
            disabled={scale <= 0.5}
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <ZoomOut size={18} />
          </IconButton>
          <IconButton
            onClick={handleZoomIn}
            size="small"
            disabled={scale >= 3}
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <ZoomIn size={18} />
          </IconButton>
          <IconButton
            onClick={handleRotate}
            size="small"
            sx={{ bgcolor: "var(--color-wa-icon-bg)", "&:hover": { bgcolor: "var(--color-wa-icon-bg-hover)", color: "#fff" } }}
          >
            <RotateCw size={18} />
          </IconButton>
          <Button
            size="small"
            onClick={handleReset}
            sx={{ textTransform: "none", fontSize: 13, minWidth: "auto", px: 1 }}
          >
            Reset
          </Button>
          <Tooltip
            title="Keyboard shortcuts: Arrows=Move, +/-=Zoom, R=Rotate, 0=Reset, Enter=Confirm, Esc=Cancel"
            arrow
            placement="bottom-end"
          >
            <IconButton
              sx={{ color: "var(--color-text-secondary)", "&:hover": { color: "var(--color-primary)", bgcolor: "rgba(115, 103, 240, 0.08)" } }}
            >
              <Info size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: "var(--color-wa-input-bg)" }}>
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          className="image-adjustment-container"
          sx={{
            position: "relative",
            height: 320,
            overflow: "hidden",
            cursor: isDragging ? "grabbing" : "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "var(--color-wa-input-bg)",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.9)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
          {imageUrl && (() => {
            const base = getBaseDimensions();
            return (
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Adjust"
                onLoad={handleImageLoad}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: base.w,
                  height: base.h,
                  transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.1s ease",
                  userSelect: "none",
                  pointerEvents: "none",
                  opacity: imageLoaded ? 1 : 0,
                }}
              />
            );
          })()}
          {!imageLoaded && imageUrl && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "var(--color-wa-modal-text)",
              }}
            >
              <Typography sx={{ fontFamily: "Poppins" }}>Loading...</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 2, p: 2, bgcolor: "var(--color-wa-modal-bg)" }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onClose}
            sx={{ fontFamily: "Poppins", textTransform: "capitalize", borderRadius: "16px" }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleConfirm}
            sx={{ fontFamily: "Poppins", textTransform: "capitalize", borderRadius: "16px" }}
          >
            Done
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ImageAdjustmentModal;
