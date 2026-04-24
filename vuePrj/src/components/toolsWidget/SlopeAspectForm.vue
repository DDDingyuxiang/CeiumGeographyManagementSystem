<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="terrain-layer">图层选择</label>
      <select id="terrain-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择栅格图层</option>
        <option v-for="layer in availableLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="form-item">
      <label>分析内容</label>
      <div class="option-group">
        <label class="check-item">
          <input v-model="generateSlope" type="checkbox" />
          <span>坡度</span>
        </label>
        <label class="check-item">
          <input v-model="generateAspect" type="checkbox" />
          <span>坡向</span>
        </label>
      </div>
    </div>

    <div class="form-item">
      <label>高程倍数</label>
      <input type="number" v-model.number="zFactor" min="0.1" step="0.1" class="custom-input" />
    </div>

    <div class="form-item">
      <label>比例尺参数</label>
      <input type="number" v-model.number="scale" min="0.1" step="0.1" class="custom-input" />
    </div>

    <button class="submit-btn" :disabled="submitting || !availableLayers.length" @click="run">
      {{ submitting ? "执行中..." : "生成坡度/坡向" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { submitAnalysisTask, type AnalysisResponse } from "@/api/analysis";
import emitter from "@/utils/bus";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

const props = defineProps<{
  loadedLayers: WorkbenchLayerItem[];
}>();

const selectedLayerId = ref("");
const generateSlope = ref(true);
const generateAspect = ref(true);
const zFactor = ref(1);
const scale = ref(1);
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

const addLayer = (response: AnalysisResponse, selectedLayer: WorkbenchLayerItem, type: string) => {
  emitter.emit("add-analysis-layer", {
    id: `analysis_${type}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    label: response.data.layerName || `${selectedLayer.label}_${type}`,
    type: "raster",
    visible: true,
    wmsUrl: response.data.wmsUrl,
    layers: response.data.layers,
    storeName: response.data.storeName || response.data.tempStoreName,
    resourceType: response.data.resourceType,
    cleanupGroup: response.data.cleanupGroup,
    sourceAssetId: selectedLayer.assetId,
  });
};

const runSingle = async (analysisType: "slope" | "aspect", selectedLayer: WorkbenchLayerItem) => {
  const response = await submitAnalysisTask({
    toolId: 20004,
    assetId: selectedLayer.assetId!,
    params: {
      analysisType,
      zFactor: zFactor.value,
      scale: scale.value,
    },
  });

  addLayer(response, selectedLayer, analysisType);
};

const run = async () => {
  const selectedLayer = availableLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (!generateSlope.value && !generateAspect.value) {
    ElMessage.warning("请至少选择一个分析结果");
    return;
  }

  if (!Number.isFinite(zFactor.value) || zFactor.value <= 0) {
    ElMessage.warning("高程倍数必须大于 0");
    return;
  }

  if (!Number.isFinite(scale.value) || scale.value <= 0) {
    ElMessage.warning("比例尺参数必须大于 0");
    return;
  }

  submitting.value = true;
  try {
    if (generateSlope.value) {
      await runSingle("slope", selectedLayer);
    }

    if (generateAspect.value) {
      await runSingle("aspect", selectedLayer);
    }

    ElMessage.success("坡度/坡向结果已生成并加载到地图");
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.message || error?.message || "坡度/坡向分析失败",
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

.option-group {
  display: flex;
  gap: 12px;
  padding-top: 4px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e2e8f0;
  font-size: 13px;
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
