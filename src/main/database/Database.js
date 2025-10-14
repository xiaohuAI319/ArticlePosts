/**
 * 数据库连接管理类
 * 使用 better-sqlite3 进行数据库操作
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../../data/app.db');
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * 获取或创建加密密钥
   */
  getOrCreateEncryptionKey() {
    // 在实际应用中，应该从安全的地方获取密钥
    // 这里使用机器ID作为基础，生产环境需要更安全的方案
    const machineId = require('os').hostname() + require('os').userInfo().username;
    return crypto.createHash('sha256').update(machineId).digest('hex');
  }

  /**
   * 初始化数据库连接
   */
  initialize() {
    try {
      // 确保数据目录存在
      const fs = require('fs');
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 创建数据库连接
      this.db = new Database(this.dbPath);

      // 配置数据库
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');

      console.log('数据库连接成功');
      return true;
    } catch (error) {
      console.error('数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('数据库连接已关闭');
    }
  }

  /**
   * 获取数据库实例
   */
  getInstance() {
    if (!this.db) {
      throw new Error('数据库未初始化，请先调用 initialize()');
    }
    return this.db;
  }

  /**
   * 执行SQL语句
   */
  exec(sql) {
    try {
      return this.getInstance().exec(sql);
    } catch (error) {
      console.error('SQL执行失败:', error);
      throw error;
    }
  }

  /**
   * 准备SQL语句
   */
  prepare(sql) {
    try {
      return this.getInstance().prepare(sql);
    } catch (error) {
      console.error('SQL准备失败:', error);
      throw error;
    }
  }

  /**
   * 执行查询
   */
  all(sql, params = []) {
    try {
      const stmt = this.prepare(sql);
      return stmt.all(params);
    } catch (error) {
      console.error('查询失败:', error);
      throw error;
    }
  }

  /**
   * 执行查询（单条记录）
   */
  get(sql, params = []) {
    try {
      const stmt = this.prepare(sql);
      return stmt.get(params);
    } catch (error) {
      console.error('查询失败:', error);
      throw error;
    }
  }

  /**
   * 执行更新
   */
  run(sql, params = []) {
    try {
      const stmt = this.prepare(sql);
      return stmt.run(params);
    } catch (error) {
      console.error('更新失败:', error);
      throw error;
    }
  }

  /**
   * 开始事务
   */
  beginTransaction() {
    this.exec('BEGIN TRANSACTION');
  }

  /**
   * 提交事务
   */
  commit() {
    this.exec('COMMIT');
  }

  /**
   * 回滚事务
   */
  rollback() {
    this.exec('ROLLBACK');
  }

  /**
   * 加密数据
   */
  encrypt(data) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('数据加密失败:', error);
      throw error;
    }
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');

      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('数据解密失败:', error);
      return null;
    }
  }

  /**
   * 备份数据库
   */
  backup(backupPath) {
    try {
      const backup = new Database(backupPath);
      this.getInstance().backup(backup);
      backup.close();
      console.log('数据库备份成功:', backupPath);
      return true;
    } catch (error) {
      console.error('数据库备份失败:', error);
      throw error;
    }
  }

  /**
   * 检查数据库健康状态
   */
  checkHealth() {
    try {
      // 检查数据库完整性
      const integrityResult = this.get('PRAGMA integrity_check');
      if (integrityResult && integrityResult.integrity_check !== 'ok') {
        throw new Error('数据库完整性检查失败');
      }

      // 检查表是否存在
      const tables = this.all('SELECT name FROM sqlite_master WHERE type=\'table\'');
      const tableNames = tables.map(t => t.name);

      return {
        status: 'healthy',
        tables: tableNames,
        size: this.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').size
      };
    } catch (error) {
      console.error('数据库健康检查失败:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// 创建单例实例
let dbInstance = null;

/**
 * 获取数据库实例
 */
function getDatabaseInstance() {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

module.exports = {
  DatabaseManager,
  getDatabaseInstance
};