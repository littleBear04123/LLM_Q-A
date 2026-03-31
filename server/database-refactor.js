const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

console.log('开始数据库重构...');

try {
    // 获取当前表结构信息
    console.log('检查当前表结构...');
    
    // 在重构表之前，先获取session_id到scenario_id的映射
    const sessionScenarioLinks = db.prepare(`
        SELECT session_id, id as scenario_id
        FROM scenarios
        WHERE session_id IS NOT NULL
    `).all();
    
    console.log(`发现 ${sessionScenarioLinks.length} 个场景-会话关联`);
    
    // 获取所有消息数据
    const allMessages = db.prepare(`
        SELECT session_id, role, content, created_at 
        FROM messages
    `).all();
    
    console.log(`发现 ${allMessages.length} 条消息`);
    
    // 建立session_id到scenario_id的映射
    const sessionToScenarioMap = new Map();
    for (const link of sessionScenarioLinks) {
        if (link.session_id) {
            sessionToScenarioMap.set(link.session_id, link.scenario_id);
        }
    }
    
    // 开始事务
    db.exec('BEGIN TRANSACTION;');
    
    // 1. 重构scenarios表（移除user_id, session_id，保留use_case_id）
    console.log('1. 重构scenarios表...');
    
    // 创建新的scenarios表
    db.exec(`
        CREATE TABLE scenarios_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            use_case_id INTEGER NOT NULL,
            title TEXT,
            initial_input TEXT,
            generated_scenario TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (use_case_id) REFERENCES use_cases (id) ON DELETE CASCADE
        )
    `);
    
    // 迁移scenarios表数据
    const allScenarios = db.prepare(`
        SELECT id, use_case_id, title, initial_input, generated_scenario, created_at, updated_at 
        FROM scenarios
    `).all();
    
    if (allScenarios.length > 0) {
        const insertScenarioStmt = db.prepare(`
            INSERT INTO scenarios_new (id, use_case_id, title, initial_input, generated_scenario, created_at, updated_at)
            VALUES (@id, @use_case_id, @title, @initial_input, @generated_scenario, @created_at, @updated_at)
        `);
        
        for (const scenario of allScenarios) {
            insertScenarioStmt.run({
                id: scenario.id,
                use_case_id: scenario.use_case_id,
                title: scenario.title,
                initial_input: scenario.initial_input,
                generated_scenario: scenario.generated_scenario,
                created_at: scenario.created_at,
                updated_at: scenario.updated_at
            });
        }
        
        console.log(`迁移了 ${allScenarios.length} 条场景数据`);
    }
    
    // 删除原scenarios表并重命名新表
    db.exec('DROP TABLE scenarios;');
    db.exec('ALTER TABLE scenarios_new RENAME TO scenarios;');
    
    // 2. 重构messages表（移除session_id，添加scenario_id）
    console.log('2. 重构messages表...');
    
    // 创建新的messages表
    db.exec(`
        CREATE TABLE messages_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
        )
    `);
    
    // 迁移消息数据，使用之前建立的映射
    let migratedMessages = 0;
    if (allMessages.length > 0) {
        const insertMsgStmt = db.prepare(`
            INSERT INTO messages_new (scenario_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
        `);
        
        for (const msg of allMessages) {
            // 查找对应的scenario_id
            const scenarioId = sessionToScenarioMap.get(msg.session_id);
            if (scenarioId) {
                insertMsgStmt.run(scenarioId, msg.role, msg.content, msg.created_at);
                migratedMessages++;
            } else {
                console.log(`警告: 消息无法找到对应的场景，session_id: ${msg.session_id}`);
            }
        }
        
        console.log(`迁移了 ${migratedMessages} 条消息数据`);
    }
    
    // 删除原messages表并重命名新表
    db.exec('DROP TABLE messages;');
    db.exec('ALTER TABLE messages_new RENAME TO messages;');
    
    // 3. 重构sessions表（移除status_table字段）
    console.log('3. 重构sessions表...');
    
    // 创建新的sessions表
    db.exec(`
        CREATE TABLE sessions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);
    
    // 迁移会话数据
    const allSessions = db.prepare(`
        SELECT id, user_id, session_token, created_at, last_active 
        FROM sessions
    `).all();
    
    if (allSessions.length > 0) {
        const insertSessionStmt = db.prepare(`
            INSERT INTO sessions_new (id, user_id, session_token, created_at, last_active)
            VALUES (@id, @user_id, @session_token, @created_at, @last_active)
        `);
        
        for (const session of allSessions) {
            insertSessionStmt.run(session);
        }
        
        console.log(`迁移了 ${allSessions.length} 条会话数据`);
    }
    
    // 删除原sessions表并重命名新表
    db.exec('DROP TABLE sessions;');
    db.exec('ALTER TABLE sessions_new RENAME TO sessions;');
    
    // 提交事务
    db.exec('COMMIT;');
    
    console.log('数据库重构完成！');
    console.log('新的表结构:');
    console.log('- users: 保持不变');
    console.log('- projects: 保持不变');
    console.log('- use_cases: 保持不变');
    console.log('- scenarios: 移除了user_id, session_id字段，保留use_case_id外键');
    console.log('- sessions: 移除了status_table字段，保留user_id外键');
    console.log('- messages: 移除了session_id字段，添加了scenario_id外键');
    
    // 验证重构结果
    console.log('\n验证重构结果...');
    
    const scenarioCount = db.prepare('SELECT COUNT(*) as count FROM scenarios').get().count;
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    
    console.log(`验证结果: ${scenarioCount} 个场景, ${messageCount} 条消息, ${sessionCount} 个会话`);
    
} catch (error) {
    // 回滚事务
    try {
        db.exec('ROLLBACK;');
    } catch (rollbackErr) {
        console.error('回滚失败:', rollbackErr.message);
    }
    
    console.error('数据库重构失败:', error.message);
    console.error(error.stack);
} finally {
    try {
        db.close();
    } catch (closeErr) {
        console.error('关闭数据库连接失败:', closeErr.message);
    }
}