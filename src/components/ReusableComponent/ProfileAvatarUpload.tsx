"use client";

import { useState, useEffect } from "react";
import { Avatar, CircularProgress } from "@mui/material";
import { Camera, Upload, Eye, Trash2 } from "lucide-react";
import {
  checkCameraAvailability,
  capturePhotoFromCamera,
  openImageFilePicker,
} from "../../utils/cameraUtils";
import { uploadMediaAPi } from "../../API/FileUpload/uploadHelpers";
import { removeFileApi } from "../../API/FileUpload/filesRemoveApi";
import {
  getWhatsAppAvatarConfig,
  isImageDead,
  markImageAsDead,
} from "../../utils/globalFunc";
import toast from "react-hot-toast";
import ConfirmationDialog from "./ConfirmationDialog";
import WhatsAppMenu from "./WhatsAppMenu";
import ImageAdjustmentModal from "./ImageAdjustmentModal";
import ViewPhotoDialog from "./ViewPhotoDialog";
import "./ProfileAvatarUpload.scss";

interface ProfileAvatarUploadProps {
  size?: number;
  currentImageUrl?: string | null;
  avatarSeed?: string;
  showOverlay?: boolean;
  overlayText?: string;
  onImageSelected?: (file: File, previewUrl: string) => void;
  onUploadComplete?: (imageUrl: string, file: File) => void | Promise<void>;
  onUploadError?: (error: unknown) => void;
  onRemoveComplete?: () => void;
  disabled?: boolean;
  className?: string;
  folderName?: string;
}

const ProfileAvatarUpload = ({
  size = 130,
  currentImageUrl = null,
  avatarSeed = "",
  showOverlay = true,
  overlayText = "Add group icon",
  onImageSelected,
  onUploadComplete,
  onUploadError,
  onRemoveComplete,
  disabled = false,
  className = "",
  folderName = "tecochat/profileImage",
}: ProfileAvatarUploadProps) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(currentImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraDialog, setCameraDialog] = useState({ open: false, message: "" });
  const [removeDialog, setRemoveDialog] = useState({ open: false });
  const [adjustmentModal, setAdjustmentModal] = useState<{
    open: boolean;
    file: File | null;
  }>({ open: false, file: null });
  const [viewDialog, setViewDialog] = useState({ open: false, imageUrl: "" });

  useEffect(() => {
    setPreviewImage(currentImageUrl);
  }, [currentImageUrl]);

  const hasExistingImage = !!(currentImageUrl || previewImage);

  const photoMenuItems = hasExistingImage
    ? [
        { label: "View Photo", action: "viewPhoto", icon: <Eye size={20} /> },
        { label: "Take Photo", action: "takePhoto", icon: <Camera size={20} /> },
        { label: "Upload Photo", action: "uploadPhoto", icon: <Upload size={20} /> },
        { label: "Remove Photo", action: "removePhoto", icon: <Trash2 size={20} />, danger: true },
      ]
    : [
        { label: "Take Photo", action: "takePhoto", icon: <Camera size={20} /> },
        { label: "Upload Photo", action: "uploadPhoto", icon: <Upload size={20} /> },
      ];

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      setMenuAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleTakePhoto = async () => {
    handleMenuClose();
    const hasCamera = await checkCameraAvailability();
    if (!hasCamera) {
      setCameraDialog({
        open: true,
        message:
          'No camera detected on this device. Please use "Upload Photo" to select an image from your files.',
      });
      return;
    }
    capturePhotoFromCamera((files) => {
      handlePhotoSelected(files);
    });
  };

  const handleUploadPhoto = async () => {
    handleMenuClose();
    openImageFilePicker((files) => {
      handlePhotoSelected(files);
    }, false);
  };

  const handleViewPhoto = () => {
    handleMenuClose();
    const imageUrl = currentImageUrl || previewImage;
    if (imageUrl) {
      setViewDialog({ open: true, imageUrl });
    }
  };

  const handleRemovePhoto = () => {
    handleMenuClose();
    setRemoveDialog({ open: true });
  };

  const handleConfirmRemove = async () => {
    setRemoveDialog({ open: false });
    setIsUploading(true);
    try {
      if (currentImageUrl) markImageAsDead(currentImageUrl);
      await removeExistingImage(currentImageUrl || undefined);
      setPreviewImage(null);
      if (onRemoveComplete) {
        onRemoveComplete();
      } else {
        toast.success("Photo removed successfully");
      }
    } catch (error) {
      console.error("Error removing photo:", error);
      if (onUploadError) {
        onUploadError(error);
      } else {
        toast.error("Error removing photo");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeExistingImage = async (imageUrl?: string) => {
    if (!imageUrl) return;
    try {
      const response = await removeFileApi({ attachments: imageUrl });
      console.log("Existing image removed from storage:", response?.status);
      return response;
    } catch (error) {
      console.error("Error removing existing image:", error);
    }
  };

  const handlePhotoSelected = (files: File[]) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setAdjustmentModal({ open: true, file });
    }
  };

  const handleAdjustmentComplete = async (adjustedFile: File) => {
    setAdjustmentModal({ open: false, file: null });

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
      if (onImageSelected) {
        onImageSelected(adjustedFile, result);
      }
    };
    reader.readAsDataURL(adjustedFile);

    if (!onImageSelected) {
      await uploadPhotoWithRemoval(adjustedFile);
    }
  };

  const handleAdjustmentCancel = () => {
    setAdjustmentModal({ open: false, file: null });
  };

  const uploadPhotoWithRemoval = async (file: File) => {
    setIsUploading(true);
    const previousImageUrl = currentImageUrl || previewImage;
    try {
      const uploadedFiles = await uploadMediaAPi({
        folderName,
        files: [file],
        onProgress: (progress) => {
          console.log("Upload progress:", progress);
        },
      });

      if (uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
        const uploadedFile = uploadedFiles[0];
        const imageUrl =
          uploadedFile?.FileUrl ||
          uploadedFile?.fileUrl ||
          uploadedFile?.Url ||
          uploadedFile?.url ||
          uploadedFile?.path;

        if (!imageUrl) {
          throw new Error("Failed to get image URL from upload");
        }

        if (onUploadComplete) {
          await onUploadComplete(imageUrl, file);
        } else {
          toast.success("Photo uploaded successfully");
        }

        if (previousImageUrl && previousImageUrl !== imageUrl) {
          await removeExistingImage(previousImageUrl);
        }
      } else {
        throw new Error("Upload failed - no files returned");
      }
    } catch (error) {
      console.error("Error in upload process:", error);
      if (onUploadError) {
        onUploadError(error);
      } else {
        toast.error("Error uploading photo");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseCameraDialog = () => {
    setCameraDialog({ open: false, message: "" });
  };

  const displayImage =
    previewImage || (currentImageUrl && !isImageDead(currentImageUrl))
      ? (previewImage || currentImageUrl)
      : null;

  return (
    <>
      <div
        className={`avatar-container ${className}`}
        onClick={handleAvatarClick}
        style={{ cursor: disabled ? "default" : "pointer" }}
      >
        <Avatar
          {...getWhatsAppAvatarConfig(avatarSeed, size)}
          className="profile-avatar"
          src={displayImage || undefined}
          sx={{
            width: size,
            height: size,
            ...(getWhatsAppAvatarConfig(avatarSeed, size) as any).sx,
          }}
        />

        {showOverlay && !disabled && (
          <div className="avatar-overlay">
            {isUploading ? (
              <CircularProgress size={24} sx={{ color: "white" }} />
            ) : (
              <>
                <Camera size={24} />
                <span style={{ fontSize: "10px", marginTop: "4px" }}>
                  {overlayText.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <WhatsAppMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        items={photoMenuItems}
        onAction={(action) => {
          if (action === "takePhoto") handleTakePhoto();
          if (action === "uploadPhoto") handleUploadPhoto();
          if (action === "viewPhoto") handleViewPhoto();
          if (action === "removePhoto") handleRemovePhoto();
        }}
        sx={{
          minWidth: 200,
          boxShadow: "0px 6px 18px rgba(0,0,0,0.12), 0px 3px 6px rgba(0,0,0,0.08)",
          px: 1,
        }}
        transformOrigin={{ horizontal: "center", vertical: "top" }}
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
      />

      <ConfirmationDialog
        isOpen={cameraDialog.open}
        onClose={handleCloseCameraDialog}
        onConfirm={handleCloseCameraDialog}
        title="Camera Not Available"
        description={cameraDialog.message}
        confirmText="OK"
        variant="primary"
        showCancel={false}
      />

      <ConfirmationDialog
        isOpen={removeDialog.open}
        onClose={() => setRemoveDialog({ open: false })}
        onConfirm={handleConfirmRemove}
        title="Remove Profile Photo"
        description="Are you sure you want to remove this profile photo?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        showCancel={true}
      />

      <ImageAdjustmentModal
        open={adjustmentModal.open}
        onClose={handleAdjustmentCancel}
        imageFile={adjustmentModal.file}
        onConfirm={handleAdjustmentComplete}
        title="Adjust Profile Image"
      />

      <ViewPhotoDialog
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, imageUrl: "" })}
        imageUrl={viewDialog.imageUrl}
      />
    </>
  );
};

export default ProfileAvatarUpload;
