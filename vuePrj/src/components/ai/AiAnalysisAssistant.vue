<template>
  <aside class="ai-launcher" :class="{ hidden: hideLauncher }">
    <button
      class="bar-icon-btn ai-icon-btn"
      :class="{ active: panelActive }"
      type="button"
      title="AI 分析助手"
      @click="togglePanel"
    >
      <span>AI</span>
    </button>
  </aside>

  <transition name="slide-right">
    <aside v-show="panelActive" class="side-panel ai-panel">
      <div class="panel-content">
        <div class="panel-header">
          <div>
            <h3 class="panel-title">AI 分析助手</h3>
            <p class="panel-subtitle">用自然语言生成可确认的 GIS 分析计划</p>
          </div>
          <button class="close-btn" type="button" title="关闭" @click="panelActive = false">
            ×
          </button>
        </div>

        <div class="panel-body">
          <textarea
            v-model="prompt"
            class="prompt-input"
            rows="4"
            placeholder="例如：给道路图层生成 500 米缓冲区"
          ></textarea>

          <button
            class="primary-btn"
            type="button"
            :disabled="planning || !prompt.trim()"
            @click="requestPlan"
          >
            {{ planning ? "生成中..." : "生成计划" }}
          </button>

          <section v-if="plan" class="plan-panel">
            <div class="plan-summary">
              <strong>{{ plan.needsClarification ? "需要补充信息" : "分析计划" }}</strong>
              <p>{{ plan.needsClarification ? plan.clarificationQuestion : plan.summary }}</p>
            </div>

            <div v-if="plan.warnings.length" class="warning-list">
              <p v-for="warning in plan.warnings" :key="warning">{{ warning }}</p>
            </div>

            <div v-if="!plan.needsClarification" class="step-list">
              <div
                v-for="(step, index) in plan.steps"
                :key="`${step.toolId}_${index}`"
                class="step-card"
              >
                <div class="step-top">
                  <span>步骤 {{ index + 1 }}</span>
                  <strong>{{ toolName(step.toolId) }}</strong>
                </div>
                <p>{{ step.reason }}</p>
                <dl>
                  <div>
                    <dt>图层</dt>
                    <dd>{{ layerName(step.assetId) }}</dd>
                  </div>
                  <div>
                    <dt>参数</dt>
                    <dd>{{ formatParams(step.params) }}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <button
              v-if="!plan.needsClarification"
              class="execute-btn"
              type="button"
              :disabled="executing"
              @click="executePlan"
            >
              {{ executing ? "执行中..." : "确认执行" }}
            </button>
          </section>

          <AiReportPanel :items="reports" />
        </div>
      </div>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { createAiAnalysisPlan } from "@/api/ai";
import { submitAnalysisTask, type AnalysisResponse } from "@/api/analysis";
import AiReportPanel from "./AiReportPanel.vue";
import emitter from "@/utils/bus";
import type { AiAnalysisPlan, AiPlanStep } from "@/types/ai";
import type { WorkbenchLayerItem } from "@/views/Workbench.vue";

const props = defineProps<{
  loadedLayers: WorkbenchLayerItem[];
  hideLauncher?: boolean;
}>();

const panelActive = ref(false);
const prompt = ref("");
const planning = ref(false);
const executing = ref(false);
const plan = ref<AiAnalysisPlan | null>(null);
const reports = ref<Array<{ id: string; title: string; message: string }>>([]);

const layerLookup = computed(() => {
  const lookup = new Map<string, string>();
  for (const layer of props.loadedLayers) {
    if (layer.assetId) {
      lookup.set(layer.assetId, layer.label);
    }
  }

  for (const layer of plan.value?.layers ?? []) {
    lookup.set(layer.assetId, layer.name);
  }

  return lookup;
});

const planningLayers = computed(() =>
  props.loadedLayers
    .filter((layer) => layer.id !== 0 && !!layer.assetId)
    .map((layer) => ({
      assetId: layer.assetId!,
      name: layer.label,
      type: layer.type,
    })),
);

const toolLabels: Record<number, string> = {
  10003: "要素简化",
  10004: "缓冲区分析",
  10005: "叠加分析",
  10006: "质心提取",
  20001: "裁剪与掩膜",
  20002: "影像拼接",
  20003: "重采样",
  20004: "坡度坡向分析",
  20005: "等高线提取",
  20006: "山体阴影",
  20007: "植被指数(NDVI)",
  20008: "波段组合",
};

const togglePanel = () => {
  panelActive.value = !panelActive.value;
};

const toolName = (toolId: number) => toolLabels[toolId] ?? `工具 ${toolId}`;

const layerName = (assetId: string) => layerLookup.value.get(assetId) ?? assetId;

const formatParams = (params: Record<string, unknown>) => {
  const entries = Object.entries(params);
  if (!entries.length) {
    return "默认参数";
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join("，");
};

const inferStyleKind = (step: AiPlanStep): "contour" | "point" | "polygon" | undefined => {
  if (step.toolId === 20005) return "contour";
  if (step.toolId === 10006) return "point";
  if ([10004, 10005].includes(step.toolId)) return "polygon";
  return undefined;
};

const inferResultType = (step: AiPlanStep): string => {
  if ([20001, 20002, 20003, 20004, 20006, 20007, 20008].includes(step.toolId)) {
    return "raster";
  }
  return "vector";
};

const addResultLayer = (
  response: AnalysisResponse,
  step: AiPlanStep,
  index: number,
) => {
  emitter.emit("add-analysis-layer", {
    id: `ai_analysis_${Date.now()}_${index}`,
    label: response.data.layerName || `${layerName(step.assetId)}_${toolName(step.toolId)}`,
    type: inferResultType(step),
    visible: true,
    wmsUrl: response.data.wmsUrl,
    layers: response.data.layers,
    storeName: response.data.storeName || response.data.tempStoreName,
    resourceType: response.data.resourceType,
    cleanupGroup: response.data.cleanupGroup,
    geoJsonPath: response.data.geoJsonPath,
    geoJsonUrl: response.data.geoJsonUrl,
    bounds: response.data.bounds,
    sourceAssetId: step.assetId,
    styleKind: inferStyleKind(step),
  });
};

const requestPlan = async () => {
  planning.value = true;
  reports.value = [];
  try {
    const response = await createAiAnalysisPlan({
      prompt: prompt.value.trim(),
      layers: planningLayers.value,
    });
    plan.value = response.data;
    if (response.data.needsClarification) {
      ElMessage.warning(response.data.clarificationQuestion || "AI 需要更多信息");
    } else {
      ElMessage.success("AI 分析计划已生成");
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "AI 分析计划生成失败");
  } finally {
    planning.value = false;
  }
};

const executePlan = async () => {
  if (!plan.value || plan.value.needsClarification) {
    return;
  }

  executing.value = true;
  reports.value = [];
  try {
    for (const [index, step] of plan.value.steps.entries()) {
      const response = await submitAnalysisTask({
        toolId: step.toolId,
        assetId: step.assetId,
        params: step.params,
      });
      addResultLayer(response, step, index);
      reports.value.push({
        id: `${step.toolId}_${index}_${Date.now()}`,
        title: toolName(step.toolId),
        message: `${layerName(step.assetId)} 的结果已加载到地图。`,
      });
    }
    ElMessage.success("AI 计划执行完成");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || "AI 计划执行失败");
  } finally {
    executing.value = false;
  }
};
</script>

<style scoped>
.ai-launcher {
  position: absolute;
  top: 70px;
  right: 20px;
  z-index: 70;
  transition: all 0.3s ease;
  transform: v-bind("panelActive ? 'translateX(80px)' : 'translateX(0)'");
  opacity: v-bind("panelActive ? '0' : '1'");
  pointer-events: v-bind("panelActive ? 'none' : 'auto'");
}

.ai-launcher.hidden {
  transform: translateX(80px);
  opacity: 0;
  pointer-events: none;
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
  color: rgba(255, 255, 255, 0.62);
}

.bar-icon-btn:hover,
.bar-icon-btn.active {
  background: rgba(37, 99, 235, 0.2);
  color: #60a5fa;
  border-color: rgba(37, 99, 235, 0.3);
  transform: scale(1.05);
}

.ai-icon-btn span {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
}

.side-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  background: rgba(8, 13, 24, 0.98);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 90;
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
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title {
  margin: 0 0 4px;
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 700;
}

.panel-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}

.close-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f87171;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.prompt-input {
  width: 100%;
  resize: vertical;
  min-height: 104px;
  max-height: 190px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 6px;
  outline: none;
  background: rgba(2, 6, 23, 0.62);
  color: #f8fafc;
  line-height: 1.5;
}

.prompt-input:focus {
  border-color: rgba(96, 165, 250, 0.72);
}

.primary-btn,
.execute-btn {
  width: 100%;
  height: 36px;
  margin-top: 10px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.execute-btn {
  background: #16a34a;
}

.primary-btn:disabled,
.execute-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.plan-panel {
  margin-top: 12px;
}

.plan-summary {
  padding: 10px;
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.86);
}

.plan-summary strong {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
}

.plan-summary p,
.warning-list p,
.step-card p {
  margin: 0;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.55;
}

.warning-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.warning-list p {
  padding: 8px;
  border: 1px solid rgba(251, 191, 36, 0.24);
  border-radius: 6px;
  color: #fde68a;
  background: rgba(120, 53, 15, 0.32);
}

.step-list {
  display: grid;
  gap: 8px;
  max-height: 280px;
  margin-top: 10px;
  overflow: auto;
}

.step-card {
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.74);
}

.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.step-top span {
  color: #93c5fd;
  font-size: 12px;
}

.step-top strong {
  font-size: 13px;
}

dl {
  display: grid;
  gap: 5px;
  margin: 8px 0 0;
}

dl div {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  font-size: 12px;
}

dt {
  color: #64748b;
}

dd {
  margin: 0;
  color: #cbd5e1;
  word-break: break-word;
}

@media (max-width: 760px) {
  .side-panel {
    width: min(360px, 100vw);
  }
}
</style>
