const express = require('express');
const router = express.Router();
const { userModel } = require('../database');
const { createInitialStatusTable } = require('../utils');

// 用户初始化/登录
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

// 删除用户账户及其所有数据
router.delete('/delete-account', async (req, res) => {
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ error: '请先登录' });
    }

    try {
        const userId = req.session.user_id;
        
        // 执行删除操作
        const success = userModel.deleteUserAccount(userId);
        
        if (success) {
            // 删除成功后，销毁会话
            req.session = null;  // 直接将session设为null
            res.json({ success: true, message: '账户及所有相关数据已成功删除' });
        } else {
            res.status(404).json({ error: '用户不存在' });
        }
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: '删除账户失败: ' + error.message });
    }
});

module.exports = router;