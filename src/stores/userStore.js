import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({//用户状态管理模块的状态
    user: null,//用户名
    sessionToken: localStorage.getItem('sessionToken') || null,//会话令牌
    currentProject: null,//当前项目
    currentUseCase: null,//当前用例
    currentScenario: null,//当前场景
  }),

  getters: {//计算属性
    isAuthenticated: (state) => !!state.sessionToken,//是否登录。！！是双重否定操作。作用是把原来的值转化为布尔值。
    currentUserName: (state) => state.user?.username || '',//当前用户名
    currentProjectId: (state) => state.currentProject?.id || null,//当前项目ID
    currentUseCaseId: (state) => state.currentUseCase?.id || null,//当前用例ID
    currentScenarioId: (state) => state.currentScenario?.id || null,//当前场景ID
  },

  actions: {//方法
    async login(username) {//使用 fetch API 发送 POST 请求到 /api/users/init，包含用户名作为请求体参数
      try {
        console.log('发起登录请求，用户名:', username);
        const response = await fetch('/api/users/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username })
        })

        if (!response.ok) {//如果响应状态码不ok，说明登录失败
          const errorText = await response.text();
          throw new Error(`登录失败: ${response.status} - ${errorText}`);//返回错误信息
        }

        const data = await response.json();
        console.log('登录成功，返回数据:', data);
        
        this.user = data.user;//保存用户信息
        this.sessionToken = data.session.token;//保存会话令牌
        localStorage.setItem('sessionToken', data.session.token);
        //将后端返回的会话令牌（sessionToken）存储到浏览器的本地存储（localStorage）中。
        // 这样，在后续的请求中，客户端可以使用这个令牌来验证会话。
        
        console.log('用户状态更新完成，sessionToken:', this.sessionToken);
        return data;
      } catch (error) {
        console.error('登录失败:', error);
        throw error;
      }
    },

    logout() {
      console.log('执行登出操作');
      this.user = null;
      this.sessionToken = null;
      this.currentProject = null;
      this.currentUseCase = null;
      this.currentScenario = null;
      localStorage.removeItem('sessionToken');
      console.log('登出完成');
    },

    setCurrentProject(project) {//设置当前项目
      //当用户点击某个项目时，需要将当前项目设置为该项目
      //将当前项目设置为该项目的操作就是更改state中的currentProject属性
      this.currentProject = project;
    },

    setCurrentUseCase(useCase) {
      this.currentUseCase = useCase;
    },

    setCurrentScenario(scenario) {
      this.currentScenario = scenario;
    },

    async checkSession() {//检查会话是否有效
      if (!this.sessionToken) {
        console.log('无sessionToken，会话无效');
        return false;
      }
      try {
        const response = await fetch('/api/health', {//使用fetch API 发送 GET 请求到 /api/health，包含会话令牌作为请求头参数
          headers: {
            'X-Session-Token': this.sessionToken
          }
        });
        const isValid = response.ok;
        console.log('会话检查结果:', isValid);
        return isValid;
      } catch (error) {
        console.error('会话检查失败:', error);
        return false;
      }
    }
  }
})
