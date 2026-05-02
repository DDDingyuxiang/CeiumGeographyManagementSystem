<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="overlay-base-layer">输入图层</label>
      <select id="overlay-base-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择输入矢量图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label for="overlay-mask-layer">叠加图层</label>
      <select id="overlay-mask-layer" v-model="overlayLayerId" class="custom-input">
        <option disabled value="">选择叠加矢量图层</option>
        <option v-for="layer in overlayLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label for="overlay-operation">叠加方式</label>
      <select id="overlay-operation" v-model="operation" class="custom-input">
        <option value="intersection">交集</option>
        <option value="union">并集</option>
        <option value="difference">擦除</option>
      </select>
    </div>

    <button class="submit-btn" :disabled="submitting || overlayLayers.length === 0" @click="run">
      {{ submitting ? "执行中..." : "执行叠加分析" }}
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
const overlayLayerId = ref("");
const operation = ref("intersection");
const submitting = ref(false);

const availableLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "vector" && !!layer.assetId,
  ),
);

const overlayLayers = computed(() =>
  availableLayers.value.filter((layer) => String(layer.id) !== selectedLayerId.value),
);

watch(
  availableLayers,
  (layers) => {
    if (!layers.length) {
      selectedLayerId.value = "";
      overlayLayerId.value = "";
      return;
    }

    if (!layers.some((layer) => String(layer.id) === selectedLayerId.value)) {
      selectedLayerId.value = String(layers[0]!.id);
    }
  },
  { immediate: true },
);

watch(
  overlayLayers,
  (layers) => {
    if (!layers.length) {
      overlayLayerId.value = "";
      return;
    }

    if (!layers.some((layer) => String(layer.id) === overlayLayerId.value)) {
      overlayLayerId.value = String(layers[0]!.id);
    }
  },
  { immediate: true },
);

const run = async () => {
  const selectedLayer = availableLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );
  const overlayLayer = availableLayers.value.find(
    (layer) => String(layer.id) === overlayLayerId.value,
  );

  if (!selectedLayer?.assetId || !overlayLayer?.assetId) {
    ElMessage.warning("请选择两个不同的矢量图层");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 10005,
      assetId: selectedLayer.assetId,
      params: {
        overlayAssetId: overlayLayer.assetId,
        operation: operation.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_overlay_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_overlay`,
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

    ElMessage.success("叠加分析结果已添加到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "叠加分析失败");
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
