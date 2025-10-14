/**
 * DatabaseService.js 数据库服务管理测试
 */

const { getDatabaseService } = require('../../../../src/main/database/DatabaseService');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, '../../../test-dbservice-data.db');

// 测试工具函数
const createTestArticle = (overrides = {}) => ({
  title: '测试文章',
  content: '{"ops":[{"insert":"这是一个测试文章\n"}]}',
  html_content: '<p>这是一个测试文章</p>',
  tags: ['测试', '数据库'],
  category: '技术',
  status: 0,
  ...overrides
});

const createTestPlatform = (overrides = {}) => ({
  name: '测试平台',
  platform_code: 'test_platform',
  base_url: 'https://test.com',
  login_type: 'qrcode',
  is_active: true,
  config: {},
  ...overrides
});

describe('DatabaseService 数据库服务管理', () => {
  let dbService;

  beforeAll(async () => {
    // 使用测试数据库路径
    process.env.TEST_DB_PATH = TEST_DB_PATH;
    dbService = getDatabaseService();
  });

  afterAll(async () => {
    if (dbService) {
      await dbService.close();
    }
  });

  beforeEach(async () => {
    // 重新初始化数据库服务
    await dbService.initialize();
  });

  afterEach(async () => {
    // 清理测试数据
    await dbService.close();
    // 删除测试数据库文件
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('服务初始化', () => {
    test('应该成功初始化数据库服务', async () => {
      expect(dbService.db).toBeDefined();
      expect(dbService.models).toBeDefined();
      expect(dbService.models.article).toBeDefined();
      expect(dbService.models.platform).toBeDefined();
    });

    test('应该创建所有必需的表', async () => {
      const tables = dbService.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      const expectedTables = [
        'articles', 'platforms', 'user_platform_configs',
        'login_sessions', 'publish_tasks', 'publish_logs',
        'system_configs', 'media_files'
      ];

      expectedTables.forEach(table => {
        expect(tables.some(t => t.name === table)).toBe(true);
      });
    });

    test('应该运行迁移脚本', async () => {
      // 检查迁移版本表是否存在
      const migrationTable = dbService.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_migrations'
      `).get();

      expect(migrationTable).toBeDefined();
    });
  });

  describe('模型访问', () => {
    test('应该提供文章模型访问', () => {
      const articleModel = dbService.getModel('article');
      expect(articleModel).toBeDefined();
      expect(articleModel.create).toBeDefined();
      expect(articleModel.findById).toBeDefined();
      expect(articleModel.findAll).toBeDefined();
      expect(articleModel.update).toBeDefined();
      expect(articleModel.delete).toBeDefined();
    });

    test('应该提供平台模型访问', () => {
      const platformModel = dbService.getModel('platform');
      expect(platformModel).toBeDefined();
      expect(platformModel.create).toBeDefined();
      expect(platformModel.findById).toBeDefined();
      expect(platformModel.findAll).toBeDefined();
      expect(platformModel.update).toBeDefined();
      expect(platformModel.delete).toBeDefined();
    });

    test('应该处理无效模型名称', () => {
      expect(() => dbService.getModel('invalid')).toThrow();
    });
  });

  describe('事务处理', () => {
    test('应该执行简单事务', async () => {
      const result = await dbService.transaction(async () => {
        const articleModel = dbService.getModel('article');
        const article = await articleModel.create(createTestArticle({
          title: '事务测试文章'
        }));
        return article.id;
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('number');

      // 验证文章已创建
      const articleModel = dbService.getModel('article');
      const article = await articleModel.findById(result);
      expect(article).toBeDefined();
      expect(article.title).toBe('事务测试文章');
    });

    test('应该回滚失败的事务', async () => {
      const articleModel = dbService.getModel('article');
      const initialCount = (await articleModel.findAll()).length;

      await expect(
        dbService.transaction(async () => {
          await articleModel.create(createTestArticle({
            title: '应该被回滚的文章'
          }));
          throw new Error('测试错误');
        })
      ).rejects.toThrow('测试错误');

      const finalCount = (await articleModel.findAll()).length;
      expect(finalCount).toBe(initialCount);
    });

    test('应该支持嵌套事务', async () => {
      const articleModel = dbService.getModel('article');

      const result = await dbService.transaction(async () => {
        const article1 = await articleModel.create(createTestArticle({
          title: '外层事务文章'
        }));

        return await dbService.transaction(async () => {
          const article2 = await articleModel.create(createTestArticle({
            title: '内层事务文章'
          }));
          return [article1.id, article2.id];
        });
      });

      expect(result).toHaveLength(2);

      // 验证两篇文章都已创建
      const article1 = await articleModel.findById(result[0]);
      const article2 = await articleModel.findById(result[1]);
      expect(article1.title).toBe('外层事务文章');
      expect(article2.title).toBe('内层事务文章');
    });
  });

  describe('批量操作', () => {
    test('应该执行批量数据库操作', async () => {
      const articleModel = dbService.getModel('article');
      const platformModel = dbService.getModel('platform');

      const operations = [
        { model: 'article', type: 'create', data: createTestArticle({ title: '文章1' }) },
        { model: 'platform', type: 'create', data: createTestPlatform({ platform_code: 'platform1' }) },
        { model: 'article', type: 'create', data: createTestArticle({ title: '文章2' }) }
      ];

      const results = await dbService.batch(operations);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);

      // 验证操作结果
      const articles = await articleModel.findAll();
      const platforms = await platformModel.findAll();
      expect(articles).toHaveLength(2);
      expect(platforms).toHaveLength(1);
    });

    test('应该处理批量操作中的错误', async () => {
      const operations = [
        { model: 'article', type: 'create', data: createTestArticle() },
        { model: 'invalid_model', type: 'create', data: {} },
        { model: 'article', type: 'create', data: createTestArticle() }
      ];

      const results = await dbService.batch(operations);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      expect(results[1].error).toBeDefined();
    });
  });

  describe('数据验证', () => {
    test('应该验证数据库完整性', async () => {
      const validation = await dbService.validate();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.tables.missing).toHaveLength(0);
      expect(validation.tables.extra).toHaveLength(0);
    });

    test('应该检测缺失的表', async () => {
      // 删除一个表来模拟损坏
      dbService.db.exec('DROP TABLE articles');

      const validation = await dbService.validate();

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.tables.missing).toContain('articles');
    });

    test('应该验证外键约束', async () => {
      const articleModel = dbService.getModel('article');
      const platformModel = dbService.getModel('platform');

      // 创建测试数据
      const platform = await platformModel.create(createTestPlatform());
      const article = await articleModel.create(createTestArticle());

      // 创建用户平台配置（应该成功）
      dbService.db.run(`
        INSERT INTO user_platform_configs (user_id, platform_id, config)
        VALUES (?, ?, ?)
      `, [1, platform.id, '{}']);

      const validation = await dbService.validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('数据库统计', () => {
    beforeEach(async () => {
      const articleModel = dbService.getModel('article');
      const platformModel = dbService.getModel('platform');

      // 创建测试数据
      await articleModel.create(createTestArticle({ title: '文章1' }));
      await articleModel.create(createTestArticle({ title: '文章2' }));
      await platformModel.create(createTestPlatform({ platform_code: 'platform1' }));
    });

    test('应该返回完整的统计信息', async () => {
      const stats = dbService.getStats();

      expect(stats.database).toBeDefined();
      expect(stats.database.tables.length).toBeGreaterThan(0);
      expect(stats.database.size).toBeGreaterThan(0);
      expect(stats.articles.total).toBe(2);
      expect(stats.platforms.length).toBe(1);
    });

    test('应该计算数据库大小', async () => {
      const stats = dbService.getStats();
      expect(stats.database.size).toBeGreaterThan(0);
    });

    test('应该统计表记录数', async () => {
      const articleModel = dbService.getModel('article');
      const platformModel = dbService.getModel('platform');

      const stats = dbService.getStats();

      expect(stats.articles.total).toBe(2);
      expect(stats.platforms.length).toBe(1);
    });
  });

  describe('数据导入导出', () => {
    test('应该导出数据为JSON', async () => {
      const articleModel = dbService.getModel('article');
      await articleModel.create(createTestArticle({ title: '导出测试文章' }));

      const exportData = await dbService.export();

      expect(exportData).toBeDefined();
      expect(exportData.articles).toBeDefined();
      expect(exportData.platforms).toBeDefined();
      expect(exportData.articles.length).toBe(1);
      expect(exportData.articles[0].title).toBe('导出测试文章');
    });

    test('应该导入JSON数据', async () => {
      const importData = {
        articles: [
          createTestArticle({ title: '导入文章1' }),
          createTestArticle({ title: '导入文章2' })
        ],
        platforms: [
          createTestPlatform({ platform_code: 'import_platform' })
        ]
      };

      const result = await dbService.import(importData);

      expect(result.success).toBe(true);
      expect(result.imported.articles).toBe(2);
      expect(result.imported.platforms).toBe(1);

      // 验证数据已导入
      const articleModel = dbService.getModel('article');
      const platformModel = dbService.getModel('platform');

      const articles = await articleModel.findAll();
      const platforms = await platformModel.findAll();

      expect(articles).toHaveLength(2);
      expect(platforms).toHaveLength(1);
      expect(articles[0].title).toBe('导入文章1');
      expect(articles[1].title).toBe('导入文章2');
    });

    test('应该处理导入数据验证', async () => {
      const invalidImportData = {
        articles: [
          { title: '' } // 无效文章数据（缺少必需字段）
        ]
      };

      const result = await dbService.import(invalidImportData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('清理操作', () => {
    test('应该清理过期的登录会话', async () => {
      // 创建过期的会话
      dbService.db.run(`
        INSERT INTO login_sessions (platform_id, session_data, expires_at)
        VALUES (?, ?, ?)
      `, [1, '{}', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]);

      await dbService.cleanup({
        loginSessionRetentionDays: 0 // 立即清理所有会话
      });

      const expiredSessions = dbService.db.prepare(`
        SELECT COUNT(*) as count FROM login_sessions
        WHERE expires_at < datetime('now')
      `).get();

      expect(expiredSessions.count).toBe(0);
    });

    test('应该清理旧的发布日志', async () => {
      // 创建旧的发布日志
      dbService.db.run(`
        INSERT INTO publish_logs (task_id, platform_id, status, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [1, 1, 'success', 'test', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]);

      await dbService.cleanup({
        publishLogRetentionDays: 7 // 保留7天
      });

      const oldLogs = dbService.db.prepare(`
        SELECT COUNT(*) as count FROM publish_logs
        WHERE created_at < datetime('now', '-7 days')
      `).get();

      expect(oldLogs.count).toBe(0);
    });

    test('应该清理临时媒体文件', async () => {
      // 创建临时媒体文件记录
      dbService.db.run(`
        INSERT INTO media_files (filename, filepath, file_type, size, is_temporary, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['temp.jpg', '/temp/temp.jpg', 'image', 1024, 1, new Date().toISOString()]);

      await dbService.cleanup({
        tempFileRetentionHours: 1 // 保留1小时
      });

      const tempFiles = dbService.db.prepare(`
        SELECT COUNT(*) as count FROM media_files
        WHERE is_temporary = 1 AND created_at < datetime('now', '-1 hours')
      `).get();

      expect(tempFiles.count).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库连接错误', async () => {
      await dbService.close();

      await expect(dbService.getModel('article')).rejects.toThrow();
    });

    test('应该处理无效操作', async () => {
      await expect(
        dbService.transaction(() => {
          throw new Error('测试错误');
        })
      ).rejects.toThrow('测试错误');
    });

    test('应该提供错误恢复机制', async () => {
      // 模拟数据库损坏
      await dbService.close();

      // 重新初始化应该能恢复
      await dbService.initialize();

      expect(dbService.db).toBeDefined();
      expect(dbService.isConnected()).toBe(true);
    });
  });

  describe('性能监控', () => {
    test('应该监控查询性能', async () => {
      const articleModel = dbService.getModel('article');

      // 执行多个操作
      await articleModel.create(createTestArticle());
      await articleModel.findAll();
      await articleModel.search('测试');

      const performance = dbService.getPerformanceStats();

      expect(performance).toBeDefined();
      expect(performance.queries).toBeGreaterThan(0);
      expect(performance.totalTime).toBeGreaterThan(0);
    });

    test('应该检测慢查询', async () => {
      const articleModel = dbService.getModel('article');

      // 模拟慢查询（大量数据插入）
      const articles = [];
      for (let i = 0; i < 100; i++) {
        articles.push(createTestArticle({ title: `文章${i}` }));
      }

      await articleModel.batch(articles.map(article => ({
        type: 'create',
        data: article
      })));

      const performance = dbService.getPerformanceStats();
      expect(performance.slowQueries).toBeDefined();
    });
  });
});