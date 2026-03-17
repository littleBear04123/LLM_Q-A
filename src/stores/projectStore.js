import { defineStore } from 'pinia'
import { useUserStore } from './userStore'

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [],
    currentUMLCode: '',
    useCases: [],
    isLoading: false,
    currentProject: null
  }),

  getters: {
    hasProjects: (state) => state.projects.length > 0,
    completedUseCases: (state) => state.useCases.filter(uc => uc.status === 'completed'),
    pendingUseCases: (state) => state.useCases.filter(uc => uc.status === 'pending'),
    currentProjectId: (state) => state.currentProject?.id || null
  },

  actions: {
    // 获取用户的所有项目
    async fetchUserProjects() {
      const userStore = useUserStore()
      this.isLoading = true

      try {
        console.log('获取用户项目列表...')
        console.log('当前会话Token:', userStore.sessionToken)
        
        const response = await fetch('/api/projects/user-projects', {
            headers: {
                'X-Session-Token': userStore.sessionToken,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })

        if (!response.ok) {
            if (response.status === 401) {
                // 会话过期，触发重新登录
                userStore.logout()
                throw new Error('会话已过期，请重新登录')
            }
            const errorText = await response.text()
            throw new Error(`获取项目列表失败: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('项目列表响应:', data)
        this.projects = data.projects || []
        return this.projects
      } catch (error) {
        console.error('Fetch projects error:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 创建新项目
    async createProject(projectData) {
      const userStore = useUserStore()
      this.isLoading = true

      try {
        console.log('创建项目:', projectData)
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify(projectData)
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`创建项目失败: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('项目创建响应:', data)
        
        // 将新项目添加到列表开头
        this.projects.unshift(data.project)
        
        // 设置当前项目
        this.currentProject = data.project
        
        return data.project
      } catch (error) {
        console.error('Create project error:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 生成UML用例图
    async generateUML(projectId, requirementText) {
      const userStore = useUserStore()
      this.isLoading = true
      
      try {
        console.log('🔴 ========== UML生成调试开始 ==========')
        console.log('项目ID:', projectId)
        console.log('项目ID类型:', typeof projectId)
        console.log('会话Token:', userStore.sessionToken)
        console.log('当前用户:', userStore.user)
        console.log('需求文本前50字符:', requirementText.substring(0, 50))
        
        // 先获取用户的所有项目，检查项目是否存在
        console.log('获取用户项目列表...')
        await this.fetchUserProjects()
        console.log('用户项目列表:', this.projects)
        
        const targetProject = this.projects.find(p => p.id == projectId)
        console.log('找到的目标项目:', targetProject)
        
        if (!targetProject) {
          console.error('❌ 项目不存在，可用项目ID:', this.projects.map(p => p.id))
          throw new Error(`项目ID ${projectId} 不存在，请选择有效的项目`)
        }

        console.log('调用生成UML API...')
        const response = await fetch(`/api/projects/${projectId}/generate-uml`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': userStore.sessionToken
          },
          body: JSON.stringify({ requirementText })
        })

        console.log('响应状态:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ API响应错误:', errorText)
          throw new Error(`生成UML图失败: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('✅ UML生成成功:', data)
        
        this.currentUMLCode = data.mermaidCode
        // 确保useCases数组结构正确
        this.useCases = Array.isArray(data.useCases) ? data.useCases.map(uc => ({
            id: uc.id || uc.use_case_id,
            use_case_name: uc.use_case_name || uc.name,
            actor: uc.actor,
            description: uc.description,
            status: uc.status || 'pending',
            project_id: uc.project_id || projectId
        })) : []

        console.log('设置的用例数量:', this.useCases.length)
        
        // 更新当前项目
        if (projectId !== 'new') {
          const project = this.projects.find(p => p.id == projectId)
          if (project) {
            project.uml_mermaid_code = data.mermaidCode
          }
        }
        
        return data
      } catch (error) {
        console.error('🔴 Generate UML完整错误:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 获取项目的用例列表
    async fetchUseCases(projectId) {
      const userStore = useUserStore()
      this.isLoading = true

      try {
        console.log('获取项目用例列表，项目ID:', projectId)
        const response = await fetch(`/api/projects/${projectId}/use-cases`, {
          headers: {
            'X-Session-Token': userStore.sessionToken
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`获取用例列表失败: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('用例列表响应:', data)
        this.useCases = Array.isArray(data.useCases) ? data.useCases : []
        return this.useCases
      } catch (error) {
        console.error('Fetch use cases error:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // 设置当前项目（确保数据隔离）
    setCurrentProject(project) {
      this.currentProject = project;
      if (project && project.uml_mermaid_code) {
        this.currentUMLCode = project.uml_mermaid_code;
      } else {
        this.currentUMLCode = '';
      }
      // 切换项目时强制清空用例列表，确保数据隔离
      this.useCases = [];
    },

    // 清空当前状态
    clearCurrentState() {
      this.currentUMLCode = '';
      this.useCases = [];
      this.currentProject = null;
      this.isLoading = false;
    },

    // 更新用例状态
    updateUseCaseStatus(useCaseId, status) {
      const useCase = this.useCases.find(uc => uc.id === useCaseId)
      if (useCase) {
        useCase.status = status
      }
    }
  }
})
