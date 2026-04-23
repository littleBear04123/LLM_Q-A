<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>欢迎使用LLM需求用例生成系统</h2>
          <p>请输入用户名开始使用</p>
        </div>
      </template>
      
      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input 
            v-model="username"
            placeholder="请输入用户名"
            size="large"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-button 
          type="primary" 
          size="large" 
          @click="handleLogin" 
          :loading="loading"
          style="width: 100%;"
        >
          {{ loading ? '登录中...' : '开始使用' }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/userStore';
import { useRouter } from 'vue-router';
import { User } from '@element-plus/icons-vue';

const username = ref('');//用户名输入框的值，与第15行代码有关
//ref 函数会创建一个包含 value 属性的对象，这个 value 属性是响应式的。
// 当用户输入用户名时，username.value会自动更新为用户输入的用户名
const loading = ref(false);
const userStore = useUserStore();
const router = useRouter();

console.log('LoginView组件加载完成');

onMounted(() => {// 检查是否已登录，页面一挂载就执行此函数。
  if (userStore.isAuthenticated) {
    console.log('已登录，自动跳转到项目页')
    router.push('/projects');
  }
});

const handleLogin = async () => {//async函数，用于处理登录操作，等待登录API返回
  console.log('点击登录按钮，用户名:', username.value);
  
  if (!username.value.trim()) {
    console.log('用户名为空，显示错误');
    alert('请输入用户名');
    return;
  }
  
  loading.value = true;
  console.log('开始登录请求...');
  
  try {
    const result = await userStore.login(username.value);//这个函数在userStore.js中定义，用于登录用户
    console.log('登录API返回:', result);
    
    alert('登录成功！');
    console.log('准备跳转到/projects');
    
    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 使用replace而不是push，避免浏览器后退按钮问题
    router.replace('/projects');
    console.log('路由跳转指令已发送');
    
  } catch (error) {
    console.error('登录失败:', error);
    alert('登录失败：' + error.message);
  } finally {
    loading.value = false;
    console.log('登录流程结束');
  }
};
</script>

<style scoped>
/* 粒子背景效果 */
.login-container::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(circle, #61BFAD 1px, transparent 1px);
  background-size: 50px 50px;
  z-index: -1;
  opacity: 0.1;
  pointer-events: none;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f5f5;
  position: relative;
}

.login-card {
  width: 400px;
  max-width: 90vw;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.login-card:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
}

.login-header h2 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-weight: 600;
}

.login-header p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}
</style>