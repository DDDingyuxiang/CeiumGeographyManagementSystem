# Cesium GIS 空间分析平台

一个面向空间数据管理、三维场景可视化与地理分析的全栈 GIS 应用。项目使用 Vue 构建前端交互界面，使用 Express 提供 API 服务，并集成 Cesium、GeoServer、MongoDB、PostgreSQL/PostGIS 与 Python GIS 工具链。

> 本项目适用于本地开发与私有化部署。运行完整功能需要 MongoDB、PostgreSQL/PostGIS、GeoServer 和 Python GIS 环境等外部服务。

## 功能特性

- 用户注册、登录、JWT 鉴权与个人资料管理
- 个人空间数据资产的上传、查询、删除与存储用量统计
- 基于 CesiumJS 的三维地图：图层显隐、排序、缩放定位与拖拽加载
- 支持将矢量、栅格数据发布到 GeoServer，并通过 WMS 在地图中渲染
- CZML 场景的创建、保存、加载与播放
- 矢量分析：要素简化、缓冲区、叠加分析、质心提取
- 栅格分析：裁剪、拼接、重采样、坡度坡向、等高线、山体阴影、NDVI、波段组合
- 基于用户配置的大语言模型生成 GIS 分析计划

## 技术架构

```text
浏览器
  |
  +-- vuePrj/       Vue 3 + TypeScript + Vite + Element Plus + CesiumJS
  |       | REST / JSON
  |
  +-- expreePrj/    Express + TypeScript + JWT + Multer
          +-- MongoDB            用户与资产元数据
          +-- PostgreSQL/PostGIS 空间数据与分析支撑
          +-- GeoServer          服务发布与 WMS 图层
          +-- Python GIS 工具    GeoPandas / GDAL / Rasterio
```

## 目录结构

```text
.
+-- vuePrj/                  # 前端应用
|   +-- src/api/             # API 请求封装
|   +-- src/components/      # 工作台、工具与 AI 组件
|   +-- src/router/          # 路由与鉴权守卫
|   +-- src/views/           # 登录、工作台、个人中心、设置页面
+-- expreePrj/               # 后端应用
|   +-- src/analysis/        # 分析任务编排与 Python 脚本
|   +-- src/controllers/     # 请求控制器
|   +-- src/middleware/      # 鉴权与上传中间件
|   +-- src/models/          # MongoDB 数据模型
|   +-- src/routes/          # API 路由
+-- README.md
```

## 环境要求

| 依赖 | 建议版本 | 用途 |
| --- | --- | --- |
| Node.js | `20.19+` 或 `22.12+` | 前后端运行环境 |
| pnpm | `10+` | 包管理工具 |
| MongoDB | `6+` | 用户与资产元数据 |
| PostgreSQL + PostGIS | `14+` | 空间数据与分析支撑 |
| GeoServer | `2.23+` | WMS 服务发布 |
| Python | `3.10+` | GIS 分析脚本运行环境 |

请为 `PYTHON_PATH` 指向的 Python 环境安装分析任务所需依赖，例如 GeoPandas、Shapely、GDAL 与 Rasterio。

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <你的仓库地址>
cd Shijian

cd vuePrj
pnpm install

cd ../expreePrj
pnpm install
```

### 2. 配置环境变量

创建 `expreePrj/.env`：

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/cesium_db
JWT_SECRET=请替换为足够长的随机密钥

GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=请替换为你的 GeoServer 密码
GEOSERVER_WORKSPACE=user_data_space

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=请替换为你的数据库密码
DB_NAME=cesiumGeojsonDB

# 用于运行 GIS 分析脚本的 Python 可执行文件绝对路径
PYTHON_PATH=/path/to/python
```

创建 `vuePrj/.env`：

```env
VITE_API_ORIGIN=http://localhost:3000

# 使用 Cesium Ion 资源时需要配置。
VITE_CESIUM_ACCESSTOKEN=请替换为你的 Cesium Ion Token

# 默认底图服务地址。
VITE_GAODE_ACCESSTOKEN=https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}
```

请不要提交真实的密钥、令牌或生产环境连接字符串。若这些信息曾被提交到版本控制，请立即轮换相关凭据。

### 3. 启动服务

先启动 MongoDB、PostgreSQL/PostGIS 与 GeoServer，再分别打开两个终端：

```bash
# 终端 1：启动后端
cd expreePrj
pnpm dev
```

```bash
# 终端 2：启动前端
cd vuePrj
pnpm dev
```

在浏览器访问 `http://localhost:5173`。后端默认监听 `http://localhost:3000`。

## 常用命令

| 目录 | 命令 | 说明 |
| --- | --- | --- |
| `vuePrj/` | `pnpm dev` | 启动 Vite 开发服务器 |
| `vuePrj/` | `pnpm type-check` | 执行 Vue 与 TypeScript 类型检查 |
| `vuePrj/` | `pnpm build` | 类型检查并构建前端生产包 |
| `vuePrj/` | `pnpm preview` | 本地预览前端生产包 |
| `expreePrj/` | `pnpm dev` | 以监听模式启动后端 |
| `expreePrj/` | `pnpm build` | 编译后端 TypeScript 代码 |
| `expreePrj/` | `pnpm start` | 启动编译后的后端服务 |

## API 概览

所有接口均以 `/api` 为前缀。需要鉴权的接口必须携带 `Authorization: Bearer <token>` 请求头。

| 方法 | 接口 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | 否 | 注册用户 |
| `POST` | `/auth/login` | 否 | 登录并获取 JWT |
| `GET`、`PUT` | `/users/profile` | 是 | 获取或更新当前用户资料 |
| `GET` | `/users/datasets` | 是 | 获取个人数据资产列表 |
| `POST` | `/users/upload-data` | 是 | 上传空间数据资产 |
| `POST` | `/users/datasets/publish` | 是 | 将支持的数据发布到 GeoServer |
| `POST` | `/users/datasets/czml` | 是 | 保存 CZML 场景资产 |
| `POST` | `/analysis/task` | 是 | 提交空间分析任务 |
| `POST` | `/ai/plan` | 是 | 生成 AI 分析计划 |

## 支持的数据类型

上传流程支持 GeoJSON、KML、GPX、TIFF/GeoTIFF 等常见矢量和栅格数据；Shapefile 请打包为 ZIP 文件上传，并至少包含 `.shp`、`.shx`、`.dbf` 文件。三维场景工作流还支持 GLB 模型与 CZML 文件。

## 部署说明

- 在 `expreePrj/src/app.ts` 中将 CORS 来源替换为实际部署的前端地址。
- 生产环境请使用 HTTPS，并通过部署平台的环境变量管理密钥，不要提交 `.env` 文件。
- 上传目录和 GeoServer 数据目录应使用持久化存储；本地文件系统仅适用于开发环境。
- 确保 `GEOSERVER_WORKSPACE` 指向可用工作区，并为后端账号授予发布资源所需权限。
- 部署前端前，请使用生产环境的 `VITE_API_ORIGIN` 执行构建。

## 贡献指南

欢迎提交 Issue 和 Pull Request。提交前请确保：

1. 从当前默认分支创建一个聚焦的功能或修复分支。
2. 保持改动范围明确，并记录任何配置变更。
3. 在 `vuePrj/` 和 `expreePrj/` 中均执行 `pnpm build`。
4. Bug 修复请提供复现步骤；涉及界面的改动建议附带截图。
5. 不要提交密钥、令牌、上传文件或本地环境配置。

## 安全说明

项目会处理用户上传文件并连接外部 GIS 服务。部署到公网前，请检查并收紧访问控制、上传大小限制、CORS 来源、JWT 密钥管理以及 GeoServer 权限配置。

## 开源许可证

当前仓库尚未包含许可证文件。若计划公开分发或接收外部贡献，请先添加明确的开源许可证，例如 MIT 或 Apache-2.0。
