/**
 * 发布任务数据模型
 */

class PublishTask {
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建发布任务
   */
  async create(taskData) {
    try {
      const {
        article_id,
        platform_id,
        session_id,
        config_id,
        status = 0,
        progress = 0,
        error_message,
        retry_count = 0,
        max_retries = 3,
        published_url,
        platform_article_id,
        started_at,
        completed_at,
        created_at
      } = taskData;

      const stmt = this.db.prepare(`
        INSERT INTO publish_tasks (
          article_id, platform_id, session_id, config_id, status,
          progress, error_message, retry_count, max_retries,
          published_url, platform_article_id, started_at, completed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        article_id,
        platform_id,
        session_id,
        config_id,
        status,
        progress,
        error_message,
        retry_count,
        max_retries,
        published_url,
        platform_article_id,
        started_at,
        completed_at,
        created_at || new Date().toISOString()
      );

      return {
        success: true,
        data: {
          id: result.lastInsertRowid,
          ...taskData
        }
      };
    } catch (error) {
      console.error('创建发布任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据ID获取发布任务
   */
  async getById(taskId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM publish_tasks WHERE id = ?
      `);

      const task = stmt.get(taskId);

      if (task) {
        return {
          success: true,
          data: task
        };
      } else {
        return {
          success: false,
          error: '发布任务不存在'
        };
      }
    } catch (error) {
      console.error('获取发布任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新发布任务
   */
  async update(taskId, updateData) {
    try {
      const fields = [];
      const values = [];

      // 动态构建更新字段 - 严格过滤掉updated_at字段
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'updated_at') {
          // 双重检查确保不会包含updated_at字段
          if (key === 'updated_at') {
            console.warn(`跳过updated_at字段: ${key}`);
            return;
          }
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        return {
          success: true,
          changes: 0,
          message: '没有需要更新的字段'
        };
      }

      // 添加任务ID
      values.push(taskId);

      const stmt = this.db.prepare(`
        UPDATE publish_tasks
        SET ${fields.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);

      if (result.changes > 0) {
        return {
          success: true,
          changes: result.changes
        };
      } else {
        return {
          success: false,
          error: '发布任务不存在或未更新'
        };
      }
    } catch (error) {
      console.error('更新发布任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除发布任务
   */
  async delete(taskId) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM publish_tasks WHERE id = ?
      `);

      const result = stmt.run(taskId);

      return {
        success: result.changes > 0,
        changes: result.changes
      };
    } catch (error) {
      console.error('删除发布任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据条件查询发布任务
   */
  async getWithFilters(filters = {}) {
    try {
      const {
        articleId,
        platformId,
        status,
        sessionId,
        limit = 50,
        offset = 0,
        orderBy = 'created_at DESC',
        cutoffTime = null
      } = filters;

      let query = `
        SELECT pt.*,
               a.title as article_title,
               p.name as platform_name,
               p.display_name as platform_display_name,
               ls.session_name as session_name
        FROM publish_tasks pt
        LEFT JOIN articles a ON pt.article_id = a.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        LEFT JOIN login_sessions ls ON pt.session_id = ls.id
        WHERE 1=1
      `;

      const conditions = [];
      const values = [];

      // 添加过滤条件
      if (articleId) {
        conditions.push('pt.article_id = ?');
        values.push(articleId);
      }

      if (platformId) {
        conditions.push('pt.platform_id = ?');
        values.push(platformId);
      }

      if (status !== undefined) {
        if (Array.isArray(status)) {
          conditions.push(`pt.status IN (${status.map(() => '?').join(', ')})`);
          values.push(...status);
        } else {
          conditions.push('pt.status = ?');
          values.push(status);
        }
      }

      if (sessionId) {
        conditions.push('pt.session_id = ?');
        values.push(sessionId);
      }

      if (cutoffTime) {
        conditions.push('pt.started_at < ?');
        values.push(cutoffTime);
      }

      // 添加条件到查询
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      // 添加排序
      query += ` ORDER BY ${orderBy}`;

      // 添加分页
      query += ' LIMIT ? OFFSET ?';
      values.push(limit, offset);

      const stmt = this.db.prepare(query);
      const tasks = stmt.all(...values);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM publish_tasks pt WHERE 1=1';
      const countValues = [];

      if (conditions.length > 0) {
        countQuery += ' AND ' + conditions.join(' AND ');
        countValues.push(...values.slice(0, -2)); // 排除limit和offset
      }

      const countStmt = this.db.prepare(countQuery);
      const countResult = countStmt.get(...countValues);

      return {
        success: true,
        data: tasks,
        total: countResult.total
      };
    } catch (error) {
      console.error('查询发布任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取状态分布统计
   */
  async getStatusDistribution() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM publish_tasks
        GROUP BY status
      `);

      const results = stmt.all();

      const distribution = {
        0: 0, // pending
        1: 0, // in_progress
        2: 0, // success
        3: 0  // failed
      };

      results.forEach(row => {
        distribution[row.status] = row.count;
      });

      return {
        success: true,
        data: distribution
      };
    } catch (error) {
      console.error('获取状态分布失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取平台分布统计
   */
  async getPlatformDistribution() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          p.id,
          p.name,
          p.display_name,
          COUNT(pt.id) as count,
          SUM(CASE WHEN pt.status = 2 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN pt.status = 3 THEN 1 ELSE 0 END) as failed_count
        FROM platforms p
        LEFT JOIN publish_tasks pt ON p.id = pt.platform_id
        GROUP BY p.id, p.name, p.display_name
        ORDER BY count DESC
      `);

      const results = stmt.all();

      const distribution = {};
      results.forEach(row => {
        distribution[row.name] = {
          id: row.id,
          displayName: row.display_name,
          total: row.count,
          success: row.success_count,
          failed: row.failed_count
        };
      });

      return {
        success: true,
        data: distribution
      };
    } catch (error) {
      console.error('获取平台分布失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取最近的活动任务
   */
  async getRecentActivity(limit = 10) {
    try {
      const stmt = this.db.prepare(`
        SELECT pt.*,
               a.title as article_title,
               p.display_name as platform_display_name
        FROM publish_tasks pt
        LEFT JOIN articles a ON pt.article_id = a.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        ORDER BY pt.created_at DESC
        LIMIT ?
      `);

      const tasks = stmt.all(limit);

      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('获取最近活动失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取失败的任务
   */
  async getFailedTasks(limit = 20) {
    try {
      const stmt = this.db.prepare(`
        SELECT pt.*,
               a.title as article_title,
               p.display_name as platform_display_name
        FROM publish_tasks pt
        LEFT JOIN articles a ON pt.article_id = a.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        WHERE pt.status = 3
        ORDER BY pt.completed_at DESC
        LIMIT ?
      `);

      const tasks = stmt.all(limit);

      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('获取失败任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取可重试的任务
   */
  async getRetryableTasks() {
    try {
      const stmt = this.db.prepare(`
        SELECT pt.*,
               a.title as article_title,
               p.display_name as platform_display_name
        FROM publish_tasks pt
        LEFT JOIN articles a ON pt.article_id = a.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        WHERE pt.status = 0
          AND pt.retry_count < pt.max_retries
        ORDER BY pt.created_at ASC
      `);

      const tasks = stmt.all();

      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('获取可重试任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量更新任务状态
   */
  async batchUpdateStatus(taskIds, status, updateData = {}) {
    try {
      const placeholders = taskIds.map(() => '?').join(',');

      let query = `
        UPDATE publish_tasks
        SET status = ?
      `;

      const values = [status];

      // 添加额外的更新字段
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          query += `, ${key} = ?`;
          values.push(updateData[key]);
        }
      });

      query += ` WHERE id IN (${placeholders})`;
      values.push(...taskIds);

      const stmt = this.db.prepare(query);
      const result = stmt.run(...values);

      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('批量更新任务状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理旧任务
   */
  async cleanup(retentionDays = 30) {
    try {
      const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      // 先清理相关的日志
      const logStmt = this.db.prepare(`
        DELETE FROM publish_logs
        WHERE task_id IN (
          SELECT id FROM publish_tasks
          WHERE created_at < ? AND status IN (2, 3)
        )
      `);

      const logResult = logStmt.run(cutoffDate);

      // 清理已完成的任务
      const taskStmt = this.db.prepare(`
        DELETE FROM publish_tasks
        WHERE created_at < ? AND status IN (2, 3)
      `);

      const taskResult = taskStmt.run(cutoffDate);

      return {
        success: true,
        deletedTasks: taskResult.changes,
        deletedLogs: logResult.changes
      };
    } catch (error) {
      console.error('清理旧任务失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as failed,
          AVG(CASE WHEN status = 2 THEN
            (julianday(completed_at) - julianday(started_at)) * 24 * 60
            ELSE NULL END) as avg_duration_minutes,
          MAX(created_at) as last_created
        FROM publish_tasks
      `);

      const stats = stmt.get();

      return {
        success: true,
        data: {
          total: stats.total || 0,
          pending: stats.pending || 0,
          inProgress: stats.in_progress || 0,
          success: stats.success || 0,
          failed: stats.failed || 0,
          avgDurationMinutes: stats.avg_duration_minutes || 0,
          lastCreated: stats.last_created
        }
      };
    } catch (error) {
      console.error('获取任务统计失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PublishTask;