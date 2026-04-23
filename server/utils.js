//创建初始状态表
function createInitialStatusTable(sceneDescription = "") {
    // 创建初始状态表，所有组件都设为"pending"状态
    // 智能分析将由AI在首次对话中完成
    const initialTable = {
        actor: {
            agent: { status: "pending", summary: "" },
            role: { status: "pending", summary: "" },
            group: { status: "pending", summary: "" },
            organization: { status: "pending", summary: "" },
            physicalStructure: { status: "pending", summary: "" }
        },
        intention: {
            goal: { status: "pending", summary: "" },
            purpose: { status: "pending", summary: "" },
            plan: { status: "pending", summary: "" },
            policy: { status: "pending", summary: "" }
        },
        task: {
            task: { status: "pending", summary: "" },
            action: { status: "pending", summary: "" },
            procedure: { status: "pending", summary: "" },
            resource: { status: "pending", summary: "" },
            object: { status: "pending", summary: "" },
            event: { status: "pending", summary: "" },
            state: { status: "pending", summary: "" }
        },
        environment: {
            physical: { status: "pending", summary: "" },
            social: { status: "pending", summary: "" },
            economic: { status: "pending", summary: "" },
            time: { status: "pending", summary: "" },
            location: { status: "pending", summary: "" },
            situation: { status: "pending", summary: "" }
        },
        communication: {
            attitude: { status: "pending", summary: "" },
            assumption: { status: "pending", summary: "" },
            expectation: { status: "pending", summary: "" },
            misunderstanding: { status: "pending", summary: "" },
            argument: { status: "pending", summary: "" },
            interpretation: { status: "pending", summary: "" },
            decision: { status: "pending", summary: "" },
            reason: { status: "pending", summary: "" }
        }
    };

    return initialTable;
}

function statusTableToText(statusTable) {
    let text = "当前信息收集状态：\n";
    
    Object.entries(statusTable).forEach(([category, components]) => {
        text += `\n【${getCategoryName(category)}】\n`;
        Object.entries(components).forEach(([component, data]) => {
            const statusIcon = data.status === 'collected' ? '✅' : '❓';
            text += `${statusIcon} ${getComponentName(component)}: ${data.summary || '未收集'}\n`;
        });
    });
    
    return text;
}

function getCategoryName(category) {
    const names = {
        actor: '行动者',
        intention: '意图',
        task: '任务',
        environment: '环境',
        communication: '沟通'
    };
    return names[category] || category;
}

function getComponentName(component) {
    const names = {
        agent: '代理', role: '角色', group: '群体', organization: '组织', physicalStructure: '物理结构',
        goal: '目标', purpose: '目的', plan: '计划', policy: '策略',
        task: '任务', action: '动作', procedure: '流程', resource: '资源', object: '对象', event: '事件', state: '状态',
        physical: '物理环境', social: '社交环境', economic: '经济环境', time: '时间', location: '地点', situation: '情境',
        attitude: '态度', assumption: '假设', expectation: '期望', misunderstanding: '误解', argument: '论点', interpretation: '解释', decision: '决策', reason: '原因'
    };
    return names[component] || component;
}

module.exports = {
    createInitialStatusTable,
    statusTableToText
};