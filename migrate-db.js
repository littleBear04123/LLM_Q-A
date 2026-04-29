const Database = require('better-sqlite3');
const fs = require('fs');

// 检查数据库文件是否存在
const dbPath = './data.db';
if (!fs.existsSync(dbPath)) {
    console.log('数据库文件不存在，将创建新数据库...');
}

// 连接到数据库
const db = new Database(dbPath);

try {
    console.log('开始数据库迁移...');
    
    // 添加新的plantuml代码列（如果不存在）
    const alterQuery = `ALTER TABLE projects ADD COLUMN uml_plantuml_code TEXT;`;
    
    try {
        db.exec(alterQuery);
        console.log('成功添加 uml_plantuml_code 列');
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('列 uml_plantuml_code 已存在，跳过添加');
        } else {
            console.error('添加列时出错:', err.message);
            throw err;
        }
    }
    
    // 尝试将现有的uml_mermaid_code数据迁移到uml_plantuml_code
    const migrateQuery = `
        UPDATE projects 
        SET uml_plantuml_code = uml_mermaid_code 
        WHERE uml_mermaid_code IS NOT NULL AND uml_plantuml_code IS NULL;
    `;
    
    try {
        const stmt = db.prepare(migrateQuery);
        const result = stmt.run();
        console.log(`迁移了 ${result.changes} 行数据`);
    } catch (updateErr) {
        console.log('迁移数据时出错（可能是列不存在）:', updateErr.message);
    }
    
    // 验证表结构
    const tableInfoQuery = "PRAGMA table_info(projects);";
    const rows = db.prepare(tableInfoQuery).all();
    
    console.log('projects表结构:');
    rows.forEach(row => {
        console.log(`  ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // 检查新列是否存在
    const hasNewColumn = rows.some(row => row.name === 'uml_plantuml_code');
    if (hasNewColumn) {
        console.log('\n✅ 数据库迁移成功完成！');
        console.log('新列 uml_plantuml_code 已添加到 projects 表中');
    } else {
        console.log('\n⚠️  新列可能未成功添加，请检查数据库');
    }
    
} finally {
    db.close();
    console.log('数据库连接已关闭');
}