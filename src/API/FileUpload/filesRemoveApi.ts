import axios from "axios";
import { getHeaders, REMOVE_FILE_URL } from "../InitialApi/Config";

interface RemoveFileParams {
  attachments: string;
}

export const removeFileApi = async ({
  attachments,
}: RemoveFileParams): Promise<any> => {
  const data = { imageUrl: attachments };
  try {
    const response = await axios.post(REMOVE_FILE_URL(), data, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...getHeaders(),
      },
      maxBodyLength: Infinity,
    });
    return response;
  } catch (error) {
    console.error("File remove failed:", error);
  }
};
