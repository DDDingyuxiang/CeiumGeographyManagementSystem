<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="clip-raster-layer">图层选择</label>
      <select id="clip-raster-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择栅格图层</option>
        <option v-for="layer in rasterLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label for="clip-mode">裁剪方式</label>
      <select id="clip-mode" v-model="mode" class="custom-input">
        <option value="extent">矩形范围</option>
        <option value="mask">矢量掩膜</option>
      </select>
    </div>

    <template v-if="mode === 'extent'">
      <div class="grid-2">
        <div class="form-item">
          <label>最小 X</label>
          <input v-model.number="extent.minX" type="number" class="custom-input" />
        </div>
        <div class="form-item">
          <label>最小 Y</label>
          <input v-model.number="extent.minY" type="number" class="custom-input" />
        </div>
        <div class="form-item">
          <label>最大 X</label>
          <input v-model.number="extent.maxX" type="number" class="custom-input" />
        </div>
        <div class="form-item">
          <label>最大 Y</label>
          <input v-model.number="extent.maxY" type="number" class="custom-input" />
        </div>
      </div>
    </template>

    <div v-else class="form-item">
      <label for="mask-layer">掩膜图层</label>
      <select id="mask-layer" v-model="maskLayerId" class="custom-input">
        <option disabled value="">选择矢量掩膜图层</option>
        <option v-for="layer in vectorLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>NoData 值</label>
      <input v-model="nodata" type="number" class="custom-input" placeholder="留空则沿用默认值" />
    </div>

    <button class="submit-btn" :disabled="submitting || !rasterLayers.length" @click="run">
      {{ submitting ? "执行中..." : "执行裁剪" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { submitAnalysisTask } from "@/api/analysis";
import emitter from "@/utils/bus";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

const props = defineProps<{
  loadedLayers: WorkbenchLayerItem[];
}>();

const selectedLayerId = ref("");
const maskLayerId = ref("");
const mode = ref<"extent" | "mask">("extent");
const nodata = ref("");
const submitting = ref(false);
const extent = reactive({
  minX: undefined as number | undefined,
  minY: undefined as number | undefined,
  maxX: undefined as number | undefined,
  maxY: undefined as number | undefined,
});

const rasterLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "raster" && !!layer.assetId,
  ),
);

const vectorLayers = computed(() =>
  props.loadedLayers.filter(
    (layer) => layer.id !== 0 && layer.type === "vector" && !!layer.assetId,
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

watch(
  vectorLayers,
  (layers) => {
    if (!layers.length) {
      maskLayerId.value = "";
      return;
    }
    if (!layers.some((layer) => String(layer.id) === maskLayerId.value)) {
      maskLayerId.value = String(layers[0]!.id);
    }
  },
  { immediate: true },
);

const run = async () => {
  const selectedLayer = rasterLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );
  const maskLayer = vectorLayers.value.find((layer) => String(layer.id) === maskLayerId.value);

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (mode.value === "mask" && !maskLayer?.assetId) {
    ElMessage.warning("请选择一个矢量掩膜图层");
    return;
  }

  if (mode.value === "extent") {
    const values = [extent.minX, extent.minY, extent.maxX, extent.maxY];
    if (values.some((value) => !Number.isFinite(Number(value)))) {
      ElMessage.warning("请填写完整的裁剪范围");
      return;
    }
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20001,
      assetId: selectedLayer.assetId,
      params: {
        mode: mode.value,
        minX: extent.minX,
        minY: extent.minY,
        maxX: extent.maxX,
        maxY: extent.maxY,
        maskAssetId: maskLayer?.assetId,
        nodata: nodata.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_clip_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_clip`,
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("裁剪结果已加载到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "裁剪失败");
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
