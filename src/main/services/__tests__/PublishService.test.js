/**
 * PublishService TDD测试套件
 * 测试发布任务管理服务的所有核心功能
 */

const PublishService = require('../PublishService');
const { DatabaseService } = require('../../database/DatabaseService');

describe('PublishService', () => {
  let publishService;
  let dbService;

  beforeAll(async () => {
    // 初始化数据库服务
    dbService = new DatabaseService();
    await dbService.initialize();
  });

  afterAll(async () => {
    // 清理
    if (publishService) {
      await publishService.shutdown();
    }
    if (dbService) {
      await dbService.close();
    }
  });

  beforeEach(async () => {
    // 创建新的服务实例
    publishService = new PublishService();
    await publishService.initialize();
  });

  afterEach(async () => {
    // 清理测试数据
    if (publishService) {
      await publishService.shutdown();
    }

    // 清理数据库中的测试数据
    await dbService.db.exec('DELETE FROM publish_logs');
    await dbService.db.exec('DELETE FROM publish_tasks');
  });

  describe('服务初始化', () => {
    test('应该成功初始化服务', async () => {
      expect(publishService.isInitialized).toBe(true);
      expect(publishService.activeTasks).toBeInstanceOf(Map);
      expect(publishService.taskEventHandlers).toBeInstanceOf(Map);
    });

    test('应该加载活跃任务到缓存', async () => {
      // 创建一个待处理的任务
      const result = await dbService.publishTasks.create({
        article_id: 1,
        platform_id: 1,
        status: 0
      });

      // 重新初始化服务
      await publishService.shutdown();
      await publishService.initialize();

      // 验证任务被加载到缓存
      expect(publishService.activeTasks.has(result.data.id)).toBe(true);
    });
  });

  describe('创建发布任务', () => {
    test('应该成功创建发布任务', async () => {
      const taskData = {
        articleId: 1,
        platformId: 1,
        sessionId: 1,
        maxRetries: 3
      };

      const result = await publishService.createPublishTask(taskData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.article_id).toBe(1);
      expect(result.data.platform_id).toBe(1);
      expect(result.data.status).toBe(0); // pending
      expect(result.data.progress).toBe(0);
      expect(result.data.retry_count).toBe(0);
      expect(result.data.max_retries).toBe(3);

      // 验证任务被添加到缓存
      expect(publishService.activeTasks.has(result.data.id)).toBe(true);
    });

    test('应该拒绝无效的必需参数', async () => {
      const result = await publishService.createPublishTask({
        articleId: null,
        platformId: 1
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('文章ID和平台ID不能为空');
    });

    test('应该检查文章是否存在', async () => {
      const result = await publishService.createPublishTask({
        articleId: 99999, // 不存在的文章
        platformId: 1
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('文章不存在');
    });

    test('应该检查平台是否存在', async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 99999 // 不存在的平台
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('平台不存在');
    });

    test('应该防止重复的活跃任务', async () => {
      const taskData = {
        articleId: 1,
        platformId: 1
      };

      // 创建第一个任务
      const result1 = await publishService.createPublishTask(taskData);
      expect(result1.success).toBe(true);

      // 尝试创建重复任务
      const result2 = await publishService.createPublishTask(taskData);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('已有进行中的发布任务');
    });
  });

  describe('开始发布任务', () => {
    let taskId;

    beforeEach(async () => {
      // 创建一个待处理的任务
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
    });

    test('应该成功开始发布任务', async () => {
      const result = await publishService.startPublishTask(taskId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(1); // in_progress
      expect(result.data.progress).toBe(0);
      expect(result.data.started_at).toBeDefined();
    });

    test('应该拒绝开始不存在的任务', async () => {
      const result = await publishService.startPublishTask(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('任务不存在或未加载');
    });

    test('应该拒绝开始非待处理状态的任务', async () => {
      // 先开始任务
      await publishService.startPublishTask(taskId);

      // 再次尝试开始
      const result = await publishService.startPublishTask(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('状态不正确');
    });

    test('应该记录开始执行日志', async () => {
      await publishService.startPublishTask(taskId);

      const logs = await publishService.getTaskLogs(taskId);
      expect(logs.success).toBe(true);
      expect(logs.data.some(log => log.message.includes('开始执行发布任务'))).toBe(true);
    });
  });

  describe('更新任务进度', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
      await publishService.startPublishTask(taskId);
    });

    test('应该成功更新任务进度', async () => {
      const result = await publishService.updateTaskProgress(taskId, 50, '正在处理内容');

      expect(result.success).toBe(true);
      expect(result.data.progress).toBe(50);
      expect(result.data.message).toBe('正在处理内容');
    });

    test('应该验证进度值范围', async () => {
      // 测试超出范围的值
      const result1 = await publishService.updateTaskProgress(taskId, 150);
      expect(result1.data.progress).toBe(100);

      const result2 = await publishService.updateTaskProgress(taskId, -10);
      expect(result2.data.progress).toBe(0);
    });

    test('应该处理不存在的任务', async () => {
      const result = await publishService.updateTaskProgress(99999, 50);

      expect(result.success).toBe(false);
      expect(result.error).toContain('任务不存在');
    });

    test('应该记录进度日志', async () => {
      await publishService.updateTaskProgress(taskId, 25, '步骤1完成');

      const logs = await publishService.getTaskLogs(taskId);
      expect(logs.success).toBe(true);
      expect(logs.data.some(log => log.message.includes('步骤1完成'))).toBe(true);
    });
  });

  describe('完成任务', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
      await publishService.startPublishTask(taskId);
    });

    test('应该成功完成任务', async () => {
      const resultData = {
        publishedUrl: 'https://example.com/article/123',
        platformArticleId: 'art_123',
        message: '发布成功'
      };

      const result = await publishService.completePublishTask(taskId, resultData);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(2); // success
      expect(result.data.progress).toBe(100);
      expect(result.data.published_url).toBe('https://example.com/article/123');
      expect(result.data.platform_article_id).toBe('art_123');
      expect(result.data.completed_at).toBeDefined();

      // 验证任务从缓存中移除
      expect(publishService.activeTasks.has(taskId)).toBe(false);
    });

    test('应该记录完成日志', async () => {
      await publishService.completePublishTask(taskId, {
        message: '测试发布完成'
      });

      const logs = await publishService.getTaskLogs(taskId);
      expect(logs.success).toBe(true);
      expect(logs.data.some(log => log.message.includes('测试发布完成'))).toBe(true);
    });

    test('应该处理不存在的任务', async () => {
      const result = await publishService.completePublishTask(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('任务不存在');
    });
  });

  describe('失败任务处理', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1,
        maxRetries: 2
      });
      taskId = result.data.id;
      await publishService.startPublishTask(taskId);
    });

    test('应该可以重试失败的任务', async () => {
      const errorInfo = {
        error: '网络错误',
        canRetry: true
      };

      const result = await publishService.failPublishTask(taskId, errorInfo);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(0); // pending
      expect(result.data.retryCount).toBe(1);
      expect(result.data.canRetry).toBe(true);

      // 任务应该仍在缓存中
      expect(publishService.activeTasks.has(taskId)).toBe(true);
    });

    test('应该标记无法重试的任务为失败', async () => {
      // 先用完所有重试次数
      await publishService.failPublishTask(taskId, { error: '错误1', canRetry: true });
      await publishService.failPublishTask(taskId, { error: '错误2', canRetry: true });

      // 第三次失败，无法重试
      const result = await publishService.failPublishTask(taskId, {
        error: '最终失败',
        canRetry: false
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(3); // failed
      expect(result.data.retryCount).toBe(2);
      expect(result.data.canRetry).toBe(false);

      // 任务应该从缓存中移除
      expect(publishService.activeTasks.has(taskId)).toBe(false);
    });

    test('应该记录失败日志', async () => {
      await publishService.failPublishTask(taskId, {
        error: '测试错误',
        canRetry: false
      });

      const logs = await publishService.getTaskLogs(taskId);
      expect(logs.success).toBe(true);
      expect(logs.data.some(log => log.message.includes('测试错误'))).toBe(true);
    });
  });

  describe('取消任务', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
      await publishService.startPublishTask(taskId);
    });

    test('应该成功取消任务', async () => {
      const result = await publishService.cancelPublishTask(taskId, '用户主动取消');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(3); // failed
      expect(result.data.error_message).toContain('用户主动取消');

      // 任务应该从缓存中移除
      expect(publishService.activeTasks.has(taskId)).toBe(false);
    });

    test('应该记录取消日志', async () => {
      await publishService.cancelPublishTask(taskId, '测试取消');

      const logs = await publishService.getTaskLogs(taskId);
      expect(logs.success).toBe(true);
      expect(logs.data.some(log => log.message.includes('测试取消'))).toBe(true);
    });
  });

  describe('任务状态查询', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
    });

    test('应该获取任务状态', async () => {
      const result = await publishService.getTaskStatus(taskId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id', taskId);
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('logs');
      expect(Array.isArray(result.data.logs)).toBe(true);
    });

    test('应该处理不存在的任务', async () => {
      const result = await publishService.getTaskStatus(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('任务不存在');
    });
  });

  describe('活跃任务管理', () => {
    test('应该获取活跃任务列表', async () => {
      // 创建多个任务
      await publishService.createPublishTask({ articleId: 1, platformId: 1 });
      await publishService.createPublishTask({ articleId: 2, platformId: 1 });

      const result = await publishService.getActiveTasks();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
    });

    test('应该按文章ID过滤活跃任务', async () => {
      await publishService.createPublishTask({ articleId: 1, platformId: 1 });
      await publishService.createPublishTask({ articleId: 2, platformId: 1 });

      const result = await publishService.getActiveTasks(1); // 只查找文章1的任务

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].article_id).toBe(1);
    });

    test('应该按平台ID过滤活跃任务', async () => {
      await publishService.createPublishTask({ articleId: 1, platformId: 1 });
      await publishService.createPublishTask({ articleId: 2, platformId: 2 });

      const result = await publishService.getActiveTasks(null, 1); // 只查找平台1的任务

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].platform_id).toBe(1);
    });
  });

  describe('任务历史查询', () => {
    test('应该获取任务历史', async () => {
      // 创建并完成任务
      const createResult = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      await publishService.startPublishTask(createResult.data.id);
      await publishService.completePublishTask(createResult.data.id);

      const result = await publishService.getTaskHistory();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('article');
      expect(result.data[0]).toHaveProperty('platform');
    });

    test('应该支持过滤条件', async () => {
      const createResult = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      await publishService.startPublishTask(createResult.data.id);
      await publishService.completePublishTask(createResult.data.id);

      const result = await publishService.getTaskHistory({
        platformId: 1,
        status: 2 // success
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].platform.id).toBe(1);
      expect(result.data[0].status).toBe(2);
    });
  });

  describe('日志管理', () => {
    let taskId;

    beforeEach(async () => {
      const result = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });
      taskId = result.data.id;
    });

    test('应该添加任务日志', async () => {
      const result = await publishService.addTaskLog(
        taskId,
        'info',
        '测试日志消息',
        { detail: '测试详情' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.level).toBe('info');
      expect(result.data.message).toBe('测试日志消息');
    });

    test('应该获取任务日志', async () => {
      await publishService.addTaskLog(taskId, 'info', '消息1');
      await publishService.addTaskLog(taskId, 'warn', '消息2');

      const result = await publishService.getTaskLogs(taskId);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0].message).toBe('消息2'); // 按时间倒序
      expect(result.data[1].message).toBe('消息1');
    });

    test('应该限制日志数量', async () => {
      // 添加多条日志
      for (let i = 0; i < 15; i++) {
        await publishService.addTaskLog(taskId, 'info', `消息${i}`);
      }

      const result = await publishService.getTaskLogs(taskId, 10);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(10);
    });
  });

  describe('统计信息', () => {
    test('应该获取服务统计信息', async () => {
      // 创建一些测试数据
      const task1 = await publishService.createPublishTask({ articleId: 1, platformId: 1 });
      const task2 = await publishService.createPublishTask({ articleId: 2, platformId: 2 });

      await publishService.startPublishTask(task1.data.id);
      await publishService.startPublishTask(task2.data.id);
      await publishService.completePublishTask(task1.data.id);

      const result = await publishService.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalTasks');
      expect(result.data).toHaveProperty('activeTasks');
      expect(result.data).toHaveProperty('statusDistribution');
      expect(result.data).toHaveProperty('platformDistribution');
      expect(result.data).toHaveProperty('recentActivity');
      expect(typeof result.data.totalTasks).toBe('number');
      expect(typeof result.data.activeTasks).toBe('number');
    });
  });

  describe('任务事件处理', () => {
    test('应该注册和触发任务事件', async () => {
      const mockHandler = jest.fn();

      const createResult = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });

      publishService.onTaskEvent(createResult.data.id, mockHandler);

      await publishService.startPublishTask(createResult.data.id);

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockHandler).toHaveBeenCalledWith('started', expect.any(Object));
    });

    test('应该移除任务事件处理器', async () => {
      const mockHandler = jest.fn();

      const createResult = await publishService.createPublishTask({
        articleId: 1,
        platformId: 1
      });

      publishService.onTaskEvent(createResult.data.id, mockHandler);
      publishService.offTaskEvent(createResult.data.id, mockHandler);

      await publishService.startPublishTask(createResult.data.id);

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('数据清理', () => {
    test('应该清理异常任务', async () => {
      // 手动创建一个超时的进行中任务
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1小时前
      await dbService.db.exec(`
        INSERT INTO publish_tasks (article_id, platform_id, status, started_at, created_at)
        VALUES (1, 1, 1, ?, ?)
      `, [oldTime, oldTime]);

      await publishService.initialize();

      // 验证超时任务被标记为失败
      const result = await dbService.publishTasks.getById(1);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(3); // failed
      expect(result.data.error_message).toContain('任务执行超时');
    });
  });

  describe('数据安全', () => {
    test('应该清理任务敏感信息', async () => {
      const taskWithSensitiveData = {
        id: 1,
        article_id: 1,
        platform_id: 1,
        session_data: 'sensitive_cookie_data',
        created_at: '2023-01-01T00:00:00.000Z'
      };

      const sanitized = publishService.sanitizeTask(taskWithSensitiveData);

      expect(sanitized).not.toHaveProperty('session_data');
      expect(sanitized).toHaveProperty('article_id', 1);
      expect(sanitized).toHaveProperty('created_at');
    });
  });
});