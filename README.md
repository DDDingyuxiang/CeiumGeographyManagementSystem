# GIS 地理信息管理平台项目说明

## 1. 项目概述

本项目是一个前后端分离的 GIS 地理信息管理平台，核心目标是实现用户空间数据的上传、管理、发布、地图可视化和基础空间分析。

项目由两个子工程组成：

- `vuePrj`：前端可视化与交互系统。
- `expreePrj`：后端接口、数据管理、GeoServer 发布与分析任务调度。

平台以 Cesium 三维场景为地图展示窗口，结合 GeoServer 提供 WMS 服务，并通过 Python/GeoPandas/GDAL 脚本执行部分空间分析任务。

## 2. 主要技术栈

### 前端

- `Vue 3`
- `TypeScript`
- `Vite`
- `Vue Router`
- `Element Plus`
- `Axios`
- `Cesium`
- `vite-plugin-cesium`
- `JSZip`

### 后端

- `Node.js`
- `Express 5`
- `TypeScript`
- `Multer`
- `JWT + jsonwebtoken`
- `bcryptjs`
- `CORS`
- `dotenv`

### GIS 与数据处理

- `MongoDB + Mongoose`：存储用户与数据资产信息。
- `PostgreSQL + Knex`：存储 GeoJSON 要素并支持 SQL 视图发布。
- `GeoServer`：发布矢量和栅格图层，向前端提供 WMS 服务。
- `geoserver-node-client`：自动创建工作区、数据存储和发布图层。
- `Python / GeoPandas / Shapely / GDAL`：执行缓冲区、要素简化、叠加分析、质心提取、坡度坡向、等高线、山体阴影等分析处理。

## 3. 已实现功能

### 3.1 用户与权限

- 用户注册、登录。
- JWT 登录态保存与接口鉴权。
- 路由鉴权，未登录用户无法访问工作台、个人中心和设置页。
- 个人中心展示用户资料、头像、角色、创建时间、数据数量和存储占用。
- 支持修改昵称、头像和密码。

### 3.2 数据管理

- 支持上传矢量和栅格空间数据。
- 支持格式包括 `GeoJSON / JSON / SHP ZIP / TIFF / TIF`。
- Shapefile 上传前会检查 `.shp`、`.shx`、`.dbf` 配套文件。
- 个人中心可查看、筛选和删除用户数据资产。

### 3.3 数据发布与地图展示

- 工作台基于 Cesium 初始化三维地球场景。
- 用户可将左侧资源面板中的数据拖拽到地图上。
- 后端按数据类型自动发布到 GeoServer：
  - `TIFF / TIF` 发布为 CoverageStore。
  - `GeoJSON / JSON` 写入数据库后通过 SQL 视图发布。
  - `SHP ZIP` 解压后发布为 DataStore。
- 前端通过 `Cesium.WebMapServiceImageryProvider` 加载 WMS 图层。
- 发布接口会尽量返回图层 `bounds`，用于前端缩放至图层范围。
- 地图顶部中间提供放大、缩小按钮。
- 左侧图层列表支持：
  - 图层显示/隐藏。
  - 拖拽调整图层顺序。
  - 右键菜单。
  - 右键“缩放至”图层范围。
  - 右键“移除”地图图层。
- 页面卸载或关闭时会向后端发送清理请求，删除临时发布资源。

### 3.4 空间分析工具

当前已经形成前端表单、后端调度、Python 处理、GeoServer 发布、Cesium 回显的完整闭环：

- 要素简化 `toolId: 10003`
  - 基于矢量图层执行几何抽稀。
  - 支持设置简化容差。
  - 支持保持拓扑关系。
- 缓冲区分析 `toolId: 10004`
  - 基于矢量图层生成指定距离缓冲区。
- 叠加分析 `toolId: 10005`
  - 支持两个矢量图层之间的交集、并集、擦除操作。
- 质心提取 `toolId: 10006`
  - 支持几何质心和面内点两种模式。
- 坡度/坡向 `toolId: 20004`
  - 基于 DEM 生成坡度或坡向栅格结果。
- 等高线提取 `toolId: 20005`
  - 基于 DEM 提取矢量等高线结果。
- 山体阴影 `toolId: 20006`
  - 基于 DEM 生成 hillshade 栅格结果。

分析结果会写入 `geoserver_data/temp_analysis`，发布为临时 GeoServer 图层，并回显到地图中。

### 3.5 地形相关能力

- 后端已具备 `demToTerrain.py` 地形生成能力，可将 DEM 转换为 terrain 数据目录。
- 临时分析结果由清理任务和页面卸载清理请求共同维护。

## 4. 当前仍为预留或待扩展的能力

右侧工具箱中仍保留部分扩展入口，当前尚未形成完整业务闭环：

- 格式转换。
- 裁剪与掩膜。
- 影像拼接。
- 重采样。
- NDVI。
- 波段组合。
- 自动化出图。
- 报表生成。
- 服务切片。

坐标转换面板当前仍偏占位实现，尚未接入完整空间处理链路。

## 5. 项目目录结构

```text
Shijian/
├── vuePrj/        前端项目：页面交互、地图展示、图层管理、分析表单
└── expreePrj/     后端项目：认证、数据上传、GeoServer 发布、分析任务调度
```

### 前端关键目录

- `src/views`
  - 登录页、工作台、个人中心、设置页等主页面。
- `src/components/workbench`
  - 左右侧边栏、数据拖拽上图、图层树管理、图层右键菜单等工作台核心组件。
- `src/components/toolsWidget`
  - 各类分析工具表单组件。
- `src/api`
  - 认证、用户、数据集、分析等接口封装。
- `src/utils`
  - 全局事件总线等工具。

### 后端关键目录

- `src/controllers`
  - 用户、认证、数据、分析相关接口逻辑。
- `src/routes`
  - 认证、用户、分析等路由。
- `src/models`
  - 用户和数据资产模型。
- `src/utils`
  - GeoServer 客户端封装。
- `src/analysis`
  - 分析任务调度、地形服务、Python 脚本调用。
- `src/analysis/python`
  - 缓冲区、要素简化、叠加分析、质心提取、坡度坡向、等高线、山体阴影、DEM 转地形等脚本。
- `src/middleware`
  - 鉴权、头像上传、数据上传等中间件。

## 6. 业务流程概括

1. 用户注册并登录系统。
2. 上传矢量或栅格空间数据。
3. 在个人中心查看和管理数据。
4. 在工作台将数据拖拽到地图中。
5. 后端自动将数据发布到 GeoServer。
6. 前端通过 WMS 将图层加载到 Cesium 场景。
7. 用户选择分析工具发起空间分析。
8. 后端调用 Python 脚本生成分析结果。
9. 分析结果再次发布为 GeoServer 图层并回显到地图中。
10. 用户可在图层列表中显示/隐藏、排序、缩放至或移除图层。

## 7. 本地开发与验证

前端：

```bash
cd vuePrj
npm install
npm run dev
```

后端：

```bash
cd expreePrj
npm install
npm run dev
```

常用验证命令：

```bash
cd expreePrj
npm run build

cd ../vuePrj
npm run type-check
npm run build-only
```

后端分析功能依赖可用的 Python GIS 环境。`PYTHON_PATH` 应指向安装了 `geopandas`、`shapely`、`gdal/rasterio` 等依赖的 Python 解释器。

## 8. 总结

该平台已经完成用户体系、数据上传、GeoServer 发布、Cesium 展示、图层管理和多项空间分析工具的一体化闭环。

当前亮点包括：

- 前后端分离的 GIS 平台架构。
- 用户数据到 GeoServer 图层发布的自动化流程。
- Cesium、GeoServer、数据库和 Python GIS 脚本的业务链路整合。
- 矢量工具箱已支持要素简化、缓冲区、叠加分析和质心提取。
- 地图图层支持右键移除与缩放至范围。

## 9. AI 智能分析扩展

项目新增了 AI GIS 智能分析助手的基础工程结构，用于将用户的自然语言需求转换为可执行的空间分析计划。该能力不是简单聊天框，而是围绕现有 `analysisService.ts` 中的 GIS 工具做受控任务编排。

### 9.1 设计目标

- 让用户用自然语言描述空间分析需求。
- AI 只允许选择系统已有的 GIS 工具，不允许编造工具。
- AI 只允许选择当前用户已有的数据图层，不允许编造 `assetId`。
- AI 输出结构化 JSON 分析计划，由前端展示给用户确认后再执行。
- 后端对 AI 返回结果做二次校验，避免错误参数直接进入分析链路。
- 用户可以在设置页配置自己的模型名称、Base URL 和 API Key。

### 9.2 后端新增文件

```text
expreePrj/src/ai/
├── toolCatalog.ts
├── promptBuilder.ts
├── aiPlanningService.ts
└── resultExplainService.ts

expreePrj/src/controllers/aiController.ts
expreePrj/src/routes/aiRoutes.ts
```

文件职责：

- `toolCatalog.ts`：维护 AI 可使用的 GIS 工具目录，包括 `toolId`、工具名称、别名、输入数据类型、输出类型、参数定义、规则和示例。
- `promptBuilder.ts`：集中生成 AI prompt，包括系统角色、工具目录、图层上下文和严格 JSON 输出格式。
- `aiPlanningService.ts`：定义 AI 分析计划的数据结构，提供 prompt payload 生成、AI JSON 解析和后端校验逻辑。
- `resultExplainService.ts`：预留给后续“AI 分析报告生成”能力。
- `aiController.ts`：预留 AI 接口控制器，用于处理自然语言规划和结果解释请求。
- `aiRoutes.ts`：预留 AI 路由文件，用于挂载 `/api/ai/plan` 等接口。

### 9.3 AI 工具目录

当前 AI 规划层支持以下已有 GIS 工具：

| toolId | 工具 | 数据类型 | 主要参数 |
| --- | --- | --- | --- |
| `10003` | 要素简化 | vector | `tolerance`, `preserveTopology` |
| `10004` | 缓冲区分析 | vector | `radius` |
| `10005` | 叠加分析 | vector | `overlayAssetId`, `operation` |
| `10006` | 质心提取 | vector | `mode` |
| `20004` | 坡度坡向分析 | raster | `analysisType`, `zFactor`, `scale` |
| `20005` | 等高线提取 | raster | `interval`, `base` |
| `20006` | 山体阴影 | raster | `azimuth`, `altitude`, `zFactor` |

### 9.4 AI 输出格式

AI 必须返回合法 JSON，格式如下：

```json
{
  "summary": "对道路图层执行 500 米缓冲区分析",
  "needsClarification": false,
  "clarificationQuestion": "",
  "steps": [
    {
      "toolId": 10004,
      "assetId": "真实的数据资产 ID",
      "params": {
        "radius": 500
      },
      "reason": "用户要求生成道路 500 米影响范围"
    }
  ],
  "warnings": []
}
```

如果用户信息不足，例如没有说明缓冲距离，应返回：

```json
{
  "summary": "",
  "needsClarification": true,
  "clarificationQuestion": "请问缓冲区距离是多少米？",
  "steps": [],
  "warnings": ["缺少缓冲区距离参数"]
}
```

### 9.5 模型配置

项目在设置页增加了 AI 模型配置能力，用户可以配置自己的模型服务：

- 模型服务：`OpenAI Compatible`、`OpenAI`、`DashScope` 或自定义服务。
- Base URL：模型服务地址，例如 `https://api.openai.com/v1`。
- 模型名称：例如 `gpt-4o-mini`、`qwen-plus`、`deepseek-chat`。
- API Key：用户自己的模型密钥。

相关接口：

```text
GET /api/users/ai-settings
PUT /api/users/ai-settings
```

安全说明：

- 后端保存 API Key 时目前存储在 MongoDB 用户文档的 `aiSettings.apiKey` 字段中。
- 查询设置时不会返回完整 API Key，只返回 `hasApiKey` 和 `maskedApiKey`。
- 课程项目和简历演示可以使用该方案；生产环境建议改为服务端加密存储或接入密钥管理服务。

### 9.6 前端新增文件

```text
vuePrj/src/api/ai.ts
vuePrj/src/types/ai.ts
vuePrj/src/components/ai/AiAnalysisAssistant.vue
vuePrj/src/components/ai/AiReportPanel.vue
```

文件职责：

- `api/ai.ts`：预留 AI 接口请求封装。
- `types/ai.ts`：预留 AI 分析计划、步骤、警告和报告相关类型。
- `AiAnalysisAssistant.vue`：预留工作台内的自然语言 GIS 助手组件。
- `AiReportPanel.vue`：预留 AI 分析报告展示组件。

设置页已接入：

```text
vuePrj/src/views/settings.vue
```

### 9.7 推荐后续接入流程

1. 在 `aiController.ts` 中实现 `POST /api/ai/plan`。
2. 从 `DataAsset` 查询当前用户可用图层。
3. 调用 `createPlanningPromptPayload()` 生成模型请求消息。
4. 调用用户在设置页保存的模型服务。
5. 用 `parseAiPlanJson()` 解析模型输出。
6. 用 `validateAiAnalysisPlan()` 做后端二次校验。
7. 前端 `AiAnalysisAssistant.vue` 展示计划，用户确认后复用现有 `/api/analysis/task` 执行。
8. 执行结果继续通过 GeoServer 发布，并由 Cesium 回显。

### 9.8 验证命令

后端：

```bash
cd expreePrj
pnpm run build
```

前端：

```bash
cd vuePrj
pnpm run type-check
```
