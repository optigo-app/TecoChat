import { CommonAPI, buildLoginBody } from "../InitialApi/CommonApi";
import { getDeviceDetails } from "../../utils/getDeviceDetails";

export interface AutoLoginData {
  ufcc: string;
  userEmail: string;
  yearcode?: string;
  sv?: string | number;
}

export const fetchAutoLoginApi = async (data: AutoLoginData): Promise<any> => {
  const payload = {
    Ufcc: data.ufcc,
    UserEmail: data.userEmail,
    ...getDeviceDetails(),
  };

  const body = buildLoginBody(
    "RedirectToErp",
    data.userEmail,
    payload,
    "Chat module (login)"
  );

  const headers: Record<string, string> = {};

  if (data.yearcode) {
    headers["Yearcode"] = data.yearcode;
  }

  if (data.sv !== undefined && data.sv !== null && data.sv !== "") {
    headers["sv"] = String(data.sv);
  }

  return CommonAPI(body, {
    authType: "login",
    pageName: "RedirectToErp",
    headers,
  });
};
