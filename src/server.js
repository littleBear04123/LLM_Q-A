const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

// 加载环境变量
require('dotenv').config();

// 导入数据库和工具函数
const { db, userModel } = require('./server/database');
const sessionMiddleware = require('./server/middleware/session');
const userRoutes = require('./server/routes/users/index.js');
const { createInitialStatusTable, statusTableToText } = require('./server/utils');
const projectRoutes = require('./server/routes/projects');
const useCaseRoutes = require('./server/routes/usecases');
const scenarioRoutes = require('./server/routes/scenarios');


const app = express();
const port = 3001;

// 中间件配置
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [/^https:\/\/.*\.vercel\.app$/, /^https:\/\/.*\.netlify\.app$/] // 生产环境允许部署域名
        : 'http://localhost:3001', // 开发环境允许Vite前端端口
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// 注册路由 - 更具体的路由应该在更通用的路由之前
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/usecases', useCaseRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/plantuml', scenarioRoutes);  // PlantUML相关API现在也在scenarioRoutes中
// 不再使用通用的 /api 路由，避免与具体路由冲突

// 专门处理 /api/chat 路由 - 直接复用场景路由中的聊天处理逻辑
// 从场景路由模块导入聊天处理函数
const scenarioRoutesModule = require('./server/routes/scenarios');

// 从数据库导入模型类
const ScenarioModel = require('./server/database/models/scenario');
const MessageModel = require('./server/database/models/message');

// 创建模型实例
const scenarioModel = new ScenarioModel(db);
const messageModel = new MessageModel(db);

// 辅助函数：统计已收集的项目数量
function countCollectedItems(statusTable) {
  let count = 0;
  
  for (const field of Object.values(statusTable)) {
    for (const component of Object.values(field)) {
      if (component.status === 'collected') {
        count++;
      }
    }
  }
  
  return count;
}
// 处理聊天请求
app.post('/api/chat', sessionMiddleware, async (req, res) => {
  // 复用 scenarios/index.js 中的聊天处理逻辑
  // 检查是否有上下文信息
  const userMessage = req.body.message;
  const context = req.body.context; // 包含projectId, useCaseId等上下文信息
  const sessionId = req.session.id;

  if (!userMessage) {
    return res.status(400).json({ error: '消息内容不能为空' });
  }

  // 检查是否是场景对话（有上下文）还是通用聊天（无上下文）
  if (context && context.useCaseId) {
    // 场景对话模式 - 有上下文信息
    try {
      const { getScenarioStatusTable, getRecentChatHistory, mergeStatusUpdates, updateScenarioStatusTable, callDeepSeekAPI } = scenarioRoutesModule;
      
      // 需要根据上下文获取useCaseId
      const useCaseId = context?.useCaseId;
      if (!useCaseId) {
        return res.status(400).json({ error: '缺少用例ID' });
      }
      
      // 获取或创建场景
      let scenario = scenarioModel.getScenarioByUseCase(useCaseId);
      if (!scenario) {
          // 如果没有找到场景，创建一个新场景
          const title = "需求收集场景";
          scenario = {
              id: scenarioModel.createScenario(useCaseId, title, userMessage)
          };
      }
      
      // 1. 保存用户消息到数据库
      messageModel.saveMessage(scenario.id, 'user', userMessage);

      // 2. 获取当前场景的状态表和对话历史
      let [statusTable, recentMessages] = await Promise.all([
          getScenarioStatusTable(scenario.id),
          getRecentChatHistory(scenario.id)
      ]);
      
      // 如果是首次对话且状态表为空，使用初始输入智能初始化
      if (recentMessages.length <= 2 && Object.keys(statusTable).length === 0) {
          const { createInitialStatusTable } = require('./server/utils');
          statusTable = createInitialStatusTable(userMessage);
      }

      // 3. 构造发送给AI的提示词（包含已收集的信息摘要）
      const { generateCollectedInfoSummary } = require('./server/utils');
      let enhancedPrompt;
      if (recentMessages.length <= 2) { // 用户消息刚刚被添加，所以历史可能只有少量消息
          // 如果是首次对话，使用专门的初始提示词
          enhancedPrompt = `您好，我是您的需求工程顾问。请告诉我您想设计什么场景？比如'用户登录系统'、'客户下单购买'或'员工提交报销'。我会通过提问帮助您完善这个场景的细节，最后生成完整的场景文档。

用户输入：${userMessage}

请根据用户输入开始提问。`;
      } else {
          // 否则，提供已收集的信息摘要给AI
          const collectedInfoSummary = generateCollectedInfoSummary(statusTable);
          enhancedPrompt = `以下是已收集的信息摘要：
${collectedInfoSummary}

用户最新输入：${userMessage}

请根据已有信息和用户的新输入，提出下一个相关问题。`;
      }

      // 4. 调用DeepSeek API，获取结构化JSON响应
      const aiResponse = await callDeepSeekAPI(enhancedPrompt, {
          sessionId,
          ...context  // 包含projectId, useCaseId等上下文
      });

      // 5. 从AI的响应中提取问题和状态更新
      const nextQuestion = typeof aiResponse === 'object' && aiResponse.question 
          ? aiResponse.question 
          : (typeof aiResponse === 'string' ? aiResponse : '抱歉，我没有理解您的意思。请重新表述。');
      
      const aiSuggestedStatusUpdate = typeof aiResponse === 'object' && aiResponse.statusUpdate 
          ? aiResponse.statusUpdate 
          : null;

      // 6. 合并AI建议的状态更新与当前状态表
      const updatedStatusTable = mergeStatusUpdates(statusTable, aiSuggestedStatusUpdate);

      // 7. 保存更新后的状态表
      await updateScenarioStatusTable(scenario.id, updatedStatusTable);

      // 8. 保存AI回复到数据库（只保存问题部分，而不保存状态部分）
      messageModel.saveMessage(scenario.id, 'assistant', nextQuestion);

      console.log('AI回复内容:', nextQuestion.substring(0, 100) + '...');
      res.json({ 
          success: true,
          response: nextQuestion,
          statusTable: updatedStatusTable,
          collectedCount: scenarioRoutesModule.countCollectedItems(updatedStatusTable), // 返回已收集项的数量
          scenarioId: scenario.id // 返回场景ID以便前端跟踪
      });

    } catch (error) {
      console.error('场景对话请求出错:', error.message);
      res.status(500).json({ 
          error: '服务器错误: ' + error.message 
      });
    }
  } else {
    // 通用聊天模式 - 无特定上下文
    try {
      const { callDeepSeekAPI } = scenarioRoutesModule;
      // 构建发送给AI的提示词
      const enhancedPrompt = `您好，我是您的AI助手。${userMessage} 请回复用户的消息。`;

      // 调用DeepSeek API
      const aiResponse = await callDeepSeekAPI(enhancedPrompt, { sessionId });

      // 根据AI响应的结构提取用户可见的回复内容
      // 如果AI返回了question字段，则使用question作为用户可见的响应
      const userVisibleResponse = typeof aiResponse === 'string' ? aiResponse : 
                                  aiResponse.question || aiResponse.response || aiResponse.reply || JSON.stringify(aiResponse);

      res.json({
        success: true,
        response: userVisibleResponse,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('通用聊天API错误:', error);
      res.status(500).json({ error: '聊天服务暂时不可用' });
    }
  }
});

// 生产环境：提供静态文件
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
}
// 注意：在开发环境中，使用 Vite 作为前端开发服务器
// 但在当前配置中，我们只需要提供 API 服务，前端由 Vite 独立提供
// 健康检查端点
app.get('/api/health', (req, res) => {
    if (req.session && req.session.user_id) {
        res.json({ 
            status: 'OK',
            authenticated: true, 
            userId: req.session.user_id,
            username: req.session.username,
            message: '服务器运行正常',
            api: 'DeepSeek Official API',
            features: '集成状态表和会话管理'
        });
    } else {
        res.json({ 
            status: 'OK',
            authenticated: false,
            message: '服务器运行正常',
            api: 'DeepSeek Official API',
            features: '集成状态表和会话管理'
        });
    }
});

// 创建服务器实例以便后续控制
const server = app.listen(port, () => {
    console.log(`DeepSeek LLM服务器启动成功`);
    console.log(`API服务: http://localhost:${port}`);
    console.log(`前端开发服务器: http://localhost:${port}`);
    console.log(`使用模型: deepseek-chat`);
    console.log(`数据库: SQLite (data.db)`);
    console.log(`会话管理: 已启用`);
});

// 关闭服务器的函数
function gracefulShutdown(signal) {
    console.log(`
收到 ${signal} 信号，正在关闭服务器...`);
    
    // 关闭服务器
    server.close(() => {
        console.log('HTTP服务器已关闭');
        
        // 关闭数据库连接
        if (db) {
            db.close();
            console.log('数据库连接已关闭');
        }
        
        console.log('服务器已安全关闭');
        process.exit(0);
    });
    
    // 设置强制退出超时
    setTimeout(() => {
        console.error('服务器关闭超时，强制退出');
        if (db) {
            db.close(); // 尝试关闭数据库
        }
        process.exit(1);
    }, 5000); // 5秒后强制退出
}

// 监听退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart