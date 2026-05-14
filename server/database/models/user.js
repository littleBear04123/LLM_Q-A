const { uuidv4 } = require('../../utils/uuid');

class UserModel {
  constructor(db) {
    this.db = db;
  }
// 查找或创建用户
  findOrCreate(username) {
    try {
      let stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
      let user = stmt.get(username);
      
      if (user) {
        return user;
      } else {
        stmt = this.db.prepare('INSERT INTO users (username) VALUES (?)');
        const result = stmt.run(username);
        return { id: result.lastInsertRowid, username };
      }
    } catch (error) {
      console.error('Error in findOrCreate:', error);
      throw error;
    }
  }
// 创建会话
  createSession(userId) {
    try {
      const sessionToken = uuidv4();
      const stmt = this.db.prepare('INSERT INTO sessions (user_id, session_token) VALUES (?, ?)');
      const result = stmt.run(userId, sessionToken);
      
      return { 
        sessionId: result.lastInsertRowid, 
        sessionToken 
      };
    } catch (error) {
      console.error('Error in createSession:', error);
      throw error;
    }
  }

  getSessionByToken(token) {
    try {
      const stmt = this.db.prepare(`
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
  }

  getSessionById(sessionId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
      return stmt.get(sessionId);
    } catch (error) {
      console.error('Error in getSessionById:', error);
      throw error;
    }
  }

  updateSessionActivity(sessionId) {
    try {
      const stmt = this.db.prepare('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(sessionId);
    } catch (error) {
      console.error('Error in updateSessionActivity:', error);
      throw error;
    }
  }

  // 删除用户及其所有相关数据
  deleteUserAccount(userId) {
    try {
      // 由于数据库中外键约束设置了 ON DELETE CASCADE，
      // 删除用户时会自动删除相关的项目、用例、场景和消息
      const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
      const result = stmt.run(userId);
      
      console.log(`用户 ${userId} 及其所有相关数据已删除`);
      return result.changes > 0; // 返回是否成功删除
    } catch (error) {
      console.error('Error in deleteUserAccount:', error);
      throw error;
    }
  }
}

module.exports = UserModel;