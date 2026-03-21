<script setup lang="ts">
import * as Cesium from "cesium";
import "../Widgets/widgets.css";
import { computed, onMounted, onUnmounted, ref, shallowRef, markRaw } from "vue";
import { useRouter } from "vue-router";
import {
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElCollapse,
  ElCollapseItem,
  ElMessage,
  ElTree,
} from "element-plus";
import type { CollapseModelValue } from "element-plus";
import axios from "axios";
import ToolPanel from "@/components/ToolPanel.vue";
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}
window.CESIUM_BASE_URL = "/";
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESSTOKEN;
const router = useRouter();

// 面板状态 - 默认只收起面板内容，不收起工具条
const leftPanelActive = ref(false);
const rightPanelActive = ref(false);
const activeToolCategory = ref<CollapseModelValue>([]);

// 拖拽状态
const draggedItem = ref<any>(null);
const isDragging = ref(false);

// 当前激活中的工具ID
const activeToolId = ref<number | null>(null);

interface LayerItem {
  id: number | string;
  label: string;
  visible: boolean;
  cesiumLayer: Cesium.ImageryLayer | null;
  type: string;
}

// 图层数据
const layerData = ref<LayerItem[]>([
  { id: 0, label: "基础图层", visible: true, cesiumLayer: null, type: "" },
]);

// 用户数据
const userData = ref([{ id: "", label: "", type: "", size: "" }]);

// 工具箱数据
const toolCategories = ref([
  {
    id: "vector",
    title: "矢量工具箱",
    tools: [
      { name: "坐标转换", desc: "投影互转", toolId: 10001 },
      {
        name: "格式转换",
        desc: "Shapefile/GeoJSON/KML/GML互转",
        toolId: 10002,
      },
      { name: "要素简化", desc: "抽稀边界优化渲染性能", toolId: 10003 },
      { name: "缓冲区分析", desc: "生成点线面影响范围", toolId: 10004 },
      { name: "叠加分析", desc: "交集/并集/擦除操作", toolId: 10005 },
      { name: "质心提取", desc: "计算多边形几何中心", toolId: 10006 },
      { name: "字段计算", desc: "SQL/Python表达式批量修改", toolId: 10007 },
      { name: "空间连接", desc: "基于位置关系属性赋值", toolId: 10008 },
    ],
  },
  {
    id: "raster",
    title: "栅格工具箱",
    tools: [
      { name: "裁剪与掩膜", desc: "按范围裁剪TIF影像", toolId: 20001 },
      { name: "影像拼接", desc: "多幅影像无缝缝合", toolId: 20002 },
      { name: "重采样", desc: "改变像素分辨率", toolId: 20003 },
      { name: "坡度/坡向", desc: "提取地形起伏特征", toolId: 20004 },
      { name: "等高线提取", desc: "自动提取矢量等高线", toolId: 20005 },
      { name: "山体阴影", desc: "生成立体感渲染图", toolId: 20006 },
      { name: "植被指数(NDVI)", desc: "计算植被覆盖度", toolId: 20007 },
      { name: "波段组合", desc: "真彩色/假彩色合成", toolId: 20008 },
    ],
  },
  {
    id: "general",
    title: "其他工具箱",
    tools: [
      { name: "一键发布", desc: "自动发布WMS/WMTS服务", toolId: 30001 },
      { name: "服务切片", desc: "预生成GeoWebCache瓦片", toolId: 30002 },
      { name: "自动化出图", desc: "生成带图例PDF/PNG", toolId: 30003 },
      { name: "报表生成", desc: "统计结果生成Word/PDF", toolId: 30004 },
    ],
  },
]);

// 清理数据列表
const createdResources = ref<{ storeName: string; layerName: string }[]>([]);

let viewer: Cesium.Viewer | null = null;
onMounted(async () => {
  window.addEventListener("beforeunload", handleCleanup);

  viewer = new Cesium.Viewer("cesiumContainer", {
    infoBox: false, // 禁用信息框
    selectionIndicator: false, // 禁用选择指示器
    baseLayerPicker: false,
    navigationHelpButton: false,
    homeButton: false,
    sceneModePicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
        credit: "高德影像路网",
      }),
    ),
  });

  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";

  // 设置中国区域视角
  viewer.camera.setView({
    destination: Cesium.Rectangle.fromDegrees(73.5, 18.0, 135.0, 53.5),
  });

  viewer.selectedEntityChanged.addEventListener(() => {
    if (viewer) viewer.selectedEntity = undefined;
  });

  viewer.screenSpaceEventHandler.setInputAction(() => {
    if (viewer) viewer.selectedEntity = undefined;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
});

onUnmounted(() => {
  handleCleanup(); // 视情况开启
});

// 在 script setup 中添加
const displayedLayers = computed(() => {
  // 基础图层始终在底部（索引0），用户图层反转显示
  const base = layerData.value.filter((l) => l.id === 0);
  const userLayers = layerData.value.filter((l) => l.id !== 0);
  // UI 显示：用户图层在上（数组前面），基础图层在下（数组末尾）
  return [...userLayers.reverse(), ...base];
});

// 处理用户命令
const handleUserCommand = (command: string) => {
  if (command === "profile") {
    router.push("/profile");
  } else if (command === "settings") {
    router.push("/settings");
  }
};

// 同步图层到UI
const syncLayersToUI = async () => {};

// 切换左侧面板
const toggleLeftPanel = async () => {
  leftPanelActive.value = !leftPanelActive.value;
  try {
    syncLayersToUI();

    const token = localStorage.getItem("token");
    // 对应后端 userRoutes.ts 中的 router.get('/datasets', ...)
    const res = await axios.get("http://localhost:3000/api/users/datasets", {
      headers: { Authorization: token },
    });
    if (res.data.code === 200) {
      // 【关键点】：将后端返回的数据映射到前端 dataList 模型
      userData.value = res.data.data.map((item: any) => ({
        id: item._id, // 将数据库的 _id 映射给前端的 id
        label: item.name.toLowerCase().endsWith(".zip")
          ? item.name.replace(/\.zip$/i, ".shp")
          : item.name,
        filename: item.filename,
        type: item.type,
        // 格式化文件大小显示
        size:
          item.size > 1024 * 1024
            ? (item.size / (1024 * 1024)).toFixed(2) + " MB"
            : (item.size / 1024).toFixed(2) + " KB",
      }));
    }
  } catch (err) {
    ElMessage.error("获取数据集失败");
  }
};

// 切换右侧面板
const toggleRightPanel = () => {
  rightPanelActive.value = !rightPanelActive.value;
};

// 切换图层可见性
const toggleLayerVisibility = (data: any) => {
  data.visible = !data.visible;
  if (!viewer) {
    return;
  }
  if (data.id === 0) {
    let baselayer = viewer.imageryLayers.get(0);
    baselayer.show = data.visible;
  }
  // 如果是用户动态加载的图层
  else if (data.cesiumLayer) {
    data.cesiumLayer.show = data.visible;
  }
};

// 处理节点上下文菜单
const handleNodeContextMenu = (event: Event, data: any) => {
  event.preventDefault();
  console.log("右键菜单:", data);
};

// 处理拖动开始
const handleDragStart = (item: any, event: DragEvent) => {
  draggedItem.value = item;
  isDragging.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
  }
};

// 处理拖动结束
const handleDragEnd = () => {
  isDragging.value = false;
  draggedItem.value = null;
};

// 处理拖动到地图上
const handleDropOnMap = async () => {
  if (!draggedItem.value || !viewer) {
    console.warn("条件不满足: draggedItem 为空或 viewer 未初始化");
    return;
  }

  const itemId = draggedItem.value.id;
  const itemName = draggedItem.value.label;
  const itemFilename = draggedItem.value.filename;
  const itemType = draggedItem.value.type;

  const loading = ElMessage.info({
    message: `正在发布数据：${draggedItem.value.label}...`,
    duration: 0,
  });
  try {
    const token = localStorage.getItem("token");
    // 对应后端 userRoutes.ts 中的 router.post('/datasets/publish', ...)
    const res = await axios.post(
      "http://localhost:3000/api/users/datasets/publish",
      {
        filename: itemFilename || itemName,
        assetId: itemId,
      },
      {
        headers: { Authorization: token },
      },
    );
    if (res.data.code === 200) {
      const { storeName, layerName, wmsUrl, layers, viewparams } = res.data;
      const parameters: any = {
        service: "WMS",
        format: "image/png",
        transparent: true,
        viewparams: res.data.viewparams,
      };

      if (viewparams) {
        parameters.viewparams = viewparams;
      }

      const provider = new Cesium.WebMapServiceImageryProvider({
        url: wmsUrl,
        layers: layers,
        parameters: parameters,
      });

      const imageryLayer = (viewer as any).imageryLayers.addImageryProvider(
        provider,
      );

      createdResources.value.push({
        storeName: storeName,
        layerName: layerName,
      });
      layerData.value.push({
        id: itemId,
        label: itemName,
        visible: true,
        cesiumLayer: imageryLayer, // 保存引用以便后续控制显隐
        type: itemType,
      });

      loading.close();
      ElMessage.success(`数据加载成功：${itemName}`);
    }
  } catch (err: any) {
    console.log(err);

    loading.close();
    ElMessage.error(
      `数据发布失败：${err.response?.data?.message || "未知错误"}`,
    );
  } finally {
    loading.close();
    isDragging.value = false;
    draggedItem.value = null;
  }
};

// 检查是否允许将图层拖入到指定位置
const allowDrop = (draggingNode: any, dropNode: any, type: string) => {
  // 1. 严禁嵌套：只能在节点前后移动
  if (type === "inner") return false;

  // 2. 保护底图：任何图层都不允许移动到基础图层（id:0）的下方
  if (dropNode.data.id === 0 && type === "next") return false;

  return true;
};

// 检查是否允许拖动图层
const allowDrag = (node: any) => {
  return node.data.id !== 0;
};

// 处理图层拖动顺序渲染的事件
const handleLayerDrop = (
  draggingNode: any,
  dropNode: any,
  dropType: string,
  ev: DragEvent,
) => {
  if (!viewer) return;

  // 1. 立即给当前的 Provider 们留个快照，防止被 remove 删没了找不到
  const providerCache = new Map();
  layerData.value.forEach((item) => {
    if (item.id !== 0 && item.cesiumLayer) {
      providerCache.set(item.id, (item.cesiumLayer as any).imageryProvider);
    }
  });

  // 2. 核心修复：同步 Vue 的源数据顺序
  // 既然 el-tree 已经把 displayedLayers 的顺序改了，我们得让 layerData 跟上
  // 过滤掉底图，拿到当前 UI 上的用户图层顺序（从上到下）
  const newUiOrder = displayedLayers.value.filter((item) => item.id !== 0);

  // 更新源数据 layerData：[底图, ...反转后的UI顺序]
  // 为什么要反转？因为 layerData 原始逻辑里索引大的在上面，而 UI 是索引小的在上面
  layerData.value = [
    ...layerData.value.filter((item) => item.id === 0), // 保留底图在第一项
    ...[...newUiOrder].reverse(),
  ];

  // 3. 暴力重绘 Cesium
  const imageryLayers = viewer!.imageryLayers;

  // 清除所有非底图（保留 index 0）
  while (imageryLayers.length > 1) {
    imageryLayers.remove(imageryLayers.get(1));
  }

  // 4. 按照 UI 的顺序重新 add
  // UI 数组是 [顶层, ..., 底层]，我们要想让“顶层”真的在最上面，就得最后加它
  // 所以这里我们从 UI 数组的末尾（底层）开始往 Cesium 里加
  for (let i = newUiOrder.length - 1; i >= 0; i--) {
    const item = newUiOrder[i]!;
    const provider = providerCache.get(item.id);

    if (provider) {
      const newLayer = imageryLayers.addImageryProvider(provider);
      newLayer.show = item.visible;

      // 【关键】把新的图层引用塞回源数据，下次拖拽或开关显隐才能找到它
      const target = layerData.value.find((l) => l.id === item.id);
      if (target) {
        target.cesiumLayer = newLayer as any;
      }
    }
  }

  viewer!.scene.requestRender();
};

// 执行工具
const executeTool = (toolId: number) => {
  activeToolId.value = toolId;
};

// 处理页面关闭时清理资源
const handleCleanup = () => {
  if (createdResources.value.length === 0) return;

  const url = "http://localhost:3000/api/users/datasets/cleanup";
  const data = JSON.stringify({
    workspace: "user_data_space",
    resources: createdResources.value,
  });

  // 1. 优先使用 sendBeacon，它在页面关闭时非常可靠
  if (navigator.sendBeacon) {
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(url, blob);
  } else {
    // 2. 备用 fetch
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      keepalive: true,
    });
  }

  // 清空数组防止重复触发
  createdResources.value = [];
};
</script>

<template>
  <div class="workbench-bg">
    <!-- 背景装饰 -->
    <div class="grid-overlay"></div>
    <div class="bg-orb orb1"></div>
    <div class="bg-orb orb2"></div>
    <div class="workbench-wrap">
      <!-- 顶部导航 -->
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="brand">
            <svg viewBox="0 0 40 40" fill="none" class="brand-svg">
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="white"
                stroke-width="2"
                opacity="0.35"
              />
              <path
                d="M12 20 L20 12 L28 20 L20 28 Z"
                fill="white"
                opacity="0.9"
              />
              <circle cx="20" cy="20" r="4" fill="white" />
            </svg>
            <span class="brand-name">地理信息管理平台</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-cur">操作台</span>
        </div>
        <div class="top-bar-right">
          <el-dropdown
            trigger="click"
            @command="handleUserCommand"
            class="user-dropdown"
          >
            <div class="menu-trigger">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="menu-icon"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="custom-dropdown">
                <el-dropdown-item command="profile">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="dropdown-icon"
                  >
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>我的信息</span>
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="dropdown-icon"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                    />
                  </svg>
                  <span>设置</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 主体内容 -->
      <main class="workbench-main">
        <!-- 左侧工具条 (始终显示) -->
        <aside class="side-bar left-bar">
          <div
            class="bar-icon-btn"
            :class="{ active: leftPanelActive }"
            @click="toggleLeftPanel"
            title="资源管理"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <!-- 重叠方块图标 -->
              <rect
                x="2"
                y="2"
                width="9"
                height="9"
                rx="1.5"
                fill="currentColor"
                opacity="0.3"
              />
              <rect
                x="6"
                y="6"
                width="9"
                height="9"
                rx="1.5"
                fill="currentColor"
                opacity="0.6"
              />
              <rect
                x="10"
                y="10"
                width="9"
                height="9"
                rx="1.5"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
          </div>
        </aside>

        <!-- 左侧滑出面板 -->
        <transition name="slide-left">
          <aside class="side-panel left-panel" v-show="leftPanelActive">
            <div class="panel-content">
              <div class="panel-header">
                <h3 class="panel-title">资源管理</h3>
                <div class="close-btn" @click="leftPanelActive = false">×</div>
              </div>

              <div class="panel-body">
                <!-- 图层列表 -->
                <div class="content-section">
                  <div class="section-title">地图图层</div>
                  <el-tree
                    :data="displayedLayers"
                    default-expand-all
                    node-key="id"
                    draggable
                    :allow-drop="allowDrop"
                    :allow-drag="allowDrag"
                    @node-drop="handleLayerDrop"
                    @node-contextmenu="handleNodeContextMenu"
                    class="custom-tree"
                  >
                    <template #default="{ node, data }">
                      <div class="layer-node">
                        <div class="node-left">
                          <span class="layer-type-tag" v-if="data.id !== 0">
                            <svg
                              v-if="data.type === 'vector'"
                              class="type-mini-svg vector"
                              viewBox="0 0 24 24"
                            >
                              <polygon
                                points="12 2 22 20 2 20"
                                fill="currentColor"
                              />
                            </svg>
                            <svg
                              v-else-if="data.type === 'raster'"
                              class="type-mini-svg raster"
                              viewBox="0 0 24 24"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                fill="currentColor"
                              />
                            </svg>
                          </span>
                          <span class="node-label">{{ data.label }}</span>
                        </div>
                        <div
                          class="visibility-toggle"
                          @click.stop="toggleLayerVisibility(data)"
                        >
                          <svg
                            width="200"
                            height="200"
                            viewBox="0 0 200 200"
                            xmlns="http://www.w3.org/2000/svg"
                            v-show="data.visible === true"
                            class="eye-icon"
                          >
                            <rect width="100%" height="100%"fill = 'transparent' />

                            <g stroke="white" stroke-width="3" fill="none">
                              <ellipse cx="100" cy="100" rx="80" ry="50" />

                              <circle cx="100" cy="100" r="40" />
                            </g>
                          </svg>

                          <svg
                            width="200"
                            height="200"
                            viewBox="0 0 200 200"
                            xmlns="http://www.w3.org/2000/svg"
                            v-show="data.visible === false"
                            class="eye-icon"
                          >
                            <rect width="100%" height="100%"fill = 'transparent' />

                            <g
                              stroke="white"
                              stroke-width="3"
                              fill="none"
                              stroke-linecap="round"
                            >
                              <ellipse cx="100" cy="100" rx="80" ry="50" />

                              <line x1="160" y1="60" x2="40" y2="140" />
                            </g>
                          </svg>
                        </div>
                      </div>
                    </template>
                  </el-tree>
                </div>

                <!-- 分割线 -->
                <div class="section-divider"></div>

                <!-- 数据列表 -->
                <div class="content-section">
                  <div class="section-title">我的数据</div>
                  <div class="data-list">
                    <div
                      v-for="item in userData"
                      :key="item.id"
                      class="data-card"
                      draggable="true"
                      @dragstart="handleDragStart(item, $event)"
                      @dragend="handleDragEnd"
                      :class="{
                        dragging: isDragging && draggedItem?.id === item.id,
                      }"
                    >
                      <div class="data-icon-wrap" :class="item.type">
                        <svg
                          v-if="item.type === 'vector'"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.6"
                          class="type-svg"
                        >
                          <polygon points="12 2 22 20 2 20" />
                          <circle cx="12" cy="2" r="2" fill="currentColor" />
                          <circle cx="22" cy="20" r="2" fill="currentColor" />
                          <circle cx="2" cy="20" r="2" fill="currentColor" />
                        </svg>
                        <svg
                          v-else
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.6"
                          class="type-svg"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="3" y1="15" x2="21" y2="15" />
                          <line x1="9" y1="3" x2="9" y2="21" />
                          <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                      </div>
                      <div class="data-info">
                        <span class="data-name">{{ item.label }}</span>
                        <span class="data-meta">{{ item.size }}</span>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="drag-indicator"
                      >
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </transition>

        <!-- Cesium 地图容器 -->
        <div
          class="map-container"
          @dragenter.prevent
          @dragover.prevent
          @drop="handleDropOnMap"
        >
          <div id="cesiumContainer"></div>
          <!-- 拖拽提示 -->
          <div v-if="isDragging" class="drag-overlay">
            <div class="drag-hint">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>释放以加载数据到场景</span>
            </div>
          </div>

          
        </div>

        <!-- 右侧工具条 (始终显示) -->
        <aside class="side-bar right-bar">
          <div
            class="bar-icon-btn"
            :class="{ active: rightPanelActive }"
            @click="toggleRightPanel"
            title="工具箱"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <!-- 工具箱图标 -->
              <rect
                x="4"
                y="4"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
              />
              <rect
                x="13"
                y="4"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
              />
              <rect
                x="4"
                y="13"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
              />
              <rect
                x="13"
                y="13"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
              />
              <path
                d="M7.5 7.5h0M16.5 7.5h0M7.5 16.5h0M16.5 16.5h0"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </aside>

        <!-- 右侧滑出面板 -->
        <transition name="slide-right">
          <aside class="side-panel right-panel" v-show="rightPanelActive">
            <div class="panel-content">
              <div class="panel-header">
                <h3 class="panel-title">工具箱</h3>
                <div class="close-btn" @click="rightPanelActive = false">×</div>
              </div>

              <div class="panel-body">
                <el-collapse
                  v-model="activeToolCategory"
                  accordion
                  class="custom-collapse"
                >
                  <el-collapse-item
                    v-for="category in toolCategories"
                    :key="category.id"
                    :name="category.id"
                    :title="category.title"
                  >
                    <div class="tools-list">
                      <div
                        v-for="tool in category.tools"
                        :key="tool.toolId"
                        class="tool-card"
                        @click="executeTool(tool.toolId)"
                      >
                        <div class="tool-icon-box" :class="category.id">
                          <svg
                            v-if="category.id === 'vector'"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="tool-svg"
                          >
                            <path
                              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                            />
                          </svg>
                          <svg
                            v-else-if="category.id === 'raster'"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="tool-svg"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle
                              cx="8.5"
                              cy="8.5"
                              r="1.5"
                              fill="currentColor"
                            />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                          <svg
                            v-else
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="tool-svg"
                          >
                            <circle cx="12" cy="12" r="3" />
                            <path
                              d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l4.24 4.24M2.1 2.1l4.24 4.24"
                            />
                          </svg>
                        </div>
                        <div class="tool-detail">
                          <span class="tool-name">{{ tool.name }}</span>
                          <span class="tool-desc">{{ tool.desc }}</span>
                        </div>
                      </div>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </div>
          </aside>
        </transition>

        <ToolPanel 
  :tool-id="activeToolId" 
  @close="activeToolId = null" 
/>
        
      </main>
    </div>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== 背景与布局 ===== */
.workbench-bg {
  min-height: 100vh;
  background: #080d18;
  font-family: "Noto Serif SC", serif;
  position: relative;
  overflow: hidden;
}

.grid-overlay {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}

.orb1 {
  width: 600px;
  height: 600px;
  background: #1d4ed8;
  opacity: 0.08;
  top: -200px;
  left: -150px;
}

.orb2 {
  width: 500px;
  height: 500px;
  background: #0e7490;
  opacity: 0.07;
  bottom: -150px;
  right: -100px;
}

.workbench-wrap {
  position: relative;
  z-index: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ===== 顶部导航 ===== */
.top-bar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(8, 13, 24, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  z-index: 100;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-svg {
  width: 32px;
  height: 32px;
}

.brand-name {
  font-size: 17px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.breadcrumb-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 18px;
}

.breadcrumb-cur {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.45);
}

.top-bar-right {
  display: flex;
  align-items: center;
}

.menu-trigger {
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.6);
}

.menu-trigger:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}

.menu-icon {
  width: 22px;
  height: 22px;
}

/* 下拉菜单样式 */
:deep(.custom-dropdown) {
  background: #111827 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4) !important;
  padding: 6px !important;
}

:deep(.custom-dropdown .el-dropdown-menu__item) {
  color: #94a3b8 !important;
  font-family: "Noto Serif SC", serif !important;
  font-size: 14px !important;
  padding: 10px 16px !important;
  border-radius: 6px !important;
  display: flex;
  align-items: center;
  gap: 10px;
}

:deep(.custom-dropdown .el-dropdown-menu__item:hover) {
  background: rgba(37, 99, 235, 0.15) !important;
  color: #60a5fa !important;
}

.dropdown-icon {
  width: 16px;
  height: 16px;
}

/* ===== 主体布局 ===== */
.workbench-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* ===== 侧边工具条 (常驻) ===== */
.side-bar {
  position: absolute;
  top: 20px; /* 距离顶部一点距离 */
  width: auto; /* 宽度由内容决定 */
  background: transparent; /* 消除背景条 */
  border: none !important; /* 移除边框 */
  z-index: 70; /* 高于地图和面板 */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); /* 使用更平滑的贝塞尔曲线 */
}

.left-bar {
  left: 20px; /* 悬浮在左侧 */
  /* 激活时，向左偏移自身宽度+间距，实现“滑出屏幕” */
  transform: translateX(v-bind("leftPanelActive ? '-80px' : '0'"));
  opacity: v-bind("leftPanelActive ? '0' : '1'");
}

.right-bar {
  right: 20px; /* 悬浮在右侧 */
  /* 激活时，向右偏移 */
  transform: translateX(v-bind("rightPanelActive ? '80px' : '0'"));
  opacity: v-bind("rightPanelActive ? '0' : '1'");
}

.bar-icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(249, 243, 243, 0.966);
  color: rgba(255, 255, 255, 0.5);
}

.bar-icon-btn svg {
  width: 20px;
  height: 20px;
}

.bar-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #60a5fa;
  transform: scale(1.05);
}

.bar-icon-btn.active {
  background: rgba(37, 99, 235, 0.2);
  color: #60a5fa;
  border-color: rgba(37, 99, 235, 0.3);
}

/* ===== 滑出面板样式 ===== */
.side-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(8, 13, 24, 0.98);
  backdrop-filter: blur(16px);
  z-index: 60;
  /* 移除之前的 margin 和 border-radius（或只保留内侧圆角） */
  margin: 0;
}

.left-panel {
  left: 0px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.right-panel {
  right: 0px;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}

.node-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-mini-svg {
  width: 14px;
  height: 14px;
}

.type-mini-svg.vector {
  color: #4ade80;
}
.type-mini-svg.raster {
  color: #facc15;
}

.layer-node {
  cursor: grab; /* 提示可拖拽 */
}

/* 拖拽时的样式反馈 */
:deep(.el-tree-node.is-drop-inner > .el-tree-node__content) {
  background-color: rgba(37, 99, 235, 0.2) !important;
}

/* 滑动动画 */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f87171;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ===== 地图容器 ===== */
.map-container {
  flex: 1;
  position: relative;
  background: #000;
  z-index: 10;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* 强力屏蔽 Cesium 的默认点击高亮 */
:deep(.cesium-infoBox),
:deep(.cesium-selectionIndicator) {
  display: none !important;
}

/* 拖拽遮罩 */
.drag-overlay {
  position: absolute;
  inset: 0;
  background: rgba(8, 13, 24, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.2s ease;
}

.drag-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: rgba(17, 24, 39, 0.9);
  border: 2px dashed #2563eb;
  border-radius: 16px;
  color: #60a5fa;
  font-size: 16px;
}

.drag-hint svg {
  width: 48px;
  height: 48px;
  animation: bounce 1s infinite;
}

/* ===== 内部组件样式 ===== */
.section-title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 12px;
  padding-left: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 20px 0;
}

/* 树形控件 */
:deep(.custom-tree) {
  background: transparent !important;
}

/* 移除点击、选中以及焦点状态下的背景色 */
:deep(.custom-tree .el-tree-node:focus > .el-tree-node__content),
:deep(.custom-tree .el-tree-node.is-current > .el-tree-node__content) {
  background-color: transparent !important; /* 或者设为你想要的背景色 */
  color: #60a5fa; /* 可选：选中后文字变蓝，保持视觉反馈 */
}

:deep(.custom-tree .el-tree-node__content:hover) {
  background: rgba(255, 255, 255, 0.04) !important;
}

.layer-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px;
}

.node-label {
  font-size: 14px;
  color: #e2e8f0;
}

.visibility-toggle {
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
  color: #e2e8f0;
}

.visibility-toggle:hover {
  background: rgba(11, 16, 27, 0.955);
  color: #60a5fa;
}

.eye-icon {
  width: 16px;
  height: 16px;
  color: #e2e8f0;
}

/* 数据卡片 */
.data-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.data-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: move;
  transition: all 0.2s;
}

.data-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(37, 99, 235, 0.3);
}

.data-card.dragging {
  opacity: 0.5;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.data-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.data-icon-wrap.vector {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

.data-icon-wrap.raster {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
}

.type-svg {
  width: 18px;
  height: 18px;
}

.data-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.data-name {
  font-size: 13px;
  color: #e2e8f0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-meta {
  font-size: 12px;
  color: #64748b;
}

.drag-indicator {
  width: 12px;
  height: 12px;
  color: #475569;
  flex-shrink: 0;
}

/* 工具箱 */
:deep(.custom-collapse) {
  border: none;
}

:deep(.custom-collapse .el-collapse-item__header) {
  background: transparent !important;
  color: #e2e8f0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  height: 48px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

:deep(.custom-collapse .el-collapse-item__wrap) {
  background: transparent !important;
  border-bottom: none !important;
}

:deep(.custom-collapse .el-collapse-item__content) {
  padding: 0 !important;
}

.tools-list {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  gap: 8px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-card:hover {
  background: rgba(37, 99, 235, 0.08);
}

.tool-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-icon-box.vector {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.tool-icon-box.raster {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
}
.tool-icon-box.general {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
}

.tool-svg {
  width: 18px;
  height: 18px;
}

.tool-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-name {
  font-size: 13px;
  color: #e2e8f0;
}

.tool-desc {
  font-size: 12px;
  color: #64748b;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
