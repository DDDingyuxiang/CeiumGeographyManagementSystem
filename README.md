<div align="center">

# 🌍 GIS 地理信息管理平台

**一站式空间数据管理、三维可视化与智能分析平台**

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Cesium](https://img.shields.io/badge/CesiumJS-1.139-006884?logo=cesium&logoColor=white)](https://cesium.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GeoServer](https://img.shields.io/badge/GeoServer-2374b5?logo=openstreetmap&logoColor=white)](https://geoserver.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](./LICENSE)

<br/>

一个基于 **CesiumJS 三维地球** 的前后端分离 GIS 平台，支持空间数据上传、GeoServer 自动发布、交互式地图可视化、丰富的空间分析工具，以及 **AI 驱动的智能分析助手**。

</div>

---

## ✨ 功能特性

### 🔐 用户与权限

- 用户注册 / 登录，JWT 鉴权，路由守卫
- 个人中心：头像上传、昵称修改、密码管理
- 数据统计：资产数量、存储占用一目了然

### 📦 数据管理

- 支持上传多种空间数据格式：`GeoJSON` / `SHP ZIP` / `TIFF` / `TIF`
- Shapefile 上传自动校验 `.shp`、`.shx`、`.dbf` 配套文件
- 个人中心支持数据筛选、查看与删除

### 🗺️ 三维地图与图层管理

- 基于 **CesiumJS** 的三维地球场景
- 拖拽数据到地图，后端自动发布到 GeoServer 并回显
- 图层列表：显示/隐藏、拖拽排序、右键缩放至范围、移除
- 底层通过 `WebMapServiceImageryProvider` 加载 WMS 图层

### 🧪 空间分析工具

前端表单 → 后端调度 → Python 处理 → GeoServer 发布 → Cesium 回显，**完整闭环**：

| 工具 | 类型 | 说明 |
|------|------|------|
| 缓冲区分析 | 矢量 | 基于矢量图层生成指定距离缓冲区 |
| 要素简化 | 矢量 | 几何抽稀，支持容差和拓扑保持 |
| 叠加分析 | 矢量 | 两个图层之间的交集、并集、擦除 |
| 质心提取 | 矢量 | 几何质心 / 面内点两种模式 |
| 坡度 / 坡向 | 栅格 | 基于 DEM 生成坡度或坡向栅格 |
| 等高线提取 | 栅格 | 基于 DEM 提取矢量等高线 |
| 山体阴影 | 栅格 | 基于 DEM 生成 hillshade 栅格 |

### 🤖 AI 智能分析助手

- 自然语言描述空间分析需求，AI 自动编排 GIS 工具链
- 严格约束：只允许选择系统已有工具和用户数据，不可编造
- 输出结构化 JSON 计划，用户确认后执行
- 支持用户自配置 LLM 服务（OpenAI / DashScope / DeepSeek / 自定义）

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (vuePrj)                      │
│   Vue 3 + TypeScript + Vite + Element Plus + Cesium  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                   后端 (expreePrj)                    │
│        Express 5 + TypeScript + JWT + Multer         │
├──────────┬───────────┬───────────┬──────────────────┤
│ MongoDB  │ PostgreSQL│ GeoServer │   Python (GIS)    │
│ 用户/资产 │ GeoJSON   │ WMS 发布  │ GeoPandas/GDAL   │
└──────────┴───────────┴───────────┴──────────────────┘
```

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|---------|
| Node.js | ≥ 20.19 或 ≥ 22.12 |
| pnpm / npm | pnpm 10+ / npm 9+ |
| MongoDB | 6.0+ |
| PostgreSQL | 14+ |
| GeoServer | 2.23+ |
| Python | 3.10+（含 GeoPandas、Shapely、GDAL/Rasterio） |

### 安装

```bash
# 克隆仓库
git clone https://github.com/DDDingyuxiang/CeiumGeographyManagementSystem.git
cd your-repo

# 安装前端依赖
cd vuePrj
pnpm install

# 安装后端依赖
cd ../expreePrj
pnpm install
```

### 环境配置

**后端** — 编辑 `expreePrj/.env`：

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/cesium_db
JWT_SECRET=your-secret-key

# GeoServer
GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASS=geoserver

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your-password
PG_DATABASE=cesiumGeojsonDB

# Python
PYTHON_PATH=/path/to/python
```

**前端** — 编辑 `vuePrj/.env`：

```env
VITE_API_ORIGIN=http://localhost:3000
VITE_CESIUM_ACCESSTOKEN=your-cesium-ion-token
VITE_GAODE_ACCESSTOKEN=your-gaode-token
```

### 启动开发环境

```bash
# 终端 1：启动后端（默认端口 3000）
cd expreePrj
pnpm dev

# 终端 2：启动前端（默认端口 5173）
cd vuePrj
pnpm dev
```

浏览器访问 `http://localhost:5173` 即可。

### 构建部署

```bash
# 前端构建（类型检查 + 生产打包）
cd vuePrj
pnpm build

# 后端编译
cd expreePrj
pnpm build

# 后端生产启动
pnpm start
```

---

## 📁 项目结构

```
├── vuePrj/                          # 前端项目
│   └── src/
│       ├── views/                   # 页面：登录、工作台、个人中心、设置
│       ├── components/
│       │   ├── workbench/           # 工作台组件：侧边栏、图层树、拖拽上图
│       │   ├── toolsWidget/         # 空间分析工具表单组件
│       │   └── ai/                  # AI 助手与报告组件
│       ├── api/                     # Axios 请求封装
│       ├── types/                   # TypeScript 类型定义
│       ├── router/                  # 路由配置（含鉴权守卫）
│       └── utils/                   # 工具函数（事件总线等）
│
├── expreePrj/                       # 后端项目
│   └── src/
│       ├── controllers/             # 路由控制器
│       ├── routes/                  # API 路由定义
│       ├── models/                  # Mongoose 数据模型
│       ├── middleware/              # 鉴权、文件上传中间件
│       ├── analysis/
│       │   ├── analysisService.ts   # 分析任务调度
│       │   ├── terrainService.ts    # 地形生成服务
│       │   └── python/              # Python GIS 脚本（14 个）
│       ├── ai/                      # AI 规划：工具目录、Prompt 构建、校验
│       ├── config/                  # 数据库与 GeoServer 配置
│       └── utils/                   # GeoServer 客户端封装
│
└── README.md
```

---

## 📡 API 接口

<details>
<summary><strong>点击展开完整 API 列表</strong></summary>

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/register` | ❌ | 用户注册 |
| `POST` | `/api/auth/login` | ❌ | 用户登录 |
| `GET` | `/api/users/profile` | ✅ | 获取用户资料 |
| `PUT` | `/api/users/profile` | ✅ | 更新用户资料 |
| `GET` | `/api/users/ai-settings` | ✅ | 获取 AI 模型配置 |
| `PUT` | `/api/users/ai-settings` | ✅ | 更新 AI 模型配置 |
| `POST` | `/api/users/upload-data` | ✅ | 上传空间数据 |
| `GET` | `/api/users/datasets` | ✅ | 获取数据资产列表 |
| `GET` | `/api/users/assets/:id/file` | ✅ | 下载资产文件 |
| `DELETE` | `/api/users/datasets/:id` | ✅ | 删除数据资产 |
| `POST` | `/api/users/datasets/publish` | ✅ | 发布数据集到 GeoServer |
| `POST` | `/api/users/datasets/czml` | ✅ | 保存 CZML 资产 |
| `POST` | `/api/users/datasets/cleanup` | ❌ | 清理临时资源 |
| `POST` | `/api/analysis/task` | ✅ | 提交空间分析任务 |
| `POST` | `/api/ai/plan` | ✅ | AI 分析规划 |

</details>

---

## 🧑‍💻 本地开发

### 常用命令

```bash
# 前端
cd vuePrj
pnpm dev          # 启动开发服务器
pnpm build        # 类型检查 + 生产构建
pnpm type-check   # 仅类型检查
pnpm build-only   # 仅 Vite 构建（跳过类型检查）

# 后端
cd expreePrj
pnpm dev          # tsx watch 热重载开发
pnpm build        # TypeScript 编译
pnpm start        # 生产环境启动
```

### 开发注意事项

- 后端 CORS 默认仅允许 `http://localhost:5173`
- Python 分析脚本依赖 `geopandas`、`shapely`、`gdal`、`rasterio`，请确保 `PYTHON_PATH` 指向正确的环境
- GeoServer 需提前创建名为 `cesium` 的工作区（或修改配置文件中的工作区名称）
- AI 功能需要用户在「设置」页面配置自己的 LLM 服务密钥

---

## 🗺️ 业务流程

```
注册/登录 → 上传空间数据 → 拖拽到地图 → 自动发布到 GeoServer
                                              ↓
                                    WMS 图层加载到 Cesium
                                              ↓
                              选择分析工具 / AI 自然语言描述
                                              ↓
                              Python 空间分析 → 结果发布 → 地图回显
```

---

## 🛣️ 后续规划

- [ ] 更多分析工具：裁剪/掩膜、影像拼接、重采样、NDVI、波段组合
- [ ] 格式转换服务
- [ ] AI 分析报告自动生成
- [ ] 地形数据（3D Tiles / Terrain）在线生成与加载
- [ ] 服务切片缓存优化
- [ ] 自动化出图与报表导出
- [ ] 单元测试与集成测试覆盖

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

请确保：
- 代码通过 `npm run type-check`（前端）和 `npm run build`（后端）检查
- 遵循项目已有的代码风格和目录结构
- 新功能请附带必要的说明文档

---

## 📄 开源许可

本项目基于 [ISC License](./LICENSE) 开源。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！**

</div>
