import service from "./request";
import { API_ENDPOINTS } from "./endpoints";

export const fetchUserProfile = async () => {
  const response = await service.get(API_ENDPOINTS.users.profile);
  return response.data;
};

export const updateUserProfile = async (payload: FormData) => {
  const response = await service.put(API_ENDPOINTS.users.updateProfile, payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
