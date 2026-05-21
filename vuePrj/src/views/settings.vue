<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchAiSettings,
  updateAiSettings,
  type AiSettingsResponseData,
} from "@/api/users";

const AI_SETTINGS_CACHE_KEY = "ai_settings_cache";

const loading = ref(false);
const saving = ref(false);
const hasApiKey = ref(false);
const maskedApiKey = ref("");

const form = reactive({
  provider: "openai-compatible",
  baseUrl: "",
  modelName: "",
  apiKey: "",
  clearApiKey: false,
});

const applySettings = (settings: AiSettingsResponseData) => {
  form.provider = settings.provider || "openai-compatible";
  form.baseUrl = settings.baseUrl || "";
  form.modelName = settings.modelName || "";
  form.apiKey = "";
  form.clearApiKey = false;
  hasApiKey.value = Boolean(settings.hasApiKey);
  maskedApiKey.value = settings.maskedApiKey || "";
};

const cacheSettings = (settings: AiSettingsResponseData) => {
  localStorage.setItem(
    AI_SETTINGS_CACHE_KEY,
    JSON.stringify({
      provider: settings.provider || "openai-compatible",
      baseUrl: settings.baseUrl || "",
      modelName: settings.modelName || "",
      hasApiKey: Boolean(settings.hasApiKey),
      maskedApiKey: settings.maskedApiKey || "",
    }),
  );
};

const applyCachedSettings = () => {
  const cached = localStorage.getItem(AI_SETTINGS_CACHE_KEY);
  if (!cached) {
    return;
  }

  try {
    applySettings(JSON.parse(cached) as AiSettingsResponseData);
  } catch {
    localStorage.removeItem(AI_SETTINGS_CACHE_KEY);
  }
};

const loadAiSettings = async () => {
  loading.value = true;
  try {
    const response = await fetchAiSettings();
    applySettings(response.data);
    cacheSettings(response.data);
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "AI 模型设置加载失败");
  } finally {
    loading.value = false;
  }
};

const saveAiSettings = async () => {
  if (!form.modelName.trim()) {
    ElMessage.warning("请填写模型名称");
    return;
  }

  saving.value = true;
  try {
    const response = await updateAiSettings({
      provider: form.provider,
      baseUrl: form.baseUrl,
      modelName: form.modelName,
      apiKey: form.apiKey,
      clearApiKey: form.clearApiKey,
    });

    applySettings(response.data);
    cacheSettings(response.data);
    ElMessage.success("AI 模型设置已保存");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "AI 模型设置保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  applyCachedSettings();
  void loadAiSettings();
});
</script>

<template>
  <div class="settings-page">
    <section class="settings-header">
      <p class="eyebrow">Settings</p>
      <h1>系统设置</h1>
    </section>

    <section v-loading="loading" class="settings-section">
      <div class="section-copy">
        <h2>AI 模型配置</h2>
        <p>配置模型服务后，GIS 智能分析助手会使用这里的模型名称和 API Key。</p>
      </div>

      <el-form label-position="top" class="settings-form">
        <el-form-item label="模型服务">
          <el-select v-model="form.provider" class="full-width">
            <el-option label="OpenAI Compatible" value="openai-compatible" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="通义千问 DashScope" value="dashscope" />
            <el-option label="自定义服务" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="Base URL">
          <el-input
            v-model="form.baseUrl"
            placeholder="例如 https://api.openai.com/v1，留空则使用后端默认配置"
            clearable
          />
        </el-form-item>

        <el-form-item label="模型名称">
          <el-input
            v-model="form.modelName"
            placeholder="例如 gpt-4o-mini、qwen-plus、deepseek-chat"
            clearable
          />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="hasApiKey ? `已保存：${maskedApiKey}，留空则继续使用` : '请输入 API Key'"
            clearable
            :disabled="form.clearApiKey"
          />
          <div v-if="hasApiKey" class="key-status">当前已保存：{{ maskedApiKey }}</div>
        </el-form-item>

        <el-checkbox v-model="form.clearApiKey" class="clear-key">
          清除已保存的 API Key
        </el-checkbox>

        <div class="actions">
          <el-button :loading="loading" @click="loadAiSettings">重新加载</el-button>
          <el-button type="primary" :loading="saving" @click="saveAiSettings">
            保存设置
          </el-button>
        </div>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 32px;
  background: #f6f8fb;
  color: #172033;
}

.settings-header {
  max-width: 980px;
  margin: 0 auto 20px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.settings-section {
  max-width: 980px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 32px;
  padding: 28px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.section-copy h2 {
  margin: 0 0 10px;
  font-size: 18px;
  color: #0f172a;
}

.section-copy p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
}

.settings-form {
  min-width: 0;
}

.full-width {
  width: 100%;
}

.key-status {
  margin-top: 8px;
  color: #475569;
  font-size: 13px;
}

.clear-key {
  margin-bottom: 20px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 760px) {
  .settings-page {
    padding: 20px;
  }

  .settings-section {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
</style>
