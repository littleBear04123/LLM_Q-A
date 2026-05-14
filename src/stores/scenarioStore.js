import { defineStore } from 'pinia'
import { useUserStore } from './userStore'

export const useScenarioStore = defineStore('scenario', {
  state: () => ({
    currentScenario: {
      projectId: null,
      useCaseId: null,
      useCaseName: null,
      actorName: null
    },
    statusTable: null,
    conversationHistory: [],
    isGenerating: false,
    generatedContent: '',
    currentAssistantResponse: '',  // 用于流式输出
    lastErrorMessage: null,        // 存储最后的错误信息
    lastSuccessMessage: null       // 存储最后的成功信息
  }),

  getters: {
    hasScenario: (state) => !!state.currentScenario,
    completionProgress: (state) => {
      if (!state.statusTable) return 0
      const totalComponents = Object.values(state.statusTable).reduce((total, category) => {
        return total + Object.values(category).length
      }, 0)
      const completedComponents = Object.values(state.statusTable).reduce((completed, category) => {
        return completed + Object.values(category).filter(comp => comp.status === 'collected').length
      }, 0)
      return Math.round((completedComponents / totalComponents) * 100)
    }
  },

  actions: {
    // 切换到新的场景/用例时重置并加载相应的数据
    switchToScenario(projectId, useCaseId, useCaseName, actorName) {
      // 先保存当前场景的数据
      this.saveToStorage();
      
      // 更新当前场景信息
      this.currentScenario = {
        projectId,
        useCaseId,
        useCaseName,
        actorName
      };
      
      // 重新初始化对话历史和状态表
      this.initializeFromStorage();
    },

    // 在用例切换时清空当前数据
    clearCurrentScenarioData() {
      this.conversationHistory = [];
      this.statusTable = null;
      this.currentAssistantResponse = '';
      this.generatedContent = '';
    },
// 发送消息到后端 - 场景对话模式
    async initializeFromStorage() {
      // 构建特定于项目和用例的存储键
      const projectId = this.currentScenario?.projectId;
      const useCaseId = this.currentScenario?.useCaseId;
      
      if (projectId && useCaseId) {
        const storageKey = `scenario_conversation_${projectId}_${useCaseId}`;
        const statusKey = `scenario_status_${projectId}_${useCaseId}`;
        
        // 首先尝试从后端API获取最新的消息历史
        try {
          const userStore = useUserStore();
          const response = await fetch(`/api/scenarios/${useCaseId}/messages`, {
            headers: {
              'X-Session-Token': userStore.sessionToken
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.messages) {
              // 使用从后端获取的消息历史
              this.conversationHistory = data.messages;
            }
          } else {
            console.warn('获取后端消息历史失败，将使用本地存储的数据');
          }
        } catch (error) {
          console.error('获取后端消息历史时出错:', error);
        }
        
        // 如果后端没有数据或获取失败，尝试从localStorage加载对话历史
        if (this.conversationHistory.length === 0) {
          const savedHistory = localStorage.getItem(storageKey);
          if (savedHistory) {
            try {
              this.conversationHistory = JSON.parse(savedHistory);
            } catch (error) {
              console.error('加载对话历史失败:', error);
              this.conversationHistory = [];
            }
          }
        }
        
        // 从localStorage加载状态表（状态表通常不会通过API获取，因为它是实时更新的）
        const savedStatusTable = localStorage.getItem(statusKey);
        if (savedStatusTable) {
          try {
            this.statusTable = JSON.parse(savedStatusTable);
          } catch (error) {
            console.error('加载状态表失败:', error);
            this.statusTable = null;
          }
        }
      }
    },

    // 防抖函数辅助工具
    _debouncedSaveTimer: null,
    
    // 带防抖的保存方法
    debouncedSaveToStorage() {
      // 清除之前的计时器
      if (this._debouncedSaveTimer) {
        clearTimeout(this._debouncedSaveTimer);
      }
      
      // 设置新的计时器，延迟500毫秒执行
      this._debouncedSaveTimer = setTimeout(() => {
        this.saveToStorage();
      }, 500);
    },
    
    saveToStorage() {
      // 构建特定于项目和用例的存储键
      const projectId = this.currentScenario?.projectId;
      const useCaseId = this.currentScenario?.useCaseId;
      
      if (projectId && useCaseId) {
        const storageKey = `scenario_conversation_${projectId}_${useCaseId}`;
        const statusKey = `scenario_status_${projectId}_${useCaseId}`;
        
        // 保存对话历史到localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(this.conversationHistory));
        } catch (error) {
          console.error('保存对话历史失败:', error);
        }
        
        // 保存状态表到localStorage
        try {
          localStorage.setItem(statusKey, JSON.stringify(this.statusTable));
        } catch (error) {
          console.error('保存状态表失败:', error);
        }
      }
    },
    // 发送消息到后端
    async sendMessage(message) {
      const userStore = useUserStore()
      this.isGenerating = true
      this.lastErrorMessage = null;  // 清除之前的错误信息
      
      try {
        // 保存用户消息
        this.conversationHistory.push({ role: 'user', content: message })
        
        // 准备请求数据，包含上下文信息
        const requestData = {
          message,
          context: {
            projectId: this.currentScenario?.projectId,
            useCaseId: this.currentScenario?.useCaseId,
            useCaseName: this.currentScenario?.useCaseName,
            actorName: this.currentScenario?.actorName
          }
        };
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify(requestData)
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `API请求失败: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }
        const data = await response.json()
        // 直接使用后端返回的已处理过的响应内容（不包含状态表等内部信息）
        const userVisibleResponse = data.response || data.reply || '';
        // 创建助手消息占位符
        const assistantMsgIndex = this.conversationHistory.length
        this.conversationHistory.push({ role: 'assistant', content: '' })
        
        // 逐字符模拟流式输出（仅用户可见部分）
        for (let i = 0; i <= userVisibleResponse.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 20)); // 控制输出速度
          this.conversationHistory[assistantMsgIndex].content = userVisibleResponse.substring(0, i);
          // 更新流式输出显示，但不直接添加到历史记录中以避免重复
          this.currentAssistantResponse = userVisibleResponse.substring(0, i);
        }
        
        // 仍然保存完整状态表用于进度计算，但不影响用户看到的内容
        if (data.statusTable) {
          this.statusTable = data.statusTable
        } else {
          // 如果API没有返回状态表，给出提示信息
          console.warn('API未返回状态表信息，可能会影响进度跟踪');
        }
        
        // 保存到本地存储（使用防抖机制以提高性能）
        this.debouncedSaveToStorage();
        
        // 设置成功消息
        this.lastSuccessMessage = '消息发送成功';
        
        return data
      } catch (error) {
        console.error('Send message error:', error)
        this.lastErrorMessage = error.message || '发送消息失败';
        throw error
      } finally {
        this.isGenerating = false
        this.currentAssistantResponse = ''  // 重置流式输出内容
      }
    },
// 发送消息到后端 - 场景对话模式
    async generateScenario(projectId, useCaseId, title, initialInput) {
      const userStore = useUserStore()
      this.isGenerating = true
      try {
        // 首先获取或创建场景ID，以便后端能够获取对应的状态表
        const scenarioData = {
          projectId,
          useCaseId,
          title,
          initialInput
        };
        
        // 如果有对话历史，也传递这些信息
        if (this.conversationHistory && this.conversationHistory.length > 0) {
          scenarioData.conversationHistory = this.conversationHistory;
        }
        
        const response = await fetch('/api/scenarios/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify(scenarioData)
        })
        if (!response.ok) throw new Error('生成场景失败')
        const data = await response.json()
        this.generatedContent = data.scenario
        return data
      } catch (error) {
        console.error('Generate scenario error:', error)
        throw error
      } finally {
        this.isGenerating = false
      }
    },
// 发送消息到后端 - 简单场景对话模式
    async generateSimpleScenario(projectId, useCaseId, title, initialInput) {
      const userStore = useUserStore()
      this.isGenerating = true
      try {
        const response = await fetch('/api/scenarios/generate-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify({
            projectId,
            useCaseId,
            title,
            initialInput
          })
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '生成场景失败' }))
          throw new Error(errorData.error || '生成场景失败')
        }
        const data = await response.json()
        this.generatedContent = data.scenario
        return data
      } catch (error) {
        console.error('Generate simple scenario error:', error)
        throw error
      } finally {
        this.isGenerating = false
      }
    },
// 统计已收集的项目数量
    clearConversation() {
      this.conversationHistory = []
      this.statusTable = null
      this.generatedContent = ''
      
      // 清除本地存储
      const projectId = this.currentScenario?.projectId;
      const useCaseId = this.currentScenario?.useCaseId;
      
      if (projectId && useCaseId) {
        const storageKey = `scenario_conversation_${projectId}_${useCaseId}`;
        const statusKey = `scenario_status_${projectId}_${useCaseId}`;
        
        localStorage.removeItem(storageKey);
        localStorage.removeItem(statusKey);
      }
    },
    
    // 保存编辑后的场景内容到服务器
    async saveEditedScenario() {
      const userStore = useUserStore();
      const projectId = this.currentScenario?.projectId;
      const useCaseId = this.currentScenario?.useCaseId;
      
      if (!projectId || !useCaseId) {
        throw new Error('缺少项目ID或用例ID，无法保存场景');
      }
      
      try {
        const response = await fetch('/api/scenarios/save-edited', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify({
            projectId: parseInt(projectId),
            useCaseId: parseInt(useCaseId),
            content: this.generatedContent
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '保存编辑的场景失败' }));
          throw new Error(errorData.error || '保存编辑的场景失败');
        }
        
        const data = await response.json();
        this.lastSuccessMessage = '场景已保存';
        return data;
      } catch (error) {
        console.error('保存编辑的场景失败:', error);
        this.lastErrorMessage = error.message || '保存编辑的场景失败';
        throw error;
      }
    }
  }
})