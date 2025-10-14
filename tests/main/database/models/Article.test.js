/**
 * Article.js 文章数据模型测试
 */

const Article = require('../../../../src/main/database/models/Article');
const Database = require('../../../../src/main/database/Database');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, '../../../../test-article-data.db');

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

describe('Article 文章数据模型', () => {
  let database;
  let articleModel;

  beforeAll(async () => {
    // 清理测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    database = new Database(TEST_DB_PATH);
    await database.initialize();

    // 创建文章表
    await database.run(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT DEFAULT '{}',
        html_content TEXT DEFAULT '',
        excerpt TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        category TEXT DEFAULT '',
        status INTEGER DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        reading_time INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        published_at DATETIME NULL,
        draft_saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    articleModel = new Article(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
      // 清理测试数据库文件
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await database.run('DELETE FROM articles');
  });

  describe('创建文章', () => {
    test('应该成功创建文章', async () => {
      const articleData = createTestArticle();
      const article = await articleModel.create(articleData);

      expect(article.id).toBeDefined();
      expect(article.title).toBe(articleData.title);
      expect(article.content).toBe(articleData.content);
      expect(article.html_content).toBe(articleData.html_content);
      expect(article.status).toBe(articleData.status);
      expect(article.word_count).toBeGreaterThan(0);
      expect(article.reading_time).toBeGreaterThan(0);
      expect(article.created_at).toBeDefined();
      expect(article.updated_at).toBeDefined();
    });

    test('应该自动计算字数和阅读时间', async () => {
      const longContent = '{"ops":[{"insert":"这是一个很长的文章内容。包含多个句子。每个句子都应该被计算在内。总共有大约五十个字符左右的内容。"}]}';
      const articleData = createTestArticle({
        content: longContent
      });

      const article = await articleModel.create(articleData);

      expect(article.word_count).toBeGreaterThan(0);
      expect(article.reading_time).toBe(Math.ceil(article.word_count / 200)); // 200字/分钟
    });

    test('应该处理必需字段缺失', async () => {
      const invalidArticle = { content: 'content without title' };

      await expect(articleModel.create(invalidArticle)).rejects.toThrow();
    });

    test('应该处理标签数组', async () => {
      const articleData = createTestArticle({
        tags: ['技术', 'JavaScript', 'Electron']
      });

      const article = await articleModel.create(articleData);

      expect(JSON.parse(article.tags)).toEqual(['技术', 'JavaScript', 'Electron']);
    });
  });

  describe('查询文章', () => {
    beforeEach(async () => {
      // 创建测试文章
      await articleModel.create(createTestArticle({ title: '文章1', status: 0 }));
      await articleModel.create(createTestArticle({ title: '文章2', status: 1 }));
      await articleModel.create(createTestArticle({ title: '文章3', status: 0 }));
    });

    test('应该根据ID查找文章', async () => {
      const articles = await articleModel.findAll();
      const firstArticle = articles[0];

      const foundArticle = await articleModel.findById(firstArticle.id);

      expect(foundArticle).toBeDefined();
      expect(foundArticle.id).toBe(firstArticle.id);
      expect(foundArticle.title).toBe(firstArticle.title);
    });

    test('应该处理不存在的文章ID', async () => {
      const foundArticle = await articleModel.findById(99999);
      expect(foundArticle).toBeNull();
    });

    test('应该查找所有文章', async () => {
      const articles = await articleModel.findAll();

      expect(articles).toHaveLength(3);
      expect(articles[0].title).toBeDefined();
      expect(articles[0].content).toBeDefined();
    });

    test('应该支持分页查询', async () => {
      const articles = await articleModel.findAll({ limit: 2, offset: 1 });

      expect(articles).toHaveLength(2);
    });

    test('应该按状态筛选文章', async () => {
      const draftArticles = await articleModel.findAll({ status: 0 });
      const publishedArticles = await articleModel.findAll({ status: 1 });

      expect(draftArticles).toHaveLength(2);
      expect(publishedArticles).toHaveLength(1);
    });

    test('应该按分类筛选文章', async () => {
      await articleModel.create(createTestArticle({
        title: '技术文章',
        category: '技术'
      }));

      const techArticles = await articleModel.findAll({ category: '技术' });

      expect(techArticles.length).toBeGreaterThan(0);
      techArticles.forEach(article => {
        expect(article.category).toBe('技术');
      });
    });

    test('应该搜索文章标题和内容', async () => {
      await articleModel.create(createTestArticle({
        title: 'JavaScript教程',
        content: '{"ops":[{"insert":"这是一篇关于JavaScript的教程"}]}'
      }));

      const searchResults = await articleModel.search('JavaScript');

      expect(searchResults.length).toBeGreaterThan(0);
      searchResults.forEach(article => {
        const titleMatch = article.title.includes('JavaScript');
        const contentMatch = article.content.includes('JavaScript');
        expect(titleMatch || contentMatch).toBe(true);
      });
    });
  });

  describe('更新文章', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await articleModel.create(createTestArticle());
    });

    test('应该成功更新文章', async () => {
      const updateData = {
        title: '更新后的标题',
        content: '{"ops":[{"insert":"更新后的内容"}]}',
        status: 1
      };

      const updatedArticle = await articleModel.update(testArticle.id, updateData);

      expect(updatedArticle.title).toBe(updateData.title);
      expect(updatedArticle.content).toBe(updateData.content);
      expect(updatedArticle.status).toBe(updateData.status);
      expect(updatedArticle.updated_at).not.toBe(testArticle.updated_at);
    });

    test('应该自动重新计算字数', async () => {
      const longContent = '{"ops":[{"insert":"这是一个很长的更新内容，包含很多文字，应该重新计算字数"}]}';

      const updatedArticle = await articleModel.update(testArticle.id, {
        content: longContent
      });

      expect(updatedArticle.word_count).toBeGreaterThan(0);
      expect(updatedArticle.reading_time).toBeGreaterThan(0);
    });

    test('应该处理部分更新', async () => {
      const updateData = { title: '只更新标题' };

      const updatedArticle = await articleModel.update(testArticle.id, updateData);

      expect(updatedArticle.title).toBe(updateData.title);
      expect(updatedArticle.content).toBe(testArticle.content); // 其他字段保持不变
    });

    test('应该处理不存在的文章ID', async () => {
      await expect(
        articleModel.update(99999, { title: '更新标题' })
      ).rejects.toThrow();
    });
  });

  describe('删除文章', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await articleModel.create(createTestArticle());
    });

    test('应该成功删除文章', async () => {
      await articleModel.delete(testArticle.id);

      const foundArticle = await articleModel.findById(testArticle.id);
      expect(foundArticle).toBeNull();
    });

    test('应该处理不存在的文章ID', async () => {
      await expect(articleModel.delete(99999)).rejects.toThrow();
    });
  });

  describe('批量操作', () => {
    beforeEach(async () => {
      // 创建多个测试文章
      for (let i = 1; i <= 5; i++) {
        await articleModel.create(createTestArticle({
          title: `文章${i}`,
          status: i <= 3 ? 0 : 1 // 前3篇为草稿
        }));
      }
    });

    test('应该批量执行操作', async () => {
      const operations = [
        { type: 'update', id: 1, data: { title: '更新文章1' } },
        { type: 'update', id: 2, data: { status: 1 } },
        { type: 'create', data: createTestArticle({ title: '新文章' }) },
        { type: 'delete', id: 3 }
      ];

      const results = await articleModel.batch(operations);

      expect(results).toHaveLength(4);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(results[3].success).toBe(true);

      // 验证操作结果
      const updatedArticle1 = await articleModel.findById(1);
      expect(updatedArticle1.title).toBe('更新文章1');

      const updatedArticle2 = await articleModel.findById(2);
      expect(updatedArticle2.status).toBe(1);

      const deletedArticle = await articleModel.findById(3);
      expect(deletedArticle).toBeNull();

      const allArticles = await articleModel.findAll();
      expect(allArticles).toHaveLength(5); // 3 + 1(新) - 1(删除) + 1(原有)
    });

    test('应该处理批量操作中的错误', async () => {
      const operations = [
        { type: 'update', id: 1, data: { title: '正常更新' } },
        { type: 'update', id: 99999, data: { title: '无效ID' } },
        { type: 'create', data: createTestArticle({ title: '新文章' }) }
      ];

      const results = await articleModel.batch(operations);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      expect(results[1].error).toBeDefined();
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await articleModel.create(createTestArticle({ title: '草稿1', status: 0 }));
      await articleModel.create(createTestArticle({ title: '草稿2', status: 0 }));
      await articleModel.create(createTestArticle({ title: '已发布', status: 1 }));
    });

    test('应该返回正确的统计信息', async () => {
      const stats = await articleModel.getStats();

      expect(stats.total).toBe(3);
      expect(stats.draft).toBe(2);
      expect(stats.published).toBe(1);
      expect(stats.totalWords).toBeGreaterThan(0);
      expect(stats.categories.length).toBeGreaterThan(0);
    });

    test('应该按时间段统计', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = await articleModel.getStats({
        startDate: yesterday.toISOString(),
        endDate: now.toISOString()
      });

      expect(stats.total).toBe(3); // 所有文章都在这个时间范围内
    });
  });

  describe('自动保存草稿', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await articleModel.create(createTestArticle());
    });

    test('应该自动更新草稿保存时间', async () => {
      const originalSavedAt = testArticle.draft_saved_at;

      // 等待一秒确保时间戳不同
      await testUtils.wait(1000);

      await articleModel.update(testArticle.id, {
        title: '更新标题'
      });

      const updatedArticle = await articleModel.findById(testArticle.id);
      expect(updatedArticle.draft_saved_at).not.toBe(originalSavedAt);
    });
  });
});