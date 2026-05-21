import service from "./request";
import { API_ENDPOINTS } from "./endpoints";

export interface AiSettingsResponseData {
  provider: string;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
  maskedApiKey: string;
}

export interface UpdateAiSettingsPayload {
  provider: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

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

export const fetchAiSettings = async () => {
  const response = await service.get(API_ENDPOINTS.users.aiSettings);
  return response.data;
};

export const updateAiSettings = async (payload: UpdateAiSettingsPayload) => {
  const response = await service.put(API_ENDPOINTS.users.aiSettings, payload);
  return response.data;
};
