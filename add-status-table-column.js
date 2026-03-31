const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

console.log('检查并添加status_table列到scenarios表...');

try {
    // 检查scenarios表是否已有status_table列
    const columns = db.prepare("PRAGMA table_info(scenarios)").all();
    const hasStatusTableColumn = columns.some(col => col.name === 'status_table');
    
    if (hasStatusTableColumn) {
        console.log('✅ status_table列已存在于scenarios表中');
    } else {
        console.log('🔧 添加status_table列到scenarios表...');
        db.exec('ALTER TABLE scenarios ADD COLUMN status_table TEXT');
        console.log('✅ status_table列已成功添加到scenarios表');
    }
    
    // 验证更改
    const updatedColumns = db.prepare("PRAGMA table_info(scenarios)").all();
    console.log('当前scenarios表结构:');
    updatedColumns.forEach(col => {
        console.log(`  - ${col.name} (${col.type}), nullable: ${!col.notnull}, default: ${col.dflt_value}`);
    });
    
} catch (error) {
    console.error('❌ 执行过程中出现错误:', error.message);
} finally {
    db.close();
    console.log('数据库连接已关闭');
}