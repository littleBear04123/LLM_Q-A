<template>
  <div class="uml-diagram">
    <div class="diagram-header">
      <h3>UML用例图</h3>
      <div class="diagram-controls">
        <!-- 缩放控制 -->
        <div class="zoom-controls">
          <el-button 
            size="small" 
            @click="handleZoomOut"
            :disabled="zoomLevel <= minZoom"
            title="缩小"
          >
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <el-button 
            size="small" 
            @click="handleZoomIn"
            :disabled="zoomLevel >= maxZoom"
            title="放大"
          >
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button 
            size="small" 
            @click="handleResetZoom"
            title="重置缩放"
          >
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </div>
        
        <el-button 
          v-if="plantUmlCode" 
          type="primary" 
          link 
          @click="handleRefresh"
          :loading="isRendering"
        >
          <el-icon><Refresh /></el-icon>
          重新生成
        </el-button>
      </div>
    </div>

    <div class="diagram-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <p>正在生成用例图...</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!plantUmlCode" class="empty-state">
        <el-icon class="empty-icon"><Picture /></el-icon>
        <p>请输入需求描述生成用例图</p>
      </div>

      <!-- UML图表 -->
      <div v-else class="plantuml-wrapper" @wheel="handleWheel">
        <div 
          class="plantuml-container"
          :style="{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }"
        >
          <div 
            ref="plantUmlRef" 
            class="plantuml-diagram"
            v-html="plantUmlSvg"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import plantumlEncoder from 'plantuml-encoder';
import { Refresh, Loading, Picture, ZoomIn, ZoomOut, FullScreen } from '@element-plus/icons-vue';

const props = defineProps({
  plantUmlCode: String,
  loading: Boolean,
  useCases: Array
});

const emit = defineEmits(['use-case-click']);

const plantUmlRef = ref(null);
const isRendering = ref(false);
const lastClickedUseCase = ref('');
const plantUmlSvg = ref('');

// 缩放相关状态
const zoomLevel = ref(1.0);
const minZoom = ref(0.3);
const maxZoom = ref(3.0);
const zoomStep = ref(0.1);

// 缩放控制方法
const handleZoomIn = () => {
  if (zoomLevel.value < maxZoom.value) {
    zoomLevel.value = Math.min(zoomLevel.value + zoomStep.value, maxZoom.value);
  }
};

const handleZoomOut = () => {
  if (zoomLevel.value > minZoom.value) {
    zoomLevel.value = Math.max(zoomLevel.value - zoomStep.value, minZoom.value);
  }
};

const handleResetZoom = () => {
  zoomLevel.value = 1.0;
};

// 滚轮缩放功能
const handleWheel = (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
    if (event.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }
};

// PlantUML渲染函数
const renderPlantUml = async (code) => {
  if (isRendering.value) return;
  
  isRendering.value = true;
  console.log('开始渲染PlantUML图表');
  
  try {
    // 如果是空代码，显示空状态
    if (!code || code.trim() === '') {
      plantUmlSvg.value = '<div class="empty-plantuml">等待PlantUML代码...</div>';
      return;
    }
    
    // 处理PlantUML代码
    const processedCode = code.replace(/```(?:plantuml)?/g, '').trim();
    
    // 使用PlantUML的在线服务器渲染 - 尝试多个备用服务器
    const encodedCode = encodeForPlantUml(processedCode);
    
    // 备用服务器列表
    const plantUmlServers = [
      `https://www.plantuml.com/plantuml/svg/${encodedCode}`,
      `https://plantuml-server.kkeisuke.com/svg/${encodedCode}`,
      `https://plantuml.com/plantuml/svg/${encodedCode}`
    ];
    
    let svgContent = null;
    let lastError = null;
    
    // 尝试每个服务器
    for (const serverUrl of plantUmlServers) {
      try {
        console.log('尝试使用服务器:', serverUrl);
        const response = await fetch(serverUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'image/svg+xml'
          }
        });
        
        if (response.ok) {
          svgContent = await response.text();
          console.log('PlantUML SVG设置成功，服务器:', serverUrl, '长度:', svgContent.length);
          break;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.warn('服务器连接失败:', serverUrl, error.message);
        lastError = error;
        continue; // 继续尝试下一个服务器
      }
    }
    
    if (!svgContent) {
      // 所有服务器都失败，显示错误信息
      throw new Error(`无法连接到PlantUML服务器: ${lastError?.message || '网络连接失败'}`);
    }
    
    // 设置SVG内容
    plantUmlSvg.value = svgContent;
    
    nextTick(() => {
      addClickEvents();
      // 重置缩放
      handleResetZoom();
    });
    
  } catch (error) {
    console.error('PlantUML渲染错误:', error);
    // 显示更友好的错误信息
    plantUmlSvg.value = `
      <div class="error">
        <h4>图表渲染失败</h4>
        <p>原因: ${error.message}</p>
        <p>请检查网络连接或稍后重试。</p>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px;">刷新页面</button>
      </div>
    `;
  } finally {
    isRendering.value = false;
  }
};

// 监听PlantUML代码变化
watch(() => props.plantUmlCode, async (newCode) => {
  if (!isRendering.value) {
    await renderPlantUml(newCode);
  }
});

// PlantUML编码函数 - 将文本转换为PlantUML服务器接受的格式
function encodeForPlantUml(text) {
  // 使用plantuml-encoder库进行编码
  return plantumlEncoder.encode(text);
}

// 点击事件处理
const addClickEvents = () => {
  if (!plantUmlRef.value) return;
  
  const svgElement = plantUmlRef.value.querySelector('svg');
  if (!svgElement) {
    console.warn('未找到SVG元素');
    return;
  }
  
  // 添加样式优化SVG质量
  svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgElement.style.shapeRendering = 'geometricPrecision';
  
  svgElement.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'text') {
      const useCaseName = target.textContent.trim();
      if (useCaseName && useCaseName.length > 1) {
        console.log('点击用例:', useCaseName);
        lastClickedUseCase.value = useCaseName;
        emit('use-case-click', { 
          name: useCaseName, 
          id: useCaseName.replace(/\s+/g, '-').toLowerCase() 
        });
      }
    }
  });
};

const handleRefresh = () => {
  if (props.plantUmlCode && !isRendering.value) {
    renderPlantUml(props.plantUmlCode);
  }
};

onMounted(() => {
  if (props.plantUmlCode) {
    renderPlantUml(props.plantUmlCode);
  }
});
</script>

<style scoped>
.uml-diagram {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.diagram-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  color: #2c3e50;
}

.diagram-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
}

.diagram-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.diagram-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  position: relative;
}

.loading-state, .empty-state {
  text-align: center;
  color: #9ca3af;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.plantuml-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
  min-height: 500px;
}

.plantuml-container {
  transition: transform 0.3s ease;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
}

.plantuml-diagram {
  display: inline-block;
  max-width: 100%;
}

/* 优化SVG显示质量 */
:deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
  shape-rendering: geometricPrecision;
  text-rendering: geometricPrecision;
  image-rendering: optimizeQuality;
}

:deep(.label) {
  font-size: 16px !important;
  font-family: Arial, sans-serif !important;
  color: #2c3e50 !important;
}

:deep(.node) {
  stroke-width: 2px !important;
  stroke: #61BFAD !important;
  fill: #f0fdfa !important;
}

:deep(.edgePath) {
  stroke-width: 2px !important;
  stroke: #61BFAD !important;
}

.error {
  color: red;
  padding: 20px;
  text-align: center;
}

.loading-icon, .empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
}
</style>