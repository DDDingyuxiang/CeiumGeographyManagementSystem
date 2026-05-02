<script setup lang="ts">
import * as Cesium from "cesium";
import "../Widgets/widgets.css";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ToolPanel from "@/components/ToolPanel.vue";
import WorkbenchLeftTray from "@/components/workbench/WorkbenchLeftTray.vue";
import WorkbenchRightTray from "@/components/workbench/WorkbenchRightTray.vue";
import emitter, { type AnalysisLayerPayload } from "@/utils/bus";

export interface WorkbenchLayerItem {
  id: number | string;
  label: string;
  visible: boolean;
  cesiumLayer: Cesium.ImageryLayer | null;
  type: string;
  assetId?: string;
  wmsUrl?: string;
  layers?: string;
  storeName?: string;
  resourceType?: string;
  cleanupGroup?: string;
  geoJsonPath?: string;
  geoJsonUrl?: string;
  bounds?: [number, number, number, number];
  sourceAssetId?: string;
  styleKind?: "contour" | "point" | "polygon";
}

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

window.CESIUM_BASE_URL = "/";
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESSTOKEN;

const router = useRouter();
const isDragging = ref(false);
const activeToolId = ref<number | null>(null);
const leftTrayRef = ref<{ handleDropOnMap: () => Promise<void> } | null>(null);
const loadedLayers = ref<WorkbenchLayerItem[]>([
  {
    id: 0,
    label: "基础图层",
    visible: true,
    cesiumLayer: null,
    type: "imagery",
  },
]);

let viewer: Cesium.Viewer | null = null;

const buildContourSld = (layerName: string) => `
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <Title>Contour Style</Title>
      <FeatureTypeStyle>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#f59e0b</CssParameter>
              <CssParameter name="stroke-width">1.5</CssParameter>
              <CssParameter name="stroke-opacity">0.95</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`.trim();

const buildVectorSld = (layerName: string, styleKind: string) => {
  const symbolizer =
    styleKind === "point"
      ? `
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill>
                  <CssParameter name="fill">#ef4444</CssParameter>
                  <CssParameter name="fill-opacity">0.95</CssParameter>
                </Fill>
                <Stroke>
                  <CssParameter name="stroke">#ffffff</CssParameter>
                  <CssParameter name="stroke-width">1</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>`
      : `
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#38bdf8</CssParameter>
              <CssParameter name="fill-opacity">0.28</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#0ea5e9</CssParameter>
              <CssParameter name="stroke-width">1.4</CssParameter>
              <CssParameter name="stroke-opacity">0.95</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#0ea5e9</CssParameter>
              <CssParameter name="stroke-width">1.4</CssParameter>
              <CssParameter name="stroke-opacity">0.95</CssParameter>
            </Stroke>
          </LineSymbolizer>`;

  return `
<StyledLayerDescriptor version="1.0.0"
  xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <Title>Vector Analysis Style</Title>
      <FeatureTypeStyle>
        <Rule>${symbolizer}
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`.trim();
};

const addWmsLayer = async (payload: AnalysisLayerPayload) => {
  if (!viewer) {
    return;
  }

  const parameters: Record<string, string | boolean> = {
    service: "WMS",
    format: "image/png",
    transparent: true,
  };

  if (payload.styleKind === "contour") {
    parameters.SLD_BODY = buildContourSld(payload.layers);
  } else if (payload.styleKind) {
    parameters.SLD_BODY = buildVectorSld(payload.layers, payload.styleKind);
  }

  const provider = new Cesium.WebMapServiceImageryProvider({
    url: payload.wmsUrl,
    layers: payload.layers,
    parameters,
  });

  const imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
  imageryLayer.alpha = 1;
  loadedLayers.value = [
    ...loadedLayers.value,
    {
      id: payload.id,
      label: payload.label,
      visible: payload.visible,
      cesiumLayer: imageryLayer,
      type: payload.type,
      wmsUrl: payload.wmsUrl,
      layers: payload.layers,
      storeName: payload.storeName,
      resourceType: payload.resourceType,
      cleanupGroup: payload.cleanupGroup,
      geoJsonPath: payload.geoJsonPath,
      geoJsonUrl: payload.geoJsonUrl,
      bounds: payload.bounds,
      sourceAssetId: payload.sourceAssetId,
      styleKind: payload.styleKind,
    },
  ];

  if (payload.bounds) {
    const [west, south, east, north] = payload.bounds;
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
      duration: 0.8,
    });
  }
};

onMounted(() => {
  viewer = new Cesium.Viewer("cesiumContainer", {
    infoBox: false,
    selectionIndicator: false,
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
        url: import.meta.env.VITE_GAODE_ACCESSTOKEN,
        credit: "高德影像路网",
      }),
    ),
  });

  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";

  viewer.camera.setView({
    destination: Cesium.Rectangle.fromDegrees(73.5, 18.0, 135.0, 53.5),
  });

  viewer.selectedEntityChanged.addEventListener(() => {
    if (viewer) viewer.selectedEntity = undefined;
  });

  viewer.screenSpaceEventHandler.setInputAction(() => {
    if (viewer) viewer.selectedEntity = undefined;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  emitter.on("add-analysis-layer", addWmsLayer);
});

onBeforeUnmount(() => {
  emitter.off("add-analysis-layer", addWmsLayer);
});

const handleUserCommand = (command: string) => {
  if (command === "profile") {
    router.push("/profile");
  } else if (command === "settings") {
    router.push("/settings");
  }
};

const handleDropOnMap = async () => {
  await leftTrayRef.value?.handleDropOnMap();
};

const executeTool = (toolId: number) => {
  activeToolId.value = toolId;
};

const getZoomAmount = () => {
  if (!viewer) {
    return 1000;
  }

  const height = viewer.camera.positionCartographic.height;
  return Math.max(height * 0.45, 200);
};

const zoomIn = () => {
  viewer?.camera.zoomIn(getZoomAmount());
};

const zoomOut = () => {
  viewer?.camera.zoomOut(getZoomAmount());
};
</script>

<template>
  <div class="workbench-bg">
    <div class="grid-overlay"></div>
    <div class="bg-orb orb1"></div>
    <div class="bg-orb orb2"></div>

    <div class="workbench-wrap">
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="brand">
            <svg viewBox="0 0 40 40" fill="none" class="brand-svg">
              <circle cx="20" cy="20" r="18" stroke="white" stroke-width="2" opacity="0.35" />
              <path d="M12 20 L20 12 L28 20 L20 28 Z" fill="white" opacity="0.9" />
              <circle cx="20" cy="20" r="4" fill="white" />
            </svg>
            <span class="brand-name">地理信息管理平台</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-cur">操作台</span>
        </div>

        <div class="top-bar-right">
          <el-dropdown trigger="click" @command="handleUserCommand" class="user-dropdown">
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

      <main class="workbench-main">
        <WorkbenchLeftTray
          ref="leftTrayRef"
          :viewer="viewer"
          :layers="loadedLayers"
          @dragging-change="isDragging = $event"
          @update:layers="loadedLayers = $event"
        />

        <div class="map-container" @dragenter.prevent @dragover.prevent @drop="handleDropOnMap">
          <div id="cesiumContainer"></div>

          <div class="map-zoom-controls" aria-label="地图缩放">
            <button class="zoom-btn" type="button" title="放大" @click="zoomIn">
              <span>+</span>
            </button>
            <button class="zoom-btn" type="button" title="缩小" @click="zoomOut">
              <span>-</span>
            </button>
          </div>

          <div v-if="isDragging" class="drag-overlay">
            <div class="drag-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>释放以加载数据到场景</span>
            </div>
          </div>
        </div>

        <WorkbenchRightTray
          :loaded-layers="loadedLayers"
          @execute-tool="executeTool"
        />
        <ToolPanel
          :tool-id="activeToolId"
          :loaded-layers="loadedLayers"
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

.workbench-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

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

.map-zoom-controls {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  padding: 6px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}

.zoom-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: black;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.zoom-btn span {
  line-height: 1;
  font-size: 22px;
  font-weight: 600;
}

.zoom-btn:hover {
  background: rgba(37, 99, 235, 0.24);
  border-color: rgba(96, 165, 250, 0.45);
  color: #bfdbfe;
}

:deep(.cesium-infoBox),
:deep(.cesium-selectionIndicator) {
  display: none !important;
}

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
