/**
 * T020 ErrorHandlingService服务测试
 * 错误处理和重试逻辑服务的测试驱动开发
 */

// 模拟依赖服务
const mockPublishService = {
  initialize: jest.fn().mockResolvedValue({ success: true }),
  updateTaskStatus: jest.fn(),
  addTaskLog: jest.fn(),
  getTaskById: jest.fn(),
  getTaskStats: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getTaskHistory: jest.fn().mockResolvedValue({ success: true, data: [] })
};

const mockBrowserManager = {
  initialize: jest.fn().mockResolvedValue({ success: true }),
  cleanupAll: jest.fn(),
  createBrowser: jest.fn().mockResolvedValue({ success: true, data: {} }),
  takeScreenshot: jest.fn(),
  getPageContent: jest.fn()
};

// 模拟模块
jest.mock('../../../../src/main/services/PublishService.js', () => {
  return jest.fn().mockImplementation(() => mockPublishService);
});

jest.mock('../../../../src/main/automation/BrowserManager.js', () => {
  return jest.fn().mockImplementation(() => mockBrowserManager);
});

// 模拟node-fetch
jest.mock('node-fetch', () => {
  return jest.fn().mockResolvedValue({ ok: true });
});

// 模拟fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

const ErrorHandlingService = require('../../../../src/main/services/ErrorHandlingService.js');

describe('T020 ErrorHandlingService服务', () => {
  let errorHandlingService;

  beforeEach(() => {
    jest.clearAllMocks();
    errorHandlingService = new ErrorHandlingService();
  });

  describe('错误分类测试', () => {
    test('应该正确分类网络错误', () => {
      const networkErrors = [
        new Error('Network timeout'),
        new Error('ECONNREFUSED'),
        new Error('fetch failed'),
        { message: 'socket hang up' },
        { message: 'request timeout' },
        new Error('connection refused'),
        new Error('ETIMEDOUT')
      ];

      networkErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('network_error');
      });
    });

    test('应该正确分类登录错误', () => {
      const loginErrors = [
        new Error('Authentication failed'),
        new Error('Login required'),
        new Error('Token expired'),
        { message: 'unauthorized' },
        { message: 'session timeout' },
        new Error('登录失败'),
        new Error('认证过期')
      ];

      loginErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('login_error');
      });
    });

    test('应该正确分类内容错误', () => {
      const contentErrors = [
        new Error('Content too long'),
        new Error('Invalid format'),
        new Error('Missing required fields'),
        { message: 'content validation failed' },
        { message: 'title too short' },
        new Error('内容为空'),
        new Error('标题格式错误')
      ];

      contentErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('content_error');
      });
    });

    test('应该正确分类平台错误', () => {
      const platformErrors = [
        new Error('Platform maintenance'),
        new Error('Service unavailable'),
        new Error('API rate limit exceeded'),
        { message: 'platform error' },
        { message: 'service temporarily unavailable' },
        new Error('发布失败'),
        new Error('验证码错误')
      ];

      platformErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('platform_error');
      });
    });

    test('应该正确分类浏览器错误', () => {
      const browserErrors = [
        new Error('Browser crashed'),
        new Error('Page not found'),
        new Error('JavaScript error'),
        { message: 'page crashed' },
        { message: 'selector not found' },
        new Error('浏览器崩溃'),
        new Error('页面加载失败')
      ];

      browserErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('browser_error');
      });
    });

    test('应该正确分类系统错误', () => {
      const systemErrors = [
        new Error('Out of memory'),
        new Error('Disk full'),
        new Error('Permission denied'),
        { message: 'system error' },
        { message: 'resource exhausted' },
        new Error('系统资源不足'),
        new Error('权限不足')
      ];

      systemErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('system_error');
      });
    });

    test('应该将未知错误分类为UNKNOWN', () => {
      const unknownErrors = [
        new Error('Random error'),
        { message: 'something went wrong' },
        { error: 'mysterious issue' },
        new Error('Unknown issue')
      ];

      unknownErrors.forEach(error => {
        const category = errorHandlingService.categorizeError(error);
        expect(category).toBe('unknown_error');
      });
    });
  });

  describe('用户友好错误消息测试', () => {
    test('应该生成网络错误的用户友好消息', () => {
      const error = new Error('Network timeout');
      const category = 'network_error';
      const context = { platform: '知乎' };

      const message = errorHandlingService.generateUserFriendlyMessage(error, category, context);

      expect(message.title).toBe('网络连接错误');
      expect(message.message).toBe('网络连接不稳定，请检查网络连接后重试');
      expect(message.action).toBe('检查网络连接，稍后重试');
    });

    test('应该生成登录错误的用户友好消息', () => {
      const error = new Error('Authentication failed');
      const category = 'login_error';
      const context = { platform: '知乎', articleTitle: '测试文章' };

      const message = errorHandlingService.generateUserFriendlyMessage(error, category, context);

      expect(message.title).toBe('登录状态异常');
      expect(message.message).toBe('知乎登录状态已过期，需要重新登录');
      expect(message.action).toBe('重新登录后再试');
    });

    test('应该生成内容错误的用户友好消息', () => {
      const error = new Error('Content too long');
      const category = 'content_error';
      const context = { articleTitle: '我的测试文章' };

      const message = errorHandlingService.generateUserFriendlyMessage(error, category, context);

      expect(message.title).toBe('内容格式错误');
      expect(message.message).toBe('文章"我的测试文章"的内容格式存在问题');
      expect(message.action).toBe('检查文章内容格式，确保标题和正文完整');
    });
  });

  describe('重试策略测试', () => {
    test('应该为不同错误类型设置正确的重试次数', () => {
      // 网络错误：最多3次重试
      const networkShouldRetry = errorHandlingService.shouldRetry(
        new Error('Network timeout'),
        'network_error',
        2
      );
      expect(networkShouldRetry.shouldRetry).toBe(true);

      const networkShouldNotRetry = errorHandlingService.shouldRetry(
        new Error('Network timeout'),
        'network_error',
        3
      );
      expect(networkShouldNotRetry.shouldRetry).toBe(false);

      // 登录错误：最多2次重试
      const loginShouldNotRetry = errorHandlingService.shouldRetry(
        new Error('Login failed'),
        'login_error',
        2
      );
      expect(loginShouldNotRetry.shouldRetry).toBe(false);

      // 内容错误：最多1次重试
      const contentShouldNotRetry = errorHandlingService.shouldRetry(
        new Error('Content error'),
        'content_error',
        1
      );
      expect(contentShouldNotRetry.shouldRetry).toBe(false);
    });

    test('应该实现指数退避算法', () => {
      // 网络错误重试延迟计算
      const delay1 = errorHandlingService.calculateRetryDelay('network_error', 0);
      const delay2 = errorHandlingService.calculateRetryDelay('network_error', 1);
      const delay3 = errorHandlingService.calculateRetryDelay('network_error', 2);

      // 验证指数增长 (2000, 3000, 4500)
      expect(delay1).toBe(2000);
      expect(delay2).toBe(3000); // 2000 * 1.5
      expect(delay3).toBe(4500); // 3000 * 1.5
    });

    test('应该识别不可重试的错误', () => {
      const nonRetryableErrors = [
        new Error('Permission denied'),
        new Error('Access denied'),
        new Error('Invalid credentials'),
        new Error('权限不足'),
        new Error('内容不存在')
      ];

      nonRetryableErrors.forEach(error => {
        const result = errorHandlingService.shouldRetry(error, 'network_error', 0);
        expect(result.shouldRetry).toBe(false);
        expect(result.reason).toBe('non_retryable_error');
      });
    });
  });

  describe('服务初始化测试', () => {
    test('应该成功初始化服务', async () => {
      const result = await errorHandlingService.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toBe('错误处理服务初始化完成');
      expect(mockPublishService.initialize).toHaveBeenCalled();
      expect(mockBrowserManager.initialize).toHaveBeenCalled();
      expect(errorHandlingService.initialized).toBe(true);
    });

    test('应该避免重复初始化', async () => {
      await errorHandlingService.initialize();
      const result = await errorHandlingService.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toBe('错误处理服务已初始化');
      expect(mockPublishService.initialize).toHaveBeenCalledTimes(1);
    });

    test('应该处理初始化失败', async () => {
      mockPublishService.initialize.mockRejectedValue(new Error('初始化失败'));

      const result = await errorHandlingService.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('初始化失败');
    });
  });

  describe('重试执行测试', () => {
    test('应该成功执行重试逻辑', async () => {
      const taskId = 1;
      const retryFunction = jest.fn().mockResolvedValue({ success: true });

      mockPublishService.getTaskById.mockResolvedValue({
        success: true,
        data: {
          id: taskId,
          retryCount: 0,
          error: 'Network timeout'
        }
      });

      const result = await errorHandlingService.executeRetry(taskId, retryFunction);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(retryFunction).toHaveBeenCalled();
      expect(mockPublishService.addTaskLog).toHaveBeenCalledWith(
        taskId,
        'info',
        '第1次重试开始...'
      );
    });

    test('应该处理重试失败', async () => {
      const taskId = 1;
      const retryFunction = jest.fn().mockRejectedValue(new Error('重试仍然失败'));

      mockPublishService.getTaskById.mockResolvedValue({
        success: true,
        data: {
          id: taskId,
          retryCount: 0,
          error: 'Network timeout'
        }
      });

      const result = await errorHandlingService.executeRetry(taskId, retryFunction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('重试仍然失败');
    });

    test('应该处理超过最大重试次数', async () => {
      const taskId = 1;
      const retryFunction = jest.fn();

      mockPublishService.getTaskById.mockResolvedValue({
        success: true,
        data: {
          id: taskId,
          retryCount: 3, // 已达到最大重试次数
          error: 'Network timeout'
        }
      });

      const result = await errorHandlingService.executeRetry(taskId, retryFunction);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('max_retries_exceeded');
      expect(retryFunction).not.toHaveBeenCalled();
    });
  });

  describe('备用方案测试', () => {
    test('应该执行网络错误备用方案', async () => {
      const taskId = 1;
      const error = new Error('Network timeout');
      const context = { platform: 'zhihu' };

      const result = await errorHandlingService.createFallback(taskId, error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('network_reset');
      expect(mockBrowserManager.cleanupAll).toHaveBeenCalled();
    });

    test('应该执行登录错误备用方案', async () => {
      const taskId = 1;
      const error = new Error('Authentication failed');
      const context = { platformId: 'zhihu' };

      const result = await errorHandlingService.createFallback(taskId, error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('relogin_required');
      expect(result.requiresUserAction).toBe(true);
    });

    test('应该执行浏览器错误备用方案', async () => {
      const taskId = 1;
      const error = new Error('Browser crashed');
      const context = { platform: 'zhihu' };

      const result = await errorHandlingService.createFallback(taskId, error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('browser_restart');
      expect(mockBrowserManager.cleanupAll).toHaveBeenCalled();
      expect(mockBrowserManager.createBrowser).toHaveBeenCalled();
    });
  });

  describe('网络连接检查测试', () => {
    test('应该检查网络连接', async () => {
      const result = await errorHandlingService.checkNetworkConnection();

      expect(result).toBe(true);
    });

    test('应该处理网络连接失败', async () => {
      const fetch = require('node-fetch');
      fetch.mockRejectedValue(new Error('Network unreachable'));

      const result = await errorHandlingService.checkNetworkConnection();

      expect(result).toBe(false);
    });
  });

  describe('错误统计测试', () => {
    test('应该获取错误统计信息', async () => {
      const mockTasks = [
        {
          id: 1,
          status: 'failed',
          error: 'Network timeout',
          platformId: 'zhihu',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          status: 'failed',
          error: 'Login failed',
          platformId: 'xiaohongshu',
          createdAt: new Date().toISOString()
        }
      ];

      mockPublishService.getTaskHistory.mockResolvedValue({
        success: true,
        data: mockTasks
      });

      const result = await errorHandlingService.getErrorStats(24);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(2);
      expect(result.data.byCategory['network_error']).toBe(1);
      expect(result.data.byCategory['login_error']).toBe(1);
      expect(result.data.byPlatform['zhihu']).toBe(1);
      expect(result.data.byPlatform['xiaohongshu']).toBe(1);
    });

    test('应该处理统计获取失败', async () => {
      mockPublishService.getTaskHistory.mockRejectedValue(new Error('获取历史失败'));

      const result = await errorHandlingService.getErrorStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('获取历史失败');
    });
  });

  describe('调试信息保存测试', () => {
    test('应该保存调试信息', async () => {
      const taskId = 1;
      const debugInfo = {
        timestamp: new Date().toISOString(),
        platform: 'zhihu',
        error: 'Test error'
      };

      const result = await errorHandlingService.saveDebugInfo(taskId, debugInfo);

      expect(result).toContain('debug_1_');
      const fs = require('fs');
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test('应该处理调试信息保存失败', async () => {
      const fs = require('fs');
      fs.promises.writeFile.mockRejectedValue(new Error('写入失败'));

      const taskId = 1;
      const debugInfo = { error: 'Test error' };

      const result = await errorHandlingService.saveDebugInfo(taskId, debugInfo);

      expect(result).toBeNull();
    });
  });

  describe('睡眠函数测试', () => {
    test('应该正确执行睡眠', async () => {
      const startTime = Date.now();
      await errorHandlingService.sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // 允许一些误差
    });
  });

  describe('集成测试', () => {
    test('应该完整处理网络错误流程', async () => {
      const taskId = 1;
      const error = new Error('Network timeout');
      const context = { platform: 'zhihu', articleId: 1 };

      // 1. 分类错误
      const category = errorHandlingService.categorizeError(error);
      expect(category).toBe('network_error');

      // 2. 生成用户友好消息
      const userMessage = errorHandlingService.generateUserFriendlyMessage(error, category, context);
      expect(userMessage.title).toBe('网络连接错误');

      // 3. 检查重试策略
      const retryDecision = errorHandlingService.shouldRetry(error, category, 0);
      expect(retryDecision.shouldRetry).toBe(true);

      // 4. 计算重试延迟
      const delay = errorHandlingService.calculateRetryDelay(category, 0);
      expect(delay).toBe(2000);

      // 5. 执行备用方案
      const fallbackResult = await errorHandlingService.createFallback(taskId, error, context);
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.action).toBe('network_reset');
    });

    test('应该完整处理登录错误流程', async () => {
      const taskId = 1;
      const error = new Error('Authentication failed');
      const context = { platform: 'zhihu' };

      // 1. 分类错误
      const category = errorHandlingService.categorizeError(error);
      expect(category).toBe('login_error');

      // 2. 生成用户友好消息
      const userMessage = errorHandlingService.generateUserFriendlyMessage(error, category, context);
      expect(userMessage.title).toBe('登录状态异常');

      // 3. 执行备用方案
      const fallbackResult = await errorHandlingService.createFallback(taskId, error, context);
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.action).toBe('relogin_required');
      expect(fallbackResult.requiresUserAction).toBe(true);
    });
  });

  describe('边界情况测试', () => {
    test('应该处理空错误对象', () => {
      const result = errorHandlingService.categorizeError(null);
      expect(result).toBe('unknown_error');
    });

    test('应该处理未知错误类型', () => {
      const result = errorHandlingService.calculateRetryDelay('unknown_category', 0);
      expect(result).toBe(3000); // 默认延迟
    });

    test('应该处理缺少上下文的错误消息生成', () => {
      const error = new Error('Test error');
      const result = errorHandlingService.generateUserFriendlyMessage(error, 'unknown_error', {});

      expect(result.title).toBe('未知错误');
      expect(result.message).toBe('Test error');
    });
  });
});