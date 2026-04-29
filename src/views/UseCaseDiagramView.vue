<template>
  <div class="use-case-diagram-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>用例图生成</h1>
      <p>输入需求描述，系统将自动生成UML用例图</p>
    </div>

    <!-- 三栏布局 - 垂直占满高度 -->
    <div class="three-column-layout">
      <!-- 左侧：需求输入 -->
      <div class="left-panel">
        <RequirementInput 
          @create-project="handleCreateProject"
          @generate-uml="handleGenerateUML"
          @reload-projects="handleReloadProjects"
          @project-change="handleProjectChange"
          :loading="projectStore.isLoading"
        />
      </div>

      <!-- 中间：UML图表展示 -->
      <div class="center-panel">
        <UMLDiagram 
          :plant-uml-code="projectStore.currentUMLCode"
          :loading="projectStore.isLoading"
          :use-cases="projectStore.useCases"
          @use-case-click="handleUseCaseClick"
        />
      </div>

      <!-- 右侧：用例列表 -->
      <div class="right-panel">
        <UseCaseList 
          :use-cases="projectStore.useCases"
          :loading="projectStore.isLoading"
          @use-case-select="handleUseCaseSelect"
        />
      </div>
    </div>

    <!-- 底部功能区 -->
    <div class="bottom-panel">
      <div class="panel-content">
        <p>此处可添加相关说明或备注</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { useUserStore } from '../stores/userStore'
import { useRouter } from 'vue-router'
import RequirementInput from '../components/RequirementInput.vue'
import UMLDiagram from '../components/UMLDiagram.vue'
import UseCaseList from '../components/UseCaseList.vue'

const projectStore = useProjectStore()
const userStore = useUserStore()
const router = useRouter()

// 生命周期
onMounted(async () => {
  console.log('UseCaseDiagramView mounted')
  try {
    await projectStore.fetchUserProjects()
    console.log('项目列表加载完成:', projectStore.projects)
    
    // 如果有项目，默认选择第一个
    if (projectStore.projects.length > 0) {
      const firstProject = projectStore.projects[0]
      projectStore.setCurrentProject(firstProject)
      // 加载第一个项目的用例
      await projectStore.fetchUseCases(firstProject.id)
    } else {
      // 新用户或没有项目时清空状态
      projectStore.clearCurrentState()
    }
  } catch (error) {
    console.error('加载项目列表失败:', error)
    projectStore.clearCurrentState()
  }
})

// 事件处理
const handleCreateProject = async (projectData) => {
  try {
    const project = await projectStore.createProject(projectData)
    console.log('项目创建成功:', project)
    
    // 项目创建后自动生成UML
    await handleGenerateUML(project.id, projectData.requirementText)
    
    // 重新加载项目列表以更新下拉框
    await projectStore.fetchUserProjects()
    
    // 选中新创建的项目
    projectStore.setCurrentProject(project)
    await projectStore.fetchUseCases(project.id)
    
  } catch (error) {
    console.error('创建项目失败:', error)
    alert('创建项目失败: ' + error.message)
  }
}

const handleGenerateUML = async (projectId, requirementText) => {
  try {
    console.log('开始生成UML，项目ID:', projectId)
    const result = await projectStore.generateUML(projectId, requirementText)
    console.log('UML生成成功:', result)
  } catch (error) {
    console.error('生成UML失败:', error)
    alert('生成UML失败: ' + error.message)
  }
}

// 项目切换处理 - 修复版本
const handleProjectChange = async (projectId) => {
  try {
    console.log('切换到项目:', projectId)
    
    // 确保切换项目时清空当前状态，防止数据串行
    projectStore.clearCurrentState()
    
    const project = projectStore.projects.find(p => p.id == projectId)
    if (project) {
      projectStore.setCurrentProject(project)
      
      // 如果项目已有UML代码，设置当前UML代码
      if (project.uml_plantuml_code) {
        projectStore.currentUMLCode = project.uml_plantuml_code
      }
    }
    
    // 加载该项目的用例
    await projectStore.fetchUseCases(projectId)
    
    console.log('项目切换完成，当前用例数量:', projectStore.useCases.length)
  } catch (error) {
    console.error('切换项目失败:', error)
    // 切换失败时也清空状态
    projectStore.clearCurrentState()
  }
}

// 添加重新加载项目的方法
const handleReloadProjects = async () => {
  try {
    await projectStore.fetchUserProjects()
    console.log('项目列表重新加载完成:', projectStore.projects)
  } catch (error) {
    console.error('重新加载项目失败:', error)
  }
}

const handleUseCaseClick = (useCase) => {
  console.log('点击用例:', useCase)
  // 跳转到场景生成页面
  const projectId = projectStore.currentProject?.id || userStore.currentProjectId
  if (!projectId) {
    console.error('无法确定项目ID')
    return
  }
  router.push(`/scenario/${projectId}/${useCase.id}`)
}

const handleUseCaseSelect = (useCase) => {
  console.log('选择用例:', useCase)
}
</script>

<style scoped>
/* 粒子背景效果 */
.use-case-diagram-view::before {
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

.use-case-diagram-view {
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  height: 100vh;
  overflow: hidden;
}

.page-header {
  margin-bottom: 20px;
  text-align: center;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
}

.page-header p {
  margin: 10px 0 0 0;
  color: #64748b;
}

.three-column-layout {
  display: grid;
  grid-template-columns: 300px 1fr 300px;
  gap: 20px;
  flex: 1;
  min-height: 70vh;
}

.left-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  padding: 20px;
  overflow: auto;
  height: 70vh;
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.right-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  padding: 20px;
  overflow: auto;
  height: 70vh;
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.center-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  padding: 20px;
  overflow: auto;
  height: 70vh;
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.left-panel:hover, .center-panel:hover, .right-panel:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

/* 底部面板样式 */
.bottom-panel {
  margin-top: 20px;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.bottom-panel:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.panel-content p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .three-column-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .left-panel, .center-panel, .right-panel {
    min-height: 200px;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>