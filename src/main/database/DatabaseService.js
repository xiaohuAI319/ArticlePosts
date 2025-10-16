/**
 * 数据库服务管理器
 * 统一管理所有数据库操作
 */

const { getDatabaseInstance } = require('./Database');
const MigrationManager = require('./Migration');
const Article = require('./models/Article');
const Platform = require('./models/Platform');
const PublishTask = require('./models/PublishTask');
const PublishLog = require('./models/PublishLog');

class DatabaseService {
  constructor() {
    this.db = null;
    this.migrationManager = null;
    this.initialized = false;

    // 数据模型实例
    this.models = {
      article: null,
      platform: null,
      publishTasks: null,
      publishLogs: null
    };
  }

  /**
   * 初始化数据库服务
   */
  async initialize() {
    try {
      if (this.initialized) {
        console.log('数据库服务已初始化');
        return true;
      }

      console.log('正在初始化数据库服务...');

      // 1. 初始化数据库连接
      this.db = getDatabaseInstance();
      this.db.initialize();

      // 2. 初始化迁移管理器
      this.migrationManager = new MigrationManager();
      await this.migrationManager.initialize();

      // 3. 执行迁移
      const migrationResult = await this.migrationManager.migrate();
      if (!migrationResult.success) {
        throw new Error(`数据库迁移失败: ${migrationResult.error}`);
      }

      // 4. 初始化数据模型
      this.models.article = new Article();
      this.models.platform = new Platform();
      this.models.publishTasks = new PublishTask(this.db);
      this.models.publishLogs = new PublishLog(this.db);

      // 5. 检查数据库健康状态
      const healthCheck = this.db.checkHealth();
      if (healthCheck.status !== 'healthy') {
        console.warn('数据库健康检查警告:', healthCheck);
      }

      this.initialized = true;
      console.log('数据库服务初始化完成');

      return true;
    } catch (error) {
      console.error('数据库服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库服务
   */
  async close() {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.migrationManager = null;
      this.models = {
        article: null,
        platform: null,
        publishTasks: null,
        publishLogs: null
      };
      this.initialized = false;

      console.log('数据库服务已关闭');
    } catch (error) {
      console.error('关闭数据库服务失败:', error);
    }
  }

  /**
   * 获取数据模型
   */
  getModel(modelName) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    if (!this.models[modelName]) {
      throw new Error(`数据模型 ${modelName} 不存在`);
    }

    return this.models[modelName];
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      this.db.beginTransaction();
      const result = await callback(this.models);
      this.db.commit();
      return result;
    } catch (error) {
      this.db.rollback();
      console.error('事务执行失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      const dbStats = this.db.checkHealth();
      const migrationStatus = this.migrationManager.getStatus();
      const articleStats = this.models.article.getStats();
      const platformStats = this.models.platform.getAllStats();

      return {
        database: dbStats,
        migrations: migrationStatus,
        articles: articleStats,
        platforms: platformStats
      };
    } catch (error) {
      console.error('获取数据库统计失败:', error);
      throw error;
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      return this.db.backup(backupPath);
    } catch (error) {
      console.error('数据库备份失败:', error);
      throw error;
    }
  }

  /**
   * 清理数据库
   */
  async cleanup(options = {}) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      const {
        cleanupOldArticles = true,
        articleRetentionDays = 30,
        cleanupOldLogs = true,
        logRetentionDays = 7
      } = options;

      const results = {};

      // 清理旧文章
      if (cleanupOldArticles) {
        results.deletedArticles = this.models.article.cleanup(articleRetentionDays);
      }

      // 清理旧日志
      if (cleanupOldLogs) {
        const cutoffDate = Date.now() - (logRetentionDays * 24 * 60 * 60 * 1000);
        const stmt = this.db.prepare('DELETE FROM publish_logs WHERE created_at < ?');
        const result = stmt.run(cutoffDate);
        results.deletedLogs = result.changes;
      }

      // 执行VACUUM优化数据库
      this.db.exec('VACUUM');

      console.log('数据库清理完成:', results);
      return results;
    } catch (error) {
      console.error('数据库清理失败:', error);
      throw error;
    }
  }

  /**
   * 重置数据库
   */
  async reset() {
    try {
      console.log('正在重置数据库...');

      // 1. 关闭当前连接
      this.db.close();

      // 2. 删除数据库文件
      const fs = require('fs');
      const dbPath = this.db.dbPath;
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // 3. 重新初始化
      return await this.initialize();
    } catch (error) {
      console.error('数据库重置失败:', error);
      throw error;
    }
  }

  /**
   * 导出数据
   */
  export(options = {}) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      const {
        includeArticles = true,
        includePlatforms = true,
        includeConfigs = true,
        includeLogs = false
      } = options;

      const exportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        data: {}
      };

      // 导出文章
      if (includeArticles) {
        exportData.data.articles = this.models.article.findAll({
          limit: 10000 // 限制导出数量
        });
      }

      // 导出平台配置
      if (includePlatforms) {
        exportData.data.platforms = this.models.platform.findAll(false);
      }

      // 导出系统配置
      if (includeConfigs) {
        exportData.data.configs = this.db.all('SELECT * FROM system_configs');
      }

      // 导出发布日志
      if (includeLogs) {
        exportData.data.logs = this.db.all(`
          SELECT pl.*, pt.article_id, p.display_name as platform_name
          FROM publish_logs pl
          LEFT JOIN publish_tasks pt ON pl.task_id = pt.id
          LEFT JOIN platforms p ON pt.platform_id = p.id
          ORDER BY pl.created_at DESC
          LIMIT 1000
        `);
      }

      return exportData;
    } catch (error) {
      console.error('数据导出失败:', error);
      throw error;
    }
  }

  /**
   * 导入数据
   */
  async import(importData, options = {}) {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      const {
        overwrite = false,
        includeArticles = true,
        includePlatforms = true,
        includeConfigs = true
      } = options;

      console.log('开始导入数据...');

      return await this.transaction(async (models) => {
        const results = {};

        // 导入平台配置
        if (includePlatforms && importData.data.platforms) {
          results.platforms = 0;
          for (const platform of importData.data.platforms) {
            try {
              // 检查是否已存在
              const existing = models.platform.findByName(platform.name);
              if (existing && !overwrite) {
                continue; // 跳过已存在的平台
              }

              if (existing && overwrite) {
                await models.platform.update(existing.id, platform);
              } else {
                await models.platform.create(platform);
              }
              results.platforms++;
            } catch (error) {
              console.error(`导入平台 ${platform.name} 失败:`, error);
            }
          }
        }

        // 导入文章
        if (includeArticles && importData.data.articles) {
          results.articles = 0;
          for (const article of importData.data.articles) {
            try {
              // 检查是否已存在
              const existing = models.article.findByUuid(article.uuid);
              if (existing && !overwrite) {
                continue; // 跳过已存在的文章
              }

              if (existing && overwrite) {
                await models.article.update(existing.id, article);
              } else {
                await models.article.create(article);
              }
              results.articles++;
            } catch (error) {
              console.error(`导入文章 ${article.title} 失败:`, error);
            }
          }
        }

        // 导入系统配置
        if (includeConfigs && importData.data.configs) {
          results.configs = 0;
          for (const config of importData.data.configs) {
            try {
              const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO system_configs
                (config_key, config_value, config_type, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
              `);

              stmt.run(
                config.config_key,
                config.config_value,
                config.config_type,
                config.description,
                config.created_at || Date.now(),
                Date.now()
              );
              results.configs++;
            } catch (error) {
              console.error(`导入配置 ${config.config_key} 失败:`, error);
            }
          }
        }

        console.log('数据导入完成:', results);
        return results;
      });
    } catch (error) {
      console.error('数据导入失败:', error);
      throw error;
    }
  }

  /**
   * 验证数据库完整性
   */
  async validate() {
    if (!this.initialized) {
      throw new Error('数据库服务未初始化');
    }

    try {
      const issues = [];

      // 检查外键约束
      const foreignKeyCheck = this.db.get('PRAGMA foreign_key_check').foreign_key_check;
      if (foreignKeyCheck !== 0) {
        issues.push('发现外键约束违规');
      }

      // 检查数据一致性
      const orphanedSessions = this.db.all(`
        SELECT ls.id
        FROM login_sessions ls
        LEFT JOIN platforms p ON ls.platform_id = p.id
        WHERE p.id IS NULL
      `);

      if (orphanedSessions.length > 0) {
        issues.push(`发现 ${orphanedSessions.length} 个孤立的登录会话`);
      }

      // 检查文章数据完整性
      const articlesWithInvalidTags = this.db.all(`
        SELECT id, title FROM articles
        WHERE tags IS NOT NULL AND tags != '' AND tags NOT LIKE '[%]'
      `);

      if (articlesWithInvalidTags.length > 0) {
        issues.push(`发现 ${articlesWithInvalidTags.length} 个文章的标签格式无效`);
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('数据库验证失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      migrationStatus: this.migrationManager ? this.migrationManager.getStatus() : null,
      models: Object.keys(this.models).filter(key => this.models[key] !== null)
    };
  }

  // 便捷方法：直接访问发布任务模型
  get publishTasks() {
    return {
      ...this.models.publishTasks,
      create: (data) => this.models.publishTasks.create(data),
      findById: (id) => this.models.publishTasks.getById(id),
      getById: (id) => this.models.publishTasks.getById(id),
      update: (id, data) => this.models.publishTasks.update(id, data),
      delete: (id) => this.models.publishTasks.delete(id),
      getWithFilters: (filters) => this.models.publishTasks.getWithFilters(filters),
      getStatusDistribution: () => this.models.publishTasks.getStatusDistribution(),
      getPlatformDistribution: () => this.models.publishTasks.getPlatformDistribution(),
      getRecentActivity: (limit) => this.models.publishTasks.getRecentActivity(limit),
      getFailedTasks: (limit) => this.models.publishTasks.getFailedTasks(limit),
      getRetryableTasks: () => this.models.publishTasks.getRetryableTasks(),
      batchUpdateStatus: (taskIds, status, updateData) => this.models.publishTasks.batchUpdateStatus(taskIds, status, updateData),
      cleanup: (retentionDays) => this.models.publishTasks.cleanup(retentionDays),
      getStats: () => this.models.publishTasks.getStats()
    };
  }

  // 便捷方法：直接访问发布日志模型
  get publishLogs() {
    return {
      ...this.models.publishLogs,
      create: (data) => this.models.publishLogs.create(data),
      getByTaskId: (taskId, options) => this.models.publishLogs.getByTaskId(taskId, options)
    };
  }

  // 便捷方法：直接访问文章模型
  get articles() {
    return {
      ...this.models.article,
      findById: (id) => {
        const result = this.models.article.findById(id);
        if (result) {
          return { success: true, data: result };
        } else {
          return { success: false, error: '文章不存在' };
        }
      },
      create: (data) => {
        const result = this.models.article.create(data);
        if (result && result.id) {
          return { success: true, data: result };
        } else {
          return { success: false, error: '创建文章失败' };
        }
      }
    };
  }

  // 便捷方法：直接访问平台模型
  get platforms() {
    return {
      ...this.models.platform,
      findById: (id) => {
        const result = this.models.platform.findById(id);
        if (result) {
          return { success: true, data: result };
        } else {
          return { success: false, error: '平台不存在' };
        }
      },
      findByName: (name) => {
        const result = this.models.platform.findByName(name);
        if (result) {
          return { success: true, data: result };
        } else {
          return { success: false, error: '平台不存在' };
        }
      }
    };
  }
}

// 创建单例实例
let dbServiceInstance = null;

/**
 * 获取数据库服务实例
 */
function getDatabaseService() {
  if (!dbServiceInstance) {
    dbServiceInstance = new DatabaseService();
  }
  return dbServiceInstance;
}

module.exports = {
  DatabaseService,
  getDatabaseService
};