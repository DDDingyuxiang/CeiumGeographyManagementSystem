<template>
  <div class="buffer-form">
    <div class="form-item">
      <label>缓冲距离 (米)</label>
      <input type="number" v-model="radius" class="custom-input" />
    </div>
    <button class="submit-btn" @click="run">执行分析</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const radius = ref(100);
const run = () => { console.log('执行半径为', radius.value, '的分析'); };
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
</style>