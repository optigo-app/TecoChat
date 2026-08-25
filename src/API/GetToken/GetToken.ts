import { CommonAPI, buildLoginBody } from "../InitialApi/CommonApi";

export const getToken = async (companyCode: string): Promise<any> => {
  try {
    const payload = { Ufcc: companyCode };
    const body = buildLoginBody(
      "VerifyCompany",
      "",
      payload,
      "VerifyCompany By Company Code (ConversionDetail)"
    );

    const response = await CommonAPI(body, { authType: "login" });
    if (response?.Data) {
      return response?.Data;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
};
