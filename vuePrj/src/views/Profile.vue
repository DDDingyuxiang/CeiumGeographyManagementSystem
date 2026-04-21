<template>
  <div class="profile-bg">
    <div class="grid-overlay"></div>
    <div class="bg-orb orb1"></div>
    <div class="bg-orb orb2"></div>

    <div class="profile-wrap">
      <!-- ===== 顶部导航 ===== -->
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="brand">
            <svg viewBox="0 0 40 40" fill="none" class="brand-svg">
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="white"
                stroke-width="2"
                opacity="0.35"
              />
              <path
                d="M12 20 L20 12 L28 20 L20 28 Z"
                fill="white"
                opacity="0.9"
              />
              <circle cx="20" cy="20" r="4" fill="white" />
            </svg>
            <span class="brand-name">地理信息管理平台</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-cur">个人中心</span>
        </div>
        <div class="top-bar-right">
          <el-button class="nav-btn wb-btn" @click="goWorkbench">
            <template #icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="btn-svg"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </template>
            返回工作台
          </el-button>
          <el-button
            class="nav-btn logout-btn"
            @click="showLogoutDialog = true"
          >
            <template #icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="btn-svg"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </template>
            退出登录
          </el-button>
        </div>
      </header>

      <!-- ===== 主体 ===== -->
      <main class="main-body">
        <!-- 左侧用户信息 -->
        <aside class="user-panel">
          <div class="avatar-section">
            <div class="avatar-ring">
              <el-avatar :size="96" :src="userInfo.avatar" class="user-avatar">
                {{ userInfo.name?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <span class="online-badge"></span>
            </div>
            <h2 class="user-name">{{ userInfo.name }}</h2>
            <p class="user-email">{{ userInfo.email }}</p>
            <el-tag class="role-tag" size="small">{{ userInfo.role }}</el-tag>
          </div>

          <el-divider class="panel-divider" />

          <div class="info-grid">
            <div class="info-row">
              <span class="info-key">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                注册时间
              </span>
              <span class="info-val">{{ userInfo.createdAt }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                上次登录
              </span>
              <span class="info-val">{{ userInfo.lastLogin }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                  />
                </svg>
                数据总量
              </span>
              <span class="info-val accent">{{ dataList.length }} 个</span>
            </div>
          </div>

          <el-divider class="panel-divider" />

          <div class="storage-section">
            <div class="storage-header">
              <span class="storage-label">存储空间</span>
              <span class="storage-val"
                >{{ userInfo.usedStorage }} / {{ userInfo.totalStorage }}</span
              >
            </div>
            <el-progress
              :percentage="storagePercent"
              :stroke-width="6"
              :show-text="false"
              class="storage-progress"
            />
          </div>

          <el-divider class="panel-divider" />

          <el-button class="edit-profile-btn" @click="openEditDialog">
            <template #icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="btn-svg"
              >
                <path d="M12 20h9" />
                <path
                  d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
                />
              </svg>
            </template>
            修改资料
          </el-button>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleAvatarChange"
          />
        </aside>

        <!-- 右侧数据管理 -->
        <section class="data-panel">
          <div class="data-header">
            <div class="data-title-wrap">
              <h3 class="data-title">我的数据集</h3>
              <el-badge :value="dataList.length" class="count-badge" />
            </div>
            <div class="data-header-right">
              <el-radio-group
                v-model="activeFilter"
                size="small"
                class="filter-group"
              >
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="vector">矢量</el-radio-button>
                <el-radio-button value="raster">栅格</el-radio-button>
              </el-radio-group>
              <el-button
                type="primary"
                class="add-data-btn"
                @click="triggerFileAdd"
              >
                <template #icon>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    class="btn-svg"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </template>
                添加数据
              </el-button>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                accept=".shp,.shx,.dbf,.prj,.cpg,.json,.geojson,.tif,.tiff"
                style="display: none"
                @change="handleFileAdd"
              />
            </div>
          </div>

          <!-- 数据表格 -->
          <el-table
            :data="filteredList"
            class="data-table"
            row-class-name="data-row"
            empty-text="暂无数据，点击「添加数据」上传本地文件"
          >
            <!-- 类型图标列 -->
            <el-table-column width="60" align="center">
              <template #default="{ row }">
                <div class="type-icon-wrap" :class="row.type">
                  <svg
                    v-if="row.type === 'vector'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <polygon points="12 2 22 20 2 20" />
                    <circle cx="12" cy="2" r="2" fill="currentColor" />
                    <circle cx="22" cy="20" r="2" fill="currentColor" />
                    <circle cx="2" cy="20" r="2" fill="currentColor" />
                  </svg>
                  <svg
                    v-else-if="row.type === 'raster'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                </div>
              </template>
            </el-table-column>

            <!-- 名称 -->
            <el-table-column label="数据名称" prop="name" min-width="180">
              <template #default="{ row }">
                <span class="data-name-cell">{{ row.name }}</span>
              </template>
            </el-table-column>

            <!-- 类型 -->
            <el-table-column label="数据类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.type === 'vector' ? 'success' : 'warning'"
                  size="small"
                  class="type-tag"
                >
                  {{ row.type === "vector" ? "矢量" : "栅格" }}
                </el-tag>
              </template>
            </el-table-column>

            <!-- 大小 -->
            <el-table-column
              label="大小"
              prop="size"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <span class="meta-cell">{{ row.size }}</span>
              </template>
            </el-table-column>

            <!-- 上传时间 -->
            <el-table-column
              label="上传时间"
              prop="uploadDate"
              width="130"
              align="center"
            >
              <template #default="{ row }">
                <span class="meta-cell">{{ row.uploadDate }}</span>
              </template>
            </el-table-column>

            <!-- 操作 -->
            <el-table-column
              label="操作"
              width="160"
              align="center"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="action-group">
                  <el-tooltip content="在工作台查看" placement="top">
                    <el-button
                      type="primary"
                      size="small"
                      class="op-btn view-op"
                      @click="viewData(row)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        class="op-svg"
                      >
                        <path
                          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      查看
                    </el-button>
                  </el-tooltip>
                  <el-popconfirm
                    title="确认移除该数据？"
                    confirm-button-text="确认"
                    cancel-button-text="取消"
                    @confirm="removeData(row)"
                  >
                    <template #reference>
                      <el-button
                        type="danger"
                        size="small"
                        class="op-btn remove-op"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          class="op-svg"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path
                            d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                          />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                        移除
                      </el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </main>
    </div>

    <!-- 退出确认弹窗 -->
    <el-dialog
      v-model="showLogoutDialog"
      title="退出登录"
      width="360px"
      class="logout-dialog"
      align-center
    >
      <div class="logout-dialog-body">
        <div class="logout-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
        <p>确认退出登录？退出后将跳转至登录页面。</p>
      </div>
      <template #footer>
        <el-button @click="showLogoutDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmLogout">确认退出</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showShpCheckDialog"
      title="完善 SHP 数据文件"
      width="500px"
      :close-on-click-modal="false"
    >
      <!-- 对话框内容（使用你原有的样式类名风格） -->
      <div v-if="pendingShpFile" class="shp-check-body">
        <div class="check-main-file">
          <span class="file-name">{{ pendingShpFile.name }}</span>
          <p>需要以下配套文件才能正常上传</p>
        </div>

        <div class="check-list">
          <div class="check-section">
            <span class="section-label required">必需文件</span>
            <div
              v-for="item in requiredChecks"
              :key="item.ext"
              class="check-row"
            >
              <span
                :class="['status-dot', item.exists ? 'ok' : 'missing']"
              ></span>
              <span class="check-name">{{ item.name }}</span>
              <span class="check-status">{{
                item.exists ? "已选择" : "缺失"
              }}</span>
            </div>
          </div>

          <div class="check-section">
            <span class="section-label optional">建议文件</span>
            <div
              v-for="item in optionalChecks"
              :key="item.ext"
              class="check-row"
            >
              <span
                :class="['status-dot', item.exists ? 'ok' : 'optional-missing']"
              ></span>
              <span class="check-name">{{ item.name }}</span>
              <span class="check-status">{{
                item.exists ? "已选择" : "可选"
              }}</span>
            </div>
          </div>
        </div>

        <div v-if="!canUpload" class="upload-hint">
          请按住 Ctrl/Cmd 键重新选择，同时选中所有必需文件
        </div>
      </div>

      <template #footer>
        <el-button @click="showShpCheckDialog = false">取消</el-button>
        <el-button v-if="!canUpload" type="primary" @click="reselectFiles"
          >重新选择</el-button
        >
        <el-button
          v-else
          type="success"
          @click="confirmUpload"
          :loading="isUploading"
          >确认上传</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEditDialog"
      title="修改资料"
      width="460px"
      class="edit-dialog"
      align-center
    >
      <el-form label-position="top" class="edit-form">
        <div class="edit-avatar-row">
          <el-avatar :size="72" :src="editPreviewAvatar" class="edit-user-avatar">
            {{ profileForm.name?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <div class="edit-avatar-actions">
            <el-button class="avatar-select-btn" @click="triggerAvatarSelect">
              更换头像
            </el-button>
            <span class="edit-tip">支持 jpg、png 等常见图片格式</span>
          </div>
        </div>

        <el-form-item label="昵称">
          <el-input v-model="profileForm.name" placeholder="请输入昵称" />
        </el-form-item>

        <el-form-item label="当前密码">
          <el-input
            v-model="profileForm.currentPassword"
            type="password"
            show-password
            placeholder="不修改密码可留空"
          />
        </el-form-item>

        <el-form-item label="新密码">
          <el-input
            v-model="profileForm.newPassword"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>

        <el-form-item label="确认新密码">
          <el-input
            v-model="profileForm.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="isSavingProfile" @click="saveProfile">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchUserDatasets } from "@/api/datasets";
import { fetchUserProfile, updateUserProfile } from "@/api/users";
import { uploadUserData } from "@/api/datasets";
import { buildBackendUrl, BASE_URL } from "@/api/request";
import axios from "axios";

const router = useRouter();
const fileInputRef = ref<HTMLInputElement>();
const avatarInputRef = ref<HTMLInputElement>();
const showLogoutDialog = ref(false);
const showEditDialog = ref(false);
const activeFilter = ref("all");
const loading = ref(true);
const showShpCheckDialog = ref(false);
const pendingShpFile = ref<File | null>(null);
const selectedFiles = ref<File[]>([]);
const isUploading = ref(false);
const isSavingProfile = ref(false);
const selectedAvatarFile = ref<File | null>(null);

// ==================== 用户信息 ====================
const userInfo = ref({
  name: "",
  email: "",
  avatar: "",
  role: "用户",
  createdAt: "",
  lastLogin: "刚刚",
  usedStorage: "0 KB",
  totalStorage: "10 GB",
  usedBytes: 0,
  totalBytes: 10 * 1024 * 1024 * 1024, // 10GB 字节数
});

const storagePercent = computed(() =>
  Math.round((userInfo.value.usedBytes / userInfo.value.totalBytes) * 100),
);

// ==================== 数据列表 ====================
interface DataItem {
  id: number;
  name: string;
  type: "vector" | "raster";
  size: string;
  uploadDate: string;
}

const dataList = ref<DataItem[]>([]);
const profileForm = ref({
  name: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const editPreviewAvatar = computed(() =>
  selectedAvatarFile.value
    ? URL.createObjectURL(selectedAvatarFile.value)
    : userInfo.value.avatar,
);

function applyProfileData(data: any) {
  userInfo.value.name = data.name;
  userInfo.value.email = data.account;
  userInfo.value.avatar = data.avatar ? buildBackendUrl(data.avatar) : "";
  userInfo.value.role =
    data.role === "admin" ? "管理员" : data.role === "user" ? "普通用户" : data.role;
  userInfo.value.createdAt = new Date(data.createdAt).toLocaleDateString();
}

function resetProfileForm() {
  profileForm.value.name = userInfo.value.name;
  profileForm.value.currentPassword = "";
  profileForm.value.newPassword = "";
  profileForm.value.confirmPassword = "";
  selectedAvatarFile.value = null;
  if (avatarInputRef.value) {
    avatarInputRef.value.value = "";
  }
}

onMounted(async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    ElMessage.warning("请先登录");
    router.push("/login");
    return;
  }

  try {
    loading.value = true;
    // 1. 获取用户基本资料
    const res = await fetchUserProfile();

    if (res.code === 200) {
      applyProfileData(res.data);
      resetProfileForm();
      await fetchDataList();
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      ElMessage.error("身份验证失效，请重新登录");
      localStorage.clear();
      router.push("/login");
    } else {
      ElMessage.error("获取个人信息失败");
    }
  } finally {
    loading.value = false;
  }
});

const filteredList = computed(() => {
  if (activeFilter.value === "all") return dataList.value;
  return dataList.value.filter((d) => d.type === activeFilter.value);
});

// ==================== 操作：查看 ====================
function viewData(row: DataItem) {
  router.push({ path: "/workbench", query: { dataId: row.id } });
}

// ==================== 操作：移除 ====================
async function removeData(row: DataItem) {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除数据 ${row.name} 吗？此操作不可撤销。`,
      "警告",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    const token = localStorage.getItem("token");
    // 注意：将 'delete-data' 改为 'datasets' 以匹配后端路由
    const res = await axios.delete(`${BASE_URL}/users/datasets/${row.id}`, {
      headers: { Authorization: token },
    });

    if (res.data.code === 200) {
      ElMessage.success(`已删除：${row.name}`);
      // 刷新数据列表
      await fetchDataList();
    }
  } catch (error) {
    ElMessage.error("删除数据失败");
  }
}

// ==================== 操作：添加（本地文件） ====================
function triggerFileAdd() {
  fileInputRef.value?.click();
}

function openEditDialog() {
  resetProfileForm();
  showEditDialog.value = true;
}

function triggerAvatarSelect() {
  avatarInputRef.value?.click();
}

function handleAvatarChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  selectedAvatarFile.value = files[0] || null;
}

async function saveProfile() {
  const trimmedName = profileForm.value.name.trim();
  if (!trimmedName) {
    ElMessage.warning("请输入昵称");
    return;
  }

  const wantsPasswordUpdate = Boolean(
    profileForm.value.currentPassword ||
      profileForm.value.newPassword ||
      profileForm.value.confirmPassword,
  );

  if (wantsPasswordUpdate) {
    if (!profileForm.value.currentPassword) {
      ElMessage.warning("请输入当前密码");
      return;
    }
    if (profileForm.value.newPassword.length < 6) {
      ElMessage.warning("新密码至少 6 位");
      return;
    }
    if (profileForm.value.newPassword !== profileForm.value.confirmPassword) {
      ElMessage.warning("两次输入的新密码不一致");
      return;
    }
  }

  const formData = new FormData();
  formData.append("name", trimmedName);

  if (selectedAvatarFile.value) {
    formData.append("avatar", selectedAvatarFile.value);
  }

  if (wantsPasswordUpdate) {
    formData.append("currentPassword", profileForm.value.currentPassword);
    formData.append("newPassword", profileForm.value.newPassword);
    formData.append("confirmPassword", profileForm.value.confirmPassword);
  }

  try {
    isSavingProfile.value = true;
    const res = await updateUserProfile(formData);

    if (res.code === 200) {
      applyProfileData(res.data);
      resetProfileForm();
      showEditDialog.value = false;
      ElMessage.success("个人信息已更新");
    } else {
      ElMessage.error(res.message || "更新失败");
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || "更新失败");
  } finally {
    isSavingProfile.value = false;
  }
}

const handleFileAdd = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;

  selectedFiles.value = Array.from(files);

  // 检查是否包含SHP文件
  const shpFile = selectedFiles.value.find((f) =>
    f.name.toLowerCase().endsWith(".shp"),
  );

  // 如果选了SHP但只有一个文件，提示需要配套文件
  if (shpFile && selectedFiles.value.length === 1) {
    pendingShpFile.value = shpFile;
    showShpCheckDialog.value = true;
    return; // 中断，等待用户补全
  }

  // 其他情况直接上传（SHP多文件或非SHP文件）
  await processUpload(selectedFiles.value);
};

// 辅助函数：格式化字节显示
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 建议补全这个列表刷新函数
async function fetchDataList() {
  try {
    const res = await fetchUserDatasets();

    if (res.code === 200) {
      dataList.value = res.data.map((item: any) => ({
        id: item._id,
        // 前端判断：zip结尾就显示为shp
        name: item.name.toLowerCase().endsWith(".zip")
          ? item.name.replace(/\.zip$/i, ".shp")
          : item.name,
        type: item.type,
        size:
          item.size > 1024 * 1024
            ? (item.size / (1024 * 1024)).toFixed(2) + " MB"
            : (item.size / 1024).toFixed(2) + " KB",
        uploadDate: new Date(item.createdAt).toLocaleDateString(),
      }));

      // 更新存储空间...
      const totalUsedBytes = res.data.reduce(
        (sum: number, item: any) => sum + (item.size || 0),
        0,
      );
      userInfo.value.usedBytes = totalUsedBytes;
      userInfo.value.usedStorage = formatBytes(totalUsedBytes);
    }
  } catch (err) {
    console.error("获取列表失败:", err);
    ElMessage.error("无法加载数据列表");
  }
}

// ==================== 导航 ====================
function goWorkbench() {
  router.push("/workbench");
}

function confirmLogout() {
  localStorage.removeItem("token");
  localStorage.clear();
  showLogoutDialog.value = false;
  ElMessage.success("已退出登录");
  router.push("/login");
}

const requiredChecks = computed(() => {
  if (!pendingShpFile.value) return [];
  const base = pendingShpFile.value.name.replace(/\.shp$/i, "");
  return [".shx", ".dbf"].map((ext) => ({
    ext,
    name: base + ext,
    exists: selectedFiles.value.some(
      (f) => f.name.toLowerCase() === (base + ext).toLowerCase(),
    ),
  }));
});

const optionalChecks = computed(() => {
  if (!pendingShpFile.value) return [];
  const base = pendingShpFile.value.name.replace(/\.shp$/i, "");
  return [".prj", ".cpg"].map((ext) => ({
    ext,
    name: base + ext,
    exists: selectedFiles.value.some(
      (f) => f.name.toLowerCase() === (base + ext).toLowerCase(),
    ),
  }));
});

const canUpload = computed(() =>
  requiredChecks.value.every((item) => item.exists),
);

function reselectFiles() {
  showShpCheckDialog.value = false;
  fileInputRef.value!.value = "";
  setTimeout(() => fileInputRef.value?.click(), 100);
}

async function confirmUpload() {
  await processUpload(selectedFiles.value);
  showShpCheckDialog.value = false;
}

async function processUpload(files: File[]) {
  if (files.length === 0) return;

  // 判断上传模式
  const hasShp = files.some((f) => f.name.toLowerCase().endsWith(".shp"));
  const isMultiFileShp = hasShp && files.length > 1;

  let uploadFile: File | Blob;
  let uploadFileName: string;
  let fileType: "vector" | "raster" | null = null;

  try {
    // ========== 场景1: 多文件 SHP（打包为ZIP） ==========
    if (isMultiFileShp) {
      const shpFile = files.find((f) => f.name.toLowerCase().endsWith(".shp"))!;
      const baseName = shpFile.name.replace(/\.shp$/i, "");

      // 浏览器端打包为ZIP
      const JSZip = await import("jszip");
      const zip = new JSZip.default();

      // 只打包SHP相关文件，排除无关文件
      const shpExts = [".shp", ".shx", ".dbf", ".prj", ".cpg", ".sbn", ".sbx"];
      for (const file of files) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (shpExts.includes(ext)) {
          const content = await file.arrayBuffer();
          zip.file(file.name, content);
        }
      }

      uploadFile = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      uploadFileName = `${baseName}.zip`;
      fileType = "vector";
    }
    // ========== 场景2: 单文件（GeoJSON/TIFF等） ==========
    else {
      const file = files[0]!;
      const ext = file.name.split(".").pop()?.toLowerCase();
      const vectorExts = ["geojson", "json", "kml", "gpx"];
      const rasterExts = ["tif", "tiff", "png", "jpg", "img"];
      const shpExts = ["shp"]; // 单个shp文件（虽然不完整，但允许上传后提示）

      if (ext && vectorExts.includes(ext)) {
        fileType = "vector";
      } else if (ext && rasterExts.includes(ext)) {
        fileType = "raster";
      } else if (ext && shpExts.includes(ext)) {
        // 单个SHP文件，后端会检查完整性
        fileType = "vector";
      } else {
        ElMessage.warning("不支持该文件格式，请上传矢量或栅格数据");
        return;
      }

      uploadFile = file;
      uploadFileName = file.name;
    }

    // ========== 统一上传逻辑 ==========
    const formData = new FormData();
    formData.append("file", uploadFile, uploadFileName);
    formData.append("type", fileType!);

    // 如果是SHP ZIP，标记格式以便后端识别
    if (isMultiFileShp) {
      formData.append("format", "shp-zip");
      formData.append("originalCount", files.length.toString());
    }

    let token = localStorage.getItem("token");
    if (!token) {
      ElMessage.error("登录过期，请重新登录");
      router.push("/login");
      return;
    }

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    const res = await uploadUserData(authHeader, formData, (progressEvent) => {
      // 可选：计算上传进度
      const percent = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1),
      );
      console.log(`上传进度: ${percent}%`);
    });

    if (res.code === 200) {
      const successMsg = isMultiFileShp
        ? `SHP数据上传成功：${uploadFileName.replace(".zip", "")}（含${files.length}个文件）`
        : `上传成功：${uploadFileName}`;
      ElMessage.success(successMsg);

      // 刷新列表和存储信息
      await fetchDataList();

      if (res.data?.usedBytes) {
        userInfo.value.usedBytes = res.data.usedBytes;
        userInfo.value.usedStorage = formatBytes(res.data.usedBytes);
      }
    } else {
      ElMessage.error(res.message || "上传业务异常");
    }
  } catch (error: any) {
    console.error("上传失败详情:", error);
    const status = error.response?.status;
    const errorMsg = error.response?.data?.message || "服务器连接失败";

    if (status === 413) {
      ElMessage.error("文件体积过大，超过服务器限制");
    } else if (status === 401) {
      ElMessage.error("登录失效，请重新登录");
      router.push("/login");
    } else if (status === 400 && errorMsg.includes("不完整")) {
      // SHP文件不完整错误
      ElMessage.error(errorMsg);
      // 重新打开选择对话框
      reselectFiles();
    } else {
      ElMessage.error(`数据上传失败: ${errorMsg}`);
    }
  } finally {
    // 清理
    selectedFiles.value = [];
    pendingShpFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = "";
  }
}
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== 背景 ===== */
.profile-bg {
  min-height: 100vh;
  background: #080d18;
  font-family: "Noto Serif SC", serif;
  position: relative;
  overflow-x: hidden;
}

.grid-overlay {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}
.orb1 {
  width: 600px;
  height: 600px;
  background: #1d4ed8;
  opacity: 0.08;
  top: -200px;
  left: -150px;
}
.orb2 {
  width: 500px;
  height: 500px;
  background: #0e7490;
  opacity: 0.07;
  bottom: -150px;
  right: -100px;
}

/* ===== 容器 ===== */
.profile-wrap {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px 40px;
}

/* ===== 顶部导航 ===== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 32px;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-svg {
  width: 32px;
  height: 32px;
}
.brand-name {
  font-size: 17px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}
.breadcrumb-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 18px;
}
.breadcrumb-cur {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.45);
}

.top-bar-right {
  display: flex;
  gap: 10px;
}

.btn-svg {
  width: 15px;
  height: 15px;
}

.nav-btn {
  font-family: "Noto Serif SC", serif !important;
  font-size: 13px !important;
  border-radius: 8px !important;
  height: 36px !important;
  padding: 0 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.wb-btn {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}
.wb-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}

.logout-btn {
  background: rgba(239, 68, 68, 0.1) !important;
  border: 1px solid rgba(239, 68, 68, 0.25) !important;
  color: #f87171 !important;
}
.logout-btn:hover {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
}

/* ===== 主体布局 ===== */
.main-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  align-items: start;
}

/* ===== 用户面板 ===== */
.user-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 28px 24px;
  backdrop-filter: blur(12px);
  position: sticky;
  top: 24px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.avatar-ring {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(135deg, #2563eb, #0e7490);
  margin-bottom: 4px;
}

.user-avatar {
  width: 96px !important;
  height: 96px !important;
  font-size: 36px !important;
  background: #1e293b !important;
  color: #60a5fa !important;
  border: 3px solid #080d18;
}

.online-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #080d18;
}

.user-name {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  text-align: center;
}
.user-email {
  font-size: 13px;
  color: #64748b;
  text-align: center;
  word-break: break-all;
}
.role-tag {
  background: rgba(37, 99, 235, 0.15) !important;
  border-color: rgba(37, 99, 235, 0.3) !important;
  color: #60a5fa !important;
  font-family: "Noto Serif SC", serif !important;
}

.panel-divider {
  border-color: rgba(255, 255, 255, 0.06) !important;
  margin: 16px 0 !important;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info-key {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}
.info-key svg {
  width: 14px;
  height: 14px;
}
.info-val {
  font-size: 13px;
  color: #94a3b8;
}
.info-val.accent {
  color: #60a5fa;
  font-weight: 600;
}

.storage-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.storage-label {
  font-size: 13px;
  color: #64748b;
}
.storage-val {
  font-size: 13px;
  color: #94a3b8;
}

.storage-progress :deep(.el-progress-bar__outer) {
  background: rgba(255, 255, 255, 0.06) !important;
  border-radius: 4px !important;
}
.storage-progress :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #2563eb, #0ea5e9) !important;
  border-radius: 4px !important;
}

.edit-profile-btn {
  width: 100%;
  font-family: "Noto Serif SC", serif !important;
  font-size: 13px !important;
  border-radius: 8px !important;
  height: 36px !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}
.edit-profile-btn:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  color: white !important;
}

/* ===== 数据面板 ===== */
.data-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 28px 28px;
  backdrop-filter: blur(12px);
}

.data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.data-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.data-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
}

.count-badge :deep(.el-badge__content) {
  background: #2563eb !important;
  border: none !important;
  font-family: "Noto Serif SC", serif !important;
}

.data-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-group :deep(.el-radio-button__inner) {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #94a3b8 !important;
  font-family: "Noto Serif SC", serif !important;
  font-size: 13px !important;
  padding: 5px 14px !important;
  transition: all 0.2s;
}
.filter-group
  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: white !important;
  box-shadow: none !important;
}

.add-data-btn {
  background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
  border: none !important;
  border-radius: 8px !important;
  font-family: "Noto Serif SC", serif !important;
  font-size: 13px !important;
  height: 34px !important;
  padding: 0 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35) !important;
}
.add-data-btn:hover {
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5) !important;
  transform: translateY(-1px) !important;
}

/* ===== 数据表格 ===== */
.data-table {
  width: 100%;
  background: transparent !important;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.03);
  --el-table-border-color: rgba(255, 255, 255, 0.07);
  --el-table-text-color: #94a3b8;
  --el-table-header-text-color: #64748b;
  --el-table-row-hover-bg-color: rgba(37, 99, 235, 0.06);
}

.data-table :deep(th.el-table__cell) {
  background: rgba(255, 255, 255, 0.03) !important;
  font-family: "Noto Serif SC", serif !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #64748b !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
}
.data-table :deep(td.el-table__cell) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
  font-family: "Noto Serif SC", serif !important;
}
.data-table :deep(.el-table__empty-text) {
  color: #475569 !important;
  font-family: "Noto Serif SC", serif !important;
}

.type-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.type-icon-wrap svg {
  width: 16px;
  height: 16px;
}
.type-icon-wrap.vector {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.type-icon-wrap.raster {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
}

.data-name-cell {
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
}
.meta-cell {
  font-size: 13px;
  color: #64748b;
}

.type-tag {
  font-family: "Noto Serif SC", serif !important;
}

.action-group {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.op-btn {
  font-family: "Noto Serif SC", serif !important;
  font-size: 12px !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
}
.op-svg {
  width: 12px;
  height: 12px;
}

/* ===== 退出弹窗 ===== */
.logout-dialog :deep(.el-dialog) {
  background: #111827 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
}
.edit-dialog :deep(.el-dialog) {
  background: #111827 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
}
.logout-dialog :deep(.el-dialog__title) {
  color: #f1f5f9 !important;
  font-family: "Noto Serif SC", serif !important;
}
.edit-dialog :deep(.el-dialog__title) {
  color: #f1f5f9 !important;
  font-family: "Noto Serif SC", serif !important;
}
.logout-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  padding: 20px 24px 16px !important;
}
.edit-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  padding: 20px 24px 16px !important;
}
.logout-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
}
.edit-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
}

.logout-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
  font-family: "Noto Serif SC", serif;
}
.logout-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f87171;
}
.logout-icon svg {
  width: 24px;
  height: 24px;
}

.edit-form :deep(.el-form-item__label) {
  color: #cbd5e1 !important;
  font-family: "Noto Serif SC", serif !important;
}
.edit-form :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.04) !important;
  box-shadow: none !important;
}
.edit-form :deep(.el-input__inner) {
  color: #e2e8f0 !important;
}
.edit-avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.edit-user-avatar {
  background: #1e293b !important;
  color: #60a5fa !important;
}
.edit-avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.avatar-select-btn {
  width: fit-content;
  background: rgba(37, 99, 235, 0.16) !important;
  border-color: rgba(37, 99, 235, 0.26) !important;
  color: #93c5fd !important;
}
.edit-tip {
  font-size: 12px;
  color: #64748b;
}
/* 添加到原有 style 末尾 */
.shp-check-body {
  padding: 0 8px;
}

.check-main-file {
  text-align: center;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8px;
}

.check-main-file .file-name {
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.check-main-file p {
  color: #64748b;
  font-size: 13px;
  margin: 0;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.check-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-bottom: 4px;
}

.section-label.required {
  color: #f87171;
}

.section-label.optional {
  color: #60a5fa;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ok {
  background: #22c55e;
}

.status-dot.missing {
  background: #ef4444;
}

.status-dot.optional-missing {
  background: #6b7280;
}

.check-name {
  flex: 1;
  color: #e2e8f0;
  font-size: 13px;
}

.check-status {
  font-size: 12px;
  color: #64748b;
}

.upload-hint {
  margin-top: 16px;
  padding: 12px;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 8px;
  color: #facc15;
  font-size: 13px;
  text-align: center;
}
</style>
