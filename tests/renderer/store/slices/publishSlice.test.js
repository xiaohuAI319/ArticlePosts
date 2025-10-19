/**
 * publishSlice 增强测试
 * 针对T018-T020功能的完整TDD测试覆盖
 */

import { configureStore } from '@reduxjs/toolkit';
import publishSlice, {
  setLoading,
  setError,
  clearError,
  setCurrentTask,
  clearCurrentTask,
  updateTaskProgress,
  addTaskResult,
  setTasks,
  addTask,
  updateTask,
  removeTask,
  addPublishHistory,
  clearHistory,
  updateStats,
  publishArticle,
  getActiveTasks,
  cancelTask,
  retryTask
} from '../../../../src/renderer/store/slices/publishSlice.js';

// 模拟electronAPI
const mockElectronAPI = {
  publish: {
    createTask: jest.fn(),
    getTaskById: jest.fn(),
    getTasks: jest.fn(),
    updateTask: jest.fn(),
    cancelTask: jest.fn(),
    retryTask: jest.fn(),
    getTaskLogs: jest.fn(),
    getPublishHistory: jest.fn(),
    getPublishStats: jest.fn()
  }
};

global.window = {
  electronAPI: mockElectronAPI
};

// 创建测试store
function createTestStore(initialState = {}) {
  return configureStore({
    reducer: {
      publish: publishSlice
    },
    preloadedState: {
      publish: {
        isPublishing: false,
        currentTask: null,
        tasks: [],
        history: [],
        stats: {
          total: 0,
          pending: 0,
          inProgress: 0,
          success: 0,
          failed: 0
        },
        error: null,
        ...initialState.publish
      }
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: {
          extraArgument: mockElectronAPI
        }
      })
  });
}

describe('publishSlice 增强测试', () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createTestStore();
  });

  describe('基础状态管理测试', () => {
    test('应该设置加载状态', () => {
      store.dispatch(setLoading(true));
      const state = store.getState().publish;
      expect(state.isPublishing).toBe(true);
    });

    test('应该设置错误信息', () => {
      const errorMessage = '发布失败';
      store.dispatch(setError(errorMessage));
      const state = store.getState().publish;
      expect(state.error).toBe(errorMessage);
    });

    test('应该清除错误信息', () => {
      store.dispatch(setError('测试错误'));
      store.dispatch(clearError());
      const state = store.getState().publish;
      expect(state.error).toBeNull();
    });

    test('应该设置当前任务', () => {
      const task = {
        id: 1,
        articleId: 1,
        status: 'pending'
      };
      store.dispatch(setCurrentTask(task));
      const state = store.getState().publish;
      expect(state.currentTask).toEqual(task);
    });

    test('应该清除当前任务', () => {
      store.dispatch(setCurrentTask({ id: 1 }));
      store.dispatch(clearCurrentTask());
      const state = store.getState().publish;
      expect(state.currentTask).toBeNull();
    });
  });

  describe('任务进度管理测试', () => {
    test('应该更新任务进度', () => {
      const task = {
        id: 1,
        progress: 0,
        currentStep: 0,
        stepMessage: '准备开始'
      };
      store.dispatch(setCurrentTask(task));

      const progressUpdate = {
        progress: 50,
        currentStep: 2,
        stepMessage: '正在填写内容'
      };
      store.dispatch(updateTaskProgress({ taskId: 1, ...progressUpdate }));

      const state = store.getState().publish;
      expect(state.currentTask.progress).toBe(50);
      expect(state.currentTask.currentStep).toBe(2);
      expect(state.currentTask.stepMessage).toBe('正在填写内容');
    });

    test('应该添加任务结果', () => {
      const task = {
        id: 1,
        results: []
      };
      store.dispatch(setCurrentTask(task));

      const result = {
        platform: 'zhihu',
        status: 'success',
        url: 'https://zhihu.com/article/123'
      };
      store.dispatch(addTaskResult({ taskId: 1, result }));

      const state = store.getState().publish;
      expect(state.currentTask.results).toHaveLength(1);
      expect(state.currentTask.results[0]).toEqual(result);
    });

    test('应该更新任务状态', () => {
      store.dispatch(setCurrentTask({
        id: 1,
        status: 'pending'
      }));

      store.dispatch(updateTask({
        id: 1,
        status: 'completed',
        endTime: new Date().toISOString()
      }));

      const state = store.getState().publish;
      expect(state.currentTask.status).toBe('completed');
      expect(state.currentTask.endTime).toBeDefined();
    });
  });

  describe('任务列表管理测试', () => {
    test('应该设置任务列表', () => {
      const tasks = [
        { id: 1, articleId: 1, status: 'pending' },
        { id: 2, articleId: 2, status: 'completed' }
      ];
      store.dispatch(setTasks(tasks));

      const state = store.getState().publish;
      expect(state.tasks).toEqual(tasks);
    });

    test('应该添加新任务', () => {
      const task = { id: 1, articleId: 1, status: 'pending' };
      store.dispatch(addTask(task));

      const state = store.getState().publish;
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toEqual(task);
    });

    test('应该更新现有任务', () => {
      const initialTask = { id: 1, articleId: 1, status: 'pending' };
      store.dispatch(addTask(initialTask));

      store.dispatch(updateTask({
        id: 1,
        status: 'in_progress',
        progress: 30
      }));

      const state = store.getState().publish;
      expect(state.tasks[0].status).toBe('in_progress');
      expect(state.tasks[0].progress).toBe(30);
    });

    test('应该删除任务', () => {
      const tasks = [
        { id: 1, articleId: 1, status: 'pending' },
        { id: 2, articleId: 2, status: 'completed' }
      ];
      store.dispatch(setTasks(tasks));

      store.dispatch(removeTask(1));

      const state = store.getState().publish;
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].id).toBe(2);
    });
  });

  describe('发布历史管理测试', () => {
    test('应该添加发布历史', () => {
      const historyItem = {
        id: 1,
        articleId: 1,
        articleTitle: '测试文章',
        platforms: ['zhihu'],
        status: 'completed',
        publishedAt: new Date().toISOString()
      };
      store.dispatch(addPublishHistory(historyItem));

      const state = store.getState().publish;
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toEqual(historyItem);
    });

    test('应该清除发布历史', () => {
      store.dispatch(addPublishHistory({ id: 1 }));
      store.dispatch(addPublishHistory({ id: 2 }));
      store.dispatch(clearHistory());

      const state = store.getState().publish;
      expect(state.history).toEqual([]);
    });

    test('应该按时间倒序排列历史记录', () => {
      const olderItem = {
        id: 1,
        publishedAt: new Date('2025-10-16T10:00:00Z').toISOString()
      };
      const newerItem = {
        id: 2,
        publishedAt: new Date('2025-10-16T12:00:00Z').toISOString()
      };

      store.dispatch(addPublishHistory(olderItem));
      store.dispatch(addPublishHistory(newerItem));

      const state = store.getState().publish;
      expect(state.history[0].id).toBe(2); // 更新的应该在前面
      expect(state.history[1].id).toBe(1);
    });
  });

  describe('统计信息管理测试', () => {
    test('应该更新统计信息', () => {
      const stats = {
        total: 10,
        pending: 2,
        inProgress: 1,
        success: 6,
        failed: 1
      };
      store.dispatch(updateStats(stats));

      const state = store.getState().publish;
      expect(state.stats).toEqual(stats);
    });

    test('应该根据任务列表自动计算统计信息', () => {
      const tasks = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'in_progress' },
        { id: 4, status: 'completed' },
        { id: 5, status: 'completed' },
        { id: 6, status: 'failed' }
      ];
      store.dispatch(setTasks(tasks));

      const state = store.getState().publish;
      expect(state.stats.total).toBe(6);
      expect(state.stats.pending).toBe(2);
      expect(state.stats.inProgress).toBe(1);
      expect(state.stats.success).toBe(2);
      expect(state.stats.failed).toBe(1);
    });
  });

  describe('异步操作测试 - publishArticle', () => {
    test('应该成功创建发布任务', async () => {
      const taskData = {
        id: 1,
        articleId: 1,
        platformIds: ['zhihu'],
        status: 'pending'
      };

      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: true,
        data: taskData
      });

      const result = await store.dispatch(publishArticle({
        articleId: 1,
        platformIds: ['zhihu'],
        config: { publishTime: 'immediate' }
      }));

      expect(result.payload).toEqual(taskData);
      expect(mockElectronAPI.publish.createTask).toHaveBeenCalledWith({
        articleId: 1,
        platformIds: ['zhihu'],
        config: { publishTime: 'immediate' }
      });
    });

    test('应该处理创建任务失败的情况', async () => {
      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: false,
        message: '创建失败'
      });

      const result = await store.dispatch(publishArticle({
        articleId: 1,
        platformIds: ['zhihu']
      }));

      expect(result.error.message).toBe('创建失败');
    });

    test('应该处理网络错误', async () => {
      mockElectronAPI.publish.createTask.mockRejectedValue(
        new Error('网络连接失败')
      );

      const result = await store.dispatch(publishArticle({
        articleId: 1,
        platformIds: ['zhihu']
      }));

      expect(result.error.message).toBe('网络连接失败');
    });

    test('应该在创建任务时设置加载状态', async () => {
      mockElectronAPI.publish.createTask.mockImplementation(() => {
        // 在异步过程中检查状态
        const state = store.getState().publish;
        expect(state.isPublishing).toBe(true);
        expect(state.error).toBeNull();

        return Promise.resolve({
          success: true,
          data: { id: 1, status: 'pending' }
        });
      });

      await store.dispatch(publishArticle({
        articleId: 1,
        platformIds: ['zhihu']
      }));

      // 完成后应该重置状态
      const finalState = store.getState().publish;
      expect(finalState.isPublishing).toBe(false);
    });
  });

  describe('异步操作测试 - getActiveTasks', () => {
    test('应该获取活跃任务列表', async () => {
      const tasks = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'in_progress' },
        { id: 3, status: 'completed' }
      ];

      mockElectronAPI.publish.getTasks.mockResolvedValue({
        success: true,
        data: tasks
      });

      const result = await store.dispatch(getActiveTasks());

      expect(result.payload).toEqual(tasks);
      expect(store.getState().publish.tasks).toEqual(tasks);
    });

    test('应该过滤只返回活跃任务', async () => {
      const allTasks = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'in_progress' },
        { id: 3, status: 'completed' },
        { id: 4, status: 'failed' }
      ];

      mockElectronAPI.publish.getTasks.mockResolvedValue({
        success: true,
        data: allTasks
      });

      await store.dispatch(getActiveTasks());

      const state = store.getState().publish;
      // 应该只存储活跃任务（pending + in_progress）
      expect(state.tasks).toHaveLength(2);
      expect(state.tasks.every(task =>
        task.status === 'pending' || task.status === 'in_progress'
      )).toBe(true);
    });
  });

  describe('异步操作测试 - cancelTask', () => {
    test('应该成功取消任务', async () => {
      const task = { id: 1, status: 'in_progress' };
      store.dispatch(addTask(task));

      mockElectronAPI.publish.cancelTask.mockResolvedValue({
        success: true
      });

      const result = await store.dispatch(cancelTask(1));

      expect(result.payload).toEqual({ taskId: 1, success: true });
      expect(mockElectronAPI.publish.cancelTask).toHaveBeenCalledWith(1);

      const state = store.getState().publish;
      expect(state.tasks[0].status).toBe('cancelled');
    });

    test('应该处理取消任务失败的情况', async () => {
      mockElectronAPI.publish.cancelTask.mockResolvedValue({
        success: false,
        message: '任务无法取消'
      });

      const result = await store.dispatch(cancelTask(1));

      expect(result.error.message).toBe('任务无法取消');
    });

    test('应该取消当前正在执行的任务', async () => {
      const currentTask = { id: 1, status: 'in_progress' };
      store.dispatch(setCurrentTask(currentTask));

      mockElectronAPI.publish.cancelTask.mockResolvedValue({
        success: true
      });

      await store.dispatch(cancelTask(1));

      const state = store.getState().publish;
      expect(state.currentTask.status).toBe('cancelled');
      expect(state.isPublishing).toBe(false);
    });
  });

  describe('异步操作测试 - retryTask', () => {
    test('应该成功重试任务', async () => {
      const task = {
        id: 1,
        status: 'failed',
        retryCount: 0,
        maxRetries: 3
      };
      store.dispatch(addTask(task));

      const updatedTask = {
        ...task,
        status: 'pending',
        retryCount: 1
      };

      mockElectronAPI.publish.retryTask.mockResolvedValue({
        success: true,
        data: updatedTask
      });

      const result = await store.dispatch(retryTask(1));

      expect(result.payload).toEqual(updatedTask);
      expect(mockElectronAPI.publish.retryTask).toHaveBeenCalledWith(1);

      const state = store.getState().publish;
      expect(state.tasks[0].status).toBe('pending');
      expect(state.tasks[0].retryCount).toBe(1);
    });

    test('应该检查重试次数限制', async () => {
      const task = {
        id: 1,
        status: 'failed',
        retryCount: 3,
        maxRetries: 3
      };
      store.dispatch(addTask(task));

      const result = await store.dispatch(retryTask(1));

      expect(result.error.message).toContain('已达到最大重试次数');
    });

    test('应该重置任务进度和状态', async () => {
      const failedTask = {
        id: 1,
        status: 'failed',
        progress: 80,
        currentStep: 4,
        error: '网络错误'
      };
      store.dispatch(addTask(failedTask));

      const retriedTask = {
        id: 1,
        status: 'pending',
        progress: 0,
        currentStep: 0,
        retryCount: 1,
        error: null
      };

      mockElectronAPI.publish.retryTask.mockResolvedValue({
        success: true,
        data: retriedTask
      });

      await store.dispatch(retryTask(1));

      const state = store.getState().publish;
      expect(state.tasks[0].progress).toBe(0);
      expect(state.tasks[0].currentStep).toBe(0);
      expect(state.tasks[0].error).toBeNull();
    });
  });

  describe('复杂场景测试', () => {
    test('应该处理并发的发布操作', async () => {
      const tasks = [
        { id: 1, articleId: 1, platformIds: ['zhihu'] },
        { id: 2, articleId: 2, platformIds: ['xiaohongshu'] }
      ];

      mockElectronAPI.publish.createTask
        .mockResolvedValueOnce({ success: true, data: tasks[0] })
        .mockResolvedValueOnce({ success: true, data: tasks[1] });

      // 并发执行两个发布操作
      const [result1, result2] = await Promise.all([
        store.dispatch(publishArticle(tasks[0])),
        store.dispatch(publishArticle(tasks[1]))
      ]);

      expect(result1.payload).toEqual(tasks[0]);
      expect(result2.payload).toEqual(tasks[1]);
      expect(store.getState().publish.tasks).toHaveLength(2);
    });

    test('应该处理任务状态变化时的统计更新', async () => {
      const tasks = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'in_progress' },
        { id: 3, status: 'failed' }
      ];
      store.dispatch(setTasks(tasks));

      // 更新任务状态
      store.dispatch(updateTask({ id: 1, status: 'in_progress' }));
      store.dispatch(updateTask({ id: 2, status: 'completed' }));
      store.dispatch(updateTask({ id: 3, status: 'completed' }));

      const state = store.getState().publish;
      expect(state.stats.pending).toBe(0);
      expect(state.stats.inProgress).toBe(1);
      expect(state.stats.success).toBe(2);
      expect(state.stats.failed).toBe(0);
    });

    test('应该处理任务完成时的历史记录添加', async () => {
      const task = {
        id: 1,
        articleId: 1,
        articleTitle: '测试文章',
        platformIds: ['zhihu'],
        status: 'in_progress'
      };
      store.dispatch(setCurrentTask(task));

      // 模拟任务完成
      const completedTask = {
        ...task,
        status: 'completed',
        results: [
          { platform: 'zhihu', status: 'success', url: 'https://zhihu.com/123' }
        ],
        endTime: new Date().toISOString()
      };

      store.dispatch(updateTask(completedTask));

      // 应该自动添加到历史记录
      const state = store.getState().publish;
      expect(state.history).toHaveLength(1);
      expect(state.history[0].articleTitle).toBe('测试文章');
      expect(state.history[0].status).toBe('completed');
    });
  });

  describe('性能测试', () => {
    test('应该高效处理大量任务', () => {
      const largeTaskList = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        articleId: index + 1,
        status: index % 3 === 0 ? 'completed' : 'pending'
      }));

      const startTime = performance.now();
      store.dispatch(setTasks(largeTaskList));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(store.getState().publish.tasks).toHaveLength(1000);
    });

    test('应该高效处理频繁的状态更新', () => {
      const task = { id: 1, status: 'pending', progress: 0 };
      store.dispatch(addTask(task));

      const startTime = performance.now();

      // 模拟频繁的进度更新
      for (let i = 1; i <= 100; i++) {
        store.dispatch(updateTaskProgress({
          taskId: 1,
          progress: i,
          currentStep: Math.floor(i / 20)
        }));
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(store.getState().publish.tasks[0].progress).toBe(100);
    });
  });

  describe('错误边界测试', () => {
    test('应该处理无效的任务数据', () => {
      const invalidTasks = [
        null,
        undefined,
        {},
        { id: null },
        { status: 'invalid_status' }
      ];

      invalidTasks.forEach(task => {
        expect(() => {
          store.dispatch(addTask(task));
        }).not.toThrow();
      });
    });

    test('应该处理异步操作的异常', async () => {
      mockElectronAPI.publish.createTask.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await store.dispatch(publishArticle({
        articleId: 1,
        platformIds: ['zhihu']
      }));

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Unexpected error');
    });
  });

  describe('状态一致性测试', () => {
    test('应该保持currentTask与tasks列表的一致性', () => {
      const task = { id: 1, status: 'pending' };
      store.dispatch(addTask(task));
      store.dispatch(setCurrentTask(task));

      // 更新tasks中的任务
      store.dispatch(updateTask({
        id: 1,
        status: 'completed',
        progress: 100
      }));

      const state = store.getState().publish;
      // currentTask也应该被更新
      expect(state.currentTask.status).toBe('completed');
      expect(state.currentTask.progress).toBe(100);
    });

    test('应该在任务完成后正确清理状态', () => {
      const task = {
        id: 1,
        status: 'in_progress',
        error: '临时错误'
      };
      store.dispatch(setCurrentTask(task));

      // 完成任务
      store.dispatch(updateTask({
        id: 1,
        status: 'completed',
        error: null
      }));

      const state = store.getState().publish;
      expect(state.isPublishing).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentTask.error).toBeNull();
    });
  });
});