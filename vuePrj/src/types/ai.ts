export interface AiPlanStep {
  toolId: number;
  assetId: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface AiPlanningLayer {
  assetId: string;
  name: string;
  type: string;
}

export interface AiAnalysisPlan {
  summary: string;
  needsClarification: boolean;
  clarificationQuestion: string;
  steps: AiPlanStep[];
  warnings: string[];
  layers?: AiPlanningLayer[];
}

export interface AiPlanRequest {
  prompt: string;
  layers?: AiPlanningLayer[];
}

export interface AiPlanResponse {
  code: number;
  message: string;
  data: AiAnalysisPlan;
}
