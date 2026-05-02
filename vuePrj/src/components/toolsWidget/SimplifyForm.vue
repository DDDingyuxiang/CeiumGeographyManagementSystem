<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="simplify-layer">图层选择</label>
      <select id="simplify-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择矢量图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>简化容差（米）</label>
      <input v-model.number="tolerance" type="number" min="0.1" step="1" class="custom-input" />
    </div>

    <label class="check-row">
      <input v-model="preserveTopology" type="checkbox" />
      <span>保持拓扑关系</span>
    </label>

    <button class="submit-btn" :disabled="submitting || !availableLayers.length" @click="run">
      {{ submitting ? "执行中..." : "执行简化" }}
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
const tolerance = ref(10);
const preserveTopology = ref(true);
const submitting = ref(false);

const availableLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "vector" && !!layer.assetId,
  ),
);

watch(
  availableLayers,
  (layers) => {
    if (!layers.length) {
      selectedLayerId.value = "";
      return;
    }

    if (!layers.some((layer) => String(layer.id) === selectedLayerId.value)) {
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
    ElMessage.warning("请选择一个已加载的矢量图层");
    return;
  }

  if (!Number.isFinite(tolerance.value) || tolerance.value <= 0) {
    ElMessage.warning("简化容差必须大于 0");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 10003,
      assetId: selectedLayer.assetId,
      params: {
        tolerance: tolerance.value,
        preserveTopology: preserveTopology.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_simplify_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_simplified`,
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
      styleKind: "polygon",
    });

    ElMessage.success("要素简化结果已添加到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "要素简化失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
@import "@/assets/analysisForm.css";

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  color: #cbd5e1;
  font-size: 12px;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
