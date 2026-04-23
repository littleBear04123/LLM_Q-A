const { userModel } = require('../database');

const sessionMiddleware = (req, res, next) => {
    console.log('会话中间件 - 请求路径:', req.path);
    console.log('会话信息:', req.session);
    
    // 检查请求头中的会话token
    const sessionToken = req.headers['x-session-token'];
    console.log('请求头中的会话Token:', sessionToken);
    
    if (sessionToken) {
        try {
            const sessionData = userModel.getSessionByToken(sessionToken);
            if (sessionData) {
                // 将会话信息附加到req对象
                req.session = {
                    id: sessionData.id,
                    user_id: sessionData.user_id,
                    username: sessionData.username
                };
                console.log('会话Token验证成功，用户:', sessionData.username);
                
                // 更新会话活跃时间
                userModel.updateSessionActivity(sessionData.id);
            } else {
                console.log('会话Token无效');
                req.session = null;
            }
        } catch (error) {
            console.error('会话验证错误:', error);
            req.session = null;
        }
    } else {
        console.log('未提供会话Token');
    }
    
    next();
};

module.exports = sessionMiddleware;
