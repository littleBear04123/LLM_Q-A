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

    initializeFromStorage() {
      // 构建特定于项目和用例的存储键
      const projectId = this.currentScenario?.projectId;
      const useCaseId = this.currentScenario?.useCaseId;
      
      if (projectId && useCaseId) {
        const storageKey = `scenario_conversation_${projectId}_${useCaseId}`;
        const statusKey = `scenario_status_${projectId}_${useCaseId}`;
        
        // 从localStorage加载对话历史
        const savedHistory = localStorage.getItem(storageKey);
        if (savedHistory) {
          try {
            this.conversationHistory = JSON.parse(savedHistory);
          } catch (error) {
            console.error('加载对话历史失败:', error);
            this.conversationHistory = [];
          }
        }
        
        // 从localStorage加载状态表
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
        
        // 从完整回复中提取用户可见部分，过滤掉内部状态表信息和格式符号
        const fullResponse = data.reply || '';
        let userVisibleResponse = fullResponse;
        
        // 检查回复是否包含状态表标记
        const statusMarkers = ['【行动者领域】', '【意图领域】', '【任务领域】', '【环境领域】', '【沟通领域】'];
        let hasStatusTable = false;
        let firstMarkerIndex = -1;
        
        for (const marker of statusMarkers) {
          const markerIndex = userVisibleResponse.indexOf(marker);
          if (markerIndex !== -1) {
            hasStatusTable = true;
            if (firstMarkerIndex === -1 || markerIndex < firstMarkerIndex) {
              firstMarkerIndex = markerIndex;
            }
          }
        }
        
        // 如果存在状态表标记且不在开头，则截取前面的内容；否则显示全部内容
        if (hasStatusTable && firstMarkerIndex > 0) {
            userVisibleResponse = userVisibleResponse.substring(0, firstMarkerIndex).trim();
        } else if (hasStatusTable && firstMarkerIndex === 0) {
            // 如果状态表标记在开头，显示完整回复，因为可能AI先返回状态表再返回问题
            userVisibleResponse = fullResponse;
        }
        
        // 确保至少显示一些内容，即使过滤后为空
        if (!userVisibleResponse.trim()) {
            userVisibleResponse = fullResponse.substring(0, 300); // 显示前300个字符作为后备
        }
        
        // 清理格式符号，提升用户阅读体验
        // 移除星号
        userVisibleResponse = userVisibleResponse.replace(/\*/g, '');
        // 只移除连续的空行，保留有意义的换行
        userVisibleResponse = userVisibleResponse.replace(/\n\s*\n/g, '\n\n');
        // 清理每行开头和结尾的空白字符
        userVisibleResponse = userVisibleResponse.split('\n').map(line => line.trim()).join('\n');
        // 最后清理首尾空白
        userVisibleResponse = userVisibleResponse.trim();
        
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

    async generateScenario(projectId, useCaseId, title, initialInput) {
      const userStore = useUserStore()
      this.isGenerating = true
      try {
        const response = await fetch('/api/generate', {
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

    async generateSimpleScenario(projectId, useCaseId, title, initialInput) {
      const userStore = useUserStore()
      this.isGenerating = true
      try {
        const response = await fetch('/api/generate-simple', {
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