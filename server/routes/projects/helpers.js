const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// AI生成UML图的函数
async function generateUMLWithAI(requirementText) {
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
                const simpleActorMatch = trimmedLine.match(/actor\s+["']?([^"'\s]+(?:\s+[^"'\s]+)*)["']?\s*/i);
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
        
        processedLines.push(lines[i]); // 保持原始缩进
    }
    
    return processedLines.join('\n');
}

function generateUseCaseId(name) {
    return btoa(name).substring(0, 8);
}

module.exports = {
    generateUMLWithAI,
    extractUseCasesFromPlantUML,
    preprocessPlantUml,
    generateUseCaseId
};