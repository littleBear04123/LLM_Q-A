import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    sessionToken: localStorage.getItem('sessionToken') || null,
    currentProject: null,
    currentUseCase: null,
    currentScenario: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.sessionToken,
    currentUserName: (state) => state.user?.username || '',
    currentProjectId: (state) => state.currentProject?.id || null,
    currentUseCaseId: (state) => state.currentUseCase?.id || null
  },

  actions: {
    async login(username) {
      try {
        console.log('发起登录请求，用户名:', username);
        const response = await fetch('/api/users/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username })
        })

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`登录失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('登录成功，返回数据:', data);
        
        this.user = data.user;
        this.sessionToken = data.session.token;
        localStorage.setItem('sessionToken', data.session.token);
        
        console.log('用户状态更新完成，sessionToken:', this.sessionToken);
        return data;
      } catch (error) {
        console.error('Login error:', error);
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

    setCurrentProject(project) {
      this.currentProject = project;
    },

    setCurrentUseCase(useCase) {
      this.currentUseCase = useCase;
    },

    setCurrentScenario(scenario) {
      this.currentScenario = scenario;
    },

    async checkSession() {
      if (!this.sessionToken) {
        console.log('无sessionToken，会话无效');
        return false;
      }
      try {
        const response = await fetch('/api/health', {
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
