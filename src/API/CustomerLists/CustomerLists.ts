import { CommonAPI, buildCommonBody } from "../InitialApi/CommonApi";
import type { AuthData } from "../../context/LoginData";

export interface CustomerListResponse {
  data: any[];
  total: number;
  currentPage: number;
  hasMore: boolean;
}

export const fetchCustomerLists = async (
  page = 1,
  pageSize = 20,
  searchTerm = "",
  auth: AuthData,
  fLabel = "TeCoChat ( Employee List )"
): Promise<CustomerListResponse> => {
  try {
    const payload = {
      Page: page ?? 1,
      PageSize: pageSize ?? 50,
      UserId: auth?.id ?? "",
      SearchTerm: searchTerm ?? "",
    };

    const body = buildCommonBody("GetEmployeeList", auth, payload, fLabel);
    const response = await CommonAPI(body);

    if (response?.Data) {
      return {
        data: response?.Data?.rd || [],
        total: response?.Data?.total || response?.Data?.rd?.length || 0,
        currentPage: page,
        hasMore: response?.Data?.rd?.length === pageSize,
      };
    }
    return {
      data: [],
      total: 0,
      currentPage: page,
      hasMore: false,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      data: [],
      total: 0,
      currentPage: page,
      hasMore: false,
    };
  }
};
