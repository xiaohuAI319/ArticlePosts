/**
 * 文章管理服务 - T009文章管理服务
 * 负责文章的CRUD操作、自动保存草稿、内容验证等功能
 */

const Article = require('../database/models/Article');
const path = require('path');
const fs = require('fs').promises;

class ArticleService {
  constructor() {
    this.articleModel = new Article();
    this.autoSaveInterval = null;
    this.lastSaveTime = null;
  }

  /**
   * 创建新文章
   */
  async createArticle(articleData) {
    try {
      const article = await this.articleModel.create({
        title: articleData.title || '无标题文章',
        content: articleData.content || '',
        html_content: articleData.html_content || articleData.content || '',
        tags: articleData.tags || [],
        category: articleData.category || '',
        status: 0, // 默认为草稿
        cover_image: articleData.cover_image || ''
      });

      return {
        success: true,
        data: article,
        message: '文章创建成功'
      };
    } catch (error) {
      console.error('创建文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '文章创建失败'
      };
    }
  }

  /**
   * 根据ID获取文章
   */
  async getArticle(id) {
    try {
      const article = await this.articleModel.findById(id);
      if (!article) {
        return {
          success: false,
          error: 'Article not found',
          message: '文章不存在'
        };
      }

      return {
        success: true,
        data: article
      };
    } catch (error) {
      console.error('获取文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文章失败'
      };
    }
  }

  /**
   * 根据UUID获取文章
   */
  async getArticleByUuid(uuid) {
    try {
      const article = await this.articleModel.findByUuid(uuid);
      if (!article) {
        return {
          success: false,
          error: 'Article not found',
          message: '文章不存在'
        };
      }

      return {
        success: true,
        data: article
      };
    } catch (error) {
      console.error('获取文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文章失败'
      };
    }
  }

  /**
   * 更新文章
   */
  async updateArticle(id, updateData) {
    try {
      // 验证文章是否存在
      const existing = await this.articleModel.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Article not found',
          message: '文章不存在'
        };
      }

      // 验证内容
      const validationResult = this.validateContent(updateData);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          message: validationResult.message
        };
      }

      // 更新文章
      const updated = await this.articleModel.update(id, updateData);
      if (!updated) {
        return {
          success: false,
          error: 'Update failed',
          message: '更新文章失败'
        };
      }

      // 获取更新后的文章
      const article = await this.articleModel.findById(id);

      return {
        success: true,
        data: article,
        message: '文章更新成功'
      };
    } catch (error) {
      console.error('更新文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新文章失败'
      };
    }
  }

  /**
   * 删除文章
   */
  async deleteArticle(id) {
    try {
      const deleted = await this.articleModel.delete(id);
      if (!deleted) {
        return {
          success: false,
          error: 'Article not found',
          message: '文章不存在'
        };
      }

      return {
        success: true,
        message: '文章删除成功'
      };
    } catch (error) {
      console.error('删除文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '删除文章失败'
      };
    }
  }

  /**
   * 获取文章列表
   */
  async getArticles(options = {}) {
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

      const articles = await this.articleModel.findAll({
        limit,
        offset,
        status,
        category,
        search,
        orderBy,
        order
      });

      const total = await this.articleModel.count({
        status,
        category,
        search
      });

      return {
        success: true,
        data: {
          articles,
          total,
          limit,
          offset,
          hasMore: offset + articles.length < total
        }
      };
    } catch (error) {
      console.error('获取文章列表失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文章列表失败'
      };
    }
  }

  /**
   * 获取文章统计信息
   */
  async getStats() {
    try {
      const stats = await this.articleModel.getStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取统计信息失败'
      };
    }
  }

  /**
   * 内容验证
   */
  validateContent(articleData) {
    // 标题验证
    if (articleData.title && articleData.title.length > 200) {
      return {
        valid: false,
        error: 'title_too_long',
        message: '标题长度不能超过200个字符'
      };
    }

    // 内容验证
    if (articleData.content && articleData.content.length > 1000000) {
      return {
        valid: false,
        error: 'content_too_long',
        message: '内容长度不能超过100万个字符'
      };
    }

    // 标签验证
    if (articleData.tags && Array.isArray(articleData.tags)) {
      if (articleData.tags.length > 20) {
        return {
          valid: false,
          error: 'too_many_tags',
          message: '标签数量不能超过20个'
        };
      }

      for (const tag of articleData.tags) {
        if (tag.length > 50) {
          return {
            valid: false,
            error: 'tag_too_long',
            message: '标签长度不能超过50个字符'
          };
        }
      }
    }

    // 分类验证
    if (articleData.category && articleData.category.length > 100) {
      return {
        valid: false,
        error: 'category_too_long',
        message: '分类长度不能超过100个字符'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * 清理内容（移除不安全的HTML标签等）
   */
  sanitizeContent(content) {
    if (!content) return '';

    // 基本的HTML清理
    let sanitized = content
      // 移除script标签
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 移除危险的事件属性
      .replace(/on\w+="[^"]*"/gi, '')
      // 移除javascript:协议
      .replace(/javascript:/gi, '')
      // 移除data:协议（除了data:image）
      .replace(/data:(?!image)/gi, '');

    return sanitized;
  }

  /**
   * 处理图片上传
   */
  async handleImageUpload(imageData, articleId) {
    try {
      // 这里可以实现图片的本地存储
      // 暂时返回图片数据URL
      const imageUrl = `data:image/png;base64,${imageData}`;

      return {
        success: true,
        data: { imageUrl },
        message: '图片上传成功'
      };
    } catch (error) {
      console.error('图片上传失败:', error);
      return {
        success: false,
        error: error.message,
        message: '图片上传失败'
      };
    }
  }

  /**
   * 启动自动保存
   */
  startAutoSave(articleId, updateData) {
    // 清除现有的自动保存定时器
    this.stopAutoSave();

    // 设置新的自动保存定时器（每30秒）
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.updateArticle(articleId, {
          ...updateData,
          updatedAt: new Date().toISOString()
        });
        this.lastSaveTime = new Date();
        console.log('自动保存完成:', articleId);
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, 30000); // 30秒

    console.log('自动保存已启动:', articleId);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('自动保存已停止');
    }
  }

  /**
   * 获取自动保存状态
   */
  getAutoSaveStatus() {
    return {
      isActive: !!this.autoSaveInterval,
      lastSaveTime: this.lastSaveTime
    };
  }

  /**
   * 批量操作
   */
  async batchOperation(operations) {
    try {
      const results = await this.articleModel.batch(operations);
      return {
        success: true,
        data: results,
        message: '批量操作完成'
      };
    } catch (error) {
      console.error('批量操作失败:', error);
      return {
        success: false,
        error: error.message,
        message: '批量操作失败'
      };
    }
  }

  /**
   * 清理旧文章
   */
  async cleanupOldArticles(olderThanDays = 30) {
    try {
      const deletedCount = await this.articleModel.cleanup(olderThanDays);
      return {
        success: true,
        data: { deletedCount },
        message: `清理了${deletedCount}篇旧文章`
      };
    } catch (error) {
      console.error('清理旧文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '清理旧文章失败'
      };
    }
  }

  /**
   * 导出文章
   */
  async exportArticle(id, format = 'json') {
    try {
      const result = await this.getArticle(id);
      if (!result.success) {
        return result;
      }

      const article = result.data;
      let exportData;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(article, null, 2);
          break;
        case 'markdown':
          exportData = this.convertToMarkdown(article);
          break;
        case 'html':
          exportData = article.html_content || article.content;
          break;
        default:
          return {
            success: false,
            error: 'unsupported_format',
            message: '不支持的导出格式'
          };
      }

      return {
        success: true,
        data: exportData,
        filename: `${article.title}_${article.id}.${format}`
      };
    } catch (error) {
      console.error('导出文章失败:', error);
      return {
        success: false,
        error: error.message,
        message: '导出文章失败'
      };
    }
  }

  /**
   * 转换为Markdown格式
   */
  convertToMarkdown(article) {
    const { title, content, tags, category } = article;

    let markdown = `# ${title}\n\n`;

    if (category) {
      markdown += `**分类**: ${category}\n\n`;
    }

    if (tags && tags.length > 0) {
      markdown += `**标签**: ${tags.join(', ')}\n\n`;
    }

    markdown += `**字数**: ${article.word_count || 0}\n\n`;
    markdown += `**阅读时间**: ${article.reading_time || 0}分钟\n\n`;
    markdown += `---\n\n`;

    // 简单的HTML到Markdown转换
    let contentMarkdown = content || '';
    contentMarkdown = contentMarkdown
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '');

    markdown += contentMarkdown.trim();

    return markdown;
  }
}

module.exports = ArticleService;