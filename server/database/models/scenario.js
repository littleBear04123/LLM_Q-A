class ScenarioModel {
  constructor(db) {
    this.db = db;
  }

  createScenario(useCaseId, title, initialInput) {
    try {
      // 检查是否已存在该用例的场景，如果存在则更新，否则插入新记录
      const existingScenarioStmt = this.db.prepare('SELECT id FROM scenarios WHERE use_case_id = ?');
      const existingScenario = existingScenarioStmt.get(useCaseId);
      
      if (existingScenario) {
        // 如果场景已存在，则更新它
        const updateStmt = this.db.prepare(`
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
        const insertStmt = this.db.prepare(`
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
  }

  getScenariosByUseCase(useCaseId) {
    try {
      const stmt = this.db.prepare(`
          SELECT * FROM scenarios 
          WHERE use_case_id = ? 
      `);
      return stmt.all(useCaseId);
    } catch (error) {
      console.error('Error in getScenariosByUseCase:', error);
      throw error;
    }
  }

  updateScenarioContent(scenarioId, generatedScenario, statusTable, scenarioPlantUmlCode = null) {
    try {
      let stmt;
      if (scenarioPlantUmlCode !== null) {
        // 如果提供了场景图代码，则也更新它
        stmt = this.db.prepare(`
            UPDATE scenarios 
            SET generated_scenario = ?, status_table = ?, scenario_plantuml_code = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        stmt.run(generatedScenario, statusTable, scenarioPlantUmlCode, scenarioId);
      } else {
        // 否则只更新场景内容和状态表
        stmt = this.db.prepare(`
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
  }

  getScenarioByUseCase(useCaseId) {
    try {
      const stmt = this.db.prepare(`
          SELECT * FROM scenarios 
          WHERE use_case_id = ? 
      `);
      return stmt.get(useCaseId);
    } catch (error) {
      console.error('Error in getScenarioByUseCase:', error);
      throw error;
    }
  }

  // 更新场景的状态表
  updateScenarioStatusTable(scenarioId, statusTable) {
    try {
      const stmt = this.db.prepare('UPDATE scenarios SET status_table = ? WHERE id = ?');
      stmt.run(JSON.stringify(statusTable), scenarioId);
    } catch (error) {
      console.error('Error in updateScenarioStatusTable:', error);
      throw error;
    }
  }

  // 获取场景的状态表
  getScenarioStatusTable(scenarioId) {
    try {
      const stmt = this.db.prepare('SELECT status_table FROM scenarios WHERE id = ?');
      const result = stmt.get(scenarioId);
      return result && result.status_table ? JSON.parse(result.status_table) : {};
    } catch (error) {
      console.error('Error in getScenarioStatusTable:', error);
      return {};
    }
  }

  // 获取未完成的场景
  getUnfinishedScenarios(userId) {
    try {
      // 这里根据你的业务逻辑实现
      console.log(`获取用户 ${userId} 的未完成场景`);
      return []; // 暂时返回空数组
    } catch (error) {
      console.error('Error in getUnfinishedScenarios:', error);
      return [];
    }
  }

  // 通过场景ID获取场景信息
  getScenarioById(scenarioId) {
    try {
      const stmt = this.db.prepare(`
          SELECT * FROM scenarios 
          WHERE id = ? 
      `);
      return stmt.get(scenarioId);
    } catch (error) {
      console.error('Error in getScenarioById:', error);
      throw error;
    }
  }
}

module.exports = ScenarioModel;