<template>
  <div class="analysis-form">
    <div class="form-item">
      <label>参与拼接的影像</label>
      <div class="layer-check-list">
        <label v-for="layer in rasterLayers" :key="layer.id" class="check-item">
          <input v-model="selectedLayerIds" type="checkbox" :value="String(layer.id)" />
          <span>{{ layer.label }}</span>
        </label>
      </div>
    </div>

    <div class="form-item">
      <label for="mosaic-resampling">重采样方法</label>
      <select id="mosaic-resampling" v-model="resampling" class="custom-input">
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

    <button class="submit-btn" :disabled="submitting || rasterLayers.length < 2" @click="run">
      {{ submitting ? "执行中..." : "执行影像拼接" }}
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

const selectedLayerIds = ref<string[]>([]);
const resampling = ref("nearest");
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
    const validIds = new Set(layers.map((layer) => String(layer.id)));
    selectedLayerIds.value = selectedLayerIds.value.filter((id) => validIds.has(id));
    if (selectedLayerIds.value.length < 2) {
      selectedLayerIds.value = layers.slice(0, 2).map((layer) => String(layer.id));
    }
  },
  { immediate: true },
);

const run = async () => {
  const selectedLayers = rasterLayers.value.filter((layer) =>
    selectedLayerIds.value.includes(String(layer.id)),
  );

  if (selectedLayers.length < 2) {
    ElMessage.warning("请至少选择两幅栅格影像");
    return;
  }

  const [baseLayer, ...otherLayers] = selectedLayers;
  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20002,
      assetId: baseLayer!.assetId!,
      params: {
        rasterAssetIds: otherLayers.map((layer) => layer.assetId),
        resampling: resampling.value,
        nodata: nodata.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_mosaic_${Date.now()}`,
      label: response.data.layerName || "影像拼接结果",
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: baseLayer!.assetId,
    });

    ElMessage.success("影像拼接结果已加载到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "影像拼接失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
@import "@/assets/analysisForm.css";

.layer-check-list {
  max-height: 150px;
  overflow: auto;
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid #334155;
  border-radius: 4px;
  background: #1e293b;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
  font-size: 13px;
}

.check-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
