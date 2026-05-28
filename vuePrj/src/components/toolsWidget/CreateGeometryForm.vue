<template>
  <div class="create-geometry-form">
    <div class="form-item">
      <label for="geometry-name">图层名称</label>
      <input
        id="geometry-name"
        v-model.trim="layerName"
        class="custom-input"
        type="text"
        placeholder="手绘要素"
        :disabled="isDrawing || !!drawingDataSource"
      />
    </div>

    <div class="form-item">
      <label for="geometry-type">几何类型</label>
      <select
        id="geometry-type"
        v-model="geometryType"
        class="custom-input"
        :disabled="isDrawing"
      >
        <option value="point">点</option>
        <option value="polyline">线</option>
        <option value="polygon">面</option>
      </select>
    </div>

    <div class="form-item">
      <label for="geometry-color">样式颜色</label>
      <div class="color-row">
        <input
          id="geometry-color"
          v-model="geometryColor"
          class="color-input"
          type="color"
          :disabled="isDrawing"
        />
        <span class="color-value">{{ geometryColor }}</span>
      </div>
    </div>

    <div class="draw-status" :class="{ active: isDrawing }">
      {{ statusText }}
    </div>

    <div class="button-row">
      <button
        v-if="!isDrawing"
        class="submit-btn"
        type="button"
        :disabled="!viewer"
        @click="startDrawing"
      >
        开始绘制
      </button>
      <button v-else class="submit-btn danger" type="button" @click="cancelDrawing">
        取消
      </button>

      <button
        class="secondary-btn"
        type="button"
        :disabled="!isDrawing || positions.length === 0"
        @click="undoLastPoint"
      >
        撤销点
      </button>
    </div>

    <button
      v-if="isDrawing && geometryType !== 'point'"
      class="secondary-btn full"
      type="button"
      :disabled="!canFinish"
      @click="finishDrawing"
    >
      完成当前几何
    </button>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from "cesium";
import { computed, onBeforeUnmount, ref } from "vue";
import { ElMessage } from "element-plus";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

type GeometryType = "point" | "polyline" | "polygon";

const props = defineProps<{
  viewer: Cesium.Viewer | null;
  loadedLayers: WorkbenchLayerItem[];
}>();

const emit = defineEmits<{
  (event: "add-drawing-layer", layer: WorkbenchLayerItem): void;
}>();

const layerName = ref("手绘要素");
const geometryType = ref<GeometryType>("point");
const geometryColor = ref("#38bdf8");
const isDrawing = ref(false);
const positions = ref<Cesium.Cartesian3[]>([]);
const cursorPosition = ref<Cesium.Cartesian3 | null>(null);
const featureCount = ref(0);
const drawingDataSource = ref<Cesium.CustomDataSource | null>(null);

let drawHandler: Cesium.ScreenSpaceEventHandler | null = null;
let previewEntity: Cesium.Entity | null = null;
const vertexEntities: Cesium.Entity[] = [];

const canFinish = computed(() => {
  if (geometryType.value === "polyline") {
    return positions.value.length >= 2;
  }

  if (geometryType.value === "polygon") {
    return positions.value.length >= 3;
  }

  return false;
});

const statusText = computed(() => {
  if (!props.viewer) {
    return "地图尚未初始化";
  }

  if (!isDrawing.value) {
    return featureCount.value
      ? `已创建 ${featureCount.value} 个要素`
      : "选择类型后点击开始绘制";
  }

  if (geometryType.value === "point") {
    return "左键在地图上添加点，取消后退出绘制";
  }

  const minPoints = geometryType.value === "polyline" ? 2 : 3;
  return `左键添加节点，右键或双击完成，至少 ${minPoints} 个节点`;
});

const getColor = (alpha = 1) =>
  Cesium.Color.fromCssColorString(geometryColor.value).withAlpha(alpha);

const pickPosition = (screenPosition: Cesium.Cartesian2 | undefined) => {
  if (!props.viewer || !screenPosition) {
    return null;
  }

  const { scene } = props.viewer;
  let cartesian: Cesium.Cartesian3 | undefined;

  if (scene.pickPositionSupported) {
    cartesian = scene.pickPosition(screenPosition);
  }

  if (!Cesium.defined(cartesian)) {
    cartesian = props.viewer.camera.pickEllipsoid(screenPosition, scene.globe.ellipsoid);
  }

  return Cesium.defined(cartesian) ? Cesium.Cartesian3.clone(cartesian) : null;
};

const ensureDrawingLayer = () => {
  if (!props.viewer) {
    return null;
  }

  if (drawingDataSource.value) {
    return drawingDataSource.value;
  }

  const id = `drawing_${Date.now()}`;
  const label = layerName.value || "手绘要素";
  const dataSource = new Cesium.CustomDataSource(label);
  drawingDataSource.value = dataSource;
  props.viewer.dataSources.add(dataSource);

  emit("add-drawing-layer", {
    id,
    label,
    visible: true,
    cesiumLayer: null,
    dataSource,
    type: "vector",
    styleKind: geometryType.value === "point" ? "point" : "polygon",
  });

  return dataSource;
};

const addVertexMarker = (position: Cesium.Cartesian3) => {
  if (!props.viewer) {
    return;
  }

  const marker = props.viewer.entities.add({
    position,
    point: {
      pixelSize: 8,
      color: getColor(),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1.5,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  vertexEntities.push(marker);
};

const removePreview = () => {
  if (!props.viewer) {
    return;
  }

  if (previewEntity) {
    props.viewer.entities.remove(previewEntity);
    previewEntity = null;
  }

  vertexEntities.splice(0).forEach((entity) => {
    props.viewer?.entities.remove(entity);
  });
};

const getPreviewPositions = () => {
  const next = [...positions.value];
  if (cursorPosition.value) {
    next.push(cursorPosition.value);
  }

  if (geometryType.value === "polygon" && next.length > 2) {
    next.push(next[0]!);
  }

  return next;
};

const createPreviewEntity = () => {
  if (!props.viewer || previewEntity || geometryType.value === "point") {
    return;
  }

  previewEntity = props.viewer.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(getPreviewPositions, false),
      width: 3,
      clampToGround: true,
      material: getColor(0.9),
    },
  });
};

const resetCurrentGeometry = () => {
  positions.value = [];
  cursorPosition.value = null;
  removePreview();
};

const addPointFeature = (position: Cesium.Cartesian3) => {
  const dataSource = ensureDrawingLayer();
  if (!dataSource) {
    return;
  }

  dataSource.entities.add({
    name: `${layerName.value || "手绘点"}-${featureCount.value + 1}`,
    position,
    point: {
      pixelSize: 10,
      color: getColor(),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  featureCount.value += 1;
  props.viewer?.scene.requestRender();
};

const finishDrawing = () => {
  if (!props.viewer || !canFinish.value) {
    return;
  }

  const dataSource = ensureDrawingLayer();
  if (!dataSource) {
    return;
  }

  const finalPositions = positions.value.map((position) => Cesium.Cartesian3.clone(position));
  const name = `${layerName.value || "手绘要素"}-${featureCount.value + 1}`;

  if (geometryType.value === "polyline") {
    dataSource.entities.add({
      name,
      polyline: {
        positions: finalPositions,
        width: 4,
        clampToGround: true,
        material: getColor(),
      },
    });
  } else {
    dataSource.entities.add({
      name,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(finalPositions),
        material: getColor(0.28),
        outline: true,
        outlineColor: getColor(),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      polyline: {
        positions: [...finalPositions, finalPositions[0]!],
        width: 3,
        clampToGround: true,
        material: getColor(),
      },
    });
  }

  featureCount.value += 1;
  resetCurrentGeometry();
  props.viewer.scene.requestRender();
  ElMessage.success("要素已添加到地图");
};

const handleLeftClick = (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
  const position = pickPosition(movement.position);
  if (!position) {
    ElMessage.warning("未能获取当前位置，请换一个地图位置重试");
    return;
  }

  if (geometryType.value === "point") {
    addPointFeature(position);
    return;
  }

  positions.value = [...positions.value, position];
  addVertexMarker(position);
  createPreviewEntity();
};

const handleMouseMove = (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
  if (geometryType.value === "point" || positions.value.length === 0) {
    return;
  }

  cursorPosition.value = pickPosition(movement.endPosition);
};

const startDrawing = () => {
  if (!props.viewer) {
    ElMessage.warning("地图尚未初始化");
    return;
  }

  cancelDrawing();
  isDrawing.value = true;
  drawHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
  drawHandler.setInputAction(handleLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  drawHandler.setInputAction(handleMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  drawHandler.setInputAction(finishDrawing, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  drawHandler.setInputAction(finishDrawing, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
};

const undoLastPoint = () => {
  if (!positions.value.length) {
    return;
  }

  positions.value = positions.value.slice(0, -1);
  const marker = vertexEntities.pop();
  if (marker) {
    props.viewer?.entities.remove(marker);
  }

  if (positions.value.length === 0 && previewEntity && props.viewer) {
    props.viewer.entities.remove(previewEntity);
    previewEntity = null;
  }
};

const cancelDrawing = () => {
  drawHandler?.destroy();
  drawHandler = null;
  isDrawing.value = false;
  resetCurrentGeometry();
};

onBeforeUnmount(() => {
  cancelDrawing();
});
</script>

<style scoped>
.create-geometry-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item label {
  display: block;
  margin-bottom: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.custom-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #334155;
  border-radius: 4px;
  background: #1e293b;
  color: #ffffff;
}

.custom-input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-input {
  width: 42px;
  height: 34px;
  padding: 2px;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #1e293b;
  cursor: pointer;
}

.color-value {
  color: #cbd5e1;
  font-size: 12px;
}

.draw-status {
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.7);
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.draw-status.active {
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(14, 116, 144, 0.18);
  color: #bae6fd;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 88px;
  gap: 8px;
}

.submit-btn,
.secondary-btn {
  height: 34px;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  cursor: pointer;
}

.submit-btn {
  background: #3b82f6;
}

.submit-btn.danger {
  background: #ef4444;
}

.secondary-btn {
  background: #334155;
}

.secondary-btn.full {
  width: 100%;
}

.submit-btn:disabled,
.secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
