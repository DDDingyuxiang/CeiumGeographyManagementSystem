// src/api/request.ts
import axios from "axios";

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";
export const API_PREFIX = "/api";
export const BASE_URL = `${API_ORIGIN}${API_PREFIX}`;

const service = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = token.startsWith("Bearer ")
      ? token
      : `Bearer ${token}`;
  }
  return config;
});

export const buildBackendUrl = (path: string) => {
  if (!path) return "";
  return /^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path}`;
};

export default service;
