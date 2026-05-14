class ProjectModel {
  constructor(db) {
    this.db = db;
  }
// 创建新项目
// 用于创建一个新的项目记录
// 包含用户ID、项目名称、描述和需求文本
  createProject(userId, projectName, description, requirementText) {
    try {
      const stmt = this.db.prepare(`
          INSERT INTO projects (user_id, project_name, description, requirement_text) 
          VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(userId, projectName, description, requirementText);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error in createProject:', error);
      throw error;
    }
  }
// 获取用户的所有项目
// 用于获取指定用户的所有项目记录
  getProjectsByUser(userId) {
    try {
      const stmt = this.db.prepare(`
          SELECT * FROM projects 
          WHERE user_id = ? 
          ORDER BY updated_at DESC
      `);
      return stmt.all(userId);
    } catch (error) {
      console.error('Error in getProjectsByUser:', error);
      throw error;
    }
  }
// 更新项目UML代码
// 用于更新指定项目的UML代码
// 包含项目ID和新的UML代码
  updateProjectUML(projectId, plantUmlCode) {
    try {
      const stmt = this.db.prepare(`
          UPDATE projects 
          SET uml_plantuml_code = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
      `);
      stmt.run(plantUmlCode, projectId);
    } catch (error) {
      console.error('Error in updateProjectUML:', error);
      throw error;
    }
  }

  // 检查项目是否存在且属于用户
  checkProjectAccess(projectId, userId) {
    try {
      const stmt = this.db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
      const project = stmt.get(projectId, userId);
      return !!project;
    } catch (error) {
      console.error('Error in checkProjectAccess:', error);
      return false;
    }
  }

  // 删除项目及其所有相关数据
  deleteProject(projectId, userId) {
    try {
      // 首先验证项目是否属于该用户
      const checkStmt = this.db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
      const project = checkStmt.get(projectId, userId);
      
      if (!project) {
        throw new Error('项目不存在或不属于当前用户');
      }
      
      // 由于数据库中外键约束设置了 ON DELETE CASCADE，
      // 删除项目时会自动删除相关的用例、场景和消息
      const stmt = this.db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');
      const result = stmt.run(projectId, userId);
      
      console.log(`项目 ${projectId} 及其所有相关数据已删除`);
      return result.changes > 0; // 返回是否成功删除
    } catch (error) {
      console.error('Error in deleteProject:', error);
      throw error;
    }
  }
}

module.exports = ProjectModel;