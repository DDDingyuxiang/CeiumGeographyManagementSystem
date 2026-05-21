/**
 * AI prompt builder.
 */

import {
  formatToolCatalogForPrompt,
  inferAssetDataType,
  type AnalysisDataType,
} from "./toolCatalog.js";

export interface AiLayerContext {
  assetId: string;
  name: string;
  type: string;
  dataType: AnalysisDataType | "unknown";
}

export interface BuildPlanningPromptInput {
  userPrompt: string;
  layers: Array<{
    assetId: string;
    name: string;
    type: string;
  }>;
}

export interface AiChatMessage {
  role: "system" | "user";
  content: string;
}

export const GIS_PLANNER_SYSTEM_PROMPT = `
你是一个 GIS 空间分析规划助手。
你的任务：
1. 将用户的自然语言需求转换为结构化 GIS 分析计划。
2. 只能使用系统提供的工具目录中的工具。
3. 只能选择用户已有图层列表中的图层。
4. 不允许编造 toolId、assetId、图层名称、字段名或参数。
5. 不直接执行分析，只生成计划。
6. 如果缺少必要参数、图层或操作方式，返回 needsClarification=true。
7. 如果用户需求超出工具能力范围，返回 needsClarification=true，并在 warnings 中说明原因。
8. 输出必须是合法 JSON，不要输出 Markdown，不要输出解释性文本。

全局约束：
- 矢量分析工具只能用于 vector 图层。
- 栅格分析工具只能用于 raster 图层。
- 缓冲区距离、等高距等数值参数必须是数字，不能是字符串。
- 缓冲区距离单位默认是米。
- 叠加分析必须有两个矢量图层。
- DEM、TIF、TIFF、高程栅格默认视为 raster。
- GeoJSON、JSON、SHP、ZIP 默认视为 vector。
- 如果多个图层名称相似，不能猜测，必须追问用户。
- 多步骤计划只在用户明确提出连续分析时生成；否则优先生成单步骤计划。

输出 JSON 格式必须严格符合：
{
  "summary": "string",
  "needsClarification": boolean,
  "clarificationQuestion": "string",
  "steps": [
    {
      "toolId": number,
      "assetId": "string",
      "params": {},
      "reason": "string"
    }
  ],
  "warnings": ["string"]
}
`.trim();

export const normalizeLayerContext = (
  layers: BuildPlanningPromptInput["layers"],
): AiLayerContext[] => {
  return layers.map((layer) => ({
    assetId: layer.assetId,
    name: layer.name,
    type: layer.type,
    dataType: inferAssetDataType(layer.type),
  }));
};

export const buildGisPlanningMessages = (
  input: BuildPlanningPromptInput,
): AiChatMessage[] => {
  const toolCatalog = formatToolCatalogForPrompt();
  const layerContext = normalizeLayerContext(input.layers);

  return [
    {
      role: "system",
      content: GIS_PLANNER_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "根据用户需求生成 GIS 分析计划。",
          userPrompt: input.userPrompt,
          availableTools: toolCatalog,
          availableLayers: layerContext,
          responseLanguage: "zh-CN",
          reminder:
            "只能返回 JSON。必须使用 availableTools 中存在的 toolId 和 availableLayers 中存在的 assetId。",
        },
        null,
        2,
      ),
    },
  ];
};

export const buildGisPlanningPrompt = (input: BuildPlanningPromptInput) => {
  return buildGisPlanningMessages(input)
    .map((message) => `[${message.role.toUpperCase()}]\n${message.content}`)
    .join("\n\n");
};
