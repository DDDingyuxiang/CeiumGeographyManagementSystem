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
