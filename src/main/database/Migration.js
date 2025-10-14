/**
 * 数据库迁移管理类
 */

const fs = require('fs');
const path = require('path');
const { getDatabaseInstance } = require('./Database');

class MigrationManager {
  constructor() {
    this.db = getDatabaseInstance();
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * 初始化迁移系统
   */
  async initialize() {
    try {
      // 创建迁移记录表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          description TEXT
        )
      `);

      console.log('迁移系统初始化完成');
    } catch (error) {
      console.error('迁移系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取已应用的迁移
   */
  getAppliedMigrations() {
    const result = this.db.all(`
      SELECT version, applied_at, description
      FROM schema_migrations
      ORDER BY applied_at ASC
    `);

    return result.map(row => ({
      version: row.version,
      appliedAt: row.applied_at,
      description: row.description
    }));
  }

  /**
   * 获取所有迁移文件
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();

    return files.map(file => {
      const match = file.match(/^(\d+)_(.+)\.js$/);
      if (!match) return null;

      return {
        version: match[1],
        description: match[2].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        filePath: path.join(this.migrationsPath, file)
      };
    }).filter(Boolean);
  }

  /**
   * 获取待应用的迁移
   */
  getPendingMigrations() {
    const applied = this.getAppliedMigrations().map(m => m.version);
    const available = this.getMigrationFiles();

    return available.filter(migration => !applied.includes(migration.version));
  }

  /**
   * 执行单个迁移
   */
  async applyMigration(migration) {
    try {
      // 动态加载迁移文件
      const migrationModule = require(migration.filePath);

      console.log(`正在应用迁移: ${migration.version} - ${migration.description}`);

      // 开始事务
      this.db.beginTransaction();

      try {
        // 执行迁移
        if (migrationModule.up && typeof migrationModule.up === 'function') {
          migrationModule.up(this.db);
        }

        // 记录迁移
        this.db.run(`
          INSERT INTO schema_migrations (version, description)
          VALUES (?, ?)
        `, [migration.version, migration.description]);

        // 提交事务
        this.db.commit();

        console.log(`迁移 ${migration.version} 应用成功`);
      } catch (error) {
        // 回滚事务
        this.db.rollback();
        throw error;
      }

    } catch (error) {
      console.error(`迁移 ${migration.version} 应用失败:`, error);
      throw error;
    }
  }

  /**
   * 执行所有待应用的迁移
   */
  async migrate() {
    try {
      const pending = this.getPendingMigrations();

      if (pending.length === 0) {
        console.log('没有待应用的迁移');
        return { success: true, applied: [] };
      }

      console.log(`发现 ${pending.length} 个待应用的迁移`);

      const applied = [];
      for (const migration of pending) {
        await this.applyMigration(migration);
        applied.push(migration);
      }

      console.log('所有迁移应用完成');
      return { success: true, applied };
    } catch (error) {
      console.error('迁移执行失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 回滚单个迁移
   */
  async rollbackMigration(migration) {
    try {
      const migrationModule = require(migration.filePath);

      console.log(`正在回滚迁移: ${migration.version} - ${migration.description}`);

      this.db.beginTransaction();

      try {
        // 执行回滚
        if (migrationModule.down && typeof migrationModule.down === 'function') {
          migrationModule.down(this.db);
        }

        // 删除迁移记录
        this.db.run(`
          DELETE FROM schema_migrations
          WHERE version = ?
        `, [migration.version]);

        this.db.commit();
        console.log(`迁移 ${migration.version} 回滚成功`);
      } catch (error) {
        this.db.rollback();
        throw error;
      }

    } catch (error) {
      console.error(`迁移 ${migration.version} 回滚失败:`, error);
      throw error;
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(targetVersion) {
    try {
      const applied = this.getAppliedMigrations();
      const toRollback = applied
        .filter(m => m.version > targetVersion)
        .reverse(); // 从最新开始回滚

      if (toRollback.length === 0) {
        console.log('没有需要回滚的迁移');
        return { success: true, rolledback: [] };
      }

      console.log(`回滚到版本 ${targetVersion}，需要回滚 ${toRollback.length} 个迁移`);

      const rolledback = [];
      for (const migration of toRollback) {
        const migrationFile = this.getMigrationFiles().find(f => f.version === migration.version);
        if (migrationFile) {
          await this.rollbackMigration(migrationFile);
          rolledback.push(migration);
        }
      }

      console.log('回滚完成');
      return { success: true, rolledback };
    } catch (error) {
      console.error('回滚失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重置数据库（回滚所有迁移）
   */
  async reset() {
    try {
      console.log('开始重置数据库...');

      const applied = this.getAppliedMigrations();
      if (applied.length === 0) {
        console.log('数据库已经是初始状态');
        return { success: true };
      }

      return await this.rollbackToVersion('0');
    } catch (error) {
      console.error('数据库重置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取迁移状态
   */
  getStatus() {
    const applied = this.getAppliedMigrations();
    const available = this.getMigrationFiles();
    const pending = this.getPendingMigrations();

    return {
      total: available.length,
      applied: applied.length,
      pending: pending.length,
      currentVersion: applied.length > 0 ? applied[applied.length - 1].version : null,
      migrations: {
        applied,
        pending: pending.map(m => ({
          version: m.version,
          description: m.description
        }))
      }
    };
  }
}

module.exports = MigrationManager;