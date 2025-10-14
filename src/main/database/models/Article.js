/**
 * 文章数据模型
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabaseInstance } = require('../Database');

class Article {
  constructor() {
    this.db = getDatabaseInstance();
  }

  /**
   * 创建新文章
   */
  create(articleData) {
    try {
      const article = {
        uuid: uuidv4(),
        title: articleData.title || '无标题文章',
        content: articleData.content || '',
        html_content: articleData.html_content || '',
        cover_image: articleData.cover_image || '',
        tags: JSON.stringify(articleData.tags || []),
        category: articleData.category || '',
        status: articleData.status || 0,
        word_count: this.calculateWordCount(articleData.content),
        reading_time: this.calculateReadingTime(articleData.content),
        created_at: Date.now(),
        updated_at: Date.now()
      };

      const stmt = this.db.prepare(`
        INSERT INTO articles (
          uuid, title, content, html_content, cover_image, tags,
          category, status, word_count, reading_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        article.uuid,
        article.title,
        article.content,
        article.html_content,
        article.cover_image,
        article.tags,
        article.category,
        article.status,
        article.word_count,
        article.reading_time,
        article.created_at,
        article.updated_at
      );

      return {
        id: result.lastInsertRowid,
        ...article,
        tags: JSON.parse(article.tags)
      };
    } catch (error) {
      console.error('创建文章失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取文章
   */
  findById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?');
      const article = stmt.get(id);

      if (article) {
        return {
          ...article,
          tags: JSON.parse(article.tags || '[]')
        };
      }
      return null;
    } catch (error) {
      console.error('获取文章失败:', error);
      throw error;
    }
  }

  /**
   * 根据UUID获取文章
   */
  findByUuid(uuid) {
    try {
      const stmt = this.db.prepare('SELECT * FROM articles WHERE uuid = ?');
      const article = stmt.get(uuid);

      if (article) {
        return {
          ...article,
          tags: JSON.parse(article.tags || '[]')
        };
      }
      return null;
    } catch (error) {
      console.error('获取文章失败:', error);
      throw error;
    }
  }

  /**
   * 更新文章
   */
  update(id, updateData) {
    try {
      const updates = { ...updateData };
      updates.updated_at = Date.now();

      // 重新计算字数和阅读时间
      if (updates.content) {
        updates.word_count = this.calculateWordCount(updates.content);
        updates.reading_time = this.calculateReadingTime(updates.content);
      }

      // 处理标签
      if (updates.tags) {
        updates.tags = JSON.stringify(updates.tags);
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
        UPDATE articles
        SET ${fields.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);

      return result.changes > 0;
    } catch (error) {
      console.error('更新文章失败:', error);
      throw error;
    }
  }

  /**
   * 删除文章
   */
  delete(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM articles WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('删除文章失败:', error);
      throw error;
    }
  }

  /**
   * 获取文章列表
   */
  findAll(options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        status = null,
        category = null,
        search = '',
        orderBy = 'updated_at',
        order = 'DESC'
      } = options;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status !== null) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      const stmt = this.db.prepare(`
        SELECT * FROM articles
        ${whereClause}
        ORDER BY ${orderBy} ${order}
        LIMIT ? OFFSET ?
      `);

      const articles = stmt.all([...params, limit, offset]);

      return articles.map(article => ({
        ...article,
        tags: JSON.parse(article.tags || '[]')
      }));
    } catch (error) {
      console.error('获取文章列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取文章总数
   */
  count(options = {}) {
    try {
      const {
        status = null,
        category = null,
        search = ''
      } = options;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status !== null) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM articles ${whereClause}
      `);

      const result = stmt.get(...params);
      return result.count;
    } catch (error) {
      console.error('获取文章总数失败:', error);
      throw error;
    }
  }

  /**
   * 批量操作
   */
  batch(operations) {
    try {
      this.db.beginTransaction();

      const results = [];
      for (const operation of operations) {
        const { type, data } = operation;

        switch (type) {
        case 'create':
          results.push(this.create(data));
          break;
        case 'update':
          results.push(this.update(data.id, data));
          break;
        case 'delete':
          results.push(this.delete(data.id));
          break;
        default:
          throw new Error(`不支持的操作类型: ${type}`);
        }
      }

      this.db.commit();
      return results;
    } catch (error) {
      this.db.rollback();
      console.error('批量操作失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 0 THEN 1 END) as drafts,
          COUNT(CASE WHEN status = 1 THEN 1 END) as published,
          COUNT(CASE WHEN status = 2 THEN 1 END) as failed,
          SUM(word_count) as total_words,
          AVG(reading_time) as avg_reading_time
        FROM articles
      `);

      return stmt.get();
    } catch (error) {
      console.error('获取统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 清理旧文章
   */
  cleanup(olderThanDays = 30) {
    try {
      const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

      const stmt = this.db.prepare(`
        DELETE FROM articles
        WHERE status = 0 AND updated_at < ? AND id NOT IN (
          SELECT DISTINCT article_id FROM publish_tasks
        )
      `);

      const result = stmt.run(cutoffDate);
      return result.changes;
    } catch (error) {
      console.error('清理旧文章失败:', error);
      throw error;
    }
  }

  /**
   * 计算字数
   */
  calculateWordCount(content) {
    if (!content) return 0;

    // 如果是Quill Delta格式，提取文本内容
    if (typeof content === 'string' && content.startsWith('{"ops"')) {
      try {
        const delta = JSON.parse(content);
        const text = delta.ops.map(op => op.insert).join('');
        return this.countWords(text);
      } catch (error) {
        // 如果解析失败，直接处理原内容
      }
    }

    return this.countWords(content);
  }

  /**
   * 计算阅读时间（分钟）
   */
  calculateReadingTime(content) {
    const wordCount = this.calculateWordCount(content);
    // 假设阅读速度：中文300字/分钟，英文200词/分钟
    return Math.max(1, Math.ceil(wordCount / 300));
  }

  /**
   * 字数统计工具
   */
  countWords(text) {
    if (!text) return 0;

    // 清理HTML标签
    const cleanText = text.replace(/<[^>]*>/g, '');

    // 中文字符统计
    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 英文单词统计
    const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length;

    return chineseChars + englishWords;
  }
}

module.exports = Article;