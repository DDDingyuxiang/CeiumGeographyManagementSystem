<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="centroid-layer">图层选择</label>
      <select id="centroid-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择矢量图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label for="centroid-mode">中心点方式</label>
      <select id="centroid-mode" v-model="mode" class="custom-input">
        <option value="centroid">几何质心</option>
        <option value="representative_point">面内点</option>
      </select>
    </div>

    <button class="submit-btn" :disabled="submitting || !availableLayers.length" @click="run">
      {{ submitting ? "执行中..." : "提取质心" }}
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
const mode = ref("centroid");
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

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 10006,
      assetId: selectedLayer.assetId,
      params: {
        mode: mode.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_centroid_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_centroid`,
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
      styleKind: "point",
    });

    ElMessage.success("质心结果已添加到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "质心提取失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
@import "@/assets/analysisForm.css";

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
