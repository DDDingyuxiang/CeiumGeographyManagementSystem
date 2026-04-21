<template>
  <div class="hillshade-form">
    <div class="form-item">
      <label for="hillshade-layer">图层选择</label>
      <select id="hillshade-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择栅格图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>太阳方位角</label>
      <input type="number" v-model.number="azimuth" min="0" max="360" class="custom-input" />
    </div>

    <div class="form-item">
      <label>太阳高度角</label>
      <input type="number" v-model.number="altitude" min="1" max="90" class="custom-input" />
    </div>

    <div class="form-item">
      <label>高程倍率</label>
      <input type="number" v-model.number="zFactor" min="0.1" step="0.1" class="custom-input" />
    </div>

    <button class="submit-btn" :disabled="submitting || !availableLayers.length" @click="run">
      {{ submitting ? "执行中..." : "生成山体阴影" }}
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
const azimuth = ref(315);
const altitude = ref(45);
const zFactor = ref(1);
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

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20006,
      assetId: selectedLayer.assetId,
      params: {
        azimuth: azimuth.value,
        altitude: altitude.value,
        zFactor: zFactor.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_hillshade`,
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("山体阴影已生成并加载到地图");
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || "山体阴影生成失败",
    );
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.form-item { margin-bottom: 15px; }
.form-item label { display: block; font-size: 12px; margin-bottom: 5px; color: #94a3b8; }
.custom-input {
  width: 100%; background: #1e293b; border: 1px solid #334155;
  color: white; padding: 8px; border-radius: 4px;
}
.submit-btn {
  width: 100%; padding: 8px; background: #3b82f6; color: white;
  border: none; border-radius: 4px; cursor: pointer;
}
.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
