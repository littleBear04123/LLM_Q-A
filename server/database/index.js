// server/database/index.js - 数据库主入口
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 导入迁移脚本
const { initializeTables } = require('./migrations/init');

// 初始化数据库表
initializeTables(db);

// 导入模型类
const UserModel = require('./models/user');
const ProjectModel = require('./models/project');
const UseCaseModel = require('./models/usecase');
const ScenarioModel = require('./models/scenario');
const MessageModel = require('./models/message');

// 创建模型实例
const userModel = new UserModel(db);
const projectModel = new ProjectModel(db);
const useCaseModel = new UseCaseModel(db);
const scenarioModel = new ScenarioModel(db);
const messageModel = new MessageModel(db);

module.exports = {
    db,
    uuidv4,
    userModel,
    projectModel,
    useCaseModel,
    scenarioModel,
    messageModel
};