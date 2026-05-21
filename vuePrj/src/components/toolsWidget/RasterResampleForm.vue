<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="resample-raster-layer">图层选择</label>
      <select id="resample-raster-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择栅格图层</option>
        <option v-for="layer in rasterLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>目标像元大小</label>
      <input v-model.number="pixelSize" type="number" min="0.000001" step="0.1" class="custom-input" />
    </div>

    <div class="form-item">
      <label for="resample-method">重采样方法</label>
      <select id="resample-method" v-model="resampling" class="custom-input">
        <option value="nearest">最近邻</option>
        <option value="bilinear">双线性</option>
        <option value="cubic">三次卷积</option>
        <option value="average">平均值</option>
      </select>
    </div>

    <div class="form-item">
      <label>NoData 值</label>
      <input v-model="nodata" type="number" class="custom-input" placeholder="留空则沿用默认值" />
    </div>

    <button class="submit-btn" :disabled="submitting || !rasterLayers.length" @click="run">
      {{ submitting ? "执行中..." : "执行重采样" }}
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
const pixelSize = ref(30);
const resampling = ref("bilinear");
const nodata = ref("");
const submitting = ref(false);

const rasterLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "raster" && !!layer.assetId,
  ),
);

watch(
  rasterLayers,
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
  const selectedLayer = rasterLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (!Number.isFinite(pixelSize.value) || pixelSize.value <= 0) {
    ElMessage.warning("目标像元大小必须大于 0");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20003,
      assetId: selectedLayer.assetId,
      params: {
        pixelSize: pixelSize.value,
        resampling: resampling.value,
        nodata: nodata.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_resample_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_resampled`,
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("重采样结果已加载到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "重采样失败");
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
