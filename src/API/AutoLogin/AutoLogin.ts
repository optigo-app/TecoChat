import { CommonAPI, buildLoginBody } from "../InitialApi/CommonApi";

export interface AutoLoginData {
  uid: string;
  yc: string;
  userId?: string | number;
}

export const fetchAutoLoginApi = async (data: AutoLoginData): Promise<any> => {
  const body = buildLoginBody(
    "crm_redirect",
    data.uid,
    undefined,
    "crm_redirect"
  );
  body.p = "";

  const headers: Record<string, string> = {
    Yearcode: data.yc,
  };

  if (data.userId !== undefined && data.userId !== null && data.userId !== "") {
    headers["sv"] = String(data.userId);
  }

  return CommonAPI(body, {
    authType: "login",
    pageName: "crm_redirect",
    headers,
  });
};
