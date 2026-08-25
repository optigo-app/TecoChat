import CryptoJS from "crypto-js";
import { filesUploadApi } from "./filesUploadApi";
import { compressImagesToWebP } from "../../utils/globalFunc";

interface UploadMediaParams {
  folderName?: string;
  files?: File[];
  onProgress?: (progress: number) => void;
}

export const uploadMediaAPi = async ({
  folderName = "ChatMedia",
  files = [],
  onProgress,
}: UploadMediaParams): Promise<any[]> => {
  try {
    if (!Array.isArray(files) || files.length === 0) return [];

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          if (!(file instanceof File)) return file;
          if (!file?.type?.startsWith("image/")) return file;

          const compressedResults = await compressImagesToWebP(file);
          const compressed = Array.isArray(compressedResults)
            ? compressedResults[0]
            : null;

          if (!compressed?.blob) return file;

          return new File([compressed.blob], compressed.compressedName || file.name, {
            type: compressed.blob.type || "image/webp",
            lastModified: file.lastModified,
          });
        } catch {
          return file;
        }
      })
    );

    const uniqueNo = CryptoJS.lib.WordArray.random(16).toString();

    const res = await filesUploadApi({
      attachments: processedFiles.map((file) => ({ file })),
      folderName,
      uniqueNo,
      onProgress,
    });

    if (res?.files && Array.isArray(res.files)) {
      return res.files;
    }

    return [];
  } catch (error) {
    console.error("uploadAndSaveTaskAttachments error:", error);
    return { success: false, error } as any;
  }
};
