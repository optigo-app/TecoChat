import { passwordToSha1 } from "../../utils/globalFunc";
import { CommonAPI, buildLoginBody } from "../InitialApi/CommonApi";

interface LoginCredentials {
  companycode?: string;
  userId?: string;
  password?: string;
}

export const fetchLoginApi = async (data: LoginCredentials): Promise<any> => {
  try {
    const password = data?.password ?? "";
    // Check if the password looks like an existing SHA1 hash (40 hex chars)
    // to prevent double-hashing if the browser auto-fills a previously hashed value.
    const isAlreadyHashed = /^[a-f0-9]{40}$/i.test(password);
    const hashedPassword = isAlreadyHashed
      ? password
      : await passwordToSha1(password);

    const payload = {
      Ufcc: (data?.companycode ?? "").trim(),
      UserEmail: (data?.userId ?? "").trim(),
      PWD: hashedPassword,
    };

    const body = buildLoginBody(
      "login",
      (data?.userId ?? "").trim(),
      payload,
      "Chat module (login)"
    );

    const response = await CommonAPI(body, { authType: "login" });

    if (response?.Data) {
      return response?.Data;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};
