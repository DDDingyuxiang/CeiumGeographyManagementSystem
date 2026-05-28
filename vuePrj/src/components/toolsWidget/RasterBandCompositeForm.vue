<template>
  <div class="analysis-form">
    <div class="form-item">
      <label for="band-raster-layer">图层选择</label>
      <select id="band-raster-layer" v-model="selectedLayerId" class="custom-input">
        <option disabled value="">选择多波段栅格图层</option>
        <option v-for="layer in rasterLayers" :key="layer.id" :value="String(layer.id)">
          {{ layer.label }}
        </option>
      </select>
    </div>

    <div class="grid-3">
      <div class="form-item">
        <label>红</label>
        <input v-model.number="redBand" type="number" min="1" step="1" class="custom-input" />
      </div>
      <div class="form-item">
        <label>绿</label>
        <input v-model.number="greenBand" type="number" min="1" step="1" class="custom-input" />
      </div>
      <div class="form-item">
        <label>蓝</label>
        <input v-model.number="blueBand" type="number" min="1" step="1" class="custom-input" />
      </div>
    </div>

    <div class="form-item">
      <label for="band-preset">组合预设</label>
      <select id="band-preset" v-model="preset" class="custom-input" @change="applyPreset">
        <option value="trueColor">真彩色 3/2/1</option>
        <option value="falseColor">标准假彩色 4/3/2</option>
        <option value="custom">自定义</option>
      </select>
    </div>

    <div class="form-item">
      <label for="band-stretch">拉伸方式</label>
      <select id="band-stretch" v-model="stretch" class="custom-input">
        <option value="percent">2%-98% 百分位</option>
        <option value="minmax">最小最大值</option>
        <option value="none">不拉伸</option>
      </select>
    </div>

    <div class="form-item">
      <label>NoData 值</label>
      <input v-model="nodata" type="number" class="custom-input" placeholder="留空则沿用源数据" />
    </div>

    <button class="submit-btn" :disabled="submitting || !rasterLayers.length" @click="run">
      {{ submitting ? "执行中..." : "生成波段组合" }}
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
const greenBand = ref(2);
const blueBand = ref(1);
const preset = ref<"trueColor" | "falseColor" | "custom">("trueColor");
const stretch = ref("percent");
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

watch([redBand, greenBand, blueBand], () => {
  const values = [redBand.value, greenBand.value, blueBand.value].join(",");
  if (values === "3,2,1") {
    preset.value = "trueColor";
  } else if (values === "4,3,2") {
    preset.value = "falseColor";
  } else {
    preset.value = "custom";
  }
});

const applyPreset = () => {
  if (preset.value === "trueColor") {
    redBand.value = 3;
    greenBand.value = 2;
    blueBand.value = 1;
  } else if (preset.value === "falseColor") {
    redBand.value = 4;
    greenBand.value = 3;
    blueBand.value = 2;
  }
};

const isPositiveBand = (value: number) => Number.isInteger(value) && value > 0;

const run = async () => {
  const selectedLayer = rasterLayers.value.find(
    (layer) => String(layer.id) === selectedLayerId.value,
  );

  if (!selectedLayer?.assetId) {
    ElMessage.warning("请选择一个已加载的栅格图层");
    return;
  }

  if (![redBand.value, greenBand.value, blueBand.value].every(isPositiveBand)) {
    ElMessage.warning("波段号必须为大于 0 的整数");
    return;
  }

  submitting.value = true;
  try {
    const response = await submitAnalysisTask({
      toolId: 20008,
      assetId: selectedLayer.assetId,
      params: {
        redBand: redBand.value,
        greenBand: greenBand.value,
        blueBand: blueBand.value,
        stretch: stretch.value,
        nodata: nodata.value,
      },
    });

    emitter.emit("add-analysis-layer", {
      id: `analysis_bands_${Date.now()}`,
      label: response.data.layerName || `${selectedLayer.label}_composite`,
      type: "raster",
      visible: true,
      wmsUrl: response.data.wmsUrl,
      layers: response.data.layers,
      storeName: response.data.storeName || response.data.tempStoreName,
      resourceType: response.data.resourceType,
      cleanupGroup: response.data.cleanupGroup,
      sourceAssetId: selectedLayer.assetId,
    });

    ElMessage.success("波段组合结果已加载到地图");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "波段组合失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
@import "@/assets/analysisForm.css";

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 8px;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
