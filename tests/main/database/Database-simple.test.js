/**
 * DatabaseManager 简化功能测试
 * 测试实际已实现的功能
 */

const { DatabaseManager } = require('../../../src/main/database/Database');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, '../../../test-db-simple.db');

describe('DatabaseManager 基础功能测试', () => {
  let dbManager;

  beforeEach(() => {
    // 清理之前的测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    dbManager = new DatabaseManager();
    // 手动设置测试数据库路径
    dbManager.dbPath = TEST_DB_PATH;
  });

  afterEach(async () => {
    if (dbManager && dbManager.db) {
      dbManager.close();
    }

    // 清理测试数据库文件
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('数据库初始化', () => {
    test('应该成功初始化数据库连接', async () => {
      const result = await dbManager.initialize();

      expect(result).toBe(true);
      expect(dbManager.db).toBeDefined();
      expect(dbManager.getInstance()).toBeDefined();
    });

    test('应该创建数据库文件', async () => {
      await dbManager.initialize();

      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    test('应该配置数据库参数', async () => {
      await dbManager.initialize();

      // 检查WAL模式是否启用
      const journalMode = dbManager.get('PRAGMA journal_mode');
      expect(journalMode).toBe('wal');

      // 检查外键约束
      const foreignKeys = dbManager.get('PRAGMA foreign_keys');
      expect(foreignKeys).toBe(0); // 默认可能未启用
    });
  });

  describe('基础数据库操作', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('应该执行基础查询', () => {
      const result = dbManager.get('SELECT 1 as test_value');
      expect(result.test_value).toBe(1);
    });

    test('应该执行参数化查询', () => {
      const result = dbManager.get('SELECT ? as value', ['test_param']);
      expect(result.value).toBe('test_param');
    });

    test('应该执行多条查询', () => {
      const results = dbManager.all('SELECT 1 as num UNION SELECT 2 as num');
      expect(results).toHaveLength(2);
      expect(results[0].num).toBe(1);
      expect(results[1].num).toBe(2);
    });

    test('应该创建表和插入数据', () => {
      // 创建测试表
      dbManager.run(`
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 插入数据
      const insertResult = dbManager.run(
        'INSERT INTO test_table (name) VALUES (?)',
        ['测试数据']
      );

      expect(insertResult.changes).toBe(1);
      expect(insertResult.lastID).toBe(1);

      // 查询数据
      const insertedData = dbManager.get(
        'SELECT * FROM test_table WHERE id = ?',
        [1]
      );

      expect(insertedData.name).toBe('测试数据');
      expect(insertedData.id).toBe(1);
    });

    test('应该执行批量操作', () => {
      // 创建测试表
      dbManager.run(`
        CREATE TABLE IF NOT EXISTS batch_test (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);

      // 准备批量插入
      const stmt = dbManager.prepare('INSERT INTO batch_test (value) VALUES (?)');
      const batchResult = dbManager.batch([
        stmt.run('value1'),
        stmt.run('value2'),
        stmt.run('value3')
      ]);

      const results = batchResult();
      expect(results).toHaveLength(3);
      expect(results[0].changes).toBe(1);
      expect(results[1].changes).toBe(1);
      expect(results[2].changes).toBe(1);

      // 验证数据
      const allData = dbManager.all('SELECT * FROM batch_test');
      expect(allData).toHaveLength(3);
    });
  });

  describe('事务处理', () => {
    beforeEach(async () => {
      await dbManager.initialize();
      dbManager.run(`
        CREATE TABLE IF NOT EXISTS transaction_test (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);
    });

    test('应该成功提交事务', () => {
      dbManager.beginTransaction();

      try {
        dbManager.run('INSERT INTO transaction_test (value) VALUES (?)', ['value1']);
        dbManager.run('INSERT INTO transaction_test (value) VALUES (?)', ['value2']);
        dbManager.commit();
      } catch (error) {
        dbManager.rollback();
        throw error;
      }

      const count = dbManager.get('SELECT COUNT(*) as count FROM transaction_test');
      expect(count.count).toBe(2);
    });

    test('应该成功回滚事务', () => {
      dbManager.beginTransaction();

      try {
        dbManager.run('INSERT INTO transaction_test (value) VALUES (?)', ['value1']);
        throw new Error('测试错误');
      } catch (error) {
        dbManager.rollback();
      }

      const count = dbManager.get('SELECT COUNT(*) as count FROM transaction_test');
      expect(count.count).toBe(0);
    });
  });

  describe('数据加密功能', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('应该能够加密数据', () => {
      const testData = { message: '这是敏感数据', id: 123 };
      const encryptedData = dbManager.encrypt(testData);

      expect(encryptedData).toBeDefined();
      expect(typeof encryptedData).toBe('string');
      expect(encryptedData).toContain(':'); // 应该包含iv分隔符
    });

    test('应该能够解密数据', () => {
      const testData = { message: '这是敏感数据', id: 123 };
      const encryptedData = dbManager.encrypt(testData);
      const decryptedData = dbManager.decrypt(encryptedData);

      expect(decryptedData).toEqual(testData);
    });

    test('应该处理无效的解密数据', () => {
      const invalidEncryptedData = 'invalid:encrypted:data';
      const decryptedData = dbManager.decrypt(invalidEncryptedData);

      expect(decryptedData).toBeNull();
    });
  });

  describe('数据库备份功能', () => {
    beforeEach(async () => {
      await dbManager.initialize();
      dbManager.run(`
        CREATE TABLE IF NOT EXISTS backup_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);
      dbManager.run('INSERT INTO backup_test (data) VALUES (?)', ['重要数据']);
    });

    test('应该成功创建备份', () => {
      const backupPath = TEST_DB_PATH.replace('.db', '_backup.db');

      expect(() => {
        dbManager.backup(backupPath);
      }).not.toThrow();

      expect(fs.existsSync(backupPath)).toBe(true);

      // 清理备份文件
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });
  });

  describe('健康检查功能', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    test('应该通过健康检查', () => {
      const health = dbManager.checkHealth();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.tables).toBeDefined();
      expect(Array.isArray(health.tables)).toBe(true);
      expect(health.size).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效SQL', () => {
      expect(() => {
        dbManager.run('INVALID SQL STATEMENT');
      }).toThrow();
    });

    test('应该处理数据库未初始化', () => {
      const uninitializedDb = new DatabaseManager();

      expect(() => {
        uninitializedDb.get('SELECT 1');
      }).toThrow('数据库未初始化');
    });

    test('应该正确关闭数据库连接', () => {
      dbManager.initialize();
      expect(dbManager.db).toBeDefined();

      dbManager.close();
      expect(dbManager.db).toBeNull();
    });
  });

  describe('单例模式测试', () => {
    test('getDatabaseInstance应该返回单例', () => {
      const { getDatabaseInstance } = require('../../../src/main/database/Database');

      const instance1 = getDatabaseInstance();
      const instance2 = getDatabaseInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(DatabaseManager);
    });
  });
});