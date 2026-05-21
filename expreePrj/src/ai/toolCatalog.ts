/**
 * AI GIS tool catalog.
 *
 * Keep this list aligned with analysisService.ts. The AI planner may only use
 * these tools and parameters.
 */

export type AnalysisDataType = "vector" | "raster";

export interface ToolParamDefinition {
  name: string;
  type: "number" | "string" | "boolean";
  description: string;
  required: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
  defaultValue?: number | string | boolean;
}

export interface GisToolDefinition {
  toolId: number;
  name: string;
  aliases: string[];
  category: "vector" | "raster";
  description: string;
  inputDataTypes: AnalysisDataType[];
  outputDataType: AnalysisDataType;
  params: ToolParamDefinition[];
  planningRules: string[];
  examples: string[];
}

export const GIS_TOOL_CATALOG: GisToolDefinition[] = [
  {
    toolId: 20001,
    name: "裁剪与掩膜",
    aliases: ["裁剪", "掩膜", "按范围裁剪", "clip", "mask"],
    category: "raster",
    description: "按矩形范围或矢量掩膜裁剪 GeoTIFF 栅格影像。",
    inputDataTypes: ["raster"],
    outputDataType: "raster",
    params: [
      {
        name: "mode",
        type: "string",
        description: "裁剪方式，extent 为矩形范围，mask 为矢量掩膜。",
        required: true,
        enumValues: ["extent", "mask"],
        defaultValue: "extent",
      },
      {
        name: "minX",
        type: "number",
        description: "矩形范围最小 X，仅 mode=extent 时需要。",
        required: false,
      },
      {
        name: "minY",
        type: "number",
        description: "矩形范围最小 Y，仅 mode=extent 时需要。",
        required: false,
      },
      {
        name: "maxX",
        type: "number",
        description: "矩形范围最大 X，仅 mode=extent 时需要。",
        required: false,
      },
      {
        name: "maxY",
        type: "number",
        description: "矩形范围最大 Y，仅 mode=extent 时需要。",
        required: false,
      },
      {
        name: "maskAssetId",
        type: "string",
        description: "矢量掩膜图层 assetId，仅 mode=mask 时需要。",
        required: false,
      },
      {
        name: "nodata",
        type: "number",
        description: "输出 NoData 值，可省略。",
        required: false,
      },
    ],
    planningRules: [
      "只能用于 TIF/TIFF 栅格图层。",
      "按范围裁剪时必须明确 minX、minY、maxX、maxY。",
      "按掩膜裁剪时必须选择一个矢量掩膜图层并提供 maskAssetId。",
      "缺少裁剪范围或掩膜图层时，返回 needsClarification=true。",
    ],
    examples: ["按这个行政区边界裁剪影像", "把影像裁剪到 120,30,121,31 范围"],
  },
  {
    toolId: 20002,
    name: "影像拼接",
    aliases: ["拼接", "镶嵌", "mosaic", "merge raster"],
    category: "raster",
    description: "将多幅 GeoTIFF 栅格影像拼接为一幅影像。",
    inputDataTypes: ["raster"],
    outputDataType: "raster",
    params: [
      {
        name: "rasterAssetIds",
        type: "string",
        description: "除主图层外参与拼接的栅格 assetId 列表。",
        required: true,
      },
      {
        name: "resampling",
        type: "string",
        description: "拼接时使用的重采样方法。",
        required: false,
        enumValues: ["nearest", "bilinear", "cubic", "average"],
        defaultValue: "nearest",
      },
      {
        name: "nodata",
        type: "number",
        description: "输入/输出 NoData 值，可省略。",
        required: false,
      },
    ],
    planningRules: [
      "必须至少选择两幅 TIF/TIFF 栅格图层。",
      "rasterAssetIds 只放第二幅及之后的图层 assetId，主图层放在 step.assetId。",
      "缺少第二幅影像时，返回 needsClarification=true。",
    ],
    examples: ["把这两幅遥感影像拼接起来", "镶嵌多个相邻 TIF"],
  },
  {
    toolId: 20003,
    name: "重采样",
    aliases: ["重采样", "分辨率", "像元大小", "resample"],
    category: "raster",
    description: "改变 GeoTIFF 栅格影像的像元大小和分辨率。",
    inputDataTypes: ["raster"],
    outputDataType: "raster",
    params: [
      {
        name: "pixelSize",
        type: "number",
        description: "目标像元大小，必须大于 0，单位与输入影像坐标系一致。",
        required: true,
        min: 0,
      },
      {
        name: "resampling",
        type: "string",
        description: "重采样方法。",
        required: false,
        enumValues: ["nearest", "bilinear", "cubic", "average"],
        defaultValue: "bilinear",
      },
      {
        name: "nodata",
        type: "number",
        description: "输出 NoData 值，可省略。",
        required: false,
      },
    ],
    planningRules: [
      "只能用于 TIF/TIFF 栅格图层。",
      "必须明确目标像元大小。用户没有提供像元大小时，返回 needsClarification=true。",
      "分类影像优先使用 nearest，连续影像可使用 bilinear 或 cubic。",
    ],
    examples: ["把影像重采样到 30 米", "将分类栅格改成 10 米分辨率"],
  },
  {
    toolId: 10003,
    name: "要素简化",
    aliases: ["简化", "抽稀", "geometry simplify", "simplify"],
    category: "vector",
    description: "对矢量图层的几何进行简化，减少节点数量并保留主要形态。",
    inputDataTypes: ["vector"],
    outputDataType: "vector",
    params: [
      {
        name: "tolerance",
        type: "number",
        description: "简化容差，必须大于 0。数值越大，简化越明显。",
        required: true,
        min: 0,
        defaultValue: 10,
      },
      {
        name: "preserveTopology",
        type: "boolean",
        description: "是否尽量保持拓扑关系。",
        required: false,
        defaultValue: true,
      },
    ],
    planningRules: [
      "只能用于矢量图层。",
      "用户没有说明容差时，可以使用 tolerance=10，并在 warnings 中说明。",
    ],
    examples: ["把行政区图层简化一下", "对道路图层做抽稀，容差 20"],
  },
  {
    toolId: 10004,
    name: "缓冲区分析",
    aliases: ["缓冲区", "影响范围", "buffer", "缓冲"],
    category: "vector",
    description: "根据指定距离为矢量图层生成缓冲区。",
    inputDataTypes: ["vector"],
    outputDataType: "vector",
    params: [
      {
        name: "radius",
        type: "number",
        description: "缓冲距离，单位为米，必须大于 0。",
        required: true,
        min: 0,
      },
    ],
    planningRules: [
      "只能用于矢量图层。",
      "必须明确缓冲距离。用户没有提供距离时，返回 needsClarification=true。",
      "距离单位默认按米处理。",
    ],
    examples: ["对道路图层做 500 米缓冲区", "计算河流两侧 1000 米影响范围"],
  },
  {
    toolId: 10005,
    name: "叠加分析",
    aliases: ["叠加", "求交", "交集", "并集", "擦除", "overlay"],
    category: "vector",
    description: "对两个矢量图层执行交集、并集或差异分析。",
    inputDataTypes: ["vector"],
    outputDataType: "vector",
    params: [
      {
        name: "overlayAssetId",
        type: "string",
        description: "参与叠加的第二个矢量图层 assetId。",
        required: true,
      },
      {
        name: "operation",
        type: "string",
        description: "叠加方式。",
        required: true,
        enumValues: ["intersection", "union", "difference"],
        defaultValue: "intersection",
      },
    ],
    planningRules: [
      "必须选择两个矢量图层。",
      "用户请求交、相交、重叠区域时，operation 使用 intersection。",
      "用户请求合并、并集时，operation 使用 union。",
      "用户请求擦除、扣除、排除时，operation 使用 difference。",
      "缺少第二个图层时，返回 needsClarification=true。",
    ],
    examples: ["道路缓冲区和居民区求交", "把两个地块图层合并", "从建设区里擦除水域"],
  },
  {
    toolId: 10006,
    name: "质心提取",
    aliases: ["质心", "中心点", "面内点", "centroid"],
    category: "vector",
    description: "从矢量要素中提取几何质心或面内代表点。",
    inputDataTypes: ["vector"],
    outputDataType: "vector",
    params: [
      {
        name: "mode",
        type: "string",
        description: "centroid 为几何质心，representative_point 为面内代表点。",
        required: false,
        enumValues: ["centroid", "representative_point"],
        defaultValue: "centroid",
      },
    ],
    planningRules: [
      "只能用于矢量图层。",
      "用户强调点必须落在面内部时，mode 使用 representative_point。",
      "用户没有特殊说明时，mode 使用 centroid。",
    ],
    examples: ["提取小区面图层的中心点", "给行政区生成面内点"],
  },
  {
    toolId: 20004,
    name: "坡度坡向分析",
    aliases: ["坡度", "坡向", "slope", "aspect"],
    category: "raster",
    description: "基于 DEM 栅格生成坡度或坡向结果。",
    inputDataTypes: ["raster"],
    outputDataType: "raster",
    params: [
      {
        name: "analysisType",
        type: "string",
        description: "分析类型，slope 为坡度，aspect 为坡向。",
        required: true,
        enumValues: ["slope", "aspect"],
        defaultValue: "slope",
      },
      {
        name: "zFactor",
        type: "number",
        description: "高程缩放系数，必须大于 0。",
        required: false,
        min: 0,
        defaultValue: 1,
      },
      {
        name: "scale",
        type: "number",
        description: "水平单位换算比例，必须大于 0。",
        required: false,
        min: 0,
        defaultValue: 1,
      },
    ],
    planningRules: [
      "只能用于 DEM/TIF/TIFF 栅格图层。",
      "用户只说坡度时，analysisType 使用 slope。",
      "用户只说坡向时，analysisType 使用 aspect。",
    ],
    examples: ["根据 DEM 生成坡度图", "对高程栅格做坡向分析"],
  },
  {
    toolId: 20005,
    name: "等高线提取",
    aliases: ["等高线", "contour"],
    category: "raster",
    description: "基于 DEM 栅格提取指定间距的等高线。",
    inputDataTypes: ["raster"],
    outputDataType: "vector",
    params: [
      {
        name: "interval",
        type: "number",
        description: "等高距，必须大于 0。",
        required: true,
        min: 0,
      },
      {
        name: "base",
        type: "number",
        description: "等高线基准高程。",
        required: false,
        defaultValue: 0,
      },
    ],
    planningRules: [
      "只能用于 DEM/TIF/TIFF 栅格图层。",
      "必须明确等高距。用户没有提供等高距时，返回 needsClarification=true。",
    ],
    examples: ["从 DEM 提取 10 米等高线", "生成 50 米间隔的等高线"],
  },
  {
    toolId: 20006,
    name: "山体阴影",
    aliases: ["山体阴影", "地形阴影", "hillshade"],
    category: "raster",
    description: "基于 DEM 栅格生成山体阴影图。",
    inputDataTypes: ["raster"],
    outputDataType: "raster",
    params: [
      {
        name: "azimuth",
        type: "number",
        description: "太阳方位角，范围 0 到 360。",
        required: false,
        min: 0,
        max: 360,
        defaultValue: 315,
      },
      {
        name: "altitude",
        type: "number",
        description: "太阳高度角，范围大于 0 且小于等于 90。",
        required: false,
        min: 0,
        max: 90,
        defaultValue: 45,
      },
      {
        name: "zFactor",
        type: "number",
        description: "高程缩放系数，必须大于 0。",
        required: false,
        min: 0,
        defaultValue: 1,
      },
    ],
    planningRules: [
      "只能用于 DEM/TIF/TIFF 栅格图层。",
      "用户没有说明参数时，可以使用 azimuth=315、altitude=45、zFactor=1。",
    ],
    examples: ["给 DEM 生成山体阴影", "按方位角 270、高度角 45 生成地形阴影"],
  },
];

export const getToolDefinition = (toolId: number) => {
  return GIS_TOOL_CATALOG.find((tool) => tool.toolId === toolId);
};

export const inferAssetDataType = (assetType: string): AnalysisDataType | "unknown" => {
  const normalized = assetType.toLowerCase();

  if (["geojson", "json", "shp", "zip", "vector"].includes(normalized)) {
    return "vector";
  }

  if (["tif", "tiff", "dem", "raster"].includes(normalized)) {
    return "raster";
  }

  return "unknown";
};

export const formatToolCatalogForPrompt = () => {
  return GIS_TOOL_CATALOG.map((tool) => ({
    toolId: tool.toolId,
    name: tool.name,
    aliases: tool.aliases,
    category: tool.category,
    description: tool.description,
    inputDataTypes: tool.inputDataTypes,
    outputDataType: tool.outputDataType,
    params: tool.params.map((param) => ({
      name: param.name,
      type: param.type,
      required: param.required,
      description: param.description,
      enumValues: param.enumValues,
      min: param.min,
      max: param.max,
      defaultValue: param.defaultValue,
    })),
    planningRules: tool.planningRules,
    examples: tool.examples,
  }));
};
