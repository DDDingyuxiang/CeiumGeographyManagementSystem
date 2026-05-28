<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="ndvi-raster-layer">图层选择</label>
      <select id="ndvi-raster-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择多波段栅格图层</option>
        <option v-for="layer in rasterLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="grid-2">
      <div class="form-item">
        <label>红光波段</label>
        <input v-model.number="redBand" type="number" min="1" step="1" class="custom-input" />
      </div>
      <div class="form-item">
        <label>近红外波段</label>
        <input v-model.number="nirBand" type="number" min="1" step="1" class="custom-input" />
      </div>
    </div>

    <div class="form-item">
      <label>NoData 值</label>
      <input v-model="nodata" type="number" class="custom-input" placeholder="默认 -9999" />
    </div>

    <button class="submit-btn" :disabled="submitting || !rasterLayers.length" @click="run">
      {{ submitting ? "执行中..." : "计算 NDVI" }}
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
const redBand = ref(3);
const nirBand = ref(4);
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

const isPositiveBand = (value: number) => Number.isInteger(value) && value > 0;

const run = async () => {
  const selectedLayer = rasterLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (!isPositiveBand(redBand.value) || !isPositiveBand(nirBand.value)) {
    ElMessage.warning("波段号必须为大于 0 的整数");
    return;
  }

  if (redBand.value === nirBand.value) {
    ElMessage.warning("红光波段和近红外波段不能相同");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20007,
      assetId: selectedLayer.assetId,
      params: {
        redBand: redBand.value,
        nirBand: nirBand.value,
        nodata: nodata.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_ndvi_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_ndvi`,
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("NDVI 结果已加载到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "NDVI 计算失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
@import "@/assets/analysisForm.css";

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 10px;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
