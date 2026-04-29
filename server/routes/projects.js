const express = require('express');
const router = express.Router();
const { userModel, db } = require('../database');

// 统一的会话验证中间件
const validateSession = (req, res, next) => {
    if (!req.session || !req.session.user_id) {
        console.log('项目路由-会话验证失败');
        return res.status(401).json({ error: '请先登录' });
    }
    
    console.log('项目路由-会话验证通过，用户ID:', req.session.user_id);
    next();
};

// 应用到所有项目路由
router.use(validateSession);

// 创建新项目
router.post('/', async (req, res) => {
    try {
        const { projectName, description, requirementText } = req.body;
        
        if (!projectName || !requirementText) {
            return res.status(400).json({ error: '项目名称和需求描述不能为空' });
        }

        const projectId = userModel.createProject(
            req.session.user_id, 
            projectName, 
            description, 
            requirementText
        );

        res.json({
            success: true,
            project: {
                id: projectId,
                projectName,
                description,
                requirementText
            }
        });

    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: '创建项目失败' });
    }
});

// 获取用户的所有项目
router.get('/user-projects', async (req, res) => {
    try {
        const projects = userModel.getProjectsByUser(req.session.user_id);
        res.json({ success: true, projects });
    } catch (error) {
        console.error('获取项目列表失败:', error);
        res.status(500).json({ error: '获取项目列表失败' });
    }
});

// 生成UML用例图
router.post('/:id/generate-uml', async (req, res) => {
    try {
        const projectId = req.params.id;//从URL参数中获取项目ID
        const { requirementText } = req.body;//从请求体中获取需求描述

        if (!requirementText) {
            return res.status(400).json({ error: '需求描述不能为空' });
        }

        console.log('========== 后端 UML生成开始 ==========');
        console.log('请求项目ID:', projectId);
        console.log('会话用户ID:', req.session.user_id);
        
        //验证项目是否存在且属于当前用户
        let currentProject;
        try {
            const stmt = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
            currentProject = stmt.get(projectId, req.session.user_id);
        } catch (dbError) {
            console.error('数据库查询错误:', dbError);
            // 如果直接查询失败，回退到原来的方法
            const projects = userModel.getProjectsByUser(req.session.user_id);
            currentProject = projects.find(p => p.id == projectId);
        }
        
        if (!currentProject) {
            console.error('项目验证失败');
            console.error('可用项目查询:');
            try {
                const allProjects = userModel.getProjectsByUser(req.session.user_id);
                console.error('用户所有项目:', allProjects);
            } catch (e) {
                console.error('查询用户项目失败:', e);
            }
            return res.status(404).json({ error: '项目不存在或无权限访问' });
        }

        console.log('项目验证通过:', currentProject);
        
        // 调用AI生成UML代码
       console.log('项目验证通过:', currentProject);

// 优先使用数据库中已有的UML代码，如果没有则生成新的
let plantUmlCode = currentProject.uml_plantuml_code;

if (!plantUmlCode || plantUmlCode.trim() === '') {
    console.log('未找到现有UML代码，正在生成新的UML代码');
    plantUmlCode = await generateUMLWithAI(requirementText);
    console.log('生成的PlantUML代码长度:', plantUmlCode.length);
    
    // 保存UML代码到数据库（保存PlantUML格式）
    userModel.updateProjectUML(projectId, plantUmlCode);
} else {
    console.log('使用现有UML代码进行解析');
}

// 解析UML代码提取用例
const useCases = extractUseCasesFromPlantUML(plantUmlCode);
console.log('提取的用例数量:', useCases.length);
        
        // 保存用例到数据库
        const createdUseCases = [];
        for (const useCase of useCases) {
            try {
                // 创建数据库记录
                const useCaseId = userModel.createUseCase(projectId, useCase.name, useCase.actor, useCase.description);
                
                // 确保返回的数据结构与前端期望的一致
                createdUseCases.push({
                    id: useCaseId,
                    use_case_name: useCase.name,  // 关键：使用前端需要的字段名
                    actor: useCase.actor,
                    description: useCase.description,
                    status: 'pending',
                    project_id: projectId
                });
                console.log('创建用例成功:', useCase.name);
            } catch (dbError) {
                console.error('创建用例失败:', useCase.name, '错误:', dbError.message);
                // 即使数据库失败，也要返回用例信息给前端
                createdUseCases.push({
                    id: generateUseCaseId(useCase.name),
                    use_case_name: useCase.name,
                    actor: useCase.actor,
                    description: useCase.description,
                    status: 'pending',
                    project_id: projectId
                });
            }
        }

        console.log('UML生成完成，用例已保存到数据库');
        
        // 从数据库获取最新的用例列表，确保数据一致性
        const savedUseCases = userModel.getUseCasesByProject(projectId);
        const formattedUseCases = savedUseCases.map(uc => ({
            id: uc.id,
            use_case_name: uc.use_case_name,
            actor: uc.actor,
            description: uc.description || '',
            status: uc.status || 'pending',
            project_id: uc.project_id
        }));
        
        console.log('从数据库获取的最新用例数量:', formattedUseCases.length);
        
        res.json({
            success: true,
            plantUmlCode: plantUmlCode,  // 现在plantUmlCode字段存储PlantUML代码
            useCases: formattedUseCases
        });

    } catch (error) {
        console.error('生成UML图失败:', error);
        res.status(500).json({ error: '生成UML图失败: ' + error.message });
    }
});

// 获取项目的所有用例
router.get('/:id/use-cases', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // 直接查询数据库验证项目权限（更高效）
        const projectStmt = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
        const project = projectStmt.get(projectId, req.session.user_id);
        
        if (!project) {
            return res.status(404).json({ error: '项目不存在或无权限访问' });
        }

        console.log('正在从数据库获取项目', projectId, '的用例列表');
        const useCases = userModel.getUseCasesByProject(projectId);
        console.log('从数据库获取的用例数量:', useCases.length);
        
        // 确保返回的数据结构与前端期望的一致
        const formattedUseCases = useCases.map(uc => ({
            id: uc.id,
            use_case_name: uc.use_case_name,
            actor: uc.actor,
            description: uc.description || '',
            status: uc.status || 'pending',
            project_id: uc.project_id
        }));
        
        res.json({ success: true, useCases: formattedUseCases });
    } catch (error) {
        console.error('Get use cases error:', error);
        res.status(500).json({ error: '获取用例列表失败: ' + error.message });
    }
});

// AI生成UML用例图
async function generateUMLWithAI(requirementText) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const apiKey = 'sk-852776dbae374cd0897001aa991243c6';

    const systemPrompt = `你是一个专业的软件架构师，擅长生成精确的UML用例图。
请根据用户需求生成标准的PlantUML用例图代码，确保语法完全正确。

要求：
1. 只返回PlantUML代码，不要有其他文字说明
2. 使用标准的用例图语法，语法必须严格正确
3. 包含参与者(Actor)和用例(Use Case)，使用标准PlantUML语法
4. 每行定义一个元素或关系
5. 确保所有括号和引号正确配对
6. 使用@startuml和@enduml标签

正确示例：
\`\`\`
@startuml
left to right direction
actor 读者 as Reader
actor 图书管理员 as Librarian
actor 系统管理员 as Admin

Reader --> (查询图书)
Reader --> (借阅图书)
Reader --> (归还图书)

Librarian --> (图书信息管理)
Librarian --> (读者信息管理)
Librarian --> (借阅记录管理)

Admin --> (系统维护)
Admin --> (用户权限管理)
@enduml
\`\`\`

错误示例（避免）：
\`\`\`
@startuml
actor 读者
(查询图书)
读者 -> 查询图书  # 错误：语法不规范
@enduml
\`\`\``;

    const userPrompt = `根据以下需求生成UML用例图，确保PlantUML语法100%正确：

需求描述：${requirementText}

请生成语法正确的PlantUML代码：`;

    const requestBody = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        stream: false,
        max_tokens: 2048,
        max_context_length: 131072, // 128K tokens
        temperature: 0.1
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let plantUmlCode = data.choices[0]?.message?.content || '';
    
    plantUmlCode = plantUmlCode.replace(/```(?:\w+)?/g, '').trim();
    
    // 确保PlantUML代码包含必要的标签
    if (!plantUmlCode.includes('@startuml')) {
        plantUmlCode = '@startuml\n' + plantUmlCode;
    }
    if (!plantUmlCode.includes('@enduml')) {
        plantUmlCode += '\n@enduml';
    }
    
    console.log('AI返回的原始代码:', plantUmlCode);
    
    return plantUmlCode;
}



// 从PlantUML代码中提取用例信息
function extractUseCasesFromPlantUML(plantUmlCode) {
    console.log('========== 开始解析PlantUML代码 ==========');
    
    const useCases = [];
    const lines = plantUmlCode.split('\n');
    
    // 存储参与者映射 (别名 -> 真实名称)
    const actorAliases = {};
    // 存储参与者列表
    const actors = [];
    // 存储用例别名映射 (别名 -> 真实用例名)
    const useCaseAliases = {};
    
    // 第一步：提取参与者定义
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 匹配 actor "名称" as 别名 或 actor 名称 as 别名
        if (trimmedLine.toLowerCase().startsWith('actor ')) {
            const actorMatch = trimmedLine.match(/actor\s+["']?([^"'\s]+(?:\s+[^"'\s]+)*)["']?\s+as\s+(\w+)/i);
            if (actorMatch) {
                const realName = actorMatch[1].replace(/["']/g, '').trim();
                const alias = actorMatch[2].trim();
                actorAliases[alias] = realName;
                actors.push(realName);
                console.log(`👤 发现参与者: ${realName} (别名: ${alias})`);
            } else {
                // 匹配简单的 actor 名称 (可能包含中文)
                const simpleActorMatch = trimmedLine.match(/actor\s+["']?([^"'\s]+(?:\s+[^"'\s]+)*)["']?/i);
                if (simpleActorMatch) {
                    const realName = simpleActorMatch[1].replace(/["']/g, '').trim();
                    actorAliases[realName] = realName;
                    actors.push(realName);
                    console.log(`👤 发现参与者: ${realName}`);
                }
            }
        }
        
        // 提取用例别名定义 (用例名称) as 别名
        const aliasMatch = trimmedLine.match(/\(([^)]+)\)\s+as\s+(\w+)/);
        if (aliasMatch) {
            const useCaseName = aliasMatch[1].trim();
            const alias = aliasMatch[2].trim();
            useCaseAliases[alias] = useCaseName;
            console.log(`🔄 映射用例别名: ${alias} -> ${useCaseName}`);
        }
    }
    
    // 第二步：提取关联关系
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 匹配关联关系: ActorAlias --> (UseCase) 或 ActorAlias --> UseCaseAlias
        const relationMatch = trimmedLine.match(/(\w+)\s*-->\s*\(([^)]+)\)|(\w+)\s*-->\s*(\w+)/);
        if (relationMatch) {
            let actorAlias, useCaseName;
            
            if (relationMatch[1] && relationMatch[2]) {
                // 匹配: ActorAlias --> (UseCase)
                actorAlias = relationMatch[1];
                useCaseName = relationMatch[2];
            } else if (relationMatch[3] && relationMatch[4]) {
                // 匹配: ActorAlias --> UseCaseAlias
                actorAlias = relationMatch[3];
                const useCaseAlias = relationMatch[4];
                useCaseName = useCaseAliases[useCaseAlias] || useCaseAlias;
            }
            
            if (actorAlias && useCaseName) {
                // 解析真实参与者名称
                const realActor = actorAliases[actorAlias] || actorAlias;
                
                useCases.push({
                    name: useCaseName,
                    actor: realActor,
                    description: `${realActor}执行${useCaseName}功能`
                });
                
                console.log(`关联: ${realActor} -> ${useCaseName}`);
            }
        }
    }
    
    // 如果没有找到关联关系，尝试从参与者和用例中构建基本关联
    if (useCases.length === 0) {
        console.log('未找到关联关系，尝试构建基本用例');
        
        // 从行中查找用例定义 (用例名称)
        for (const line of lines) {
            const trimmedLine = line.trim();
            const useCaseMatch = trimmedLine.match(/\(([^)]+)\)/);
            if (useCaseMatch) {
                const useCaseName = useCaseMatch[1].trim();
                
                // 简单分配给第一个参与者，或默认参与者
                const actor = actors.length > 0 ? actors[0] : '用户';
                
                // 避免重复
                const exists = useCases.some(uc => uc.name === useCaseName && uc.actor === actor);
                if (!exists) {
                    useCases.push({
                        name: useCaseName,
                        actor: actor,
                        description: `${actor}执行${useCaseName}功能`
                    });
                    
                    console.log(`📝 创建基本用例: ${actor} -> ${useCaseName}`);
                }
            }
        }
    }
    
    console.log(`最终提取 ${useCases.length} 个用例`);
    console.log('提取的用例:', useCases);
    
    return useCases;
}

// 预处理PlantUML代码，展开嵌套结构
//为后续的用例提取函数（如extractUseCasesFromPlantUML）提供干净的PlantUML代码，
// 去除不必要的格式和容器包装，使得用例和参与者定义更容易被解析。
function preprocessPlantUml(plantUmlCode) {
    const lines = plantUmlCode.split('\n');
    const processedLines = [];
    
    // 使用栈来跟踪嵌套层级，但我们会提取所有内容，不管层级
    let insideContainer = false;
    let containerNestLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // 跳过开始和结束标记
        if (line.startsWith('@startuml') || line.startsWith('@enduml')) {
            continue;
        }
        
        // 跳过样式设置和其他非核心内容
        if (line.startsWith('skinparam') || 
            line.startsWith('left to right direction') || 
            line.startsWith('hide empty members') || 
            line.startsWith('!theme') ||
            line.startsWith('note') ||
            line.startsWith('legend') ||
            line.startsWith('center header') ||
            line.startsWith('footer') ||
            line.startsWith('title') ||
            line.startsWith('caption')) {
            continue;
        }
        
        // 检查是否是容器开始
        if (line.includes('{')) {
            // 检查是否是容器定义（而不是关联关系）
            if (/^(package|rectangle|namespace|frame|card|cloud|database|node|folder|storage|component|actor)\b/i.test(line)) {
                insideContainer = true;
                containerNestLevel++;
                // 跳过容器定义行，但仍需处理行内可能存在的内容
                const parts = line.split('{');
                const definitionPart = parts[0]; // 容器定义部分
                const contentPart = parts.slice(1).join('{'); // 可能的内容部分
                
                // 检查定义部分是否包含用例或参与者定义
                if (definitionPart.includes('(') || definitionPart.includes('actor')) {
                    processedLines.push(definitionPart.trim());
                }
                
                // 如果内容部分不为空，也需要处理
                if (contentPart.trim()) {
                    processedLines.push(contentPart.trim());
                }
                continue;
            }
        }
        
        // 检查是否是容器结束
        if (line.includes('}') && insideContainer) {
            containerNestLevel--;
            if (containerNestLevel <= 0) {
                insideContainer = false;
                containerNestLevel = 0;
            }
            continue; // 跳过纯容器结束行
        }
        
        // 如果是普通内容行，添加到结果中
        if (line && line !== '{' && line !== '}') {
            processedLines.push(line);
        }
    }
    
    return processedLines;
}

// 辅助函数：查找用例的精确参与者
function findExactActorForUseCase(plantUmlCode, useCaseName, actors) {
    // 查找格式: actor --> (用例) 或 :actor: --> (用例)
    const lines = plantUmlCode.split('\n');
    
    for (const line of lines) {
        // 检查是否有关联关系
        const associationMatch = line.match(/([\\w\\u4e00-\\u9fa5\\s:]+?)\\s*(?:-->|->)\\s*\\(([^)]+)\\)/);
        if (associationMatch) {
            let rawActor = associationMatch[1].replace(/[:]/g, '').trim();
            let matchedUseCase = associationMatch[2].trim();
            
            if (matchedUseCase === useCaseName) {
                // 检查rawActor是否在actors列表中
                for (const actor of actors) {
                    if (rawActor.includes(actor) || actor.includes(rawActor) || 
                        rawActor.includes(removePrefixes(actor)) || removePrefixes(rawActor).includes(actor)) {
                        return actor;
                    }
                }
            }
        }
    }
    return null;
}

// 辅助函数：去除参与者名称前缀
function removePrefixes(str) {
    // 移除可能的前缀如 "actor"等
    return str.replace(/^actor\s+/i, '').trim();
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// 生成用例ID
function generateUseCaseId(name) {
    return name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now();
}

// 删除项目及其所有相关数据
router.delete('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // 验证项目ID
        if (!projectId || isNaN(parseInt(projectId))) {
            return res.status(400).json({ error: '无效的项目ID' });
        }

        // 删除项目及其相关数据
        const success = userModel.deleteProject(parseInt(projectId), req.session.user_id);
        
        if (success) {
            res.json({ 
                success: true, 
                message: '项目及所有相关数据已成功删除' 
            });
        } else {
            res.status(404).json({ error: '项目不存在或删除失败' });
        }
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: '删除项目失败: ' + error.message });
    }
});

module.exports = router;