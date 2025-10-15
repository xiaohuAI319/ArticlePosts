/**
 * 平台数据模型
 */

const { getDatabaseInstance } = require('../Database');

class Platform {
  constructor() {
    this.db = getDatabaseInstance();
  }

  /**
   * 获取所有平台
   */
  findAll(activeOnly = true) {
    try {
      let sql = 'SELECT * FROM platforms';
      const params = [];

      if (activeOnly) {
        sql += ' WHERE is_active = 1';
      }

      sql += ' ORDER BY priority ASC';

      const stmt = this.db.prepare(sql);
      const platforms = stmt.all(...params);

      return platforms.map(platform => ({
        ...platform,
        config_schema: platform.config_schema ? JSON.parse(platform.config_schema) : null
      }));
    } catch (error) {
      console.error('获取平台列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取平台
   */
  findById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM platforms WHERE id = ?');
      const platform = stmt.get(id);

      if (platform && platform.config_schema) {
        platform.config_schema = JSON.parse(platform.config_schema);
      }

      return platform;
    } catch (error) {
      console.error('获取平台失败:', error);
      throw error;
    }
  }

  /**
   * 根据名称获取平台
   */
  findByName(name) {
    try {
      const stmt = this.db.prepare('SELECT * FROM platforms WHERE name = ?');
      const platform = stmt.get(name);

      if (platform && platform.config_schema) {
        platform.config_schema = JSON.parse(platform.config_schema);
      }

      return platform;
    } catch (error) {
      console.error('获取平台失败:', error);
      throw error;
    }
  }

  /**
   * 根据标识符获取平台（使用name字段）
   */
  findBySlug(slug) {
    try {
      const stmt = this.db.prepare('SELECT * FROM platforms WHERE name = ?');
      const platform = stmt.get(slug);

      if (platform && platform.config_schema) {
        platform.config_schema = JSON.parse(platform.config_schema);
      }

      return platform;
    } catch (error) {
      console.error('获取平台失败:', error);
      throw error;
    }
  }

  /**
   * 创建平台
   */
  create(platformData) {
    try {
      const platform = {
        name: platformData.name,
        display_name: platformData.display_name,
        icon_url: platformData.icon_url || '',
        base_url: platformData.base_url,
        login_url: platformData.login_url || '',
        publish_url: platformData.publish_url || '',
        config_schema: JSON.stringify(platformData.config_schema || {}),
        is_active: platformData.is_active !== undefined ? platformData.is_active : 1,
        priority: platformData.priority || 0,
        created_at: Date.now()
      };

      const stmt = this.db.prepare(`
        INSERT INTO platforms (
          name, display_name, icon_url, base_url, login_url, publish_url,
          config_schema, is_active, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        platform.name,
        platform.display_name,
        platform.icon_url,
        platform.base_url,
        platform.login_url,
        platform.publish_url,
        platform.config_schema,
        platform.is_active,
        platform.priority,
        platform.created_at
      );

      return {
        id: result.lastInsertRowid,
        ...platform,
        config_schema: JSON.parse(platform.config_schema)
      };
    } catch (error) {
      console.error('创建平台失败:', error);
      throw error;
    }
  }

  /**
   * 更新平台
   */
  update(id, updateData) {
    try {
      const updates = { ...updateData };

      // 处理配置schema
      if (updates.config_schema) {
        updates.config_schema = JSON.stringify(updates.config_schema);
      }

      // 构建更新语句
      const fields = [];
      const values = [];

      Object.keys(updates).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });

      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE platforms
        SET ${fields.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);
      return result.changes > 0;
    } catch (error) {
      console.error('更新平台失败:', error);
      throw error;
    }
  }

  /**
   * 删除平台
   */
  delete(id) {
    try {
      // 检查是否有相关的数据
      const sessionCheck = this.db.prepare('SELECT COUNT(*) as count FROM login_sessions WHERE platform_id = ?').get(id);
      const configCheck = this.db.prepare('SELECT COUNT(*) as count FROM user_platform_configs WHERE platform_id = ?').get(id);
      const taskCheck = this.db.prepare('SELECT COUNT(*) as count FROM publish_tasks WHERE platform_id = ?').get(id);

      if (sessionCheck.count > 0 || configCheck.count > 0 || taskCheck.count > 0) {
        throw new Error('无法删除平台：存在相关的登录会话、配置或发布任务');
      }

      const stmt = this.db.prepare('DELETE FROM platforms WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('删除平台失败:', error);
      throw error;
    }
  }

  /**
   * 激活/停用平台
   */
  toggleActive(id, isActive) {
    try {
      const stmt = this.db.prepare('UPDATE platforms SET is_active = ? WHERE id = ?');
      const result = stmt.run(isActive ? 1 : 0, id);
      return result.changes > 0;
    } catch (error) {
      console.error('更新平台状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新平台优先级
   */
  updatePriority(id, priority) {
    try {
      const stmt = this.db.prepare('UPDATE platforms SET priority = ? WHERE id = ?');
      const result = stmt.run(priority, id);
      return result.changes > 0;
    } catch (error) {
      console.error('更新平台优先级失败:', error);
      throw error;
    }
  }

  /**
   * 获取平台统计信息
   */
  getStats(platformId) {
    try {
      const stmt = this.db.prepare(`
        SELECT
          p.*,
          COUNT(DISTINCT ls.id) as active_sessions,
          COUNT(DISTINCT pt.id) as total_publishes,
          COUNT(DISTINCT CASE WHEN pt.status = 2 THEN pt.id END) as successful_publishes,
          COUNT(DISTINCT CASE WHEN pt.status = 3 THEN pt.id END) as failed_publishes,
          MAX(pt.created_at) as last_publish_at
        FROM platforms p
        LEFT JOIN login_sessions ls ON p.id = ls.platform_id AND ls.is_active = 1
        LEFT JOIN publish_tasks pt ON p.id = pt.platform_id
        WHERE p.id = ?
        GROUP BY p.id
      `);

      return stmt.get(platformId);
    } catch (error) {
      console.error('获取平台统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有平台的统计信息
   */
  getAllStats() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          p.id,
          p.name,
          p.display_name,
          p.is_active,
          COUNT(DISTINCT ls.id) as active_sessions,
          COUNT(DISTINCT pt.id) as total_publishes,
          COUNT(DISTINCT CASE WHEN pt.status = 2 THEN pt.id END) as successful_publishes,
          COUNT(DISTINCT CASE WHEN pt.status = 3 THEN pt.id END) as failed_publishes,
          MAX(pt.created_at) as last_publish_at
        FROM platforms p
        LEFT JOIN login_sessions ls ON p.id = ls.platform_id AND ls.is_active = 1
        LEFT JOIN publish_tasks pt ON p.id = pt.platform_id
        GROUP BY p.id
        ORDER BY p.priority ASC
      `);

      return stmt.all();
    } catch (error) {
      console.error('获取平台统计失败:', error);
      throw error;
    }
  }

  /**
   * 检查平台是否可用
   */
  isAvailable(platformId) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM platforms p
        LEFT JOIN login_sessions ls ON p.id = ls.platform_id AND ls.is_active = 1 AND ls.expires_at > ?
        WHERE p.id = ? AND p.is_active = 1
      `);

      const now = Date.now();
      const result = stmt.get(now, platformId);
      return result.count > 0;
    } catch (error) {
      console.error('检查平台可用性失败:', error);
      return false;
    }
  }

  /**
   * 获取可用的平台列表
   */
  getAvailable() {
    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT p.*
        FROM platforms p
        INNER JOIN login_sessions ls ON p.id = ls.platform_id
        WHERE p.is_active = 1 AND ls.is_active = 1 AND ls.expires_at > ?
        ORDER BY p.priority ASC
      `);

      const now = Date.now();
      const platforms = stmt.all(now);

      return platforms.map(platform => ({
        ...platform,
        config_schema: platform.config_schema ? JSON.parse(platform.config_schema) : null
      }));
    } catch (error) {
      console.error('获取可用平台失败:', error);
      return [];
    }
  }

  /**
   * 验证平台配置
   */
  validateConfig(platformId, config) {
    try {
      const platform = this.findById(platformId);
      if (!platform) {
        throw new Error('平台不存在');
      }

      if (!platform.config_schema) {
        return { valid: true, errors: [] };
      }

      const schema = platform.config_schema;
      const errors = [];

      // 验证必需字段
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in config) || config[field] === null || config[field] === '') {
            errors.push(`${field} 是必需的`);
          }
        }
      }

      // 验证字段类型
      if (schema.properties) {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
          if (field in config && config[field] !== null) {
            const value = config[field];
            const expectedType = fieldSchema.type;

            if (expectedType === 'string' && typeof value !== 'string') {
              errors.push(`${field} 必须是字符串`);
            } else if (expectedType === 'number' && typeof value !== 'number') {
              errors.push(`${field} 必须是数字`);
            } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
              errors.push(`${field} 必须是布尔值`);
            } else if (expectedType === 'array' && !Array.isArray(value)) {
              errors.push(`${field} 必须是数组`);
            } else if (expectedType === 'object' && typeof value !== 'object') {
              errors.push(`${field} 必须是对象`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('验证平台配置失败:', error);
      throw error;
    }
  }
}

module.exports = Platform;