/**
 * 错误处理和重试逻辑服务
 * 实现T020：错误处理和重试逻辑
 * 复用PublishService和BrowserManager等现有服务
 */

const PublishService = require('./PublishService');
const BrowserManager = require('../automation/BrowserManager');
const fs = require('fs').promises;
const path = require('path');

class ErrorHandlingService {
  constructor() {
    this.publishService = new PublishService();
    this.browserManager = new BrowserManager();
    this.initialized = false;

    // 错误分类定义
    this.errorCategories = {
      NETWORK: 'network_error',
      LOGIN: 'login_error',
      CONTENT: 'content_error',
      PLATFORM: 'platform_error',
      BROWSER: 'browser_error',
      SYSTEM: 'system_error',
      UNKNOWN: 'unknown_error'
    };

    // 重试策略配置
    this.retryStrategies = {
      network_error: { maxRetries: 3, delay: 2000, backoff: 1.5 },
      login_error: { maxRetries: 2, delay: 5000, backoff: 2.0 },
      content_error: { maxRetries: 1, delay: 1000, backoff: 1.0 },
      platform_error: { maxRetries: 2, delay: 3000, backoff: 1.5 },
      browser_error: { maxRetries: 2, delay: 1000, backoff: 1.2 },
      system_error: { maxRetries: 1, delay: 5000, backoff: 2.0 },
      unknown_error: { maxRetries: 1, delay: 3000, backoff: 1.0 }
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: '错误处理服务已初始化' };
    }

    try {
      await this.publishService.initialize();
      await this.browserManager.initialize();
      this.initialized = true;
      return { success: true, message: '错误处理服务初始化完成' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 分类错误类型
   */
  categorizeError(error, context = {}) {
    const errorMessage = (error.message || '').toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();

    // 网络错误
    if (errorMessage.includes('network') || errorMessage.includes('timeout') ||
        errorMessage.includes('connection') || errorMessage.includes('etimedout') ||
        errorMessage.includes('enotfound') || errorMessage.includes('econnrefused')) {
      return this.errorCategories.NETWORK;
    }

    // 登录错误
    if (errorMessage.includes('login') || errorMessage.includes('auth') ||
        errorMessage.includes('unauthorized') || errorMessage.includes('forbidden') ||
        errorMessage.includes('session') || errorMessage.includes('cookie') ||
        errorMessage.includes('登录') || errorMessage.includes('认证')) {
      return this.errorCategories.LOGIN;
    }

    // 内容错误
    if (errorMessage.includes('content') || errorMessage.includes('title') ||
        errorMessage.includes('empty') || errorMessage.includes('invalid') ||
        errorMessage.includes('内容') || errorMessage.includes('标题')) {
      return this.errorCategories.CONTENT;
    }

    // 平台错误
    if (errorMessage.includes('platform') || errorMessage.includes('publish') ||
        errorMessage.includes('submit') || errorMessage.includes('captcha') ||
        errorMessage.includes('verify') || errorMessage.includes('平台') ||
        errorMessage.includes('发布') || errorMessage.includes('验证码')) {
      return this.errorCategories.PLATFORM;
    }

    // 浏览器错误
    if (errorMessage.includes('browser') || errorMessage.includes('page') ||
        errorMessage.includes('selector') || errorMessage.includes('element') ||
        errorMessage.includes('chromium') || errorMessage.includes('puppeteer') ||
        errorMessage.includes('浏览器') || errorMessage.includes('页面')) {
      return this.errorCategories.BROWSER;
    }

    // 系统错误
    if (errorMessage.includes('system') || errorMessage.includes('memory') ||
        errorMessage.includes('disk') || errorMessage.includes('permission') ||
        errorMessage.includes('系统') || errorMessage.includes('权限')) {
      return this.errorCategories.SYSTEM;
    }

    // 未知错误
    return this.errorCategories.UNKNOWN;
  }

  /**
   * 生成用户友好的错误消息
   */
  generateUserFriendlyMessage(error, category, context = {}) {
    const { platform, articleTitle } = context;

    switch (category) {
      case this.errorCategories.NETWORK:
        return {
          title: '网络连接错误',
          message: '网络连接不稳定，请检查网络连接后重试',
          action: '检查网络连接，稍后重试'
        };

      case this.errorCategories.LOGIN:
        return {
          title: '登录状态异常',
          message: `${platform || '平台'}登录状态已过期，需要重新登录`,
          action: '重新登录后再试'
        };

      case this.errorCategories.CONTENT:
        return {
          title: '内容格式错误',
          message: articleTitle ?
            `文章"${articleTitle}"的内容格式存在问题` :
            '文章内容格式存在问题，可能缺少标题或正文',
          action: '检查文章内容格式，确保标题和正文完整'
        };

      case this.errorCategories.PLATFORM:
        return {
          title: '平台发布错误',
          message: `${platform || '平台'}暂时无法访问或出现异常`,
          action: '稍后重试，或联系平台客服'
        };

      case this.errorCategories.BROWSER:
        return {
          title: '浏览器自动化错误',
          message: '浏览器自动化过程中出现问题，可能是页面结构变化',
          action: '重新尝试发布，或联系技术支持'
        };

      case this.errorCategories.SYSTEM:
        return {
          title: '系统错误',
          message: '系统资源不足或权限问题',
          action: '检查系统状态，重启应用后再试'
        };

      default:
        return {
          title: '未知错误',
          message: error.message || '发生了未知错误',
          action: '重试或联系技术支持'
        };
    }
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error, category, retryCount = 0) {
    const strategy = this.retryStrategies[category];
    if (!strategy || retryCount >= strategy.maxRetries) {
      return { shouldRetry: false, reason: 'max_retries_exceeded' };
    }

    // 特殊错误类型不应该重试
    const errorMessage = (error.message || '').toLowerCase();
    const noRetryErrors = [
      'permission denied',
      'access denied',
      'invalid credentials',
      'content not found',
      'article deleted',
      '权限不足',
      '内容不存在',
      '文章已删除'
    ];

    if (noRetryErrors.some(noRetryError => errorMessage.includes(noRetryError))) {
      return { shouldRetry: false, reason: 'non_retryable_error' };
    }

    return { shouldRetry: true, strategy };
  }

  /**
   * 计算重试延迟
   */
  calculateRetryDelay(category, retryCount) {
    const strategy = this.retryStrategies[category];
    if (!strategy) return 3000;

    // 指数退避算法
    const baseDelay = strategy.delay;
    const backoff = strategy.backoff;
    return Math.floor(baseDelay * Math.pow(backoff, retryCount));
  }

  /**
   * 执行重试逻辑
   */
  async executeRetry(taskId, retryFunction, context = {}) {
    try {
      // 获取任务信息
      const taskResult = await this.publishService.getTaskById(taskId);
      if (!taskResult.success) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      const task = taskResult.data;
      const category = this.categorizeError(new Error(task.error || ''), context);
      const retryCount = task.retryCount || 0;

      // 检查是否应该重试
      const { shouldRetry, strategy, reason } = this.shouldRetry(
        new Error(task.error || ''),
        category,
        retryCount
      );

      if (!shouldRetry) {
        const friendlyMessage = this.generateUserFriendlyMessage(
          new Error(task.error),
          category,
          context
        );

        return {
          success: false,
          reason,
          friendlyMessage,
          category,
          retryCount
        };
      }

      // 更新任务状态为重试中
      await this.publishService.updateTaskStatus(taskId, {
        status: 'pending',
        error: null,
        retryCount: retryCount + 1
      });

      // 计算延迟时间
      const delay = this.calculateRetryDelay(category, retryCount);
      await this.sleep(delay);

      // 记录重试日志
      await this.publishService.addTaskLog(taskId, 'info', `第${retryCount + 1}次重试开始...`);

      // 执行重试函数
      const retryResult = await retryFunction();

      // 重试成功
      await this.publishService.addTaskLog(taskId, 'info', `重试成功！`);

      return {
        success: true,
        retryCount: retryCount + 1,
        category,
        delay
      };

    } catch (error) {
      // 重试失败
      await this.publishService.addTaskLog(
        taskId,
        'error',
        `重试失败: ${error.message}`
      );

      return {
        success: false,
        error: error.message,
        category: this.categorizeError(error, context),
        retryCount: (context.retryCount || 0) + 1
      };
    }
  }

  /**
   * 创建备用方案
   */
  async createFallback(taskId, error, context = {}) {
    const category = this.categorizeError(error, context);

    try {
      await this.publishService.addTaskLog(
        taskId,
        'warn',
        `触发备用方案，错误类别: ${category}`
      );

      switch (category) {
        case this.errorCategories.NETWORK:
          return await this.handleNetworkFallback(taskId, context);

        case this.errorCategories.LOGIN:
          return await this.handleLoginFallback(taskId, context);

        case this.errorCategories.BROWSER:
          return await this.handleBrowserFallback(taskId, context);

        case this.errorCategories.PLATFORM:
          return await this.handlePlatformFallback(taskId, context);

        default:
          return await this.handleGenericFallback(taskId, context);
      }

    } catch (fallbackError) {
      await this.publishService.addTaskLog(
        taskId,
        'error',
        `备用方案失败: ${fallbackError.message}`
      );

      return {
        success: false,
        error: `备用方案失败: ${fallbackError.message}`,
        fallback: true
      };
    }
  }

  /**
   * 网络错误备用方案
   */
  async handleNetworkFallback(taskId, context) {
    // 清理浏览器缓存，重新创建浏览器实例
    await this.browserManager.cleanupAll();
    await this.sleep(2000);

    // 检查网络连接
    const isOnline = await this.checkNetworkConnection();
    if (!isOnline) {
      throw new Error('网络连接不可用');
    }

    return {
      success: true,
      action: 'network_reset',
      message: '已重置网络连接，可以重试'
    };
  }

  /**
   * 登录错误备用方案
   */
  async handleLoginFallback(taskId, context) {
    // 清理过期的登录会话
    const PlatformAutoLoginService = require('../automation/PlatformAutoLoginService');
    const autoLoginService = new PlatformAutoLoginService();

    // 停用过期会话
    if (context.platformId) {
      await autoLoginService.deactivateSession(context.platformId);
    }

    return {
      success: true,
      action: 'relogin_required',
      message: '需要重新登录',
      requiresUserAction: true
    };
  }

  /**
   * 浏览器错误备用方案
   */
  async handleBrowserFallback(taskId, context) {
    // 清理所有浏览器实例
    await this.browserManager.cleanupAll();
    await this.sleep(3000);

    // 重新创建浏览器实例
    const browserResult = await this.browserManager.createBrowser({
      headless: false,
      viewport: { width: 1920, height: 1080 },
      stealth: true
    });

    if (!browserResult.success) {
      throw new Error('无法创建新的浏览器实例');
    }

    return {
      success: true,
      action: 'browser_restart',
      message: '浏览器已重启'
    };
  }

  /**
   * 平台错误备用方案
   */
  async handlePlatformFallback(taskId, context) {
    // 记录详细的错误信息供调试
    const debugInfo = {
      timestamp: new Date().toISOString(),
      platform: context.platform,
      error: context.error?.message,
      url: context.currentUrl,
      userAgent: context.userAgent
    };

    // 保存调试信息到文件
    await this.saveDebugInfo(taskId, debugInfo);

    return {
      success: true,
      action: 'debug_info_saved',
      message: '已保存调试信息，请联系技术支持',
      debugInfo: debugInfo
    };
  }

  /**
   * 通用备用方案
   */
  async handleGenericFallback(taskId, context) {
    // 保存错误报告
    const errorReport = {
      taskId,
      timestamp: new Date().toISOString(),
      error: context.error?.message,
      stack: context.error?.stack,
      context: {
        platform: context.platform,
        articleId: context.articleId,
        retryCount: context.retryCount
      }
    };

    await this.saveErrorReport(taskId, errorReport);

    return {
      success: true,
      action: 'error_report_saved',
      message: '已保存错误报告'
    };
  }

  /**
   * 检查网络连接
   */
  async checkNetworkConnection() {
    try {
      // 简单的网络检查
      const { default: fetch } = require('node-fetch');
      const response = await fetch('https://www.baidu.com', {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 保存调试信息
   */
  async saveDebugInfo(taskId, debugInfo) {
    try {
      const debugDir = path.join(process.cwd(), 'debug');
      await fs.mkdir(debugDir, { recursive: true });

      const debugFile = path.join(debugDir, `debug_${taskId}_${Date.now()}.json`);
      await fs.writeFile(debugFile, JSON.stringify(debugInfo, null, 2));

      return debugFile;
    } catch (error) {
      console.error('保存调试信息失败:', error);
      return null;
    }
  }

  /**
   * 保存错误报告
   */
  async saveErrorReport(taskId, errorReport) {
    try {
      const reportsDir = path.join(process.cwd(), 'error_reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const reportFile = path.join(reportsDir, `error_${taskId}_${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(errorReport, null, 2));

      return reportFile;
    } catch (error) {
      console.error('保存错误报告失败:', error);
      return null;
    }
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取错误统计
   */
  async getErrorStats(timeRange = 24) {
    try {
      const stats = await this.publishService.getTaskStats();
      const tasks = await this.publishService.getTaskHistory({ limit: 100 });

      const errorStats = {
        total: 0,
        byCategory: {},
        byPlatform: {},
        recent: []
      };

      const timeThreshold = Date.now() - (timeRange * 60 * 60 * 1000);

      for (const task of tasks) {
        if (task.status === 'failed' && new Date(task.createdAt).getTime() > timeThreshold) {
          errorStats.total++;

          // 按类别统计
          const category = this.categorizeError(new Error(task.error || ''));
          errorStats.byCategory[category] = (errorStats.byCategory[category] || 0) + 1;

          // 按平台统计
          const platform = task.platformId || 'unknown';
          errorStats.byPlatform[platform] = (errorStats.byPlatform[platform] || 0) + 1;

          // 最近错误
          if (errorStats.recent.length < 10) {
            errorStats.recent.push({
              taskId: task.id,
              platform,
              error: task.error,
              timestamp: task.createdAt
            });
          }
        }
      }

      return { success: true, data: errorStats };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ErrorHandlingService;