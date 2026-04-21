<template>
  <div id="app">
    <!-- 顶部导航栏 - 登录后显示 -->
    <el-header v-if="showHeader" class="app-header">
      <div class="header-content">
        <div class="logo">
          <h2>🎯 LLM需求用例生成系统</h2>
        </div>
        <div class="user-info">
          <span>欢迎，{{ userStore.currentUserName }}</span>
          <el-button @click="handleLogout" type="primary" link>退出登录</el-button>
          <el-button @click="handleDeleteAccount" type="danger" link>注销账号</el-button>
        </div>
      </div>
    </el-header>

    <!-- 主内容区域 -->
    <el-main class="app-main">
      <router-view></router-view>
    </el-main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const globalLoading = ref(false)

// 计算属性
const showHeader = computed(() => {
  return userStore.isAuthenticated && router.currentRoute.value.name !== 'Login'
})

// 生命周期
onMounted(async () => {
  console.log('App.vue挂载完成，当前路由:', router.currentRoute.value.path)
  console.log('用户认证状态:', userStore.isAuthenticated)
  
  // 如果未登录且当前不在登录页，重定向到登录页
  if (!userStore.isAuthenticated && router.currentRoute.value.path !== '/login') {
    console.log('未登录且不在登录页，重定向到登录页')
    router.replace('/login')
  }
  
  // 应用启动时检查会话有效性
  if (userStore.sessionToken) {
    globalLoading.value = true
    try {
      const isValid = await userStore.checkSession()
      if (!isValid) {
        console.log('会话无效，执行登出')
        userStore.logout()
        router.replace('/login')
      }
    } catch (error) {
      console.error('Session check failed:', error)
      userStore.logout()
      router.replace('/login')
    } finally {
      globalLoading.value = false
    }
  }
})

// 方法
const handleLogout = () => {
  console.log('用户点击退出登录')
  userStore.logout()
  router.replace('/login')
}

const handleDeleteAccount = async () => {
  try {
    await ElMessageBox.confirm(
      '注销账号后此账号所有数据将会被删除，是否注销？',
      '确认注销',
      {
        confirmButtonText: '是',
        cancelButtonText: '否',
        type: 'warning',
      }
    );
    
    // 用户确认删除，发送请求到后端删除账户
    try {
      const response = await fetch('/api/users/delete-account', {
        method: 'DELETE',
        headers: {
          'X-Session-Token': userStore.sessionToken
        }
      });

      if (response.ok) {
        const result = await response.json();
        // 删除成功，显示成功消息
        ElMessage.success(result.message || '账户已成功删除');
        
        // 清除本地状态并跳转到登录页
        userStore.logout();
        router.replace('/login');
      } else {
        const error = await response.json();
        // 显示错误消息
        ElMessage.error(error.error || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户请求失败:', error);
      ElMessage.error('网络错误，请稍后重试');
    }
  } catch (error) {
    // 用户取消删除操作，不做任何事情
    console.log('用户取消了删除操作');
  }
}
</script>

<style scoped>
/* 粒子背景效果 */
#app::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(circle, var(--primary-color) 1px, transparent 1px);
  background-size: 50px 50px;
  z-index: -1;
  opacity: 0.1;
  pointer-events: none;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
  background-color: var(--bg-primary);
}

.app-header {
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 0 20px;
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.3s ease;
  border-bottom: 1px solid var(--border-color);
}

.app-header:hover {
  box-shadow: var(--card-shadow-hover);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.logo h2 {
  margin: 0;
  font-weight: 600;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info span {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.app-main {
  flex: 1;
  padding: 0;
  overflow: auto;
  background-color: var(--bg-secondary);
  min-height: 100vh;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app-header {
    padding: 0 10px;
  }
  
  .logo h2 {
   font-size: 1.2rem;
  }
  
  .header-content {
    flex-direction: column;
    height: auto;
    padding: 10px 0;
  }
  
  .user-info {
    margin-top: 10px;
  }
}

/* 全局样式重置 */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--bg-page);
}

/* Element Plus 组件自定义样式 */
.el-button {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.el-button--primary {
  background-color: var(--btn-primary-bg);
  border-color: var(--btn-primary-bg);
}

.el-button--primary:hover {
  background-color: var(--btn-primary-hover);
  border-color: var(--btn-primary-hover);
}

.el-input__inner {
  border-radius: 8px;
  border: 1px solid var(--input-border);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.el-input__inner:focus {
  border-color: var(--input-focus);
  box-shadow: 0 0 0 3px var(--input-focus-shadow);
}

.el-card {
  border-radius: 12px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  transition: box-shadow 0.3s ease;
}

.el-card:hover {
  box-shadow: var(--card-shadow-hover);
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
  transition: background 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

/* 全局文本样式 */
.text-primary {
  color: var(--text-primary);
}

.text-secondary {
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-muted);
}

/* 全局Mermaid样式 */
.mermaid-diagram svg {
  width: 100%;
  height: auto;
  max-width: 100%;
}

.mermaid-diagram .node rect {
  fill: #e8f4ff;
  stroke: var(--primary-color);
  stroke-width: 2px;
}

.mermaid-diagram .node ellipse {
  fill: var(--bg-secondary);
  stroke: var(--primary-color);
  stroke-width: 2px;
}

.mermaid-diagram .edgePath path {
  stroke: #666;
  stroke-width: 2px;
  fill: none;
}

.mermaid-diagram .edgePath marker path {
  fill: #666;
}

.mermaid-diagram .label {
  font-family: Arial, sans-serif;
  font-size: 14px;
  color: #333;
}
</style>