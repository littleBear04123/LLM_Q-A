const sqlite3 = require('better-sqlite3');
const path = require('path');

// 连接到数据库 - 使用正确的路径（与 server/database/index.js 一致）
const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3(dbPath);

// 查询所有场景
console.log('=== 查询所有场景 ===');
const scenarios = db.prepare('SELECT * FROM scenarios').all();
console.log('场景数量:', scenarios.length);
scenarios.forEach(scenario => {
    console.log(`场景ID: ${scenario.id}, 用例ID: ${scenario.use_case_id}, 标题: ${scenario.title}`);
    
    // 查询该场景的消息
    const messages = db.prepare('SELECT * FROM messages WHERE scenario_id = ? ORDER BY created_at ASC').all(scenario.id);
    console.log(`  消息数量: ${messages.length}`);
    messages.forEach(msg => {
        console.log(`    [${msg.role}] ${msg.created_at}: ${msg.content.substring(0, 100)}...`);
    });
    console.log('');
});

// 查询所有消息（不限场景）
console.log('=== 查询所有消息 ===');
const allMessages = db.prepare('SELECT m.*, s.use_case_id FROM messages m JOIN scenarios s ON m.scenario_id = s.id ORDER BY m.created_at DESC LIMIT 10').all();
console.log('最近10条消息:');
allMessages.forEach(msg => {
    console.log(`[场景${msg.scenario_id}/用例${msg.use_case_id}] [${msg.role}] ${msg.created_at}: ${msg.content.substring(0, 100)}...`);
});

db.close();