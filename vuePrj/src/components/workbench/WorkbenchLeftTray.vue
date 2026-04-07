<script setup lang="ts">
import * as Cesium from "cesium";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { WorkbenchLayerItem as LayerItem } from "@/views/Workbench.vue";
import {
  fetchUserDatasets,
  publishUserDataset,
  sendDatasetCleanup,
} from "@/api/datasets";

interface UserDatasetItem {
  id: string;
  label: string;
  filename?: string;
  type: string;
  size: string;
}

interface CreatedResourceItem {
  storeName: string;
  layerName?: string;
  resourceType: string;
  cleanupGroup?: string;
}

const props = defineProps<{
  viewer: Cesium.Viewer | null;
  layers: LayerItem[];
}>();

const emit = defineEmits<{
  (event: "dragging-change", value: boolean): void;
  (event: "update:layers", value: LayerItem[]): void;
}>();

const leftPanelActive = ref(false);
const draggedItem = ref<UserDatasetItem | null>(null);
const isDragging = ref(false);

const userData = ref<UserDatasetItem[]>([]);
const createdResources = ref<CreatedResourceItem[]>([]);

const displayedLayers = computed(() => {
  const base = props.layers.filter((layer) => layer.id === 0);
  const userLayers = props.layers.filter((layer) => layer.id !== 0);
  return [...userLayers.reverse(), ...base];
});

const syncLayersToUI = () => {};

const updateLayers = (layers: LayerItem[]) => {
  emit("update:layers", layers);
};

const updateDraggingState = (value: boolean) => {
  isDragging.value = value;
  emit("dragging-change", value);
};

const toggleLeftPanel = async () => {
  leftPanelActive.value = !leftPanelActive.value;

  if (!leftPanelActive.value) {
    return;
  }

  try {
    syncLayersToUI();

    const res = await fetchUserDatasets();

    if (res.code === 200) {
      userData.value = res.data.map((item: any) => ({
        id: item._id,
        label: item.name.toLowerCase().endsWith(".zip")
          ? item.name.replace(/\.zip$/i, ".shp")
          : item.name,
        filename: item.filename,
        type: item.type,
        size:
          item.size > 1024 * 1024
            ? `${(item.size / (1024 * 1024)).toFixed(2)} MB`
            : `${(item.size / 1024).toFixed(2)} KB`,
      }));
    }
  } catch {
    ElMessage.error("获取数据集失败");
  }
};

const toggleLayerVisibility = (data: LayerItem) => {
  const nextVisible = !data.visible;

  if (!props.viewer) {
    return;
  }

  if (data.id === 0) {
    const baseLayer = props.viewer.imageryLayers.get(0);
    baseLayer.show = nextVisible;
  } else if (data.cesiumLayer) {
    data.cesiumLayer.show = nextVisible;
  }

  updateLayers(
    props.layers.map((layer) =>
      layer.id === data.id ? { ...layer, visible: nextVisible } : layer,
    ),
  );
};

const handleNodeContextMenu = (event: Event, data: LayerItem) => {
  event.preventDefault();
  console.log("右键菜单:", data);
};

const handleDragStart = (item: UserDatasetItem, event: DragEvent) => {
  draggedItem.value = item;
  updateDraggingState(true);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
  }
};

const handleDragEnd = () => {
  draggedItem.value = null;
  updateDraggingState(false);
};

const handleDropOnMap = async () => {
  if (!draggedItem.value || !props.viewer) {
    return;
  }

  const itemId = draggedItem.value.id;
  const itemName = draggedItem.value.label;
  const itemFilename = draggedItem.value.filename;
  const itemType = draggedItem.value.type;

  const loading = ElMessage.info({
    message: `正在发布数据：${itemName}...`,
    duration: 0,
  });

  try {
    const res = await publishUserDataset({
      filename: itemFilename || itemName,
      assetId: itemId,
    });

    if (res.code === 200) {
      const { storeName, layerName, resourceType, wmsUrl, layers, viewparams } = res;
      const parameters: Record<string, unknown> = {
        service: "WMS",
        format: "image/png",
        transparent: true,
      };

      if (viewparams) {
        parameters.viewparams = viewparams;
      }

      const provider = new Cesium.WebMapServiceImageryProvider({
        url: wmsUrl,
        layers,
        parameters,
      });

      const imageryLayer = props.viewer.imageryLayers.addImageryProvider(provider);

      if (storeName && resourceType) {
        createdResources.value.push({
          storeName,
          layerName,
          resourceType,
          cleanupGroup: res.cleanupGroup,
        });
      }
      updateLayers([
        ...props.layers,
        {
          id: itemId,
          label: itemName,
          visible: true,
          cesiumLayer: imageryLayer,
          type: itemType,
          assetId: itemId,
          wmsUrl,
          layers,
          storeName,
          resourceType,
          cleanupGroup: res.cleanupGroup,
        },
      ]);

      ElMessage.success(`数据加载成功：${itemName}`);
    }
  } catch (err: any) {
    ElMessage.error(`数据发布失败：${err.response?.data?.message || "未知错误"}`);
  } finally {
    loading.close();
    draggedItem.value = null;
    updateDraggingState(false);
  }
};

const allowDrop = (_draggingNode: any, dropNode: any, type: string) => {
  if (type === "inner") return false;
  if (dropNode.data.id === 0 && type === "next") return false;
  return true;
};

const allowDrag = (node: any) => node.data.id !== 0;

const handleLayerDrop = () => {
  if (!props.viewer) return;

  const providerCache = new Map<LayerItem["id"], Cesium.ImageryProvider>();
  props.layers.forEach((item) => {
    if (item.id !== 0 && item.cesiumLayer) {
      providerCache.set(item.id, item.cesiumLayer.imageryProvider);
    }
  });

  const newUiOrder = displayedLayers.value.filter((item) => item.id !== 0);

  const nextLayers = [
    ...props.layers.filter((item) => item.id === 0),
    ...[...newUiOrder].reverse(),
  ];
  updateLayers(nextLayers);

  const imageryLayers = props.viewer.imageryLayers;
  while (imageryLayers.length > 1) {
    imageryLayers.remove(imageryLayers.get(1));
  }

  for (let i = newUiOrder.length - 1; i >= 0; i -= 1) {
    const item = newUiOrder[i];
    if (!item) {
      continue;
    }

    const provider = providerCache.get(item.id);

    if (provider) {
      const newLayer = imageryLayers.addImageryProvider(provider);
      newLayer.show = item.visible;

      const target = nextLayers.find((layer) => layer.id === item.id);
      if (target) {
        target.cesiumLayer = newLayer;
      }
    }
  }

  props.viewer.scene.requestRender();
};

const handleCleanup = () => {
  const layerResources = props.layers
    .filter((layer) => layer.storeName && layer.resourceType)
    .map((layer) => ({
      storeName: layer.storeName!,
      layerName: layer.label,
      resourceType: layer.resourceType!,
      cleanupGroup: layer.cleanupGroup,
    }));

  const uniqueResources = [...createdResources.value, ...layerResources].filter(
    (item, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.storeName === item.storeName &&
          candidate.resourceType === item.resourceType &&
          candidate.cleanupGroup === item.cleanupGroup,
      ) === index,
  );

  if (uniqueResources.length === 0) return;

  sendDatasetCleanup({
    workspace: "user_data_space",
    resources: uniqueResources,
  });

  createdResources.value = [];
};

onMounted(() => {
  window.addEventListener("beforeunload", handleCleanup);
});

onUnmounted(() => {
  window.removeEventListener("beforeunload", handleCleanup);
  handleCleanup();
});

defineExpose({
  handleDropOnMap,
});
</script>

<template>
  <aside class="side-bar left-bar">
    <div
      class="bar-icon-btn"
      :class="{ active: leftPanelActive }"
      @click="toggleLeftPanel"
      title="资源管理"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2" y="2" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.3" />
        <rect x="6" y="6" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.6" />
        <rect x="10" y="10" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.9" />
      </svg>
    </div>
  </aside>

  <transition name="slide-left">
    <aside v-show="leftPanelActive" class="side-panel left-panel">
      <div class="panel-content">
        <div class="panel-header">
          <h3 class="panel-title">资源管理</h3>
          <div class="close-btn" @click="leftPanelActive = false">×</div>
        </div>

        <div class="panel-body">
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
              <template #default="{ data }">
                <div class="layer-node">
                  <div class="node-left">
                    <span v-if="data.id !== 0" class="layer-type-tag">
                      <svg
                        v-if="data.type === 'vector'"
                        class="type-mini-svg vector"
                        viewBox="0 0 24 24"
                      >
                        <polygon points="12 2 22 20 2 20" fill="currentColor" />
                      </svg>
                      <svg
                        v-else-if="data.type === 'raster'"
                        class="type-mini-svg raster"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" />
                      </svg>
                    </span>
                    <span class="node-label">{{ data.label }}</span>
                  </div>

                  <div class="visibility-toggle" @click.stop="toggleLayerVisibility(data)">
                    <svg
                      v-show="data.visible === true"
                      width="200"
                      height="200"
                      viewBox="0 0 200 200"
                      xmlns="http://www.w3.org/2000/svg"
                      class="eye-icon"
                    >
                      <rect width="100%" height="100%" fill="transparent" />
                      <g stroke="white" stroke-width="3" fill="none">
                        <ellipse cx="100" cy="100" rx="80" ry="50" />
                        <circle cx="100" cy="100" r="40" />
                      </g>
                    </svg>

                    <svg
                      v-show="data.visible === false"
                      width="200"
                      height="200"
                      viewBox="0 0 200 200"
                      xmlns="http://www.w3.org/2000/svg"
                      class="eye-icon"
                    >
                      <rect width="100%" height="100%" fill="transparent" />
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

          <div class="section-divider"></div>

          <div class="content-section">
            <div class="section-title">我的数据</div>
            <div class="data-list">
              <div
                v-for="item in userData"
                :key="item.id"
                class="data-card"
                draggable="true"
                :class="{ dragging: isDragging && draggedItem?.id === item.id }"
                @dragstart="handleDragStart(item, $event)"
                @dragend="handleDragEnd"
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

                <svg viewBox="0 0 24 24" fill="currentColor" class="drag-indicator">
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
</template>

<style scoped>
.side-bar {
  position: absolute;
  top: 20px;
  width: auto;
  background: transparent;
  border: none !important;
  z-index: 70;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.left-bar {
  left: 20px;
  transform: v-bind("leftPanelActive ? 'translateX(-80px)' : 'translateX(0)'");
  opacity: v-bind("leftPanelActive ? '0' : '1'");
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

.side-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(8, 13, 24, 0.98);
  backdrop-filter: blur(16px);
  z-index: 60;
  margin: 0;
}

.left-panel {
  left: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
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

.content-section {
  min-width: 0;
}

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
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px;
  cursor: grab;
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

:deep(.custom-tree) {
  background: transparent !important;
}

:deep(.custom-tree .el-tree-node:focus > .el-tree-node__content),
:deep(.custom-tree .el-tree-node.is-current > .el-tree-node__content) {
  background-color: transparent !important;
  color: #60a5fa;
}

:deep(.custom-tree .el-tree-node__content:hover) {
  background: rgba(255, 255, 255, 0.04) !important;
}

:deep(.el-tree-node.is-drop-inner > .el-tree-node__content) {
  background-color: rgba(37, 99, 235, 0.2) !important;
}
</style>
