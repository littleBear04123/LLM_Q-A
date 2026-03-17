<template>
  <div class="scenario-view">
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <button @click="goBack" class="back-btn">← 返回用例图</button>
          <div>
            <h1>场景细化</h1>
            <p>为选定的用例生成详细场景描述</p>
          </div>
        </div>
      </div>
    </div>

    <div class="scenario-content">
      <div class="use-case-info">
        <h2>当前用例: {{ useCaseName }}</h2>
        <p>参与者: {{ actorName }}</p>
        <p>项目ID: {{ projectId }}</p>
        <p>用例ID: {{ useCaseId }}</p>
      </div>

      <div class="scenario-generation-area">
        <div class="chat-area">
          <h3>
            引导式提问
            <span class="progress-display" v-if="scenarioStore.statusTable">
              （当前进度：领域进度 {{ domainProgress.domains.completed }}/{{ domainProgress.domains.total }}，细节进度 {{ domainProgress.details.completed }}/{{ domainProgress.details.total }}）
            </span>
          </h3>
          <div class="chat-messages" ref="chatContainer">
            <!-- 显示错误信息 -->
            <div 
              v-if="scenarioStore.lastErrorMessage"
              class="message-bubble error"
              @click="scenarioStore.lastErrorMessage = null"
            >
              <strong>错误:</strong>
              <div class="message-content">{{ scenarioStore.lastErrorMessage }}</div>
            </div>
            
            <!-- 显示对话历史 -->
            <div 
              v-for="(msg, index) in scenarioStore.conversationHistory" 
              :key="index" 
              :class="['message-bubble', msg.role === 'user' ? 'user' : 'assistant']"
            >
              <strong>{{ msg.role === 'user' ? '' : '系统:' }}</strong>
              <div class="message-content">{{ msg.content }}</div>
            </div>
            
            <!-- 流式输出指示器 -->
            <div 
              v-if="scenarioStore.isGenerating && scenarioStore.currentAssistantResponse &&
                   (scenarioStore.conversationHistory.length === 0 || 
                    scenarioStore.conversationHistory[scenarioStore.conversationHistory.length - 1].role !== 'assistant' ||
                    scenarioStore.conversationHistory[scenarioStore.conversationHistory.length - 1].content !== scenarioStore.currentAssistantResponse)"
              class="message-bubble assistant streaming-response"
            >
              <strong>系统:</strong>
              <div class="message-content">
                <span class="streaming-text">{{ scenarioStore.currentAssistantResponse }}</span>
                <span class="typing-indicator">▍</span>
              </div>
            </div>
            
            <!-- 思考中指示器 -->
            <div 
              v-else-if="scenarioStore.isGenerating && !scenarioStore.currentAssistantResponse" 
              class="message-bubble assistant thinking"
            >
              <strong>系统:</strong>
              <div class="message-content">
                <span class="thinking-text">思考中...</span>
              </div>
            </div>
            
            <!-- 如果没有对话历史，显示初始提示 -->
            <div v-if="scenarioStore.conversationHistory.length === 0 && !scenarioStore.isGenerating" class="system-message">
              <div class="message-bubble system">
                <p>您好，我是您的需求工程顾问。请告诉我您想设计什么场景？比如'用户登录系统'、'客户下单购买'或'员工提交报销'。我会通过提问帮助您完善这个场景的细节，最后生成完整的场景文档。</p>
              </div>
            </div>
          </div>
          
          <div class="input-area">
            <div class="input-combined">
              <textarea 
                v-model="userInput" 
                placeholder="请输入您的回答..." 
                rows="3"
                class="input-textarea"
                :disabled="scenarioStore.isGenerating"
              ></textarea>
              <div class="input-controls">
                <button 
                  @click="sendResponse" 
                  class="send-btn" 
                  :disabled="scenarioStore.isGenerating || !userInput.trim()"
                >
                  <span v-if="scenarioStore.isGenerating">发送中...</span>
                  <span v-else>发送</span>
                </button>
              </div>
            </div>
            <div v-if="scenarioStore.isGenerating" class="loading-indicator">
              AI正在思考...
            </div>
          </div>
        </div>

        <div class="scenario-preview">
          <h3>场景预览</h3>
          <div class="preview-content">
            <div v-if="scenarioStore.generatedContent">
              <h4>生成的场景:</h4>
              <pre class="generated-scenario">{{ scenarioStore.generatedContent }}</pre>
            </div>
            <div v-else-if="scenarioStore.isGenerating" class="generating-state">
              <p>正在生成场景，请稍候...</p>
            </div>
            <div v-else>
              <p>场景将在您完成引导式提问后生成...</p>
            </div>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <!-- 生成场景按钮（可选择是否进行对话） -->
        <button 
          @click="generateScenarioWithOptions" 
          class="primary-btn"
          :disabled="scenarioStore.isGenerating"
        >
          <span v-if="scenarioStore.isGenerating">生成中...</span>
          <span v-else>生成场景</span>
        </button>
        
        <!-- 根据对话生成场景的按钮，只有在状态表信息完整时才可点击 -->
        <button 
          @click="generateScenarioFromDialog" 
          class="primary-btn"
          :disabled="!isScenarioReady || scenarioStore.isGenerating"
          title="状态表信息完整后方可使用"
        >
          根据对话生成场景
        </button>
        
        <button 
          @click="regenerateScenario" 
          class="secondary-btn" 
          v-if="scenarioStore.generatedContent"
          :disabled="scenarioStore.isGenerating"
        >
          重新生成场景
        </button>
        <button 
          @click="saveScenario" 
          class="success-btn" 
          v-if="scenarioStore.generatedContent"
          :disabled="scenarioStore.isGenerating"
        >
          保存场景
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { useProjectStore } from '../stores/projectStore'
import { useScenarioStore } from '../stores/scenarioStore'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const scenarioStore = useScenarioStore()

const chatContainer = ref(null)
const projectId = computed(() => route.params.projectId)
const useCaseId = computed(() => route.params.useCaseId)

const useCaseName = ref('')
const actorName = ref('')
const userInput = ref('')

// 加载用例信息
const loadUseCaseInfo = async () => {
  try {
    // 获取项目信息
    await projectStore.fetchUserProjects()
    
    // 查找当前用例信息 - 优先从当前项目用例列表中查找
    const currentUseCaseFromStore = projectStore.useCases.find(uc => uc.id == useCaseId.value)
    if (currentUseCaseFromStore) {
      useCaseName.value = currentUseCaseFromStore.use_case_name || currentUseCaseFromStore.name
      actorName.value = currentUseCaseFromStore.actor
    } else {
      // 如果当前store中没有找到，获取该项目的完整用例列表
      const useCases = await projectStore.fetchUseCases(projectId.value)
      const currentUseCase = useCases.find(uc => uc.id == useCaseId.value)
      
      if (currentUseCase) {
        useCaseName.value = currentUseCase.use_case_name || currentUseCase.name
        actorName.value = currentUseCase.actor
      } else {
        // 如果仍然找不到，使用默认值
        useCaseName.value = '未知用例'
        actorName.value = '未知参与者'
      }
    }
    
    // 切换到新的场景/用例，这会自动处理对话历史的隔离
    scenarioStore.switchToScenario(
      projectId.value,
      useCaseId.value,
      useCaseName.value,
      actorName.value
    )
  } catch (error) {
    console.error('加载用例信息失败:', error)
    useCaseName.value = '未知用例'
    actorName.value = '未知参与者'
  }
}

// 计算领域进度和细节进度
const domainProgress = computed(() => {
  if (!scenarioStore.statusTable) return { domains: { completed: 0, total: 5 }, details: { completed: 0, total: 29 } };
  
  console.log('状态表内容:', scenarioStore.statusTable); // 调试信息
  
  let completedDomains = 0;
  let totalItems = 0;
  let completedItems = 0;
  
  // 适配后端返回的状态表结构
  const statusTable = scenarioStore.statusTable;
  
  // 遍历所有领域
  const categories = Object.keys(statusTable);
  console.log('领域列表:', categories); // 调试信息
  
  for (const category of categories) {
    console.log('处理领域:', category); // 调试信息
    let domainComplete = true;
    const components = statusTable[category];
    
    if (components && typeof components === 'object') {
      const componentKeys = Object.keys(components);
      console.log('领域', category, '包含的组件:', componentKeys); // 调试信息
      
      for (const item of componentKeys) {
        const component = components[item];
        console.log('处理项目:', item, component); // 调试信息
        totalItems++;
        if (component && component.status === 'collected') {
          completedItems++;
          console.log('项目已收集:', item); // 调试信息
        } else {
          domainComplete = false;
          console.log('项目未收集:', item); // 调试信息
        }
      }
      
      if (domainComplete) {
        completedDomains++;
        console.log('领域完成:', category); // 调试信息
      }
    }
  }
  
  // 确保总项目数至少为29
  const totalDetails = Math.max(totalItems, 29);
  console.log('进度计算结果:', { 
    domains: { completed: completedDomains, total: categories.length },
    details: { completed: completedItems, total: totalDetails }
  }); // 调试信息
  
  return { 
    domains: { completed: completedDomains, total: categories.length },
    details: { completed: completedItems, total: totalDetails }
  };
});

// 计算场景是否准备好生成（状态表信息完整）
const isScenarioReady = computed(() => {
  if (!scenarioStore.statusTable) return false;
  
  // 检查是否有足够的信息来生成场景
  // 至少需要收集一定数量的组件信息
  let collectedCount = 0;
  let totalCount = 0;
  
  const statusTable = scenarioStore.statusTable;
  
  for (const category in statusTable) {
    const components = statusTable[category];
    if (components && typeof components === 'object') {
      for (const item in components) {
        const component = components[item];
        totalCount++;
        if (component && component.status === 'collected') {
          collectedCount++;
        }
      }
    }
  }
  
  console.log('场景准备状态计算:', { collectedCount, totalCount, ready: collectedCount >= 15 }); // 调试信息
  
  // 当至少收集了总数的一定比例（例如 15/29 ≈ 52%）时认为可以生成场景
  // 或者可以根据业务逻辑设定更精确的标准
  return collectedCount >= 15; // 至少需要15个组件的信息
});

// 自动滚动到底部
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// 监听对话历史变化，自动滚动到底部
watch(() => scenarioStore.conversationHistory, () => {
  setTimeout(scrollToBottom, 100)
}, { deep: true })

// 监听scenarioStore中的生成内容
watch(() => scenarioStore.generatedContent, (newContent) => {
  if (newContent) {
    // 这里可以更新界面上的场景内容
    console.log('场景内容已更新:', newContent)
  }
}, { immediate: true })

// 监听路由参数变化，切换用例时重置对话
watch([() => route.params.projectId, () => route.params.useCaseId], async ([newProjectId, newUseCaseId], [oldProjectId, oldUseCaseId]) => {
  // 当项目ID或用例ID发生变化时
  if (newProjectId !== oldProjectId || newUseCaseId !== oldUseCaseId) {
    console.log('检测到用例切换:', { old: { projectId: oldProjectId, useCaseId: oldUseCaseId }, new: { projectId: newProjectId, useCaseId: newUseCaseId } });
    
    // 重置场景状态以清除之前的对话历史
    scenarioStore.clearConversation();
    
    // 更新当前场景信息
    scenarioStore.currentScenario = {
      projectId: newProjectId,
      useCaseId: newUseCaseId,
      useCaseName: useCaseName.value,
      actorName: actorName.value
    };
    
    // 重新加载用例信息
    await loadUseCaseInfo();
  }
}, { immediate: true });

// 初始化时获取用例信息并加载保存的对话
onMounted(async () => {
  // 先加载用例信息以设置currentScenario
  await loadUseCaseInfo()
  
  // 再从本地存储加载之前保存的对话历史和状态
  scenarioStore.initializeFromStorage()
})

// 发送用户回答
const sendResponse = async () => {
  if (!userInput.value.trim()) return
  
  console.log('用户回答:', userInput.value)
  
  try {
    // 调用scenarioStore的sendMessage方法
    await scenarioStore.sendMessage(userInput.value)
    
    // 清空输入框
    userInput.value = ''
  } catch (error) {
    console.error('发送消息失败:', error)
  }
}

// 开始场景生成
const startGeneration = async () => {
  console.log('开始场景生成流程，项目ID:', projectId.value, '用例ID:', useCaseId.value)
  
  try {
    // 重置场景状态
    scenarioStore.clearConversation()
    
    // 获取当前项目名称
    const currentProject = projectStore.projects.find(p => p.id == projectId.value);
    const projectName = currentProject ? currentProject.project_name : '未知项目';
    
    // 构建更丰富的上下文信息
    const contextMessage = `您好，我是您的需求工程顾问。很高兴为您服务。您想完善"${useCaseName.value}"的场景。` +
                          `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                          `我将按照这个场景，向您提出一些问题，请您回答。请开始引导我生成关于'${useCaseName.value}'的详细场景，参与者是${actorName.value}。` +
                          `请重点关注这个特定场景的细节，包括行动者、意图、任务、环境和沟通等方面。`;
    
    // 启动引导式提问流程
    await scenarioStore.sendMessage(contextMessage);
  } catch (error) {
    console.error('开始场景生成失败:', error)
  }
}

// 重新生成场景
const regenerateScenario = async () => {
  console.log('重新生成场景')
  
  try {
    // 重置场景状态
    scenarioStore.clearConversation()
    
    // 获取当前项目名称
    const currentProject = projectStore.projects.find(p => p.id == projectId.value);
    const projectName = currentProject ? currentProject.project_name : '未知项目';
    
    // 构建更丰富的上下文信息
    const contextMessage = `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                          `请重新生成关于'${useCaseName.value}'的场景，我需要一个新的版本。` +
                          `请重点关注这个特定场景的细节，包括行动者、意图、任务、环境和沟通等方面。`;
    
    // 重新开始场景生成流程
    await scenarioStore.sendMessage(contextMessage);
  } catch (error) {
    console.error('重新生成场景失败:', error)
  }
}

// 生成场景（根据用户选择：直接生成或开始引导式提问）
const generateScenarioWithOptions = async () => {
  // 检查用户是否进行了对话
  const userMessages = scenarioStore.conversationHistory.filter(msg => msg.role === 'user');
  const hasConversations = userMessages.length > 0;
  
  if (hasConversations) {
    // 如果已有对话，询问用户是否使用现有对话生成场景
    const useExistingDialog = confirm('您已进行了一些对话，是否使用当前对话内容生成场景？\n\n点击"确定"使用对话内容生成，点击"取消"继续引导式提问。');
    
    if (useExistingDialog) {
      // 使用现有对话内容生成场景
      try {
        // 获取当前项目名称
        const currentProject = projectStore.projects.find(p => p.id == projectId.value);
        const projectName = currentProject ? currentProject.project_name : '未知项目';
        
        // 使用现有对话内容生成场景，不重置对话历史
        const dialogSummary = scenarioStore.conversationHistory
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => `${msg.role === 'user' ? '用户' : '系统'}: ${msg.content}`)
          .join('\n');
        
        // 构建生成场景的提示
        const prompt = `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                      `基于以下对话内容生成详细的场景描述：\n\n${dialogSummary}\n\n` +
                      `请生成一个结构化的场景文档，包含基本流、备选流和异常流。`;
        
        // 使用store方法调用API生成场景
        await scenarioStore.generateSimpleScenario(
          parseInt(projectId.value),
          parseInt(useCaseId.value),
          `Generated Scenario for ${useCaseName.value}`,
          prompt
        );
        
        alert('场景已根据对话生成！');
      } catch (error) {
        console.error('生成场景失败:', error);
      }
    } else {
      // 继续引导式提问
      // 什么都不做，让用户继续对话
      alert('您可以继续与系统对话以完善场景细节。');
    }
  } else {
    // 如果没有对话，直接开始引导式提问
    try {
      // 重置场景状态
      scenarioStore.clearConversation();
      
      // 获取当前项目名称
      const currentProject = projectStore.projects.find(p => p.id == projectId.value);
      const projectName = currentProject ? currentProject.project_name : '未知项目';
      
      // 构建更丰富的上下文信息
      const contextMessage = `您好，我是您的需求工程顾问。很高兴为您服务。您想完善"${useCaseName.value}"的场景。` +
                            `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                            `我将按照这个场景，向您提出一些问题，请您回答。请开始引导我生成关于'${useCaseName.value}'的详细场景，参与者是${actorName.value}。` +
                            `请重点关注这个特定场景的细节，包括行动者、意图、任务、环境和沟通等方面。`;
      
      // 启动引导式提问流程
      await scenarioStore.sendMessage(contextMessage);
    } catch (error) {
      console.error('开始场景生成失败:', error)
    }
  }
}

// 根据对话生成场景（使用状态表信息）
const generateScenarioFromDialog = async () => {
  console.log('根据对话生成场景')
  
  try {
    // 获取当前项目名称
    const currentProject = projectStore.projects.find(p => p.id == projectId.value);
    const projectName = currentProject ? currentProject.project_name : '未知项目';
    
    // 使用当前的对话历史和状态表信息生成场景
    const dialogSummary = scenarioStore.conversationHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => `${msg.role === 'user' ? '用户' : '系统'}: ${msg.content}`)
      .join('\n');
    
    // 构建生成场景的提示
    const prompt = `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                  `基于以下对话内容生成详细的场景描述：\n\n${dialogSummary}\n\n` +
                  `请生成一个结构化的场景文档，包含基本流、备选流和异常流。`;
    
    // 使用store方法调用API生成场景
    await scenarioStore.generateSimpleScenario(
      parseInt(projectId.value),
      parseInt(useCaseId.value),
      `Generated Scenario for ${useCaseName.value}`,
      prompt
    );
    
    alert('场景已根据对话生成！');
  } catch (error) {
    console.error('根据对话生成场景失败:', error)
  }
}

// 提前生成场景
const generateEarlyScenario = async () => {
  // 检查用户是否进行了对话
  const userMessages = scenarioStore.conversationHistory.filter(msg => msg.role === 'user');
  const hasConversations = userMessages.length > 0;
  
  let confirmationMessage = '';
  if (hasConversations) {
    confirmationMessage = '提问未结束，现在直接生成的场景较为简单，准确度较低，确定继续生成吗？';
  } else {
    confirmationMessage = '当前还没有进行对话，确定直接生成场景吗？';
  }
  
  // 弹出确认对话框
  const confirmed = confirm(confirmationMessage);
  
  if (confirmed) {
    try {
      // 获取当前项目名称
      const currentProject = projectStore.projects.find(p => p.id == projectId.value);
      const projectName = currentProject ? currentProject.project_name : '未知项目';
      
      let prompt = '';
      if (hasConversations) {
        // 使用现有对话历史生成场景
        const conversationSummary = userMessages
          .map(msg => msg.content)
          .join('\n');
        
        // 使用现有信息生成场景
        prompt = `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                `基于以下对话内容，生成一个关于'${useCaseName.value}'的场景描述：\n\n` +
                `对话内容：\n${conversationSummary}\n\n` +
                `请生成详细且完整的场景描述：`;
      } else {
        // 没有对话历史，仅基于用例和参与者信息生成
        prompt = `这是一个${projectName}系统的${actorName.value}执行"${useCaseName.value}"的场景。` +
                `请基于这个上下文生成一个详细完整的场景描述：\n\n` +
                `请生成详细且完整的场景描述：`;
      }
      
      // 使用store方法调用API生成场景
      try {
        await scenarioStore.generateSimpleScenario(
          parseInt(projectId.value),
          parseInt(useCaseId.value),
          `Simple Scenario for ${useCaseName.value}`,
          prompt
        );
        alert('场景已生成！');
      } catch (error) {
        console.error('简单场景生成失败:', error);
        // 备用方案：如果API失败，使用本地生成
        if (hasConversations) {
          const conversationSummary = userMessages
            .map(msg => msg.content)
            .join('\n');
          scenarioStore.generatedContent = `基于用例"${useCaseName.value}"和参与者"${actorName.value}"的简单场景描述。\n\n对话内容摘要：\n${conversationSummary.substring(0, 200)}...`;
        } else {
          scenarioStore.generatedContent = `基于用例"${useCaseName.value}"和参与者"${actorName.value}"的简单场景描述。`;
        }
        alert('场景已生成（使用本地模式）！');
      }
    } catch (error) {
      console.error('提前生成场景失败:', error);
      alert('提前生成场景失败，请重试');
    }
  }
}

// 返回用例图页面
const goBack = () => {
  // 尝试返回上一页，如果失败则导航到用例图页面
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // 如果没有历史记录，则导航到项目主页（用例图页面）
    router.push(`/projects/${projectId.value}/diagram`);
  }
};

// 保存场景
const saveScenario = async () => {
  if (!scenarioStore.generatedContent) {
    alert('没有可保存的场景内容');
    return;
  }
  
  // 在我们的系统中，场景在生成时已经自动保存到数据库了
  // 所以这里只需提醒用户场景已保存
  alert('场景已保存到数据库！');
};
</script>

<style scoped>
/* 全局背景 */
body {
  background-color: #f5f5f5;
}

/* 粒子背景效果 */
.scenario-view::before {
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

.scenario-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #ffffff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 24px;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.page-header:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.page-header .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.back-btn:hover {
  background: #f8fafc;
  color: #2c3e50;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

.page-header h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 28px;
  font-weight: 600;
}

.page-header p {
  margin: 0;
  color: #64748b;
  font-size: 16px;
}

.use-case-info {
  background: #ffffff;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.use-case-info:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.use-case-info h2 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 20px;
  font-weight: 600;
}

.use-case-info p {
  margin: 6px 0;
  color: #64748b;
  font-size: 15px;
}

.progress-info {
  margin: 20px 0;
  padding: 16px;
  background-color: #ffffff;
  border-radius: 12px;
  border-left: 4px solid #10b981;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.progress-info:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.progress-stats h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
}

.progress-stats p {
  margin: 6px 0;
  color: #64748b;
  font-size: 15px;
  font-weight: 500;
}

.scenario-generation-area {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
  margin-bottom: 24px;
}

.chat-area {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.chat-area:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.scenario-preview {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease;
}

.scenario-preview:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.chat-area h3, .scenario-preview h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 8px;
}

.chat-messages {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background-color: #fafafa;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 85%;
  word-wrap: break-word;
  position: relative;
  line-height: 1.5;
  font-size: 15px;
  margin-bottom: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: all 0.2s ease;
}

.message-bubble:hover {
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.message-bubble.user {
  background-color: #f0fdfa;
  align-self: flex-end;
  margin-left: auto;
  border: 1px solid #c6f6d5;
  border-bottom-right-radius: 4px;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
}

.message-bubble.system,
.message-bubble.assistant {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  align-self: flex-start;
  padding: 8px 12px;
  margin: 4px 0;
  border-bottom-left-radius: 4px;
}

.message-bubble strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #9ca3af;
}

.message-bubble.user strong {
  color: #065f46;
}

.message-bubble.system strong,
.message-bubble.assistant strong {
  color: #475569;
}

.message-bubble.error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  align-self: flex-start;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 12px;
  color: #dc2626;
}

.message-bubble.error strong {
  color: #b91c1c;
}

.message-content {
  margin: 0;
  line-height: 1.6;
}

.streaming-response {
  position: relative;
}

.typing-indicator {
  animation: blink 1s infinite;
  display: inline-block;
  width: 8px;
  height: 16px;
  vertical-align: middle;
  margin-left: 4px;
  color: #61BFAD;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.thinking {
  color: #94a3b8;
  font-style: italic;
}

.system-message .message-bubble.system {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-combined {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.input-textarea {
  flex: 1;
  width: 100%;
  padding: 12px;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 15px;
  color: #2c3e50;
  background: transparent;
  transition: box-shadow 0.3s ease;
}

.input-textarea:focus {
  box-shadow: 0 0 0 2px rgba(97, 191, 173, 0.5);
}

.input-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.send-btn {
  padding: 10px 20px;
  background: #61BFAD;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(97, 191, 173, 0.2);
}

.send-btn:hover:not(:disabled) {
  background: #4da89a;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(97, 191, 173, 0.3);
}

.send-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}



.loading-indicator {
  color: #64748b;
  font-size: 14px;
}

.preview-content {
  min-height: 200px;
  padding: 12px;
  background: #ffffff;
  border-radius: 8px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
}

.generated-scenario {
  white-space: pre-wrap;
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #2c3e50;
}

.generating-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}

.action-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 24px;
  flex-wrap: wrap;
  padding: 16px 0;
}

.primary-btn {
  background-color: #61BFAD;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
  box-shadow: 0 1px 3px rgba(97, 191, 173, 0.2);
}

.primary-btn:hover:not(:disabled) {
  background-color: #4da89a;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(97, 191, 173, 0.3);
}

.primary-btn:disabled {
  background-color: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  opacity: 0.6;
}

.primary-btn:not(:disabled):active {
  transform: translateY(0);
}

.secondary-btn {
  background-color: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.secondary-btn:hover:not(:disabled) {
  background-color: #e2e8f0;
  color: #475569;
  border-color: #94a3b8;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.07);
}

.secondary-btn:disabled {
  background-color: #f8fafc;
  color: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  opacity: 0.6;
}

.secondary-btn:not(:disabled):active {
  transform: translateY(0);
}

.success-btn {
  background-color: #10b981;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
}

.success-btn:hover:not(:disabled) {
  background-color: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.success-btn:disabled {
  background-color: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  opacity: 0.6;
}

.success-btn:not(:disabled):active {
  transform: translateY(0);
}

.warning-btn {
  background-color: #f59e0b;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
  box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
}

.warning-btn:hover:not(:disabled) {
  background-color: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);
}

.warning-btn:disabled {
  background-color: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  opacity: 0.6;
}

.warning-btn:not(:disabled):active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .scenario-generation-area {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .scenario-view {
    padding: 10px;
  }
  
  .progress-display {
    font-size: 0.9em;
    color: #64748b;
    font-weight: normal;
  }
}
</style>