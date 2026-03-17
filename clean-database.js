// clean-database.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

console.log('开始清理数据库...');

try {
    // 删除所有测试数据
    db.exec(`
        DELETE FROM messages;
        DELETE FROM scenarios;
        DELETE FROM use_cases;
        DELETE FROM projects;
        DELETE FROM sessions;
        DELETE FROM users;
    `);
    
    console.log('✅ 数据库清理完成！所有测试数据已删除');
} catch (error) {
    console.error('清理数据库时出错:', error);
} finally {
    db.close();
}
