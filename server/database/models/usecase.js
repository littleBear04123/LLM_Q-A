class UseCaseModel {
  constructor(db) {
    this.db = db;
  }

  createUseCase(projectId, useCaseName, actor, description = '') {
    try {
      const stmt = this.db.prepare(`
          INSERT INTO use_cases (project_id, use_case_name, actor, description) 
          VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(projectId, useCaseName, actor, description);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error in createUseCase:', error);
      throw error;
    }
  }

  getUseCasesByProject(projectId) {
    try {
      const stmt = this.db.prepare(`
          SELECT * FROM use_cases 
          WHERE project_id = ? 
          ORDER BY priority DESC, created_at ASC
      `);
      return stmt.all(projectId);
    } catch (error) {
      console.error('Error in getUseCasesByProject:', error);
      throw error;
    }
  }

  updateUseCaseStatus(useCaseId, status) {
    try {
      const stmt = this.db.prepare('UPDATE use_cases SET status = ? WHERE id = ?');
      stmt.run(status, useCaseId);
    } catch (error) {
      console.error('Error in updateUseCaseStatus:', error);
      throw error;
    }
  }

  // 清理项目的所有用例（新增方法）
  clearUseCasesByProject(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM use_cases WHERE project_id = ?');
      stmt.run(projectId);
      console.log(`已清理项目 ${projectId} 的所有用例`);
      return true;
    } catch (error) {
      console.error('Error in clearUseCasesByProject:', error);
      throw error;
    }
  }
}

module.exports = UseCaseModel;