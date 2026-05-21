<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw } from "vue";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

const BufferForm = defineAsyncComponent(() => import("./toolsWidget/BufferForm.vue"));
const CentroidForm = defineAsyncComponent(() => import("./toolsWidget/CentroidForm.vue"));
const ContourForm = defineAsyncComponent(() => import("./toolsWidget/ContourForm.vue"));
const HillshadeForm = defineAsyncComponent(
  () => import("./toolsWidget/HillshadeForm.vue"),
);
const OverlayForm = defineAsyncComponent(() => import("./toolsWidget/OverlayForm.vue"));
const RasterClipMaskForm = defineAsyncComponent(
  () => import("./toolsWidget/RasterClipMaskForm.vue"),
);
const RasterMosaicForm = defineAsyncComponent(
  () => import("./toolsWidget/RasterMosaicForm.vue"),
);
const RasterResampleForm = defineAsyncComponent(
  () => import("./toolsWidget/RasterResampleForm.vue"),
);
const SimplifyForm = defineAsyncComponent(() => import("./toolsWidget/SimplifyForm.vue"));
const SlopeAspectForm = defineAsyncComponent(
  () => import("./toolsWidget/SlopeAspectForm.vue"),
);

const props = defineProps<{
  toolId: number | null;
  loadedLayers: WorkbenchLayerItem[];
}>();

const emit = defineEmits(["close"]);

const TOOL_CONFIG: Record<number, { title: string; component: any }> = {
  10003: { title: "要素简化", component: markRaw(SimplifyForm) },
  10004: { title: "缓冲区分析", component: markRaw(BufferForm) },
  10005: { title: "叠加分析", component: markRaw(OverlayForm) },
  10006: { title: "质心提取", component: markRaw(CentroidForm) },
  20001: { title: "裁剪与掩膜", component: markRaw(RasterClipMaskForm) },
  20002: { title: "影像拼接", component: markRaw(RasterMosaicForm) },
  20003: { title: "重采样", component: markRaw(RasterResampleForm) },
  20004: { title: "坡度/坡向", component: markRaw(SlopeAspectForm) },
  20005: { title: "等高线提取", component: markRaw(ContourForm) },
  20006: { title: "山体阴影", component: markRaw(HillshadeForm) },
};

const currentConfig = computed(() => {
  return props.toolId ? TOOL_CONFIG[props.toolId] : null;
});

const handleClose = () => {
  emit("close");
};
</script>

<template>
  <transition name="panel-fade">
    <div v-if="currentConfig" class="tool-panel-wrapper">
      <div class="tool-panel-header">
        <span class="title">{{ currentConfig.title }}</span>
        <div class="close-icon" @click="handleClose">×</div>
      </div>
      <div class="tool-panel-body">
        <component :is="currentConfig.component" :loaded-layers="loadedLayers" />
      </div>
    </div>
  </transition>
</template>

<style scoped>
.tool-panel-wrapper {
  position: absolute;
  top: 80px;
  right: 340px;
  width: 280px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 1000;
}

.tool-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.title {
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 600;
}

.close-icon {
  color: #64748b;
  cursor: pointer;
  font-size: 20px;
}

.tool-panel-body {
  padding: 16px;
  color: #cbd5e1;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: all 0.3s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
