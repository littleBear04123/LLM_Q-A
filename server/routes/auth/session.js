const express = require('express');
const router = express.Router();

// 统一的会话验证中间件
const validateSession = (req, res, next) => {
  if (!req.session || !req.session.user_id) {
    console.log('会话验证失败: 会话不存在或无用户ID');
    return res.status(401).json({ error: '未登录' });
  }
  
  console.log('会话验证通过，用户ID:', req.session.user_id);
  next();
};

module.exports = { validateSession, router };