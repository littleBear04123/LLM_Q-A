// 消息模型
// 用于处理消息相关的数据库操作
class MessageModel {
  constructor(db) {
    this.db = db;
  }
// 保存消息到数据库
  saveMessage(scenarioId, role, content) {
    try {
      const stmt = this.db.prepare('INSERT INTO messages (scenario_id, role, content) VALUES (?, ?, ?)');
      const result = stmt.run(scenarioId, role, content);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error in saveMessage:', error);
      throw error;
    }
  }
// 获取消息历史
// 用于获取指定场景的最新消息历史
  getMessageHistory(scenarioId, limit = 10) {
    try {
      const stmt = this.db.prepare(`
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
  }
}

module.exports = MessageModel;