"use client";

export const checkCameraAvailability = async (): Promise<boolean> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return false;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "videoinput");
  } catch (error) {
    console.error("Error checking camera availability:", error);
    return false;
  }
};

export const requestCameraPermission = async (): Promise<{
  granted: boolean;
  stream: MediaStream | null;
}> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return { granted: true, stream };
  } catch (error) {
    console.error("Camera permission denied or error:", error);
    return { granted: false, stream: null };
  }
};

export const stopMediaStream = (stream: MediaStream | null) => {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
};

export const openImageFilePicker = (
  onFileSelect: (files: File[]) => void,
  multiple = false
) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = multiple;

  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length > 0) {
      onFileSelect(files);
    }
  };

  input.click();
};

export const capturePhotoFromCamera = (onCapture: (files: File[]) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = (e) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length > 0) {
      onCapture(files);
    }
  };

  input.click();
};
