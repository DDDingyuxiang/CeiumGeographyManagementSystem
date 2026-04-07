import service from "./request";
import { API_ENDPOINTS } from "./endpoints";

export interface LoginPayload {
  account: string;
  password: string;
}

export const login = async (payload: LoginPayload) => {
  const response = await service.post(API_ENDPOINTS.auth.login, payload);
  return {
    status: response.status,
    ...response.data,
  };
};

export const register = async (payload: FormData) => {
  const response = await service.post(API_ENDPOINTS.auth.register, payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return {
    status: response.status,
    ...response.data,
  };
};
