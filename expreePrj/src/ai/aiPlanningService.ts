/**
 * AI analysis planning service.
 */

import axios from "axios";
import { buildGisPlanningMessages, normalizeLayerContext } from "./promptBuilder.js";
import { getToolDefinition, type AnalysisDataType } from "./toolCatalog.js";

export interface AiPlanningLayerInput {
  assetId: string;
  name: string;
  type: string;
}

export interface AiPlanStep {
  toolId: number;
  assetId: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface AiAnalysisPlan {
  summary: string;
  needsClarification: boolean;
  clarificationQuestion: string;
  steps: AiPlanStep[];
  warnings: string[];
}

export interface AiPlanningPromptPayload {
  messages: ReturnType<typeof buildGisPlanningMessages>;
  expectedJsonShape: AiAnalysisPlan;
}

export interface AiModelSettings {
  provider?: string;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export const EMPTY_PLAN: AiAnalysisPlan = {
  summary: "",
  needsClarification: true,
  clarificationQuestion: "请补充你的空间分析需求。",
  steps: [],
  warnings: [],
};

export const createPlanningPromptPayload = (
  userPrompt: string,
  layers: AiPlanningLayerInput[],
): AiPlanningPromptPayload => {
  return {
    messages: buildGisPlanningMessages({ userPrompt, layers }),
    expectedJsonShape: EMPTY_PLAN,
  };
};

export const parseAiPlanJson = (content: string): AiAnalysisPlan => {
  const trimmed = content.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const jsonText =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed
      : firstBrace >= 0 && lastBrace > firstBrace
        ? trimmed.slice(firstBrace, lastBrace + 1)
        : "";

  if (!jsonText) {
    throw new Error("AI response does not contain a JSON object.");
  }

  return JSON.parse(jsonText) as AiAnalysisPlan;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const validateRequiredShape = (plan: AiAnalysisPlan) => {
  if (!isRecord(plan)) {
    throw new Error("AI plan must be a JSON object.");
  }

  if (typeof plan.summary !== "string") {
    throw new Error("AI plan summary must be a string.");
  }

  if (typeof plan.needsClarification !== "boolean") {
    throw new Error("AI plan needsClarification must be a boolean.");
  }

  if (typeof plan.clarificationQuestion !== "string") {
    throw new Error("AI plan clarificationQuestion must be a string.");
  }

  if (!Array.isArray(plan.steps)) {
    throw new Error("AI plan steps must be an array.");
  }

  if (!Array.isArray(plan.warnings)) {
    throw new Error("AI plan warnings must be an array.");
  }
};

const validateParamValue = (
  toolId: number,
  params: Record<string, unknown>,
  paramName: string,
  expectedType: "number" | "string" | "boolean",
) => {
  const value = params[paramName];

  if (typeof value !== expectedType) {
    throw new Error(`Tool ${toolId} param ${paramName} must be ${expectedType}.`);
  }
};

const extractBufferRadius = (prompt: string) => {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters|米|公尺)/i);
  if (!match?.[1]) {
    return null;
  }

  const radius = Number(match[1]);
  return Number.isFinite(radius) && radius > 0 ? radius : null;
};

const matchLayerByName = (
  prompt: string,
  layers: AiPlanningLayerInput[],
) => {
  const normalizedPrompt = prompt.toLowerCase();
  const matches = layers.filter((layer) => {
    const name = layer.name.toLowerCase();
    return name && normalizedPrompt.includes(name);
  });

  return matches.length === 1 ? matches[0] : null;
};

const createLocalBufferPlan = (
  userPrompt: string,
  layers: AiPlanningLayerInput[],
): AiAnalysisPlan | null => {
  if (!/(缓冲|buffer|影响范围)/i.test(userPrompt)) {
    return null;
  }

  const radius = extractBufferRadius(userPrompt);
  if (!radius) {
    return {
      summary: "",
      needsClarification: true,
      clarificationQuestion: "请补充缓冲区距离，例如 500 米。",
      steps: [],
      warnings: [],
    };
  }

  const layerContext = normalizeLayerContext(layers);
  const vectorLayers = layerContext.filter((layer) => layer.dataType === "vector");
  if (vectorLayers.length === 0) {
    return {
      summary: "",
      needsClarification: true,
      clarificationQuestion: "当前工作台没有可用于缓冲区分析的矢量图层。",
      steps: [],
      warnings: ["缓冲区分析只能用于矢量图层。"],
    };
  }

  const namedLayer = matchLayerByName(userPrompt, vectorLayers);
  const selectedLayer = namedLayer ?? (vectorLayers.length === 1 ? vectorLayers[0] : null);

  if (!selectedLayer) {
    return {
      summary: "",
      needsClarification: true,
      clarificationQuestion: "当前有多个矢量图层，请说明要对哪个图层生成缓冲区。",
      steps: [],
      warnings: [],
    };
  }

  return validateAiAnalysisPlan(
    {
      summary: `为 ${selectedLayer.name} 生成 ${radius} 米缓冲区。`,
      needsClarification: false,
      clarificationQuestion: "",
      steps: [
        {
          toolId: 10004,
          assetId: selectedLayer.assetId,
          params: { radius },
          reason: "用户明确要求生成指定距离的缓冲区，已匹配缓冲区分析工具。",
        },
      ],
      warnings: [],
    },
    layers,
  );
};

export const validateAiAnalysisPlan = (
  plan: AiAnalysisPlan,
  layers: AiPlanningLayerInput[],
): AiAnalysisPlan => {
  validateRequiredShape(plan);

  if (plan.needsClarification) {
    return {
      ...plan,
      steps: [],
      warnings: plan.warnings.filter((warning) => typeof warning === "string"),
    };
  }

  const layerContext = normalizeLayerContext(layers);
  const layerById = new Map(layerContext.map((layer) => [layer.assetId, layer]));

  if (plan.steps.length === 0) {
    throw new Error("AI plan must contain at least one step when clarification is not needed.");
  }

  for (const step of plan.steps) {
    if (!Number.isInteger(step.toolId)) {
      throw new Error("AI plan step toolId must be an integer.");
    }

    if (typeof step.assetId !== "string" || !step.assetId) {
      throw new Error("AI plan step assetId must be a non-empty string.");
    }

    if (!isRecord(step.params)) {
      throw new Error(`Tool ${step.toolId} params must be an object.`);
    }

    if (typeof step.reason !== "string") {
      throw new Error(`Tool ${step.toolId} reason must be a string.`);
    }

    const tool = getToolDefinition(step.toolId);
    if (!tool) {
      throw new Error(`AI selected unsupported toolId: ${step.toolId}.`);
    }

    const layer = layerById.get(step.assetId);
    if (!layer) {
      throw new Error(`AI selected an unavailable assetId: ${step.assetId}.`);
    }

    if (
      layer.dataType !== "unknown" &&
      !tool.inputDataTypes.includes(layer.dataType as AnalysisDataType)
    ) {
      throw new Error(
        `Tool ${step.toolId} cannot be used with ${layer.dataType} layer ${layer.name}.`,
      );
    }

    for (const param of tool.params) {
      const value = step.params[param.name];

      if (param.required && value === undefined) {
        throw new Error(`Tool ${step.toolId} missing required param: ${param.name}.`);
      }

      if (value === undefined) {
        continue;
      }

      validateParamValue(step.toolId, step.params, param.name, param.type);

      if (param.type === "number") {
        const numericValue = value as number;
        if (param.min !== undefined && numericValue <= param.min) {
          throw new Error(
            `Tool ${step.toolId} param ${param.name} must be greater than ${param.min}.`,
          );
        }
        if (param.max !== undefined && numericValue > param.max) {
          throw new Error(`Tool ${step.toolId} param ${param.name} must be <= ${param.max}.`);
        }
      }

      if (
        param.enumValues &&
        typeof value === "string" &&
        !param.enumValues.includes(value)
      ) {
        throw new Error(
          `Tool ${step.toolId} param ${param.name} must be one of: ${param.enumValues.join(", ")}.`,
        );
      }
    }
  }

  return {
    ...plan,
    warnings: plan.warnings.filter((warning) => typeof warning === "string"),
  };
};

const providerDefaultBaseUrl = (provider?: string) => {
  if (provider === "openai") {
    return "https://api.openai.com/v1";
  }

  if (provider === "dashscope") {
    return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }

  return "";
};

const resolveModelSettings = (settings: AiModelSettings) => {
  const provider = settings.provider || "openai-compatible";
  const baseUrl =
    settings.baseUrl ||
    process.env.AI_BASE_URL ||
    providerDefaultBaseUrl(provider);
  const modelName = settings.modelName || process.env.AI_MODEL_NAME || process.env.OPENAI_MODEL;
  const apiKey = settings.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl) {
    throw new Error("请先在设置页配置 AI Base URL，或设置 AI_BASE_URL 环境变量。");
  }

  if (!modelName) {
    throw new Error("请先在设置页配置 AI 模型名称，或设置 AI_MODEL_NAME 环境变量。");
  }

  if (!apiKey) {
    throw new Error("请先在设置页配置 AI API Key，或设置 AI_API_KEY 环境变量。");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    modelName,
    apiKey,
  };
};

const requestChatCompletion = async (
  settings: ReturnType<typeof resolveModelSettings>,
  messages: AiPlanningPromptPayload["messages"],
  includeJsonResponseFormat: boolean,
) => {
  const response = await axios.post<ChatCompletionResponse>(
    `${settings.baseUrl}/chat/completions`,
    {
      model: settings.modelName,
      messages,
      temperature: 0.1,
      ...(includeJsonResponseFormat ? { response_format: { type: "json_object" } } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    },
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response is empty.");
  }

  return content;
};

const formatAiProviderError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "AI provider request failed.";
  }

  const status = error.response?.status;
  const data = error.response?.data as unknown;
  let providerMessage = "";

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nestedError = record.error;
    if (nestedError && typeof nestedError === "object") {
      const nested = nestedError as Record<string, unknown>;
      providerMessage =
        typeof nested.message === "string"
          ? nested.message
          : JSON.stringify(nestedError);
    } else if (typeof record.message === "string") {
      providerMessage = record.message;
    } else {
      providerMessage = JSON.stringify(data);
    }
  } else if (typeof data === "string") {
    providerMessage = data;
  }

  return `AI 模型服务请求失败${status ? `（HTTP ${status}）` : ""}${
    providerMessage ? `：${providerMessage}` : ""
  }`;
};

export const createAiAnalysisPlan = async (
  userPrompt: string,
  layers: AiPlanningLayerInput[],
  modelSettings: AiModelSettings,
): Promise<AiAnalysisPlan> => {
  const localPlan = createLocalBufferPlan(userPrompt, layers);
  if (localPlan) {
    return localPlan;
  }

  const payload = createPlanningPromptPayload(userPrompt, layers);
  const settings = resolveModelSettings(modelSettings);

  let content: string;
  try {
    content = await requestChatCompletion(settings, payload.messages, true);
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    try {
      content = await requestChatCompletion(settings, payload.messages, false);
    } catch (fallbackError) {
      throw new Error(formatAiProviderError(fallbackError));
    }
  }

  return validateAiAnalysisPlan(parseAiPlanJson(content), layers);
};
