import { createApp } from 'vue'
import { createPinia } from 'pinia'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/variables.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 等待路由准备就绪后再挂载应用
router.isReady().then(() => {
  console.log('路由准备就绪，挂载应用');
  app.mount('#app');
}).catch(error => {
  console.error('路由准备失败:', error);
});