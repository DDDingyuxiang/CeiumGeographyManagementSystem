<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="contour-layer">图层选择</label>
      <select id="contour-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择栅格图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>等高距</label>
      <input type="number" v-model.number="interval" min="1" step="1" class="custom-input" />
    </div>

    <div class="form-item">
      <label>基准高程</label>
      <input type="number" v-model.number="base" step="1" class="custom-input" />
    </div>

    <button class="submit-btn" :disabled="submitting || !availableLayers.length" @click="run">
      {{ submitting ? "执行中..." : "提取等高线" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { submitAnalysisTask } from "@/api/analysis";
import emitter from "@/utils/bus";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

const props = defineProps<{
  loadedLayers: WorkbenchLayerItem[];
}>();

const selectedLayerId = ref("");
const interval = ref(10);
const base = ref(0);
const submitting = ref(false);

const availableLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "raster" && !!layer.assetId,
  ),
);

watch(
  availableLayers,
  (layers) => {
    if (!layers.length) {
      selectedLayerId.value = "";
      return;
    }

    const hasSelected = layers.some((layer) => String(layer.id) === selectedLayerId.value);
    if (!hasSelected) {
      selectedLayerId.value = String(layers[0]!.id);
    }
  },
  { immediate: true },
);

const run = async () => {
  const selectedLayer = availableLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (!Number.isFinite(interval.value) || interval.value <= 0) {
    ElMessage.warning("等高距必须大于 0");
    return;
  }

  if (!Number.isFinite(base.value)) {
    ElMessage.warning("请输入有效的基准高程");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20005,
      assetId: selectedLayer.assetId,
      params: {
        interval: interval.value,
        base: base.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_contour_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_contour`,
      type: "vector",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      geoJsonPath: response.data.geoJsonPath,
      geoJsonUrl: response.data.geoJsonUrl,
      bounds: response.data.bounds,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("等高线已生成并加载到地图");
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || "等高线提取失败",
    );
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.form-item {
  margin-bottom: 15px;
}

.form-item label {
  display: block;
  font-size: 12px;
  margin-bottom: 5px;
  color: #94a3b8;
}

.custom-input {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  color: white;
  padding: 8px;
  border-radius: 4px;
}

.submit-btn {
  width: 100%;
  padding: 8px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
