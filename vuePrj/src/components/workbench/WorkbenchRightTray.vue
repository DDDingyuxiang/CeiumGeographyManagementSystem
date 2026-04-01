<script setup lang="ts">
import { ref } from "vue";
import type { CollapseModelValue } from "element-plus";

const emit = defineEmits<{
  (event: "execute-tool", toolId: number): void;
}>();

const rightPanelActive = ref(false);
const activeToolCategory = ref<CollapseModelValue>([]);

const toolCategories = ref([
  {
    id: "vector",
    title: "矢量工具箱",
    tools: [
      { name: "坐标转换", desc: "投影互转", toolId: 10001 },
      { name: "格式转换", desc: "Shapefile/GeoJSON/KML/GML互转", toolId: 10002 },
      { name: "要素简化", desc: "抽稀边界优化渲染性能", toolId: 10003 },
      { name: "缓冲区分析", desc: "生成点线面影响范围", toolId: 10004 },
      { name: "叠加分析", desc: "交集/并集/擦除操作", toolId: 10005 },
      { name: "质心提取", desc: "计算多边形几何中心", toolId: 10006 },
      { name: "字段计算", desc: "SQL/Python表达式批量修改", toolId: 10007 },
      { name: "空间连接", desc: "基于位置关系属性赋值", toolId: 10008 },
    ],
  },
  {
    id: "raster",
    title: "栅格工具箱",
    tools: [
      { name: "裁剪与掩膜", desc: "按范围裁剪TIF影像", toolId: 20001 },
      { name: "影像拼接", desc: "多幅影像无缝缝合", toolId: 20002 },
      { name: "重采样", desc: "改变像素分辨率", toolId: 20003 },
      { name: "坡度/坡向", desc: "提取地形起伏特征", toolId: 20004 },
      { name: "等高线提取", desc: "自动提取矢量等高线", toolId: 20005 },
      { name: "山体阴影", desc: "生成立体感渲染图", toolId: 20006 },
      { name: "植被指数(NDVI)", desc: "计算植被覆盖度", toolId: 20007 },
      { name: "波段组合", desc: "真彩色/假彩色合成", toolId: 20008 },
    ],
  },
  {
    id: "general",
    title: "其他工具箱",
    tools: [
      { name: "一键发布", desc: "自动发布WMS/WMTS服务", toolId: 30001 },
      { name: "服务切片", desc: "预生成GeoWebCache瓦片", toolId: 30002 },
      { name: "自动化出图", desc: "生成带图例的PDF/PNG", toolId: 30003 },
      { name: "报表生成", desc: "统计结果生成Word/PDF", toolId: 30004 },
    ],
  },
]);

const toggleRightPanel = () => {
  rightPanelActive.value = !rightPanelActive.value;
};

const executeTool = (toolId: number) => {
  emit("execute-tool", toolId);
};
</script>

<template>
  <aside class="side-bar right-bar">
    <div
      class="bar-icon-btn"
      :class="{ active: rightPanelActive }"
      @click="toggleRightPanel"
      title="工具箱"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" />
        <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" />
        <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" />
        <rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" />
        <path
          d="M7.5 7.5h0M16.5 7.5h0M7.5 16.5h0M16.5 16.5h0"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </div>
  </aside>

  <transition name="slide-right">
    <aside v-show="rightPanelActive" class="side-panel right-panel">
      <div class="panel-content">
        <div class="panel-header">
          <h3 class="panel-title">工具箱</h3>
          <div class="close-btn" @click="rightPanelActive = false">×</div>
        </div>

        <div class="panel-body">
          <el-collapse v-model="activeToolCategory" accordion class="custom-collapse">
            <el-collapse-item
              v-for="category in toolCategories"
              :key="category.id"
              :name="category.id"
              :title="category.title"
            >
              <div class="tools-list">
                <div
                  v-for="tool in category.tools"
                  :key="tool.toolId"
                  class="tool-card"
                  @click="executeTool(tool.toolId)"
                >
                  <div class="tool-icon-box" :class="category.id">
                    <svg
                      v-if="category.id === 'vector'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      class="tool-svg"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>

                    <svg
                      v-else-if="category.id === 'raster'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      class="tool-svg"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>

                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      class="tool-svg"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path
                        d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l4.24 4.24M2.1 2.1l4.24 4.24"
                      />
                    </svg>
                  </div>

                  <div class="tool-detail">
                    <span class="tool-name">{{ tool.name }}</span>
                    <span class="tool-desc">{{ tool.desc }}</span>
                  </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.side-bar {
  position: absolute;
  top: 20px;
  width: auto;
  background: transparent;
  border: none !important;
  z-index: 70;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.right-bar {
  right: 20px;
  transform: v-bind("rightPanelActive ? 'translateX(80px)' : 'translateX(0)'");
  opacity: v-bind("rightPanelActive ? '0' : '1'");
}

.bar-icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(249, 243, 243, 0.966);
  color: rgba(255, 255, 255, 0.5);
}

.bar-icon-btn svg {
  width: 20px;
  height: 20px;
}

.bar-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #60a5fa;
  transform: scale(1.05);
}

.bar-icon-btn.active {
  background: rgba(37, 99, 235, 0.2);
  color: #60a5fa;
  border-color: rgba(37, 99, 235, 0.3);
}

.side-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(8, 13, 24, 0.98);
  backdrop-filter: blur(16px);
  z-index: 60;
  margin: 0;
}

.right-panel {
  right: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f87171;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tools-list {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  gap: 8px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-card:hover {
  background: rgba(37, 99, 235, 0.08);
}

.tool-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-icon-box.vector {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

.tool-icon-box.raster {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
}

.tool-icon-box.general {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
}

.tool-svg {
  width: 18px;
  height: 18px;
}

.tool-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-name {
  font-size: 13px;
  color: #e2e8f0;
}

.tool-desc {
  font-size: 12px;
  color: #64748b;
}

:deep(.custom-collapse) {
  border: none;
}

:deep(.custom-collapse .el-collapse-item__header) {
  background: transparent !important;
  color: #e2e8f0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  height: 48px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

:deep(.custom-collapse .el-collapse-item__wrap) {
  background: transparent !important;
  border-bottom: none !important;
}

:deep(.custom-collapse .el-collapse-item__content) {
  padding: 0 !important;
}
</style>
