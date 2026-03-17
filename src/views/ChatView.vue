<template>
  <div class="chat-container">
    <div class="header">
      <h1>DeepSeek AI对话助手</h1>
      <p>基于官方DeepSeek API的智能对话系统 <span class="success-badge">已连接</span></p>
    </div>
    
    <div class="messages-wrapper">
      <div class="messages" ref="messagesRef">
        <div 
          v-for="message in messages" 
          :key="message.id"
          :class="['message', `${message.type}-message`]"
        >
          <div class="message-sender">{{ message.sender }}</div>
          <div 
            :class="['message-bubble', { 'error-message': message.isError }]"
          >
            {{ message.content }}
          </div>
        </div>
        
        <div 
          v-show="isTyping"
          class="message bot-message"
        >
          <div class="message-sender">DeepSeek AI</div>
          <div class="message-bubble typing-indicator">
            <span class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
            DeepSeek正在思考中...
          </div>
        </div>
      </div>
    </div>
    
    <div class="input-area">
      <el-input
        v-model="userInput"
        placeholder="向DeepSeek AI提问..."
        :disabled="isSending"
        @keyup.enter="sendMessage"
        size="large"
      >
        <template #append>
          <el-button 
            :loading="isSending"
            :disabled="!userInput.trim()"
            @click="sendMessage"
            type="primary"
          >
            {{ isSending ? '发送中...' : '发送' }}
          </el-button>
        </template>
      </el-input>
    </div>
    
    <div class="status-bar">
      <span>状态: <span :class="statusClass">{{ status }}</span></span>
      <span>模型: DeepSeek-Chat</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'ChatView',
  setup() {
    const messages = ref([
      {
        id: 1,
        type: 'bot',
        sender: 'DeepSeek AI',
        content: '你好！我是DeepSeek AI助手，很高兴为你服务。我可以帮助你回答问题、创作内容、解决编程问题等。有什么我可以帮你的吗？',
        timestamp: new Date(),
        isError: false
      }
    ])
    
    const userInput = ref('')
    const isTyping = ref(false)
    const isSending = ref(false)
    const status = ref('就绪')
    const messagesRef = ref(null)

    const statusClass = computed(() => ({
      'status-ready': status.value === '就绪',
      'status-sending': status.value === '发送中',
      'status-error': status.value === '错误'
    }))

    const scrollToBottom = async () => {
      await nextTick()
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    }

    const addMessage = (content, type, isError = false) => {
      const message = {
        id: Date.now(),
        type,
        sender: type === 'user' ? '您' : 'DeepSeek AI',
        content,
        timestamp: new Date(),
        isError
      }
      messages.value.push(message)
      scrollToBottom()
    }

    const apiSendMessage = async (message) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `请求失败: ${response.status}`)
      }
      
      return await response.json()
    }

    const sendMessage = async () => {
      const content = userInput.value.trim()
      if (!content || isSending.value) return

      isSending.value = true
      status.value = '发送中'
      addMessage(content, 'user')
      userInput.value = ''
      
      isTyping.value = true
      await scrollToBottom()

      try {
        const response = await apiSendMessage(content)
        isTyping.value = false
        addMessage(response.reply, 'bot')
        status.value = '就绪'
      } catch (error) {
        console.error('错误:', error)
        isTyping.value = false
        addMessage(`抱歉，出现错误: ${error.message}`, 'bot', true)
        status.value = '错误'
        ElMessage.error('消息发送失败')
        
        setTimeout(() => {
          if (status.value === '错误') {
            status.value = '就绪'
          }
        }, 3000)
      } finally {
        isSending.value = false
      }
    }

    return {
      messages,
      userInput,
      isTyping,
      isSending,
      status,
      messagesRef,
      statusClass,
      sendMessage
    }
  }
}
</script>

<style scoped>
/* 粒子背景效果 */
.chat-container::before {
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

.chat-container {
  max-width: 900px;
  margin: 20px auto;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: box-shadow 0.3s ease;
}

.chat-container:hover {
  box-shadow: 
    0 12px 48px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.05);
}

.header {
  background: #ffffff;
  color: #2c3e50;
  padding: 30px;
  text-align: center;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid #e2e8f0;
}

.header h1 {
  font-size: 2.4rem;
  margin-bottom: 10px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: #2c3e50;
}

.header p {
  opacity: 0.9;
  font-size: 1.1rem;
  font-weight: 300;
  color: #64748b;
}

.messages-wrapper {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.messages {
  flex: 1;
  padding: 25px;
  overflow-y: auto;
  background: #f8fafc;
}

.messages::-webkit-scrollbar {
  width: 8px;
}

.messages::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.message {
  margin-bottom: 24px;
  max-width: 80%;
  animation: fadeIn 0.4s ease-out;
}

.user-message {
  margin-left: auto;
  text-align: right;
}

.bot-message {
  margin-right: auto;
}

.message-bubble {
  padding: 14px 20px;
  border-radius: 20px;
  display: inline-block;
  word-wrap: break-word;
  max-width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  line-height: 1.5;
}

.user-message .message-bubble {
  background: #f0fdfa;
  color: #065f46;
  border-bottom-right-radius: 6px;
  border: 1px solid #c6f6d5;
}

.bot-message .message-bubble {
  background: #ffffff;
  color: #2c3e50;
  border-bottom-left-radius: 6px;
  border: 1px solid #e2e8f0;
}

.message-sender {
  font-size: 0.75rem;
  margin-bottom: 6px;
  opacity: 0.7;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #64748b;
}

.input-area {
  padding: 25px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
}

.status-bar {
  padding: 15px 25px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 0.85rem;
  color: #64748b;
  display: flex;
  justify-content: space-between;
  font-weight: 400;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.typing-dots span {
  height: 8px;
  width: 8px;
  background: #94a3b8;
  border-radius: 50%;
  display: inline-block;
  margin: 0 2px;
  animation: typing 1.2s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.error-message {
  background: #fef2f2 !important;
  color: #dc2626 !important;
  border-color: #fecaca !important;
}

.success-badge {
  background: #dcfce7;
  color: #166534;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid #bbf7d0;
}

.status-ready { color: #166534; }
.status-sending { color: #d97706; }
.status-error { color: #dc2626; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
</style>