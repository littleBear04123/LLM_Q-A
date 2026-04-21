const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据表
function initializeTables() {
    // 用户表
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 项目表
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_name VARCHAR(100) NOT NULL,
            description TEXT,
            requirement_text TEXT NOT NULL,
            uml_mermaid_code TEXT,
            uml_image_path TEXT,
            status VARCHAR(20) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    // 用例表
    db.exec(`
        CREATE TABLE IF NOT EXISTS use_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            use_case_name VARCHAR(100) NOT NULL,
            actor VARCHAR(100) NOT NULL,
            description TEXT,
            priority INTEGER DEFAULT 1,
            status VARCHAR(20) DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    `);

    // 会话表 - 修正这里的语法错误
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    // 场景表
    db.exec(`
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            use_case_id INTEGER NOT NULL UNIQUE,  -- 修改为UNIQUE，确保一个用例只对应一个场景
            title TEXT,
            initial_input TEXT,
            generated_scenario TEXT,
            status_table TEXT,
            scenario_plantuml_code TEXT,  -- 新增：存储场景图的PlantUML代码
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (use_case_id) REFERENCES use_cases (id) ON DELETE CASCADE
        )
    `);

    // 消息表
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
        )
    `);

    console.log('Database tables initialized successfully.');
}

// 初始化表
initializeTables();

const userModel = {
    findOrCreate: (username) => {
        try {
            let stmt = db.prepare('SELECT * FROM users WHERE username = ?');
            let user = stmt.get(username);
            
            if (user) {
                return user;
            } else {
                stmt = db.prepare('INSERT INTO users (username) VALUES (?)');
                const result = stmt.run(username);
                return { id: result.lastInsertRowid, username };
            }
        } catch (error) {
            console.error('Error in findOrCreate:', error);
            throw error;
        }
    },

    createSession: (userId) => {
        try {
            const sessionToken = uuidv4();
            const stmt = db.prepare('INSERT INTO sessions (user_id, session_token) VALUES (?, ?)');
            const result = stmt.run(userId, sessionToken);
            
            return { 
                sessionId: result.lastInsertRowid, 
                sessionToken 
            };
        } catch (error) {
            console.error('Error in createSession:', error);
            throw error;
        }
    },

    getSessionByToken: (token) => {
        try {
            const stmt = db.prepare(`
                SELECT s.*, u.username 
                FROM sessions s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.session_token = ?
            `);
            return stmt.get(token);
        } catch (error) {
            console.error('Error in getSessionByToken:', error);
            throw error;
        }
    },

    updateSessionActivity: (sessionId) => {
        try {
            const stmt = db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?');
            stmt.run(sessionId);
        } catch (error) {
            console.error('Error in updateSessionActivity:', error);
            throw error;
        }
    },

    // 项目相关操作
    createProject: (userId, projectName, description, requirementText) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO projects (user_id, project_name, description, requirement_text) 
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(userId, projectName, description, requirementText);
            return result.lastInsertRowid;
        } catch (error) {
            console.error('Error in createProject:', error);
            throw error;
        }
    },

    getProjectsByUser: (userId) => {
        try {
            const stmt = db.prepare(`
                SELECT * FROM projects 
                WHERE user_id = ? 
                ORDER BY updated_at DESC
            `);
            return stmt.all(userId);
        } catch (error) {
            console.error('Error in getProjectsByUser:', error);
            throw error;
        }
    },

    updateProjectUML: (projectId, mermaidCode) => {
        try {
            const stmt = db.prepare(`
                UPDATE projects 
                SET uml_mermaid_code = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            stmt.run(mermaidCode, projectId);
        } catch (error) {
            console.error('Error in updateProjectUML:', error);
            throw error;
        }
    },

    // 用例相关操作
    createUseCase: (projectId, useCaseName, actor, description = '') => {
        try {
            const stmt = db.prepare(`
                INSERT INTO use_cases (project_id, use_case_name, actor, description) 
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(projectId, useCaseName, actor, description);
            return result.lastInsertRowid;
        } catch (error) {
            console.error('Error in createUseCase:', error);
            throw error;
        }
    },

    getUseCasesByProject: (projectId) => {
        try {
            const stmt = db.prepare(`
                SELECT * FROM use_cases 
                WHERE project_id = ? 
                ORDER BY priority DESC, created_at ASC
            `);
            return stmt.all(projectId);
        } catch (error) {
            console.error('Error in getUseCasesByProject:', error);
            throw error;
        }
    },

    updateUseCaseStatus: (useCaseId, status) => {
        try {
            const stmt = db.prepare('UPDATE use_cases SET status = ? WHERE id = ?');
            stmt.run(status, useCaseId);
        } catch (error) {
            console.error('Error in updateUseCaseStatus:', error);
            throw error;
        }
    },

// 清理项目的所有用例（新增方法）
clearUseCasesByProject: (projectId) => {
    try {
        const stmt = db.prepare('DELETE FROM use_cases WHERE project_id = ?');
        stmt.run(projectId);
        console.log(`已清理项目 ${projectId} 的所有用例`);
        return true;
    } catch (error) {
        console.error('Error in clearUseCasesByProject:', error);
        throw error;
    }
},

//检查项目是否存在且属于用户
checkProjectAccess: (projectId, userId) => {
    try {
        const stmt = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
        const project = stmt.get(projectId, userId);
        return !!project;
    } catch (error) {
        console.error('Error in checkProjectAccess:', error);
        return false;
    }
},


// 获取未完成的场景（需要实现）
getUnfinishedScenarios: (userId) => {
    try {
        // 这里根据你的业务逻辑实现
        console.log(`获取用户 ${userId} 的未完成场景`);
        return []; // 暂时返回空数组
    } catch (error) {
        console.error('Error in getUnfinishedScenarios:', error);
        return [];
    }
},

    // 场景相关操作
    createScenario: (useCaseId, title, initialInput) => {
        try {
            // 检查是否已存在该用例的场景，如果存在则更新，否则插入新记录
            const existingScenarioStmt = db.prepare('SELECT id FROM scenarios WHERE use_case_id = ?');
            const existingScenario = existingScenarioStmt.get(useCaseId);
            
            if (existingScenario) {
                // 如果场景已存在，则更新它
                const updateStmt = db.prepare(`
                    UPDATE scenarios 
                    SET title = COALESCE(?, title), 
                        initial_input = COALESCE(?, initial_input),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE use_case_id = ?
                `);
                updateStmt.run(title, initialInput, useCaseId);
                return existingScenario.id;
            } else {
                // 如果场景不存在，则创建新场景
                const insertStmt = db.prepare(`
                    INSERT INTO scenarios (use_case_id, title, initial_input) 
                    VALUES (?, ?, ?)
                `);
                const result = insertStmt.run(useCaseId, title, initialInput);
                return result.lastInsertRowid;
            }
        } catch (error) {
            console.error('Error in createScenario:', error);
            throw error;
        }
    },

    getScenariosByUseCase: (useCaseId) => {
        try {
            const stmt = db.prepare(`
                SELECT * FROM scenarios 
                WHERE use_case_id = ? 
            `);
            return stmt.all(useCaseId);
        } catch (error) {
            console.error('Error in getScenariosByUseCase:', error);
            throw error;
        }
    },

    updateScenarioContent: (scenarioId, generatedScenario, statusTable, scenarioPlantUmlCode = null) => {
        try {
            let stmt;
            if (scenarioPlantUmlCode !== null) {
                // 如果提供了场景图代码，则也更新它
                stmt = db.prepare(`
                    UPDATE scenarios 
                    SET generated_scenario = ?, status_table = ?, scenario_plantuml_code = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `);
                stmt.run(generatedScenario, statusTable, scenarioPlantUmlCode, scenarioId);
            } else {
                // 否则只更新场景内容和状态表
                stmt = db.prepare(`
                    UPDATE scenarios 
                    SET generated_scenario = ?, status_table = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `);
                stmt.run(generatedScenario, statusTable, scenarioId);
            }
        } catch (error) {
            console.error('Error in updateScenarioContent:', error);
            throw error;
        }
    },

    getScenarioByUseCase: (useCaseId) => {
        try {
            const stmt = db.prepare(`
                SELECT * FROM scenarios 
                WHERE use_case_id = ? 
            `);
            return stmt.get(useCaseId);
        } catch (error) {
            console.error('Error in getScenarioByUseCase:', error);
            throw error;
        }
    },

    // 消息相关操作
    saveMessage: (scenarioId, role, content) => {
        try {
            const stmt = db.prepare('INSERT INTO messages (scenario_id, role, content) VALUES (?, ?, ?)');
            const result = stmt.run(scenarioId, role, content);
            return result.lastInsertRowid;
        } catch (error) {
            console.error('Error in saveMessage:', error);
            throw error;
        }
    },

    getMessageHistory: (scenarioId, limit = 10) => {
        try {
            const stmt = db.prepare(`
                SELECT role, content, created_at 
                FROM messages 
                WHERE scenario_id = ? 
                ORDER BY created_at ASC 
                LIMIT ?
            `);
            return stmt.all(scenarioId, limit);
        } catch (error) {
            console.error('Error in getMessageHistory:', error);
            throw error;
        }
    },

    // 获取会话信息（新增方法）
    getSessionById: (sessionId) => {
        try {
            const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
            return stmt.get(sessionId);
        } catch (error) {
            console.error('Error in getSessionById:', error);
            throw error;
        }
    },

    // 更新会话活动时间
    updateSessionActivity: (sessionId) => {
        try {
            const stmt = db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?');
            stmt.run(sessionId);
        } catch (error) {
            console.error('Error in updateSessionActivity:', error);
            throw error;
        }
    },

    // 更新场景的状态表
    updateScenarioStatusTable: (scenarioId, statusTable) => {
        try {
            const stmt = db.prepare('UPDATE scenarios SET status_table = ? WHERE id = ?');
            stmt.run(JSON.stringify(statusTable), scenarioId);
        } catch (error) {
            console.error('Error in updateScenarioStatusTable:', error);
            throw error;
        }
    },

    // 获取场景的状态表
    getScenarioStatusTable: (scenarioId) => {
        try {
            const stmt = db.prepare('SELECT status_table FROM scenarios WHERE id = ?');
            const result = stmt.get(scenarioId);
            return result && result.status_table ? JSON.parse(result.status_table) : null;
        } catch (error) {
            console.error('Error in getScenarioStatusTable:', error);
            return null;
        }
    },

    // 删除用户及其所有相关数据
    deleteUserAccount: (userId) => {
        try {
            // 由于数据库中外键约束设置了 ON DELETE CASCADE，
            // 删除用户时会自动删除相关的项目、用例、场景和消息
            const stmt = db.prepare('DELETE FROM users WHERE id = ?');
            const result = stmt.run(userId);
            
            console.log(`用户 ${userId} 及其所有相关数据已删除`);
            return result.changes > 0; // 返回是否成功删除
        } catch (error) {
            console.error('Error in deleteUserAccount:', error);
            throw error;
        }
    }
};

module.exports = { db, userModel };