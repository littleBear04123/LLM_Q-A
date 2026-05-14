const express = require('express');
const router = express.Router();
const scenarioRoutes = require('./scenarios');
const useCaseRoutes = require('./usecases');

// 将用例相关的路由挂载到 /api/usecases 下
router.use('/usecases', useCaseRoutes);

// 将场景相关的所有路由挂载到 /api/scenarios 下
router.use('/scenarios', scenarioRoutes);

// 添加PlantUML渲染路由，转发到场景路由 - 与前端兼容
// 前端请求 /api/plantuml/render，需要映射到场景路由中的相应端点
const validateSession = require('../middleware/session');
// 导入数据库和工具函数
const { db } = require('../database');
const ScenarioModel = require('../database/models/scenario');
const scenarioRoutesModule = require('./scenarios'); // 引入场景路由模块以访问其函数

const scenarioModel = new ScenarioModel(db);

// 从场景路由模块获取辅助函数
const { callDeepSeekAPI, callSimpleScenarioAPI, getRecentChatHistory, getScenarioStatusTable, createInitialStatusTable } = scenarioRoutesModule;

// PlantUML渲染API - 与前端兼容
router.post('/plantuml/render', validateSession, async (req, res) => {
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ error: '请先登录' });
    }

    try {
        const { plantumlCode } = req.body;
        
        if (!plantumlCode || typeof plantumlCode !== 'string') {
            return res.status(400).json({ error: '缺少PlantUML代码' });
        }

        console.log('收到PlantUML渲染请求，代码长度:', plantumlCode.length);

        const plantumlEncoder = require('plantuml-encoder');
        const encodedCode = plantumlEncoder.encode(plantumlCode);
        
        // 备用服务器列表（与用例图类似）
        const plantUmlServers = [
            `https://www.plantuml.com/plantuml/svg/${encodedCode}`,
            `https://plantuml-server.kkeisuke.com/svg/${encodedCode}`,
            `https://plantuml.com/plantuml/svg/${encodedCode}`
        ];
        
        let svgContent = null;
        let lastError = null;
        
        // 尝试每个服务器，带超时
        for (const serverUrl of plantUmlServers) {
            try {
                console.log('尝试使用服务器:', serverUrl);
                
                // 使用AbortController设置请求超时
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
                
                const response = await fetch(serverUrl, {
                    signal: controller.signal,
                    mode: 'cors',
                    headers: {
                        'Accept': 'image/svg+xml'
                    }
                });
                
                clearTimeout(timeoutId);
                
                console.log('服务器响应状态:', response.status);
                
                if (response.ok) {
                    svgContent = await response.text();
                    console.log('PlantUML SVG设置成功，服务器:', serverUrl, '长度:', svgContent.length);
                    
                    // 检查返回的内容是否是SVG格式（考虑可能包含XML声明的情况）
                    const trimmedContent = svgContent.trim();
                    if (!trimmedContent.startsWith('<svg') && !trimmedContent.includes('<svg')) {
                        console.error('服务器返回的不是SVG内容:', svgContent.substring(0, 500));
                        throw new Error('服务器返回了无效内容');
                    }
                    
                    break;
                } else {
                    console.error(`HTTP ${response.status}: ${response.statusText}`);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.warn('服务器连接失败:', serverUrl, error.message);
                lastError = error;
                continue; // 继续尝试下一个服务器
            }
        }
        
        if (!svgContent) {
            // 所有服务器都失败，返回错误
            throw new Error(`无法连接到PlantUML服务器: ${lastError?.message || '网络连接失败'}`);
        }
        
        res.set('Content-Type', 'image/svg+xml');
        res.send(svgContent);
    } catch (error) {
        console.error('PlantUML处理错误:', error);
        res.status(500).json({ error: error.message });
    }
});





module.exports = router;