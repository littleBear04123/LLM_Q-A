import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/userStore'

const LoginView = () => import('../views/LoginView.vue')
const UseCaseDiagramView = () => import('../views/UseCaseDiagramView.vue')
const ScenarioView = () => import('../views/ScenarioView.vue')


const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { 
      requiresAuth: false,
      title: '登录 - LLM需求用例生成系统'
    }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: UseCaseDiagramView,
    meta: { 
      requiresAuth: true,
      title: '项目管理 - LLM用例生成系统'
    }
  },
  {
    path: '/scenario/:projectId/:useCaseId',
    name: 'Scenario',
    component: ScenarioView,
    meta: { 
      requiresAuth: true,
      title: '场景生成 - LLM用例生成系统'
    },
    props: true
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }
  
  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    if (userStore.isAuthenticated && userStore.sessionToken) {
      // 已登录，允许访问
      console.log('已登录，允许访问:', to.path)
      next()
    } else {
      // 未登录，重定向到登录页
      console.log('未登录，重定向到登录页，目标路径:', to.path)
      next('/login')
    }
  } else {
    // 不需要认证的页面（如登录页）
    if (to.path === '/login' && userStore.isAuthenticated) {
      // 如果已登录但访问登录页，重定向到项目页
      console.log('已登录但访问登录页，重定向到项目页')
      next('/projects')
    } else {
      next()
    }
  }
})

export default router
