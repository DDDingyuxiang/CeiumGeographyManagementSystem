import service from "./request";
import { API_ENDPOINTS } from "./endpoints";

export const fetchUserProfile = async () => {
  const response = await service.get(API_ENDPOINTS.users.profile);
  return response.data;
};
