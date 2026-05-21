<template>
  <section v-if="items.length" class="ai-report-panel">
    <div class="report-title">执行结果</div>
    <div v-for="item in items" :key="item.id" class="report-item">
      <span class="status-dot"></span>
      <div>
        <strong>{{ item.title }}</strong>
        <p>{{ item.message }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    id: string;
    title: string;
    message: string;
  }>;
}>();
</script>

<style scoped>
.ai-report-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.report-title {
  margin-bottom: 8px;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 700;
}

.report-item {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  color: #e2e8f0;
}

.status-dot {
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: #22c55e;
  flex: 0 0 auto;
}

.report-item strong {
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
}

.report-item p {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}
</style>
