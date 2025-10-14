import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

// 异步thunk：发布文章到平台
export const publishArticle = createAsyncThunk(
  'publish/publishArticle',
  async ({ articleId, platformIds, config }, { rejectWithValue }) => {
    try {
      const publishTasks = platformIds.map(platformId => ({
        id: uuidv4(),
        articleId,
        platformId,
        config,
        status: 'pending',
        progress: 0,
        createdAt: Date.now()
      }));

      // TODO: 调用主进程API开始发布流程
      await new Promise(resolve => setTimeout(resolve, 1000));

      return publishTasks;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：更新发布任务状态
export const updatePublishTask = createAsyncThunk(
  'publish/updateTask',
  async ({ taskId, status, progress, error, publishedUrl }, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API更新任务状态
      await new Promise(resolve => setTimeout(resolve, 300));

      return {
        taskId,
        updates: {
          status,
          progress,
          error,
          publishedUrl,
          updatedAt: Date.now()
        }
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：重试发布
export const retryPublish = createAsyncThunk(
  'publish/retry',
  async ({ taskId }, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API重试发布
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        taskId,
        status: 'pending',
        error: null,
        retriedAt: Date.now()
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 初始状态
const initialState = {
  // 发布任务
  tasks: [],
  currentTask: null,

  // 状态
  loading: false,
  publishing: false,
  error: null,

  // 统计
  stats: {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    inProgress: 0
  },

  // 发布历史
  history: [],

  // 设置
  settings: {
    retryCount: 3,
    retryDelay: 5000, // 毫秒
    concurrentPublish: false,
    autoRetry: true
  }
};

const publishSlice = createSlice({
  name: 'publish',
  initialState,
  reducers: {
    // 设置当前任务
    setCurrentTask: (state, action) => {
      state.currentTask = action.payload;
    },

    // 清除当前任务
    clearCurrentTask: (state) => {
      state.currentTask = null;
    },

    // 更新任务进度
    updateTaskProgress: (state, action) => {
      const { taskId, progress } = action.payload;
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.progress = progress;
        if (progress > 0 && progress < 100) {
          task.status = 'in_progress';
        }
      }
    },

    // 添加日志
    addTaskLog: (state, action) => {
      const { taskId, level, message } = action.payload;
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        if (!task.logs) {
          task.logs = [];
        }
        task.logs.push({
          timestamp: Date.now(),
          level,
          message
        });
      }
    },

    // 更新设置
    updateSettings: (state, action) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    // 清除已完成任务
    clearCompletedTasks: (state) => {
      state.tasks = state.tasks.filter(task =>
        task.status === 'pending' || task.status === 'in_progress'
      );
    },

    // 清除所有任务
    clearAllTasks: (state) => {
      state.tasks = [];
      state.currentTask = null;
    },

    // 添加到历史记录
    addToHistory: (state, action) => {
      const { articleId, platformId, status, publishedUrl, publishedAt } = action.payload;
      state.history.unshift({
        id: uuidv4(),
        articleId,
        platformId,
        status,
        publishedUrl,
        publishedAt: publishedAt || Date.now()
      });

      // 保持历史记录不超过100条
      if (state.history.length > 100) {
        state.history = state.history.slice(0, 100);
      }
    },

    // 清除历史记录
    clearHistory: (state) => {
      state.history = [];
    },

    // 计算统计信息
    calculateStats: (state) => {
      const total = state.tasks.length;
      const success = state.tasks.filter(t => t.status === 'success').length;
      const failed = state.tasks.filter(t => t.status === 'failed').length;
      const pending = state.tasks.filter(t => t.status === 'pending').length;
      const inProgress = state.tasks.filter(t => t.status === 'in_progress').length;

      state.stats = { total, success, failed, pending, inProgress };
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 发布文章
      .addCase(publishArticle.pending, (state) => {
        state.loading = true;
        state.publishing = true;
        state.error = null;
      })
      .addCase(publishArticle.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.push(...action.payload);
        state.currentTask = action.payload[0];
        state.error = null;

        // 重新计算统计信息
        state.stats.total = state.tasks.length;
        state.stats.pending += action.payload.length;
      })
      .addCase(publishArticle.rejected, (state, action) => {
        state.loading = false;
        state.publishing = false;
        state.error = action.payload;
      })

      // 更新任务状态
      .addCase(updatePublishTask.fulfilled, (state, action) => {
        const { taskId, updates } = action.payload;
        const task = state.tasks.find(t => t.id === taskId);

        if (task) {
          // 更新任务状态
          Object.assign(task, updates);

          // 如果任务完成，更新统计信息
          if (updates.status === 'success') {
            state.stats.success++;
            state.stats.inProgress--;

            // 添加到历史记录
            state.history.push({
              id: uuidv4(),
              articleId: task.articleId,
              platformId: task.platformId,
              status: 'success',
              publishedUrl: updates.publishedUrl,
              publishedAt: Date.now()
            });
          } else if (updates.status === 'failed') {
            state.stats.failed++;
            state.stats.inProgress--;
          } else if (updates.status === 'in_progress') {
            state.stats.pending--;
            state.stats.inProgress++;
          }
        }

        // 检查是否所有任务都已完成
        const allCompleted = state.tasks.every(t =>
          t.status === 'success' || t.status === 'failed'
        );
        if (allCompleted) {
          state.publishing = false;
        }
      })

      // 重试发布
      .addCase(retryPublish.pending, (state, action) => {
        const taskId = action.meta.arg.taskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          task.status = 'pending';
          task.error = null;
          state.stats.failed--;
          state.stats.pending++;
        }
      })
      .addCase(retryPublish.fulfilled, (state, action) => {
        const { taskId, status, error } = action.payload;
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          task.status = status;
          task.error = error;
          task.retriedAt = action.payload.retriedAt;
        }
      })
      .addCase(retryPublish.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const {
  setCurrentTask,
  clearCurrentTask,
  updateTaskProgress,
  addTaskLog,
  updateSettings,
  clearCompletedTasks,
  clearAllTasks,
  addToHistory,
  clearHistory,
  calculateStats,
  clearError
} = publishSlice.actions;

export default publishSlice.reducer;