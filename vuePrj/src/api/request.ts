// src/api/request.ts
import axios from 'axios';

export const BASE_URL = 'http://localhost:3000/api';

const service = axios.create({
  baseURL: BASE_URL,
  timeout: 5000
});

// 请求拦截器：把 localStorage 里的 Token 塞进 Header
service.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = token;
  }
  return config;
});

export default service;
