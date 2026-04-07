<template>
  <div class="auth-bg">
    <!-- 背景装饰 -->
    <div class="bg-orb orb1"></div>
    <div class="bg-orb orb2"></div>
    <div class="bg-orb orb3"></div>

    <div class="auth-card" :class="{ 'is-register': isRegister }">
      <!-- 左侧品牌区 -->
      <div class="card-left">
        <div class="brand">
          <div class="brand-icon">
            <svg viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="white" stroke-width="2" opacity="0.4"/>
              <path d="M12 20 L20 12 L28 20 L20 28 Z" fill="white" opacity="0.9"/>
              <circle cx="20" cy="20" r="4" fill="white"/>
            </svg>
          </div>
          <span class="brand-name">地理信息管理平台</span>
        </div>
        <div class="left-content">
          <h2 class="left-title">{{ isRegister ? '加入我们' : '欢迎回来' }}</h2>
          <p class="left-desc">{{ isRegister ? '创建账号，开启地理信息探索之旅' : '登录您的账户，继续探索世界' }}</p>
          <div class="left-dots">
            <span class="dot" :class="{ active: !isRegister }" @click="isRegister = false"></span>
            <span class="dot" :class="{ active: isRegister }" @click="isRegister = true"></span>
          </div>
        </div>
        <div class="left-decoration">
          <div class="deco-ring ring1"></div>
          <div class="deco-ring ring2"></div>
        </div>
      </div>

      <!-- 右侧表单区 -->
      <div class="card-right">
        <div class="form-header">
          <h3 class="form-title">{{ isRegister ? '创建账号' : '账号登录' }}</h3>
          <p class="form-subtitle">
            {{ isRegister ? '已有账号？' : '还没有账号？' }}
            <span class="toggle-link" @click="toggleMode">
              {{ isRegister ? '立即登录' : '立即注册' }}
            </span>
          </p>
        </div>

        <!-- 登录表单 -->
        <el-form
          v-if="!isRegister"
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          class="auth-form"
          @keyup.enter="submitLogin"
        >
          <el-form-item prop="account">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </span>
              <el-input
                v-model="loginForm.account"
                placeholder="邮箱地址"
                class="custom-input"
              />
            </div>
          </el-form-item>

          <el-form-item prop="password">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </span>
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="登录密码"
                show-password
                class="custom-input"
              />
            </div>
          </el-form-item>

          <div class="form-options">
            <el-checkbox v-model="rememberMe" class="remember-check">记住我</el-checkbox>
            <span class="forgot-link">忘记密码？</span>
          </div>

          <el-button
            class="submit-btn"
            :loading="loading"
            @click="submitLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form>

        <!-- 注册表单 -->
        <el-form
          v-else
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          class="auth-form"
        >
          <!-- 头像上传 -->
          <el-form-item prop="avatar">
            <div class="avatar-upload-area">
              <div class="avatar-preview" @click="triggerAvatarUpload">
                <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" />
                <div v-else class="avatar-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div class="avatar-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/*"
                style="display:none"
                @change="handleAvatarChange"
              />
              <span class="avatar-tip">点击上传头像</span>
            </div>
          </el-form-item>

          <el-form-item prop="name">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <el-input
                v-model="registerForm.name"
                placeholder="用户名称（3-10个字符）"
                class="custom-input"
              />
            </div>
          </el-form-item>

          <el-form-item prop="account">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </span>
              <el-input
                v-model="registerForm.account"
                placeholder="邮箱地址"
                class="custom-input"
              />
            </div>
          </el-form-item>

          <el-form-item prop="password">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </span>
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="设置密码（至少8位）"
                show-password
                class="custom-input"
              />
            </div>
          </el-form-item>

          <el-form-item prop="confirmPassword">
            <div class="input-wrapper">
              <span class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </span>
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="确认密码"
                show-password
                class="custom-input"
              />
            </div>
          </el-form-item>

          <el-button
            class="submit-btn"
            :loading="loading"
            @click="submitRegister"
          >
            {{ loading ? '注册中...' : '创建账号' }}
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import router from '@/router'
import { login, register } from '@/api/auth'

// ==================== 状态 ====================
const isRegister = ref(false)
const loading = ref(false)
const rememberMe = ref(false)
const avatarUrl = ref('')
const avatarFile = ref<File | null>(null)
const avatarInput = ref<HTMLInputElement>()
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

// ==================== 表单数据 ====================
const loginForm = reactive({
  account: '',
  password: '',
})

const registerForm = reactive({
  name: '',
  account: '',
  password: '',
  confirmPassword: '',
  avatar: '',
})

// ==================== 校验规则 ====================
const loginRules: FormRules = {
  account: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱格式', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
}

const validateConfirmPassword = (_: unknown, value: string, callback: (e?: Error) => void) => {
  if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const registerRules: FormRules = {
  name: [
    { required: true, message: '请输入用户名称', trigger: 'blur' },
    { min: 3, max: 10, message: '名称长度应在3到10个字符之间', trigger: 'blur' },
  ],
  account: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱格式', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8位', trigger: 'blur' },
    {
      pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
      message: '密码需包含字母和数字',
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

// ==================== 头像处理 ====================
function triggerAvatarUpload() {
  avatarInput.value?.click()
}

function handleAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像文件不能超过 2MB')
    return
  }
  avatarFile.value = file
  avatarUrl.value = URL.createObjectURL(file)
  registerForm.avatar = file.name
}

// ==================== 切换模式 ====================
function toggleMode() {
  isRegister.value = !isRegister.value
  loginFormRef.value?.resetFields()
  registerFormRef.value?.resetFields()
  avatarUrl.value = ''
}

// ==================== 登录提交 ====================
// Login.vue 中的 submitLogin 函数
async function submitLogin() {
  await loginFormRef.value?.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    
    try {
      const res = await login({
        account: loginForm.account,
        password: loginForm.password,
      });

      if (res.status === 201 || res.code === 200) {
        const { token, user } = res.data;

        // --- 核心：持久化存储 ---
        localStorage.setItem('token', token);
        // 如果你有用户信息，也可以存一下，或者存入 Pinia
        localStorage.setItem('userInfo', JSON.stringify(user));

        ElMessage.success('欢迎回来，' + user.name);

        // 跳转到数据工作台
        router.push('/workbench'); 
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || '登录失败，请检查账号密码';
      ElMessage.error(msg);
    } finally {
      loading.value = false;
    }
  });
}

// ==================== 注册提交 ====================
async function submitRegister() {
  await registerFormRef.value?.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    
    try {
      const formData = new FormData();
      formData.append('name', registerForm.name);
      formData.append('account', registerForm.account);
      formData.append('password', registerForm.password);
      formData.append('confirmPassword', registerForm.confirmPassword);
      if (avatarFile.value) {
        formData.append('avatar', avatarFile.value); 
      }

      // 发送请求
      const res = await register(formData);

      // --- 成功提醒 ---
      if (res.code === 200) {
        ElMessage({
          message: '✨ 账号创建成功！欢迎加入地理信息管理平台',
          type: 'success',
          duration: 3000,
          showClose: true
        });
        
        // 延迟跳转，给用户看提醒的时间
        setTimeout(() => {
          toggleMode(); // 切换到登录界面
        }, 1200);
      }
    } catch (error: any) {
      // --- 失败提醒 ---
      // 优先显示后端返回的错误（如：邮箱已被占用），否则显示通用错误
      const errorMsg = error.response?.data?.message || '注册遇到问题，请检查网络后重试';
      
      ElMessage({
        message: `注册失败: ${errorMsg}`,
        type: 'error',
        duration: 5000,
        showClose: true
      });
      
      console.error('Registration failed:', error);
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&family=Smiley+Sans&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ===== 背景 ===== */
.auth-bg {
  min-height: 100vh;
  background: #0a0e1a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  font-family: 'Noto Serif SC', serif;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
  pointer-events: none;
}
.orb1 { width: 500px; height: 500px; background: #3b82f6; top: -150px; left: -100px; animation: drift 8s ease-in-out infinite; }
.orb2 { width: 400px; height: 400px; background: #8b5cf6; bottom: -100px; right: -50px; animation: drift 10s ease-in-out infinite reverse; }
.orb3 { width: 300px; height: 300px; background: #06b6d4; top: 50%; left: 50%; transform: translate(-50%,-50%); animation: drift 12s ease-in-out infinite 2s; }

@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 30px) scale(0.95); }
}

/* ===== 卡片 ===== */
.auth-card {
  display: flex;
  width: 860px;
  min-height: 540px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
  position: relative;
  z-index: 1;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== 左侧 ===== */
.card-left {
  width: 340px;
  flex-shrink: 0;
  background: linear-gradient(145deg, #1e3a5f 0%, #0f2447 50%, #1a1040 100%);
  padding: 40px 36px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  transition: background 0.5s ease;
}

.is-register .card-left {
  background: linear-gradient(145deg, #1e4d3a 0%, #0f2d22 50%, #0d1a2e 100%);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon { width: 36px; height: 36px; }
.brand-name {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.5px;
}

.left-content { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 20px 0; }
.left-title {
  font-size: 32px;
  font-weight: 600;
  color: white;
  line-height: 1.2;
  margin-bottom: 12px;
}
.left-desc {
  font-size: 14px;
  color: rgba(255,255,255,0.55);
  line-height: 1.6;
}

.left-dots { display: flex; gap: 8px; margin-top: 32px; }
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  cursor: pointer;
  transition: all 0.3s;
}
.dot.active { width: 24px; border-radius: 4px; background: rgba(255,255,255,0.8); }

.left-decoration { position: absolute; right: -40px; bottom: -40px; pointer-events: none; }
.deco-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
}
.ring1 { width: 200px; height: 200px; bottom: 0; right: 0; }
.ring2 { width: 140px; height: 140px; bottom: 30px; right: 30px; }

/* ===== 右侧 ===== */
.card-right {
  flex: 1;
  background: #111827;
  padding: 40px 44px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.form-header { margin-bottom: 28px; }
.form-title {
  font-size: 26px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 8px;
}
.form-subtitle { font-size: 14px; color: #64748b; }
.toggle-link {
  color: #60a5fa;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s;
}
.toggle-link:hover { color: #93c5fd; text-decoration: underline; }

/* ===== 表单 ===== */
.auth-form { flex: 1; }

.auth-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.auth-form :deep(.el-form-item__error) {
  color: #f87171;
  font-size: 12px;
}

.input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 14px;
  z-index: 2;
  width: 18px;
  height: 18px;
  color: #475569;
  display: flex;
  align-items: center;
  pointer-events: none;
}
.input-icon svg { width: 100%; height: 100%; }

.custom-input { width: 100%; }
.custom-input :deep(.el-input__wrapper) {
  background: #1e293b !important;
  border: 1px solid #2d3748 !important;
  border-radius: 10px !important;
  padding: 12px 14px 12px 42px !important;
  box-shadow: none !important;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.custom-input :deep(.el-input__wrapper:hover) {
  border-color: #3b82f6 !important;
}
.custom-input :deep(.el-input__wrapper.is-focus) {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
}
.custom-input :deep(.el-input__inner) {
  color: #e2e8f0 !important;
  font-size: 14px !important;
  background: transparent !important;
  font-family: 'Noto Serif SC', serif;
}
.custom-input :deep(.el-input__inner::placeholder) { color: #475569 !important; }
.custom-input :deep(.el-input__suffix) { color: #475569; }

/* ===== 头像上传 ===== */
.avatar-upload-area {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
}
.avatar-preview {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: #1e293b;
  border: 2px dashed #334155;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
  flex-shrink: 0;
}
.avatar-preview:hover { border-color: #3b82f6; }
.avatar-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #475569;
}
.avatar-placeholder svg { width: 28px; height: 28px; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.avatar-overlay svg { width: 22px; height: 22px; }
.avatar-preview:hover .avatar-overlay { opacity: 1; }
.avatar-tip { font-size: 13px; color: #64748b; }

/* ===== 底部选项 ===== */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0 20px;
}
.remember-check :deep(.el-checkbox__label) { color: #94a3b8; font-size: 13px; }
.remember-check :deep(.el-checkbox__inner) {
  background: #1e293b;
  border-color: #334155;
}
.forgot-link {
  font-size: 13px;
  color: #60a5fa;
  cursor: pointer;
  transition: color 0.2s;
}
.forgot-link:hover { color: #93c5fd; }

/* ===== 提交按钮 ===== */
.submit-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #2563eb, #3b82f6) !important;
  border: none !important;
  border-radius: 10px !important;
  color: white !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 2px;
  font-family: 'Noto Serif SC', serif;
  cursor: pointer;
  transition: all 0.3s !important;
  box-shadow: 0 4px 20px rgba(59,130,246,0.3) !important;
  margin-top: 8px;
}
.submit-btn:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 8px 28px rgba(59,130,246,0.45) !important;
}
.submit-btn:active { transform: translateY(0) !important; }
</style>
