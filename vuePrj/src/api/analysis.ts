// src/api/analysis.ts
import axios from "axios";
import { BASE_URL } from "./request";

// 定义通用的请求参数接口
export interface AnalysisRequest {
  toolId: number;      // 工具唯一ID
  assetId: string;     // 关联的数据资源ID
  params: Record<string, any>; // 工具特有的参数（如半径、坐标系等）
}

// 定义后端返回的结果接口
export interface AnalysisResponse {
  code: number;
  message: string;
  data: {
    layerName: string;
    wmsUrl: string;
    layers: string;
    tempStoreName?: string;
  };
}

/**
 * 通用分析任务提交函数
 */
export const submitAnalysisTask = async (data: AnalysisRequest): Promise<AnalysisResponse> => {
    const token = localStorage.getItem("token");
    if (!token) {
        return Promise.reject({code:401,message:'未登录'});
    }
  const response = await axios.post(`${BASE_URL}/analysis/task`, data, {
    headers: {
      Authorization: token // 携带身份令牌
    }
  });
  return response.data;
};