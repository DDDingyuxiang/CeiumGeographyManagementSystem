// src/api/request.ts
import axios from 'axios';

const service = axios.create({
  baseURL: 'http://localhost:3000/api',
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
