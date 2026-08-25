import axios from "axios";
import { getHeaders, LOGOUTAPI } from "./Config";

export const logoutApi = async (
  body: unknown,
  _whatsappNumber?: string
): Promise<any> => {
  try {
    const headers = getHeaders();

    const { data } = await axios.post(LOGOUTAPI(), body, { headers });
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
};
