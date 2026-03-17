const express = require('express');
const router = express.Router();
const { userModel } = require('../database');
const { createInitialStatusTable } = require('../utils');

router.post('/init', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || username.trim() === '') {
            return res.status(400).json({ error: '用户名不能为空' });
        }

        const cleanUsername = username.trim();
        const user = userModel.findOrCreate(cleanUsername);
        const session = userModel.createSession(user.id);
        
        // 暂时注释掉有问题的代码，返回空数组
        // const unfinishedScenarios = userModel.getUnfinishedScenarios(user.id);
        const unfinishedScenarios = [];
        
        res.json({
            success: true,
            user: { 
                id: user.id, 
                username: user.username 
            },
            session: { 
                token: session.sessionToken, 
                id: session.sessionId 
            },
            hasUnfinishedScenario: unfinishedScenarios.length > 0,
            unfinishedScenario: unfinishedScenarios[0] || null
        });
        
    } catch (error) {
        console.error('Init error:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

module.exports = router;
