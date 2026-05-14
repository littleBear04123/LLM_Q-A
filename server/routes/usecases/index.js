const express = require('express');
const { validateSession } = require('../auth/session');
const { db } = require('../../database');
const UseCaseModel = require('../../database/models/usecase');
const ScenarioModel = require('../../database/models/scenario');

const useCaseModel = new UseCaseModel(db);
const scenarioModel = new ScenarioModel(db);

const router = express.Router();

// 应用到所有用例路由
router.use(validateSession);

// 获取用例列表
router.get('/', async (req, res) => {
    try {
        const { projectId } = req.query;
        
        if (!projectId) {
            return res.status(400).json({ error: '缺少项目ID' });
        }

        const useCases = useCaseModel.getUseCasesByProject(projectId);
        const formattedUseCases = useCases.map(uc => {
            // 检查该用例是否有场景图代码
            const scenario = scenarioModel.getScenarioByUseCase(uc.id);
            console.log(`用例ID: ${uc.id}, 用例名称: ${uc.use_case_name}`);
            console.log(`  场景数据:`, scenario);
            console.log(`  场景图代码存在:`, !!scenario && !!scenario.scenario_plantuml_code);
            console.log(`  场景图代码长度:`, scenario ? scenario.scenario_plantuml_code?.length : 'N/A');
            console.log(`  场景图代码内容预览:`, scenario ? scenario.scenario_plantuml_code?.substring(0, 50) : 'N/A');
            
            const hasDiagram = scenario && scenario.scenario_plantuml_code && scenario.scenario_plantuml_code.trim() !== '';
            console.log(`  是否有图:`, hasDiagram);
            
            // 如果有场景图代码，状态设为 completed，否则保持原有状态或设为 pending
            const status = hasDiagram ? 'completed' : (uc.status || 'pending');
            console.log(`  最终状态:`, status);
            
            return {
                id: uc.id,
                use_case_name: uc.use_case_name,
                actor: uc.actor,
                description: uc.description || '',
                status: status,
                project_id: uc.project_id
            };
        });
        
        res.json({ success: true, useCases: formattedUseCases });
    } catch (error) {
        console.error('Get use cases error:', error);
        res.status(500).json({ error: '获取用例列表失败: ' + error.message });
    }
});

// 更新用例状态
router.put('/:id/status', async (req, res) => {
    try {
        const useCaseId = req.params.id;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: '缺少状态信息' });
        }
        
        useCaseModel.updateUseCaseStatus(useCaseId, status);
        res.json({ success: true, message: '用例状态更新成功' });
    } catch (error) {
        console.error('Update use case status error:', error);
        res.status(500).json({ error: '更新用例状态失败: ' + error.message });
    }
});

module.exports = router;