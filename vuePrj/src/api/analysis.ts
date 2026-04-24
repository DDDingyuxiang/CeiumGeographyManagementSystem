import service from "./request";
import { API_ENDPOINTS } from "./endpoints";

export interface AnalysisRequest {
  toolId: number;
  assetId: string;
  params: Record<string, any>;
}

export interface AnalysisResponse {
  code: number;
  message: string;
  data: {
    layerName: string;
    wmsUrl: string;
    layers: string;
    geoJsonPath?: string;
    geoJsonUrl?: string;
    bounds?: [number, number, number, number];
    tempStoreName?: string;
    storeName?: string;
    resourceType?: string;
    cleanupGroup?: string;
  };
}

export const submitAnalysisTask = async (data: AnalysisRequest): Promise<AnalysisResponse> => {
  const response = await service.post(API_ENDPOINTS.analysis.submitTask, data);
  return response.data;
};
