<template>
  <div class="requirement-input">
    <h3>需求输入</h3>
    
    <!-- 项目选择/创建 -->
    <div class="project-section">
      <div class="project-select-container">
        <el-select 
          v-model="selectedProject" 
          placeholder="选择现有项目"
          style="width: 100%; margin-bottom: 15px;"
          @change="handleProjectChange"
          :loading="loadingProjects"
        >
          <el-option
            v-for="project in projects"
            :key="project.id"
            :label="project.project_name"
            :value="project.id"
          >
            <div class="project-option">
              <span class="project-name">{{ project.project_name }}</span>
              <el-button 
                type="danger" 
                size="small"
                circle
                @click.prevent="confirmDeleteProject(project.id)"
                style="margin-left: 10px; padding: 4px;"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </el-option>
        </el-select>
      </div>
      
      <el-button 
        type="primary" 
        link 
        @click="showCreateDialog = true"
      >
        + 创建新项目
      </el-button>
    </div>

    <!-- 需求输入区域 -->
    <div class="input-section">
      <el-input
        v-model="requirementText"
        type="textarea"
        :rows="8"
        placeholder="请输入详细的需求描述，例如：我需要一个图书馆管理系统，包含图书借阅、归还、查询等功能..."
        resize="none"
      />
      
      <div class="action-buttons">
        <el-button 
          type="primary" 
          :loading="loading"
          :disabled="!requirementText.trim()"
          @click="handleGenerateWithCurrentProject"
          style="width: 100%;"
        >
          {{ loading ? '生成中...' : '生成UML用例图' }}
        </el-button>
      </div>
    </div>

    <!-- 创建项目对话框 - 重构 -->
    <el-dialog v-model="showCreateDialog" title="创建新项目" width="600px">
      <el-form :model="newProjectForm" label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input v-model="newProjectForm.name" placeholder="例如：图书馆管理系统" />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input v-model="newProjectForm.description" type="textarea" :rows="2" placeholder="项目描述（可选）" />
        </el-form-item>
        <el-form-item label="需求描述" required>
          <el-input 
            v-model="newProjectForm.requirementText" 
            type="textarea" 
            :rows="6" 
            placeholder="请输入详细的需求描述..."
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleCreateAndGenerate"
          :disabled="!newProjectForm.name.trim() || !newProjectForm.requirementText.trim()"
        >
          创建并生成UML
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import { useUserStore } from '../stores/userStore'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps({
  loading: Boolean
})

const emit = defineEmits(['create-project', 'generate-uml', 'reload-projects', 'project-change'])

const projectStore = useProjectStore()
const userStore = useUserStore()

// 响应式数据
const selectedProject = ref('')
const requirementText = ref('')
const showCreateDialog = ref(false)
const loadingProjects = ref(false)
const newProjectForm = ref({
  name: '',
  description: '',
  requirementText: ''
})

// 计算属性
const projects = computed(() => {
  return projectStore.projects || []
})

// 生命周期
onMounted(async () => {
  await loadProjects()
})

// 监听项目列表变化
watch(() => projectStore.projects, (newProjects) => {
  if (newProjects.length > 0 && !selectedProject.value) {
    // 默认选择第一个项目
    selectedProject.value = newProjects[0].id
    handleProjectChange(newProjects[0].id)
  }
})

// 方法
const loadProjects = async () => {
  loadingProjects.value = true
  try {
    await projectStore.fetchUserProjects()
  } catch (error) {
    console.error('加载项目失败:', error)
  } finally {
    loadingProjects.value = false
  }
}

const handleProjectChange = async (projectId) => {
  console.log('选择项目:', projectId)
  const project = projects.value.find(p => p.id == projectId)
  if (project) {
    // 设置当前项目
    projectStore.setCurrentProject(project)
    // 填充需求文本框
    requirementText.value = project.requirement_text || ''
    // 触发项目切换事件
    emit('project-change', projectId)
    
    // 加载该项目的用例
    try {
      await projectStore.fetchUseCases(projectId)
    } catch (error) {
      console.error('加载用例失败:', error)
    }
  }
}

// 创建项目并生成UML
const handleCreateAndGenerate = async () => {
  if (!newProjectForm.value.name.trim()) {
    alert('请输入项目名称')
    return
  }
  
  if (!newProjectForm.value.requirementText.trim()) {
    alert('请输入需求描述')
    return
  }
  
  try {
    // 创建新项目
    const projectData = {
      projectName: newProjectForm.value.name.trim(),
      description: newProjectForm.value.description.trim(),
      requirementText: newProjectForm.value.requirementText
    }
    
    console.log('创建新项目:', projectData)
    emit('create-project', projectData)
    
    showCreateDialog.value = false
    // 清空表单
    newProjectForm.value = { 
      name: '', 
      description: '', 
      requirementText: '' 
    }
    
  } catch (error) {
    console.error('创建项目失败:', error)
    alert('创建项目失败: ' + error.message)
  }
}

// 使用当前选中项目生成（或新建项目）
const handleGenerateWithCurrentProject = async () => {
  if (!requirementText.value.trim()) {
    alert('请输入需求描述')
    return
  }
  
  if (selectedProject.value) {
    // 使用现有项目生成
    emit('generate-uml', selectedProject.value, requirementText.value)
  } else {
    // 没有选中项目，弹出创建项目对话框
    showCreateDialog.value = true
    // 将主输入框的内容复制到对话框
    newProjectForm.value.requirementText = requirementText.value
  }
}

// 确认删除项目
const confirmDeleteProject = async (projectId) => {
  if (!projectId) {
    ElMessage.warning('请选择要删除的项目');
    return;
  }

  try {
    await ElMessageBox.confirm(
      '删除项目后，该项目下的所有用例、场景和对话记录都将被永久删除，是否继续？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 执行删除操作
    await deleteProject(projectId);
  } catch (error) {
    // 用户取消删除操作
    console.log('用户取消了删除操作');
  }
}

// 删除项目
const deleteProject = async (projectId) => {
  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'X-Session-Token': userStore.sessionToken
      }
    });

    if (response.ok) {
      const result = await response.json();
      ElMessage.success(result.message || '项目删除成功');
      
      // 重新加载项目列表
      await loadProjects();
      
      // 如果删除的是当前选中的项目，清除选择
      if (selectedProject.value === projectId) {
        selectedProject.value = '';
        requirementText.value = '';
        projectStore.clearCurrentState(); // 清空当前项目状态
      }
      
      // 触发项目列表更新事件
      emit('reload-projects');
    } else {
      const error = await response.json();
      ElMessage.error(error.error || '删除项目失败');
    }
  } catch (error) {
    console.error('删除项目请求失败:', error);
    ElMessage.error('网络错误，请稍后重试');
  }
}
</script>

<style scoped>
.requirement-input {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.project-section {
  margin-bottom: 20px;
}

.input-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h3 {
  margin: 0 0 20px 0;
  color: #303133;
  border-bottom: 2px solid #409eff;
  padding-bottom: 10px;
}

.project-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.project-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>