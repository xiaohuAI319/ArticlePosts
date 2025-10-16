/**
 * 发布日志数据模型
 */

class PublishLog {
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建发布日志
   */
  async create(logData) {
    try {
      const {
        task_id,
        level,
        message,
        details,
        screenshot_path,
        created_at
      } = logData;

      const stmt = this.db.prepare(`
        INSERT INTO publish_logs (
          task_id, level, message, details, screenshot_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        task_id,
        level,
        message,
        details,
        screenshot_path,
        created_at || new Date().toISOString()
      );

      return {
        success: true,
        data: {
          id: result.lastInsertRowid,
          ...logData
        }
      };
    } catch (error) {
      console.error('创建发布日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据任务ID获取日志
   */
  async getByTaskId(taskId, options = {}) {
    try {
      const {
        limit = 100,
        level = null,
        orderBy = 'created_at DESC'
      } = options;

      let query = `
        SELECT * FROM publish_logs
        WHERE task_id = ?
      `;

      const values = [taskId];

      if (level) {
        if (Array.isArray(level)) {
          query += ` AND level IN (${level.map(() => '?').join(', ')})`;
          values.push(...level);
        } else {
          query += ' AND level = ?';
          values.push(level);
        }
      }

      query += ` ORDER BY ${orderBy}`;

      if (limit > 0) {
        query += ' LIMIT ?';
        values.push(limit);
      }

      const stmt = this.db.prepare(query);
      const logs = stmt.all(...values);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      console.error('获取发布日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据ID获取日志
   */
  async getById(logId) {
    try {
      const stmt = this.db.prepare(`
        SELECT pl.*, pt.article_id, p.display_name as platform_name
        FROM publish_logs pl
        LEFT JOIN publish_tasks pt ON pl.task_id = pt.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        WHERE pl.id = ?
      `);

      const log = stmt.get(logId);

      if (log) {
        return {
          success: true,
          data: log
        };
      } else {
        return {
          success: false,
          error: '日志不存在'
        };
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据条件查询日志
   */
  async getWithFilters(filters = {}) {
    try {
      const {
        taskId,
        level,
        message,
        startDate,
        endDate,
        limit = 100,
        offset = 0,
        orderBy = 'created_at DESC'
      } = filters;

      let query = `
        SELECT pl.*, pt.article_id, p.display_name as platform_name, a.title as article_title
        FROM publish_logs pl
        LEFT JOIN publish_tasks pt ON pl.task_id = pt.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        LEFT JOIN articles a ON pt.article_id = a.id
        WHERE 1=1
      `;

      const conditions = [];
      const values = [];

      // 添加过滤条件
      if (taskId) {
        conditions.push('pl.task_id = ?');
        values.push(taskId);
      }

      if (level) {
        if (Array.isArray(level)) {
          conditions.push(`pl.level IN (${level.map(() => '?').join(', ')})`);
          values.push(...level);
        } else {
          conditions.push('pl.level = ?');
          values.push(level);
        }
      }

      if (message) {
        conditions.push('pl.message LIKE ?');
        values.push(`%${message}%`);
      }

      if (startDate) {
        conditions.push('pl.created_at >= ?');
        values.push(startDate);
      }

      if (endDate) {
        conditions.push('pl.created_at <= ?');
        values.push(endDate);
      }

      // 添加条件到查询
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      // 添加排序
      query += ` ORDER BY ${orderBy}`;

      // 添加分页
      if (limit > 0) {
        query += ' LIMIT ? OFFSET ?';
        values.push(limit, offset);
      }

      const stmt = this.db.prepare(query);
      const logs = stmt.all(...values);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM publish_logs pl WHERE 1=1';
      const countValues = [];

      if (conditions.length > 0) {
        countQuery += ' AND ' + conditions.join(' AND ');
        countValues.push(...values.slice(0, limit > 0 ? -2 : values.length));
      }

      const countStmt = this.db.prepare(countQuery);
      const countResult = countStmt.get(...countValues);

      return {
        success: true,
        data: logs,
        total: countResult.total
      };
    } catch (error) {
      console.error('查询发布日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除日志
   */
  async delete(logId) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM publish_logs WHERE id = ?
      `);

      const result = stmt.run(logId);

      return {
        success: result.changes > 0,
        changes: result.changes
      };
    } catch (error) {
      console.error('删除发布日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据任务ID删除日志
   */
  async deleteByTaskId(taskId) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM publish_logs WHERE task_id = ?
      `);

      const result = stmt.run(taskId);

      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('删除任务日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量删除旧日志
   */
  async cleanup(retentionDays = 30) {
    try {
      const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      const stmt = this.db.prepare(`
        DELETE FROM publish_logs WHERE created_at < ?
      `);

      const result = stmt.run(cutoffDate);

      return {
        success: true,
        changes: result.changes
      };
    } catch (error) {
      console.error('清理旧日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取日志统计信息
   */
  async getStats(filters = {}) {
    try {
      const { taskId, startDate, endDate } = filters;

      let query = `
        SELECT
          level,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM publish_logs
        WHERE 1=1
      `;

      const conditions = [];
      const values = [];

      if (taskId) {
        conditions.push('task_id = ?');
        values.push(taskId);
      }

      if (startDate) {
        conditions.push('created_at >= ?');
        values.push(startDate);
      }

      if (endDate) {
        conditions.push('created_at <= ?');
        values.push(endDate);
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += ' GROUP BY level';

      const stmt = this.db.prepare(query);
      const results = stmt.all(...values);

      const stats = {
        total: 0,
        info: 0,
        warn: 0,
        error: 0,
        lastOccurrence: null
      };

      results.forEach(row => {
        stats.total += row.count;
        stats[row.level] = row.count;
        if (!stats.lastOccurrence || row.last_occurrence > stats.lastOccurrence) {
          stats.lastOccurrence = row.last_occurrence;
        }
      });

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('获取日志统计失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取错误日志
   */
  async getErrorLogs(limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT pl.*, pt.article_id, p.display_name as platform_name, a.title as article_title
        FROM publish_logs pl
        LEFT JOIN publish_tasks pt ON pl.task_id = pt.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        LEFT JOIN articles a ON pt.article_id = a.id
        WHERE pl.level = 'error'
        ORDER BY pl.created_at DESC
        LIMIT ?
      `);

      const logs = stmt.all(limit);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      console.error('获取错误日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 搜索日志
   */
  async search(keyword, options = {}) {
    try {
      const {
        limit = 50,
        level = null,
        startDate = null,
        endDate = null
      } = options;

      let query = `
        SELECT pl.*, pt.article_id, p.display_name as platform_name, a.title as article_title
        FROM publish_logs pl
        LEFT JOIN publish_tasks pt ON pl.task_id = pt.id
        LEFT JOIN platforms p ON pt.platform_id = p.id
        LEFT JOIN articles a ON pt.article_id = a.id
        WHERE pl.message LIKE ?
      `;

      const values = [`%${keyword}%`];

      if (level) {
        if (Array.isArray(level)) {
          query += ` AND pl.level IN (${level.map(() => '?').join(', ')})`;
          values.push(...level);
        } else {
          query += ' AND pl.level = ?';
          values.push(level);
        }
      }

      if (startDate) {
        query += ' AND pl.created_at >= ?';
        values.push(startDate);
      }

      if (endDate) {
        query += ' AND pl.created_at <= ?';
        values.push(endDate);
      }

      query += ' ORDER BY pl.created_at DESC LIMIT ?';
      values.push(limit);

      const stmt = this.db.prepare(query);
      const logs = stmt.all(...values);

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      console.error('搜索日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取任务的错误摘要
   */
  async getTaskErrorSummary(taskId) {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as total_errors,
          COUNT(DISTINCT message) as unique_errors,
          GROUP_CONCAT(DISTINCT message) as error_messages,
          MAX(created_at) as last_error_time
        FROM publish_logs
        WHERE task_id = ? AND level = 'error'
      `);

      const result = stmt.get(taskId);

      if (result.total_errors > 0) {
        return {
          success: true,
          data: {
            totalErrors: result.total_errors,
            uniqueErrors: result.unique_errors,
            errorMessages: result.error_messages ? result.error_messages.split(',') : [],
            lastErrorTime: result.last_error_time
          }
        };
      } else {
        return {
          success: true,
          data: null
        };
      }
    } catch (error) {
      console.error('获取任务错误摘要失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 导出日志
   */
  async export(filters = {}) {
    try {
      const {
        taskId,
        level,
        startDate,
        endDate,
        format = 'json'
      } = filters;

      const result = await this.getWithFilters({
        taskId,
        level,
        startDate,
        endDate,
        limit: 10000 // 导出限制
      });

      if (!result.success) {
        return result;
      }

      if (format === 'csv') {
        // CSV格式导出
        const headers = ['ID', 'Task ID', 'Level', 'Message', 'Details', 'Created At', 'Article', 'Platform'];
        const rows = result.data.map(log => [
          log.id,
          log.task_id,
          log.level,
          log.message,
          log.details || '',
          log.created_at,
          log.article_title || '',
          log.platform_name || ''
        ]);

        const csvContent = [headers, ...rows]
          .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
          .join('\n');

        return {
          success: true,
          data: csvContent,
          format: 'csv'
        };
      } else {
        // JSON格式导出
        return {
          success: true,
          data: result.data,
          format: 'json',
          total: result.total
        };
      }
    } catch (error) {
      console.error('导出日志失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PublishLog;