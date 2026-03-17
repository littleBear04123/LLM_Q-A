// UseCaseList.vue - 使用您原来的代码，完全不变
<template>
  <div class="use-case-list">
    <div class="list-header">
      <h3>用例列表</h3>
      <span class="count-badge">{{ uniqueUseCases.length }}</span>
    </div>

    <!-- 搜索过滤 -->
    <div class="search-section">
      <el-radio-group v-model="searchType" size="small" style="margin-bottom: 8px;">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="useCase">按用例</el-radio-button>
        <el-radio-button label="actor">按参与者</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="searchText"
        :placeholder="searchPlaceholder"
        prefix-icon="Search"
        clearable
      />
    </div>

    <!-- 用例列表 -->
    <div class="list-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="uniqueUseCases.length === 0" class="empty-state">
        <el-icon class="empty-icon"><List /></el-icon>
        <p v-if="useCases.length === 0">暂无用例</p>
        <p v-else>未找到匹配的用例</p>
      </div>

      <!-- 按角色分组的用例项 -->
      <div v-else class="use-case-groups">
        <div
          v-for="(useCasesByActor, actor) in groupedUseCases"
          :key="actor"
          class="actor-group"
        >
          <div class="actor-header">
            <h4>{{ actor }}</h4>
          </div>
          <div class="actor-use-cases">
            <div
              v-for="useCase in useCasesByActor"
              :key="useCase.uniqueKey"
              class="use-case-item"
              :class="{ active: selectedUseCase?.uniqueKey === useCase.uniqueKey }"
              @click="handleSelectUseCase(useCase)"
            >
              <div class="use-case-header">
                <span class="use-case-name">{{ useCase.use_case_name }}</span>
                <el-tag 
                  :type="getStatusType(useCase.status)" 
                  size="small"
                >
                  {{ getStatusText(useCase.status) }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, Loading, List, User } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  useCases: {
    type: Array,
    default: () => []
  },
  loading: Boolean
})

const emit = defineEmits(['use-case-select'])

const router = useRouter()
const searchText = ref('')
const searchType = ref('all') // 搜索类型：all(全部), useCase(按用例), actor(按参与者)
const selectedUseCase = ref(null)

// 计算搜索框提示文字
const searchPlaceholder = computed(() => {
  switch (searchType.value) {
    case 'useCase':
      return '搜索用例...'
    case 'actor':
      return '搜索参与者...'
    default:
      return '搜索用例或参与者...'
  }
})

// 计算属性 - 严格去重并支持搜索过滤
const uniqueUseCases = computed(() => {
  if (!props.useCases || props.useCases.length === 0) {
    console.log('UseCaseList: 没有用例数据')
    return []
  }
  
  console.log('UseCaseList: 接收到的用例数量', props.useCases.length)
  console.log('UseCaseList: 接收到的用例数据', props.useCases)
  console.log('UseCaseList: 搜索文本', searchText.value)
  console.log('UseCaseList: 搜索类型', searchType.value)
  
  const uniqueMap = new Map()
  
  props.useCases.forEach(useCase => {
    // 确保用例对象包含必需的字段
    if (!useCase.use_case_name || !useCase.actor) {
      console.warn('发现缺少必要字段的用例:', useCase)
      return
    }
    
    // 搜索过滤逻辑 - 使用模糊匹配
    if (searchText.value) {
      let shouldInclude = false
      
      // 模糊匹配函数 - 检查字符串中是否包含子序列（字符可以不连续但顺序一致）
      const fuzzyMatch = (text, pattern) => {
        if (!pattern) return true
        text = text.toLowerCase()
        pattern = pattern.toLowerCase()
        
        let patternIndex = 0
        for (let i = 0; i < text.length; i++) {
          if (text[i] === pattern[patternIndex]) {
            patternIndex++
            if (patternIndex === pattern.length) {
              return true
            }
          }
        }
        return false
      }
      
      switch (searchType.value) {
        case 'useCase': // 按用例搜索
          shouldInclude = fuzzyMatch(useCase.use_case_name, searchText.value)
          break
        case 'actor': // 按参与者搜索
          shouldInclude = fuzzyMatch(useCase.actor, searchText.value)
          break
        case 'all': // 搜索全部
        default:
          shouldInclude = 
            fuzzyMatch(useCase.use_case_name, searchText.value) ||
            fuzzyMatch(useCase.actor, searchText.value)
          break
      }
      
      if (!shouldInclude) {
        return // 不满足搜索条件，跳过此用例
      }
    }
    
    // 创建唯一标识：用例名称 + 参与者 + 项目ID（如果存在）
    const uniqueKey = `${useCase.use_case_name}_${useCase.actor}_${useCase.project_id || ''}`
    
    if (!uniqueMap.has(uniqueKey)) {
      uniqueMap.set(uniqueKey, {
        ...useCase,
        uniqueKey: uniqueKey
      })
    }
  })
  
  const result = Array.from(uniqueMap.values())
  console.log('UseCaseList: 去重后的用例数量', result.length)
  return result
})

// 按角色分组的用例
const groupedUseCases = computed(() => {
  const groups = {}
  
  uniqueUseCases.value.forEach(useCase => {
    if (!groups[useCase.actor]) {
      groups[useCase.actor] = []
    }
    groups[useCase.actor].push(useCase)
  })
  
  console.log('UseCaseList: 分组后的用例:', groups)
  return groups
})

// 方法
const handleSelectUseCase = (useCase) => {
  selectedUseCase.value = useCase
  emit('use-case-select', useCase)
  
  // 跳转到场景细化页面
  if (useCase.project_id && useCase.id) {
    router.push({
      name: 'Scenario',
      params: { 
        projectId: useCase.project_id, 
        useCaseId: useCase.id 
      }
    })
  }
}

const getStatusType = (status) => {
  const types = {
    pending: 'info',
    generating: 'warning',
    completed: 'success'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待处理',
    generating: '生成中',
    completed: '已完成'
  }
  return texts[status] || '未知'
}
</script>

<style scoped>
.use-case-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.list-header h3 {
  margin: 0;
  color: #2c3e50;
  font-weight: 600;
  font-size: 18px;
}

.count-badge {
  background: var(--primary-color);
  color: white;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 12px;
}

.search-section {
  margin-bottom: 15px;
}

.list-container {
  flex: 1;
  overflow: auto;
  height: 100%;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.loading-icon, .empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
  color: #cbd5e1;
}

.use-case-groups {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.actor-group {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
}

.actor-header {
  background: #ffffff;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.actor-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 600;
}

.actor-use-cases {
  padding: 5px 0;
}

.use-case-item {
  padding: 10px 12px;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
  margin: 0 12px;
  border-radius: 6px;
}

.use-case-item:hover {
  background: #f0fdfa;
  color: #065f46;
}

.use-case-item.active {
  background: #e6fffa;
  color: #047857;
  border-left: 3px solid var(--primary-color);
}

.use-case-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

.use-case-name {
  font-weight: 500;
  color: #2c3e50;
  flex: 1;
  margin-right: 10px;
  font-size: 14px;
}
</style>