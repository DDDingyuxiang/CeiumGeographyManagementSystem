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
              <circle cx="20" cy="20" r="18" stroke="white" stroke-width="2" opacity="0.35"/>
              <path d="M12 20 L20 12 L28 20 L20 28 Z" fill="white" opacity="0.9"/>
              <circle cx="20" cy="20" r="4" fill="white"/>
            </svg>
            <span class="brand-name">地理信息管理平台</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-cur">个人中心</span>
        </div>
        <div class="top-bar-right">
          <el-button class="nav-btn wb-btn" @click="goWorkbench">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="btn-svg">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </template>
            返回工作台
          </el-button>
          <el-button class="nav-btn logout-btn" @click="showLogoutDialog = true">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="btn-svg">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
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
              <el-avatar
                :size="96"
                :src="userInfo.avatar"
                class="user-avatar"
              >
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                注册时间
              </span>
              <span class="info-val">{{ userInfo.createdAt }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                上次登录
              </span>
              <span class="info-val">{{ userInfo.lastLogin }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                数据总量
              </span>
              <span class="info-val accent">{{ dataList.length }} 个</span>
            </div>
          </div>

          <el-divider class="panel-divider" />

          <div class="storage-section">
            <div class="storage-header">
              <span class="storage-label">存储空间</span>
              <span class="storage-val">{{ userInfo.usedStorage }} / {{ userInfo.totalStorage }}</span>
            </div>
            <el-progress
              :percentage="storagePercent"
              :stroke-width="6"
              :show-text="false"
              class="storage-progress"
            />
          </div>
        </aside>

        <!-- 右侧数据管理 -->
        <section class="data-panel">
          <div class="data-header">
            <div class="data-title-wrap">
              <h3 class="data-title">我的数据集</h3>
              <el-badge :value="dataList.length" class="count-badge" />
            </div>
            <div class="data-header-right">
              <el-radio-group v-model="activeFilter" size="small" class="filter-group">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="vector">矢量</el-radio-button>
                <el-radio-button value="raster">栅格</el-radio-button>
              </el-radio-group>
              <el-button type="primary" class="add-data-btn" @click="triggerFileAdd">
                <template #icon>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-svg">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </template>
                添加数据
              </el-button>
              <input ref="fileInputRef" type="file" style="display:none" @change="handleFileAdd" />
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
                  <svg v-if="row.type === 'vector'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <polygon points="12 2 22 20 2 20"/>
                    <circle cx="12" cy="2" r="2" fill="currentColor"/>
                    <circle cx="22" cy="20" r="2" fill="currentColor"/>
                    <circle cx="2" cy="20" r="2" fill="currentColor"/>
                  </svg>
                  <svg v-else-if="row.type === 'raster'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                    <line x1="15" y1="3" x2="15" y2="21"/>
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
                  {{ row.type === 'vector' ? '矢量' : '栅格' }}
                </el-tag>
              </template>
            </el-table-column>

            <!-- 大小 -->
            <el-table-column label="大小" prop="size" width="100" align="center">
              <template #default="{ row }">
                <span class="meta-cell">{{ row.size }}</span>
              </template>
            </el-table-column>

            <!-- 上传时间 -->
            <el-table-column label="上传时间" prop="uploadDate" width="130" align="center">
              <template #default="{ row }">
                <span class="meta-cell">{{ row.uploadDate }}</span>
              </template>
            </el-table-column>

            <!-- 操作 -->
            <el-table-column label="操作" width="160" align="center" fixed="right">
              <template #default="{ row }">
                <div class="action-group">
                  <el-tooltip content="在工作台查看" placement="top">
                    <el-button
                      type="primary"
                      size="small"
                      class="op-btn view-op"
                      @click="viewData(row)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="op-svg">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="op-svg">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <p>确认退出登录？退出后将跳转至登录页面。</p>
      </div>
      <template #footer>
        <el-button @click="showLogoutDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmLogout">确认退出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const router = useRouter()
const fileInputRef = ref<HTMLInputElement>()
const showLogoutDialog = ref(false)
const activeFilter = ref('all')

const loading = ref(true);

// ==================== 用户信息 ====================
const userInfo = ref({
  name: '',
  email: '',
  avatar: '',
  role: '用户',
  createdAt: '',
  lastLogin: '刚刚',
  usedStorage: '0 KB',
  totalStorage: '10 GB',
  usedBytes: 0,
  totalBytes: 10 * 1024 * 1024 * 1024, // 10GB 字节数
})



const storagePercent = computed(() =>
  Math.round((userInfo.value.usedBytes / userInfo.value.totalBytes) * 100)
)

// ==================== 数据列表 ====================
interface DataItem {
  id: number
  name: string
  type: 'vector' | 'raster'
  size: string
  uploadDate: string
}

const dataList = ref<DataItem[]>([])


onMounted(async () => {
  const token = localStorage.getItem('token')
  if (!token) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }

  try {
    loading.value = true
    // 1. 获取用户基本资料
    const res = await axios.get('http://localhost:3000/api/users/profile', {
      headers: { Authorization: token }
    })

    if (res.data.code === 200) {
      const d = res.data.data
      // 填充数据
      userInfo.value.name = d.name
      userInfo.value.email = d.account
      // 注意：拼接后端地址
      userInfo.value.avatar = d.avatar ? `http://localhost:3000${d.avatar}` : ''
      userInfo.value.role = d.role
      // 格式化日期：2023-10-27
      userInfo.value.createdAt = new Date(d.createdAt).toLocaleDateString()
      await fetchDataList()
      // 后续如果有关联查询，这里可以处理 dataList
      // dataList.value = d.dataAssets || []
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      ElMessage.error('身份验证失效，请重新登录')
      localStorage.clear()
      router.push('/login')
    } else {
      ElMessage.error('获取个人信息失败')
    }
  } finally {
    loading.value = false
  }
})

const filteredList = computed(() => {
  if (activeFilter.value === 'all') return dataList.value
  return dataList.value.filter(d => d.type === activeFilter.value)
})

// ==================== 操作：查看 ====================
function viewData(row: DataItem) {
  // TODO: 预留 API —— 加载数据至工作台
  // await fetch(`/api/datasets/${row.id}/load`, { method: 'POST', ... })

  // 路由跳转至 /workbench，携带数据 id
  router.push({ path: '/workbench', query: { dataId: row.id } })
}

// ==================== 操作：移除 ====================
async function removeData(row: DataItem) {
  try{
    await ElMessageBox.confirm(
      `确定要永久删除数据 ${row.name} 吗？此操作不可撤销。`,
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const token = localStorage.getItem('token')
    // 注意：将 'delete-data' 改为 'datasets' 以匹配后端路由
const res = await axios.delete(`http://localhost:3000/api/users/datasets/${row.id}`, {
  headers: { Authorization: token }
})



    if(res.data.code === 200){
      ElMessage.success(`已删除：${row.name}`)
      // 刷新数据列表
      await fetchDataList()
    }
    } catch (error) {
      ElMessage.error('删除数据失败')
    }
}

// ==================== 操作：添加（本地文件） ====================
function triggerFileAdd() {
  fileInputRef.value?.click()
}

async function handleFileAdd(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // 1. 前端校验格式
  const ext = file.name.split('.').pop()?.toLowerCase()
  const vectorExts = ['geojson', 'json', 'shp', 'kml', 'gpx','geoJson']
  const rasterExts = ['tif', 'tiff', 'png', 'jpg', 'img']

  let type: 'vector' | 'raster' | null = null
  if (ext && vectorExts.includes(ext)) type = 'vector'
  else if (ext && rasterExts.includes(ext)) type = 'raster'
  else {
    ElMessage.warning('不支持该文件格式，请上传矢量或栅格数据')
    return
  }

  // 2. 准备上传
  const formData = new FormData()
  formData.append('file', file) 
  // 如果后端需要额外的字段（比如 type），可以在这里添加
  formData.append('type', type) 

  try {
    let token = localStorage.getItem('token')
    if (!token) {
      ElMessage.error('登录过期，请重新登录')
      router.push('/login')
      return
    }

    // 修复：确保 Token 带有 Bearer 前缀（如果存储时没加的话）
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`

    const res = await axios.post('http://localhost:3000/api/users/upload-data', formData, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'multipart/form-data'
      }
    })

    if (res.data.code === 200) {
      ElMessage.success(`上传成功：${file.name}`)
      
      // 3. 刷新列表和用户信息（更新存储容量显示）
      await fetchDataList() 
      
      // 如果后端返回了新的存储信息，可以直接更新，减少一次请求
      if(res.data.data.usedBytes) {
        userInfo.value.usedBytes = res.data.data.usedBytes
        userInfo.value.usedStorage = formatBytes(res.data.data.usedBytes)
      }
    } else {
      // 处理后端返回了 200 但 code 不是 200 的逻辑错误
      ElMessage.error(res.data.message || '上传业务异常')
    }
  } catch (error: any) {
    console.error('上传失败详情:', error)
    // 细化错误提示
    const status = error.response?.status
    const errorMsg = error.response?.data?.message || '服务器连接失败'
    
    if (status === 413) {
      ElMessage.error('文件体积过大，超过服务器限制')
    } else if (status === 401) {
      ElMessage.error('登录失效，请重新登录')
      router.push('/login')
    } else {
      ElMessage.error(`数据上传失败: ${errorMsg}`)
    }
  } finally {
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

// 辅助函数：格式化字节显示
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 建议补全这个列表刷新函数
async function fetchDataList() {
  try {
    const token = localStorage.getItem('token')
    // 对应后端 userRoutes.ts 中的 router.get('/datasets', ...)
    const res = await axios.get('http://localhost:3000/api/users/datasets', {
      headers: { Authorization: token }
    })

    if (res.data.code === 200) {
      // 【关键点】：将后端返回的数据映射到前端 dataList 模型
      dataList.value = res.data.data.map((item: any) => ({
        id: item._id, // 将数据库的 _id 映射给前端的 id
        name: item.name,
        type: item.type,
        // 格式化文件大小显示
        size: item.size > 1024 * 1024 
          ? (item.size / (1024 * 1024)).toFixed(2) + ' MB' 
          : (item.size / 1024).toFixed(2) + ' KB',
        // 格式化上传时间
        uploadDate: new Date(item.createdAt).toLocaleDateString()
      }))
    }

    const totalUsedBytes = res.data.data.reduce((sum:number, item:any) => sum + (item.size||0), 0)
    userInfo.value.usedBytes = totalUsedBytes
    userInfo.value.usedStorage = formatBytes(totalUsedBytes)
  } catch (err) {
    console.error('获取列表失败:', err)
    ElMessage.error('无法加载数据列表')
  }
}

// ==================== 导航 ====================
function goWorkbench() {
  router.push('/workbench')
}

function handleLogout() {
  showLogoutDialog.value = true
}

function confirmLogout() {
  localStorage.removeItem('token')
  localStorage.clear()
  showLogoutDialog.value = false
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== 背景 ===== */
.profile-bg {
  min-height: 100vh;
  background: #080d18;
  font-family: 'Noto Serif SC', serif;
  position: relative;
  overflow-x: hidden;
}

.grid-overlay {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
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
.orb1 { width: 600px; height: 600px; background: #1d4ed8; opacity: 0.08; top: -200px; left: -150px; }
.orb2 { width: 500px; height: 500px; background: #0e7490; opacity: 0.07; bottom: -150px; right: -100px; }

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
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 32px;
}

.top-bar-left { display: flex; align-items: center; gap: 10px; }

.brand { display: flex; align-items: center; gap: 10px; }
.brand-svg { width: 32px; height: 32px; }
.brand-name { font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.9); }
.breadcrumb-sep { color: rgba(255,255,255,0.2); font-size: 18px; }
.breadcrumb-cur { font-size: 15px; color: rgba(255,255,255,0.45); }

.top-bar-right { display: flex; gap: 10px; }

.btn-svg { width: 15px; height: 15px; }

.nav-btn {
  font-family: 'Noto Serif SC', serif !important;
  font-size: 13px !important;
  border-radius: 8px !important;
  height: 36px !important;
  padding: 0 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.wb-btn {
  background: rgba(255,255,255,0.06) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  color: rgba(255,255,255,0.75) !important;
}
.wb-btn:hover {
  background: rgba(255,255,255,0.1) !important;
  color: white !important;
}

.logout-btn {
  background: rgba(239,68,68,0.1) !important;
  border: 1px solid rgba(239,68,68,0.25) !important;
  color: #f87171 !important;
}
.logout-btn:hover {
  background: rgba(239,68,68,0.18) !important;
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
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 28px 24px;
  backdrop-filter: blur(12px);
  position: sticky;
  top: 24px;
}

.avatar-section { display: flex; flex-direction: column; align-items: center; gap: 10px; }

.avatar-ring {
  position: relative;
  width: 104px; height: 104px;
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
  bottom: 6px; right: 6px;
  width: 14px; height: 14px;
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
  background: rgba(37,99,235,0.15) !important;
  border-color: rgba(37,99,235,0.3) !important;
  color: #60a5fa !important;
  font-family: 'Noto Serif SC', serif !important;
}

.panel-divider { border-color: rgba(255,255,255,0.06) !important; margin: 16px 0 !important; }

.info-grid { display: flex; flex-direction: column; gap: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; }
.info-key {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: #64748b;
}
.info-key svg { width: 14px; height: 14px; }
.info-val { font-size: 13px; color: #94a3b8; }
.info-val.accent { color: #60a5fa; font-weight: 600; }


.storage-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.storage-label { font-size: 13px; color: #64748b; }
.storage-val { font-size: 13px; color: #94a3b8; }

.storage-progress :deep(.el-progress-bar__outer) {
  background: rgba(255,255,255,0.06) !important;
  border-radius: 4px !important;
}
.storage-progress :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #2563eb, #0ea5e9) !important;
  border-radius: 4px !important;
}

/* ===== 数据面板 ===== */
.data-panel {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
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

.data-title-wrap { display: flex; align-items: center; gap: 10px; }
.data-title { font-size: 20px; font-weight: 700; color: #f1f5f9; }

.count-badge :deep(.el-badge__content) {
  background: #2563eb !important;
  border: none !important;
  font-family: 'Noto Serif SC', serif !important;
}

.data-header-right { display: flex; align-items: center; gap: 10px; }

.filter-group :deep(.el-radio-button__inner) {
  background: rgba(255,255,255,0.04) !important;
  border-color: rgba(255,255,255,0.1) !important;
  color: #94a3b8 !important;
  font-family: 'Noto Serif SC', serif !important;
  font-size: 13px !important;
  padding: 5px 14px !important;
  transition: all 0.2s;
}
.filter-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: white !important;
  box-shadow: none !important;
}

.add-data-btn {
  background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
  border: none !important;
  border-radius: 8px !important;
  font-family: 'Noto Serif SC', serif !important;
  font-size: 13px !important;
  height: 34px !important;
  padding: 0 14px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  box-shadow: 0 4px 14px rgba(37,99,235,0.35) !important;
}
.add-data-btn:hover {
  box-shadow: 0 6px 20px rgba(37,99,235,0.5) !important;
  transform: translateY(-1px) !important;
}

/* ===== 数据表格 ===== */
.data-table {
  width: 100%;
  background: transparent !important;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255,255,255,0.03);
  --el-table-border-color: rgba(255,255,255,0.07);
  --el-table-text-color: #94a3b8;
  --el-table-header-text-color: #64748b;
  --el-table-row-hover-bg-color: rgba(37,99,235,0.06);
}

.data-table :deep(th.el-table__cell) {
  background: rgba(255,255,255,0.03) !important;
  font-family: 'Noto Serif SC', serif !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #64748b !important;
  border-bottom: 1px solid rgba(255,255,255,0.07) !important;
}
.data-table :deep(td.el-table__cell) {
  border-bottom: 1px solid rgba(255,255,255,0.05) !important;
  font-family: 'Noto Serif SC', serif !important;
}
.data-table :deep(.el-table__empty-text) {
  color: #475569 !important;
  font-family: 'Noto Serif SC', serif !important;
}

.type-icon-wrap {
  width: 34px; height: 34px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
}
.type-icon-wrap svg { width: 16px; height: 16px; }
.type-icon-wrap.vector { background: rgba(34,197,94,0.12); color: #4ade80; }
.type-icon-wrap.raster { background: rgba(234,179,8,0.12); color: #facc15; }

.data-name-cell { font-size: 14px; color: #e2e8f0; font-weight: 500; }
.meta-cell { font-size: 13px; color: #64748b; }

.type-tag { font-family: 'Noto Serif SC', serif !important; }

.action-group { display: flex; gap: 6px; justify-content: center; }

.op-btn {
  font-family: 'Noto Serif SC', serif !important;
  font-size: 12px !important;
  border-radius: 6px !important;
  padding: 0 10px !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
}
.op-svg { width: 12px; height: 12px; }

/* ===== 退出弹窗 ===== */
.logout-dialog :deep(.el-dialog) {
  background: #111827 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 16px !important;
}
.logout-dialog :deep(.el-dialog__title) {
  color: #f1f5f9 !important;
  font-family: 'Noto Serif SC', serif !important;
}
.logout-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(255,255,255,0.06) !important;
  padding: 20px 24px 16px !important;
}
.logout-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid rgba(255,255,255,0.06) !important;
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
  font-family: 'Noto Serif SC', serif;
}
.logout-icon {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: rgba(239,68,68,0.1);
  display: flex; align-items: center; justify-content: center;
  color: #f87171;
}
.logout-icon svg { width: 24px; height: 24px; }
</style>