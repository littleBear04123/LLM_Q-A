const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

// 导入数据库和工具函数
const { db, userModel } = require('./server/database');
const sessionMiddleware = require('./server/middleware/session');
const userRoutes = require('./server/routes/users');
const apiRoutes = require('./server/routes/api');
const { createInitialStatusTable, statusTableToText } = require('./server/utils');
const projectRoutes = require('./server/routes/projects');

const app = express();
const port = 3000;

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

// 注册路由
app.use('/api/users', userRoutes);
app.use('/api', apiRoutes);
app.use('/api/projects', projectRoutes);

// 生产环境：提供静态文件
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
} else {
    // 开发环境：重定向到 Vite 开发 servers
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            next();
        } else {
            res.redirect(`http://localhost:3001${req.path}`);
        }
    });
}

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: '服务器运行正常',
        api: 'DeepSeek Official API',
        features: '集成状态表和会话管理'
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`🚀 DeepSeek LLM服务器启动成功`);
    console.log(`📡 API服务: http://localhost:${port}`);
    console.log(`📱 前端开发服务器: http://localhost:3001`);
    console.log(`🤖 使用模型: deepseek-chat`);
    console.log(`📊 数据库: SQLite (data.db)`);
    console.log(`👤 会话管理: 已启用`);
});