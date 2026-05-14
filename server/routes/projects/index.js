const express = require('express');
const { validateSession } = require('../auth/session');
const { db } = require('../../database');
const UserModel = require('../../database/models/user');
const ProjectModel = require('../../database/models/project');
const UseCaseModel = require('../../database/models/usecase');
const ScenarioModel = require('../../database/models/scenario');
const { generateUMLWithAI, extractUseCasesFromPlantUML, generateUseCaseId } = require('./helpers');

const userModel = new UserModel(db);
const projectModel = new ProjectModel(db);
const useCaseModel = new UseCaseModel(db);
const scenarioModel = new ScenarioModel(db);

const router = express.Router();

// 应用到所有项目路由
router.use(validateSession);

// 创建新项目
router.post('/', async (req, res) => {
    try {
        const { projectName, description, requirementText } = req.body;
        
        if (!projectName || !requirementText) {
            return res.status(400).json({ error: '项目名称和需求描述不能为空' });
        }

        const projectId = projectModel.createProject(
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
        const projects = projectModel.getProjectsByUser(req.session.user_id);
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
            const projects = projectModel.getProjectsByUser(req.session.user_id);
            currentProject = projects.find(p => p.id == projectId);
        }
        
        if (!currentProject) {
            console.error('项目验证失败');
            console.error('可用项目查询:');
            try {
                const allProjects = projectModel.getProjectsByUser(req.session.user_id);
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
    projectModel.updateProjectUML(projectId, plantUmlCode);
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
                const useCaseId = useCaseModel.createUseCase(projectId, useCase.name, useCase.actor, useCase.description);
                
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
        const savedUseCases = useCaseModel.getUseCasesByProject(projectId);
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
        const useCases = useCaseModel.getUseCasesByProject(projectId);
        console.log('从数据库获取的用例数量:', useCases.length);
        
        // 确保返回的数据结构与前端期望的一致
        const formattedUseCases = useCases.map(uc => {
            // 检查该用例是否有场景图代码
            const scenario = scenarioModel.getScenarioByUseCase(uc.id);
            const hasDiagram = scenario && scenario.scenario_plantuml_code && scenario.scenario_plantuml_code.trim() !== '';
            
            // 如果有场景图代码，状态设为 completed，否则保持原有状态或设为 pending
            const status = hasDiagram ? 'completed' : (uc.status || 'pending');
            
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

// 删除项目及其所有相关数据
router.delete('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // 验证项目ID
        if (!projectId || isNaN(parseInt(projectId))) {
            return res.status(400).json({ error: '无效的项目ID' });
        }

        // 删除项目及其相关数据
        const success = projectModel.deleteProject(parseInt(projectId), req.session.user_id);
        
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