// server/routes/api.js
const express = require('express');
const router = express.Router();
const { userModel } = require('../database');
const { createInitialStatusTable, statusTableToText } = require('../utils');
const { DIALOGUE_SYSTEM_PROMPT, SIMPLE_GENERATION_PROMPT } = require('../config/prompts');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 会话状态管理函数
async function getSessionStatusTable(sessionId) {
    try {
        console.log(`🔍 获取会话 ${sessionId} 的状态表`);
        // 从数据库获取当前会话的状态表
        const session = await userModel.getSessionById(sessionId);
        console.log('会话信息:', session);
        
        if (session && session.status_table) {
            console.log('✅ 找到已保存的状态表');
            const parsedTable = JSON.parse(session.status_table);
            console.log('已保存的状态表内容:', JSON.stringify(parsedTable, null, 2));
            return parsedTable;
        }
        // 如果没有找到，返回初始状态表
        console.log('⚠️ 未找到状态表，返回初始状态表');
        const initialTable = createInitialStatusTable();
        console.log('初始状态表:', JSON.stringify(initialTable, null, 2));
        return initialTable;
    } catch (error) {
        console.error('获取会话状态表失败:', error);
        return createInitialStatusTable();
    }
}

async function updateSessionStatusTable(sessionId, statusTable) {
    try {
        await userModel.updateSessionStatusTable(sessionId, JSON.stringify(statusTable));
    } catch (error) {
        console.error('更新会话状态表失败:', error);
    }
}

async function getRecentMessages(sessionId, limit = 10) {
    try {
        return userModel.getMessageHistory(sessionId, limit);
    } catch (error) {
        console.error('获取消息历史失败:', error);
        return [];
    }
}

// 获取最近的对话历史
async function getRecentChatHistory(sessionId) {
    if (!sessionId) {
        return []; // 如果没有session ID，返回空历史
    }
    
    try {
        // 从数据库获取最近的对话历史
        const recentMessages = userModel.getMessageHistory(sessionId, 20); // 获取最近20条消息
        
        // 将数据库中的消息转换为API所需的格式
        const chatHistory = [];
        for (const msg of recentMessages) {
            // 根据角色映射消息
            let role = 'user';
            if (msg.role === 'assistant') {
                role = 'assistant';
            } else if (msg.role === 'system') {
                role = 'system';
            } else {
                role = 'user'; // 默认为用户消息
            }
            
            // 检查消息内容是否包含内部状态信息，如果是，则过滤掉
            let content = msg.content || '';
            
            // 如果内容包含状态表信息，可以选择过滤掉这些内部信息
            // 这里我们保留所有内容，因为AI需要完整的上下文
            chatHistory.push({
                role: role,
                content: content
            });
        }
        
        return chatHistory;
    } catch (error) {
        console.error('获取对话历史失败:', error);
        return []; // 获取失败时返回空历史
    }
}

// 统一的会话验证中间件
const validateSession = (req, res, next) => {
    if (!req.session || !req.session.user_id) {
        console.log('❌ API路由 - 会话验证失败: 会话不存在或无用户ID');
        return res.status(401).json({ error: '未登录' });
    }
    
    console.log('✅ API路由 - 会话验证通过，用户ID:', req.session.user_id);
    next();
};

// 应用会话验证中间件
router.use(validateSession);

router.get('/history', async (req, res) => {
    try {
        const messages = userModel.getMessageHistory(req.session.id, 20);
        res.json({ messages });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: '获取历史失败' });
    }
});

router.post('/message', async (req, res) => {
    const { role, content } = req.body;

    try {
        const messageId = userModel.saveMessage(req.session.id,role, content);
        res.json({ success: true, messageId });
    } catch (error) {
        console.error('Message save error:', error);
        res.status(500).json({ error: '保存消息失败' });
    }
});

// 辅助函数：将中文领域名映射到英文键
function mapChineseCategoryToEnglish(categoryZh) {
    const categoryMap = {
        '行动者领域': 'actionerField',
        '意图领域': 'intentionField',
        '任务领域': 'taskField',
        '环境领域': 'environmentField',
        '沟通领域': 'communicationField',
        'actionerField': 'actionerField',
        'intentionField': 'intentionField',
        'taskField': 'taskField',
        'environmentField': 'environmentField',
        'communicationField': 'communicationField'
    };
    return categoryMap[categoryZh];
}

// 辅助函数：将中文组件名映射到英文键
function mapChineseComponentToEnglish(componentZh) {
    const componentMap = {
        // 行动者领域
        '代理': 'agent',
        '角色': 'role',
        '群体': 'group',
        '组织': 'organization',
        '物理结构': 'physicalStructure',
        
        // 意图领域
        '目标': 'goal',
        '目的': 'purpose',
        '计划': 'plan',
        '政策': 'policy',
        
        // 任务领域
        '任务': 'task',
        '行动': 'action',
        '程序': 'procedure',
        '资源': 'resource',
        '对象': 'object',
        '事件': 'event',
        '状态': 'state',
        
        // 环境领域
        '物理环境': 'physical',
        '社会环境': 'social',
        '经济环境': 'economic',
        '时间': 'time',
        '位置': 'location',
        '情境': 'situation',
        
        // 沟通领域
        '态度': 'attitude',
        '假设': 'assumption',
        '预期': 'expectation',
        '误解': 'misunderstanding',
        '论点': 'argument',
        '解释': 'interpretation',
        '决定': 'decision',
        '理由': 'reason',
        
        // 英文键名
        'agent': 'agent',
        'role': 'role',
        'group': 'group',
        'organization': 'organization',
        'physicalStructure': 'physicalStructure',
        'goal': 'goal',
        'purpose': 'purpose',
        'plan': 'plan',
        'policy': 'policy',
        'task': 'task',
        'action': 'action',
        'procedure': 'procedure',
        'resource': 'resource',
        'object': 'object',
        'event': 'event',
        'state': 'state',
        'physical': 'physical',
        'social': 'social',
        'economic': 'economic',
        'time': 'time',
        'location': 'location',
        'situation': 'situation',
        'attitude': 'attitude',
        'assumption': 'assumption',
        'expectation': 'expectation',
        'misunderstanding': 'misunderstanding',
        'argument': 'argument',
        'interpretation': 'interpretation',
        'decision': 'decision',
        'reason': 'reason'
    };
    return componentMap[componentZh];
}

// 辅助函数：合并AI建议的状态更新与当前状态表
function mergeStatusUpdates(currentTable, aiSuggestedUpdates) {
    if (!aiSuggestedUpdates) return currentTable;
    
    const updatedTable = JSON.parse(JSON.stringify(currentTable)); // 深拷贝
    
    console.log('🔍 合并状态表更新:');
    console.log('当前状态表:', JSON.stringify(currentTable, null, 2));
    console.log('AI建议更新:', JSON.stringify(aiSuggestedUpdates, null, 2));
    
    // 映射AI返回的字段名到数据库字段名
    const fieldMapping = {
        'actionerField': 'actor',
        'intentionField': 'intention',
        'taskField': 'task',
        'environmentField': 'environment',
        'communicationField': 'communication'
    };
    
    // 遍历AI建议的状态更新
    for (const [field, components] of Object.entries(aiSuggestedUpdates)) {
        // 映射字段名
        const mappedField = fieldMapping[field] || field;
        
        console.log(`处理字段: ${field} -> ${mappedField}`);
        
        // 如果字段不存在，创建它
        if (!updatedTable[mappedField]) {
            console.log(`创建新字段: ${mappedField}`);
            updatedTable[mappedField] = {};
        }
        
        for (const [component, updateData] of Object.entries(components)) {
            console.log(`处理组件: ${component}`, updateData);
            
            // 如果组件不存在，创建它
            if (!updatedTable[mappedField][component]) {
                console.log(`创建新组件: ${mappedField}.${component}`);
                updatedTable[mappedField][component] = { status: 'pending', summary: '' };
            }
            
            if (updateData) {
                // 只有当AI提供了有效更新时才更新状态
                if (updateData.status) {
                    console.log(`更新状态: ${mappedField}.${component} -> ${updateData.status}`);
                    updatedTable[mappedField][component].status = updateData.status;
                }
                if (updateData.summary !== undefined && updateData.summary !== '') {
                    console.log(`更新摘要: ${mappedField}.${component} -> ${updateData.summary.substring(0, 50)}...`);
                    updatedTable[mappedField][component].summary = updateData.summary;
                }
            }
        }
    }
    
    console.log('✅ 合并后的状态表:', JSON.stringify(updatedTable, null, 2));
    return updatedTable;
}

// 辅助函数：生成已收集信息的摘要
function generateCollectedInfoSummary(statusTable) {
    const collectedInfo = [];
    
    for (const [field, components] of Object.entries(statusTable)) {
        for (const [component, data] of Object.entries(components)) {
            if (data.status === 'collected' && data.summary) {
                collectedInfo.push(`${field}.${component}: ${data.summary}`);
            }
        }
    }
    
    if (collectedInfo.length === 0) {
        return '暂无已收集的信息。';
    }
    
    return collectedInfo.join('\n');
}

// 辅助函数：统计已收集的项目数
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

// 辅助函数：解析AI回复，提取纯净内容并更新状态表
function parseAIReply(reply, currentStatusTable) {
    let parsedReply = reply;
    let updatedTable = { ...currentStatusTable };

    // 解析新的状态表格式
    const newFormatMatch = reply.match(/【状态表】([\s\S]*?)【下一问题】([\s\S]*)/);
    if (newFormatMatch) {
        const tableText = newFormatMatch[1];
        parsedReply = newFormatMatch[2].trim();
        
        // 解析状态表更新
        const lines = tableText.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            // 解析 "领域.组件: 状态，摘要="..." 格式的更新
            const match = line.match(/([^.]+)\.([^:]+):\s*([^,]+)，摘要="([^"]*)"/);
            if (match) {
                const [, category, component, status, summary] = match;
                
                // 映射中文领域名到英文键名
                const categoryKey = mapChineseCategoryToEnglish(category.trim());
                const componentKey = mapChineseComponentToEnglish(component.trim());
                
                if (categoryKey && componentKey && updatedTable[categoryKey] && updatedTable[categoryKey][componentKey]) {
                    updatedTable[categoryKey][componentKey].status = status.trim();
                    updatedTable[categoryKey][componentKey].summary = summary.trim();
                }
            }
        });
    } else {
        // 解析旧格式
        const legacyStatusUpdateMatch = reply.match(/【状态更新】([\s\S]*?)【下一问题】/);
        if (legacyStatusUpdateMatch) {
            const updateText = legacyStatusUpdateMatch[1];
            const updateLines = updateText.split('\n').filter(line => line.trim());
            
            updateLines.forEach(line => {
                const match = line.match(/[-*]\s*([^.]+)\.([^:]+):\s*([^,]+)，摘要="([^"]*)"/);
                if (match) {
                    const [, category, component, status, summary] = match;
                    if (updatedTable[category] && updatedTable[category][component]) {
                        updatedTable[category][component].status = status.trim();
                        updatedTable[category][component].summary = summary.trim();
                    }
                }
            });
            
            const nextQuestionMatch = reply.match(/【下一问题】([\s\S]*)/);
            if (nextQuestionMatch) {
                parsedReply = nextQuestionMatch[1].trim();
            }
        }
    }

    // 清理回复内容
    parsedReply = parsedReply.replace(/【.*?】/g, '').trim(); // 移除所有标签
    parsedReply = parsedReply.replace(/\*\*.*?\*\*/g, '').trim(); // 移除粗体标记
    parsedReply = parsedReply.replace(/\n{3,}/g, '\n\n').trim(); // 规范化换行

    // 清理多余的星号
    parsedReply = parsedReply.replace(/\*\*/g, '');
    
    // 清理多余的分隔符和空行
    parsedReply = parsedReply.replace(/-{3,}/g, '');
    parsedReply = parsedReply.replace(/={10,}/g, '');
    
    // 清理多余的空白字符
    parsedReply = parsedReply.replace(/\s+/g, ' ').trim();
    
    // 如果清理后的回复不为空，则使用清理后的回复
    if (parsedReply.trim()) {
        parsedReply = parsedReply;
    }
    
    return { parsedReply, updatedStatusTable: updatedTable };
}

// DeepSeek API调用函数 - 用于对话式提问，返回结构化JSON
async function callDeepSeekAPI(prompt, context = null) {
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const apiKey = 'sk-852776dbae374cd0897001aa991243c6'; // 您的固定API密钥

    console.log('🔍 准备调用DeepSeek API:', {
        hasContext: !!context,
        projectId: context?.projectId,
        useCaseId: context?.useCaseId,
        useCaseName: context?.useCaseName,
        actorName: context?.actorName,
        promptLength: prompt.length
    });

    try {
        // 获取历史消息
        const historyMessages = await getRecentChatHistory(context?.sessionId || null);

        // 构建消息数组，包含系统提示、历史消息和当前用户消息
        const messages = [];

        // 添加系统提示，要求大模型输出结构化JSON
        let systemPrompt = `你是一名资深的需求工程顾问，专精于基于场景的需求获取方法。你的核心任务是通过结构化提问，引导用户逐步完善场景描述。

请严格按照以下JSON格式输出你的回复：
{
  "question": "你要向用户提出的问题",
  "statusUpdate": {
    "actionerField": {
      "agent": {"status": "collected|pending", "summary": "摘要信息"},
      "role": {"status": "collected|pending", "summary": "摘要信息"},
      "group": {"status": "collected|pending", "summary": "摘要信息"},
      "organization": {"status": "collected|pending", "summary": "摘要信息"},
      "physicalStructure": {"status": "collected|pending", "summary": "摘要信息"}
    },
    "intentionField": {
      "goal": {"status": "collected|pending", "summary": "摘要信息"},
      "purpose": {"status": "collected|pending", "summary": "摘要信息"},
      "plan": {"status": "collected|pending", "summary": "摘要信息"},
      "policy": {"status": "collected|pending", "summary": "摘要信息"}
    },
    "taskField": {
      "task": {"status": "collected|pending", "summary": "摘要信息"},
      "action": {"status": "collected|pending", "summary": "摘要信息"},
      "procedure": {"status": "collected|pending", "summary": "摘要信息"},
      "resource": {"status": "collected|pending", "summary": "摘要信息"},
      "object": {"status": "collected|pending", "summary": "摘要信息"},
      "event": {"status": "collected|pending", "summary": "摘要信息"},
      "state": {"status": "collected|pending", "summary": "摘要信息"}
    },
    "environmentField": {
      "physical": {"status": "collected|pending", "summary": "摘要信息"},
      "social": {"status": "collected|pending", "summary": "摘要信息"},
      "economic": {"status": "collected|pending", "summary": "摘要信息"},
      "time": {"status": "collected|pending", "summary": "摘要信息"},
      "location": {"status": "collected|pending", "summary": "摘要信息"},
      "situation": {"status": "collected|pending", "summary": "摘要信息"}
    },
    "communicationField": {
      "attitude": {"status": "collected|pending", "summary": "摘要信息"},
      "assumption": {"status": "collected|pending", "summary": "摘要信息"},
      "expectation": {"status": "collected|pending", "summary": "摘要信息"},
      "misunderstanding": {"status": "collected|pending", "summary": "摘要信息"},
      "argument": {"status": "collected|pending", "summary": "摘要信息"},
      "interpretation": {"status": "collected|pending", "summary": "摘要信息"},
      "decision": {"status": "collected|pending", "summary": "摘要信息"},
      "reason": {"status": "collected|pending", "summary": "摘要信息"}
    }
  }
}

请只输出有效的JSON格式，不要包含任何其他解释文字。
`;

        // 如果有上下文信息，则增强系统提示词
        if (context && context.projectId && context.useCaseId) {
            const contextInfo = `当前对话是关于项目ID ${context.projectId}、用例ID ${context.useCaseId}的场景细化。` +
                               `具体用例名称是"${context.useCaseName || '未知用例'}"，参与者是"${context.actorName || '未知参与者'}"。` +
                               `请专注于这个特定用例的场景细节，确保所有问题和建议都与此用例相关。` +
                               `特别注意：如果这是首次对话且用户已提供具体场景，跳过通用开场白，直接进入该场景的细节提问。`;
            
            systemPrompt = `${contextInfo}\n\n${systemPrompt}`;
        }
        
        // 增强提示词，明确要求AI更新状态表
        systemPrompt += `\n\n重要指导原则：\n` +
                        `1. 每次提问后，必须根据用户的回答更新相应的状态表组件\n` +
                        `2. 避免重复询问已经收集到的信息\n` +
                        `3. 根据已收集的信息，提出新的、未收集的细节问题\n` +
                        `4. 确保状态更新准确反映用户提供的信息\n` +
                        `5. 当大部分信息收集完成后，可以开始总结和生成场景`;


        messages.push({ role: 'system', content: systemPrompt });

        // 添加历史消息
        messages.push(...historyMessages);

        // 添加当前用户消息
        messages.push({ role: 'user', content: prompt });

        console.log('📤 发送API请求，消息数量:', messages.length);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                stream: false,
                max_context_length: 131072, // 128K tokens
                response_format: { "type": "json_object" }  // 请求JSON格式的响应
            })
        });

        console.log('📥 API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API请求失败详情:', errorText);
            throw new Error(`API请求失败: ${response.status} ${response.statusText}. 详情: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ API请求成功，原始响应:', data.choices?.[0]?.message?.content || '');

        let content = data.choices[0].message.content;

        // 尝试解析JSON响应
        try {
            // 清理响应内容，移除可能的markdown包装
            content = content.replace(/^```json\s*|```\s*$/g, '').trim();
            
            const parsedResponse = JSON.parse(content);
            
            // 验证JSON结构
            if (parsedResponse.question && parsedResponse.statusUpdate) {
                return parsedResponse;
            } else {
                console.warn('⚠️ AI未返回预期的JSON结构，使用降级处理');
                // 降级处理：返回原始内容作为问题
                return {
                    question: content,
                    statusUpdate: null
                };
            }
        } catch (parseError) {
            console.error('⚠️ JSON解析失败，使用降级处理:', parseError.message);
            // 降级处理：返回原始内容作为问题
            return {
                question: content,
                statusUpdate: null
            };
        }
    } catch (error) {
        console.error('🚨 DeepSeek API调用错误:', error.message);
        throw error; // 重新抛出错误，让上层处理
    }
}

// 用于简单场景生成的API调用函数
async function callSimpleScenarioAPI(prompt, systemPrompt) {
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const apiKey = 'sk-852776dbae374cd0897001aa991243c6';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/plain'
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false,
            max_context_length: 131072 // 128K tokens
        })
    });

    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// 对话API - 集成状态表功能
router.post('/chat', async (req, res) => {
    console.log('=== 收到用户请求 ===');
    console.log('用户消息:', req.body.message);
    
    if (!req.session) {
        return res.status(401).json({ error: '请先登录' });
    }

    const userMessage = req.body.message;
    const context = req.body.context; // 包含projectId, useCaseId等上下文信息
    const sessionId = req.session.id;

    if (!userMessage) {
        return res.status(400).json({ error: '消息内容不能为空' });
    }

    try {
        // 1. 保存用户消息到数据库
        userModel.saveMessage(sessionId, 'user', userMessage);

        // 2. 获取当前会话的状态表和对话历史
        const [statusTable, recentMessages] = await Promise.all([
            getSessionStatusTable(sessionId),
            getRecentMessages(sessionId, 6)
        ]);

        // 3. 构造发送给AI的提示词（不再包含状态表，只包含已收集的信息摘要）
        let enhancedPrompt;
        if (recentMessages.length === 0) {
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
        await updateSessionStatusTable(sessionId, updatedStatusTable);

        // 8. 保存AI回复到数据库（只保存问题部分）
        userModel.saveMessage(sessionId, 'assistant', nextQuestion);

        console.log('AI回复内容:', nextQuestion.substring(0, 100) + '...');
        res.json({ 
            reply: nextQuestion,
            statusTable: updatedStatusTable,
            collectedCount: countCollectedItems(updatedStatusTable) // 返回已收集项的数量
        });

    } catch (error) {
        console.error('请求出错:', error.message);
        res.status(500).json({ 
            error: '服务器错误: ' + error.message 
        });
    }
});

// 场景生成API - 用于提前生成场景
router.post('/generate', async (req, res) => {
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ error: '请先登录' });
    }

    try {
        const { projectId, useCaseId, title, initialInput } = req.body;
        const sessionId = req.session.id;
        const statusTable = await getSessionStatusTable(sessionId);
        
        const generationPrompt = `${SIMPLE_GENERATION_PROMPT}\n\n基于以下收集到的完整信息，生成一个结构化的场景文档（包含基本流、备选流、异常流）：\n\n${statusTableToText(statusTable)}`;

        const scenario = await callDeepSeekAPI(generationPrompt);

        // 清理场景内容中的格式符号，提升用户阅读体验
        let cleanedScenario = scenario;
        // 移除星号
        cleanedScenario = cleanedScenario.replace(/\*/g, '');
        // 只移除连续的空行，保留有意义的换行
        cleanedScenario = cleanedScenario.replace(/\n\s*\n/g, '\n\n');
        // 清理每行开头和结尾的空白字符
        cleanedScenario = cleanedScenario.split('\n').map(line => line.trim()).join('\n');
        // 最后清理首尾空白
        cleanedScenario = cleanedScenario.trim();

        // 保存生成的场景到数据库
        if (projectId && useCaseId) {
            const scenarioId = userModel.createScenario(
                req.session.user_id, 
                projectId, 
                useCaseId, 
                sessionId, 
                title, 
                cleanedScenario,
                'completed'
            );
            
            res.json({ 
                success: true, 
                scenarioId,
                scenario: cleanedScenario 
            });
        } else {
            res.json({ 
                success: true, 
                scenario: cleanedScenario 
            });
        }
    } catch (error) {
        console.error('场景生成错误:', error);
        res.status(500).json({ error: '场景生成失败: ' + error.message });
    }
});

// 简单场景生成API - 用于提前生成场景
router.post('/generate-simple', async (req, res) => {
    if (!req.session || !req.session.user_id) {
        console.log('❌ 简单场景生成 - 会话验证失败');
        return res.status(401).json({ error: '请先登录' });
    }

    try {
        const { projectId, useCaseId, title, initialInput } = req.body;
        const sessionId = req.session.id;
        
        console.log('🔍 简单场景生成请求:', { projectId, useCaseId, title });
        
        // 使用简化的系统提示词，适合快速场景生成
        const simpleSystemPrompt = `你是一名软件需求分析师。请根据用户提供的信息，生成一个简洁但完整的场景描述。场景描述应包含基本流（主要步骤）、参与者、目标和简要的环境信息。`;

        const simpleGenerationPrompt = `基于以下信息，生成一个简洁的场景描述：

${initialInput}

请生成简洁但完整的场景描述：`;

        const scenario = await callSimpleScenarioAPI(simpleGenerationPrompt, simpleSystemPrompt);

        // 清理场景内容中的格式符号，提升用户阅读体验
        let cleanedScenario = scenario;
        // 移除星号
        cleanedScenario = cleanedScenario.replace(/\*/g, '');
        // 只移除连续的空行，保留有意义的换行
        cleanedScenario = cleanedScenario.replace(/\n\s*\n/g, '\n\n');
        // 清理每行开头和结尾的空白字符
        cleanedScenario = cleanedScenario.split('\n').map(line => line.trim()).join('\n');
        // 最后清理首尾空白
        cleanedScenario = cleanedScenario.trim();

        // 保存生成的场景到数据库
        if (projectId && useCaseId) {
            const scenarioId = userModel.createScenario(
                req.session.user_id, 
                projectId, 
                useCaseId, 
                sessionId, 
                title, 
                initialInput
            );
            
            console.log('💾 保存场景到数据库，ID:', scenarioId);
            
            // 对于简单生成，状态表为空
            userModel.updateScenarioContent(scenarioId, cleanedScenario, JSON.stringify(createInitialStatusTable()));
        }

        console.log('✅ 简单场景生成成功');
        res.json({ 
            success: true, 
            scenario: cleanedScenario
        });

    } catch (error) {
        console.error('❌ 简单场景生成错误:', error);
        res.status(500).json({ error: '简单场景生成失败: ' + error.message });
    }
});

// 保存编辑后的场景内容
router.post('/scenarios/save-edited', async (req, res) => {
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ error: '请先登录' });
    }

    try {
        const { projectId, useCaseId, content } = req.body;
        
        if (!projectId || !useCaseId || typeof content !== 'string') {
            return res.status(400).json({ error: '缺少必要参数：projectId、useCaseId或content' });
        }

        console.log('📝 保存编辑后的场景内容:', { projectId, useCaseId, contentLength: content.length });

        // 获取用户现有的场景（如果有）
        const existingScenarios = userModel.getScenariosByUseCase(useCaseId);
        let scenarioId;

        if (existingScenarios && existingScenarios.length > 0) {
            // 如果已存在场景，则更新第一个场景的内容
            scenarioId = existingScenarios[0].id;
            userModel.updateScenarioContent(scenarioId, content, JSON.stringify(createInitialStatusTable()));
            console.log('✏️ 更新现有场景，ID:', scenarioId);
        } else {
            // 如果没有现有场景，则创建新场景
            scenarioId = userModel.createScenario(
                req.session.user_id,
                projectId,
                useCaseId,
                req.session.id,
                `Edited Scenario for Use Case ${useCaseId}`,
                content
            );
            console.log('🆕 创建新场景，ID:', scenarioId);
        }

        res.json({
            success: true,
            message: '场景已保存',
            scenarioId: scenarioId
        });

    } catch (error) {
        console.error('❌ 保存编辑的场景失败:', error);
        res.status(500).json({ error: '保存编辑的场景失败: ' + error.message });
    }
});

module.exports = router;