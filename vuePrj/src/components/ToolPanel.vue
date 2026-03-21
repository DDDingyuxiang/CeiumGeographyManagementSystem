<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw } from 'vue';

// 1. 动态导入具体的工具组件（使用异步组件可以优化首屏加载）
const BufferForm = defineAsyncComponent(() => import('./toolsWidget/BufferForm.vue'));
const CoordTransform = defineAsyncComponent(() => import('./toolsWidget/CoordTransform.vue'));
// 假设你以后会有这些组件：
// const CoordTransform = defineAsyncComponent(() => import('./toolsWidget/CoordTransform.vue'));

const props = defineProps<{
  toolId: number | null;
}>();

const emit = defineEmits(['close']);

// 2. 建立 ID 与 组件/标题 的映射表
const TOOL_CONFIG: Record<number, { title: string; component: any }> = {
  10001: { title: '坐标转换', component: markRaw(CoordTransform) },
  10004: { title: '缓冲区分析', component: markRaw(BufferForm) },
  // 10001: { title: '坐标转换', component: markRaw(CoordTransform) },
};

// 3. 计算当前应该显示的配置
const currentConfig = computed(() => {
  return props.toolId ? TOOL_CONFIG[props.toolId] : null;
});

const handleClose = () => {
  emit('close');
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
        <component :is="currentConfig.component" />
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

.title { color: #f1f5f9; font-size: 14px; font-weight: 600; }
.close-icon { color: #64748b; cursor: pointer; font-size: 20px; }
.tool-panel-body { padding: 16px; color: #cbd5e1; }

/* 简单的进入退出动画 */
.panel-fade-enter-active, .panel-fade-leave-active { transition: all 0.3s ease; }
.panel-fade-enter-from, .panel-fade-leave-to { opacity: 0; transform: translateX(20px); }
</style>