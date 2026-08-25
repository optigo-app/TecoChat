// Wrapper for emitInternalStoreSocketData — matches old app's socketHelper.js.
import { emitInternalStoreSocketData } from "../socket";
import type { SocketStoreData } from "../socket";

export const registerSocketId = async (data: SocketStoreData): Promise<boolean> => {
  try {
    const response = emitInternalStoreSocketData(data);
    if (response) {
      console.log("✅ Socket ID registered successfully:", response);
      return true;
    }
    console.warn("⚠️ Socket ID registration returned empty response");
    return false;
  } catch (error) {
    console.error("❌ Failed to register socket ID:", error);
    throw error;
  }
};
