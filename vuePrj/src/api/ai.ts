import service from "./request";
import { API_ENDPOINTS } from "./endpoints";
import type { AiPlanRequest, AiPlanResponse } from "@/types/ai";

export const createAiAnalysisPlan = async (
  data: AiPlanRequest,
): Promise<AiPlanResponse> => {
  const response = await service.post(API_ENDPOINTS.ai.plan, data);
  return response.data;
};
