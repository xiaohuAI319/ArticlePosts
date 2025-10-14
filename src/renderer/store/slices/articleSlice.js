/**
 * 文章状态管理 - T006状态管理设置
 * 管理文章的创建、编辑、发布等状态
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { articleApi } from '../../services/httpService';

// 异步thunk：获取文章列表
export const fetchArticles = createAsyncThunk(
  'articles/fetchArticles',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await articleApi.getArticles(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取文章列表失败');
    }
  }
);

// 异步thunk：获取文章详情
export const fetchArticleById = createAsyncThunk(
  'articles/fetchArticleById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await articleApi.getArticle(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取文章详情失败');
    }
  }
);

// 异步thunk：创建文章
export const createArticle = createAsyncThunk(
  'articles/createArticle',
  async (articleData, { rejectWithValue }) => {
    try {
      const response = await articleApi.createArticle(articleData);
      return response;
    } catch (error) {
      return rejectWithValue(error.error?.message || '创建文章失败');
    }
  }
);

// 异步thunk：更新文章
export const updateArticle = createAsyncThunk(
  'articles/updateArticle',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await articleApi.updateArticle(id, data);
      return { ...response, id };
    } catch (error) {
      return rejectWithValue(error.error?.message || '更新文章失败');
    }
  }
);

// 异步thunk：删除文章
export const deleteArticle = createAsyncThunk(
  'articles/deleteArticle',
  async (id, { rejectWithValue }) => {
    try {
      await articleApi.deleteArticle(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.error?.message || '删除文章失败');
    }
  }
);

// 异步thunk：发布文章
export const publishArticle = createAsyncThunk(
  'articles/publishArticle',
  async ({ id, platformIds }, { rejectWithValue }) => {
    try {
      const response = await articleApi.publishArticle(id, platformIds);
      return { ...response, id, platformIds };
    } catch (error) {
      return rejectWithValue(error.error?.message || '发布文章失败');
    }
  }
);

// 异步thunk：获取发布状态
export const fetchPublishStatus = createAsyncThunk(
  'articles/fetchPublishStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await articleApi.getPublishStatus(id);
      return { ...response, id };
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取发布状态失败');
    }
  }
);

// 异步thunk：取消发布
export const cancelPublish = createAsyncThunk(
  'articles/cancelPublish',
  async ({ id, platformId }, { rejectWithValue }) => {
    try {
      await articleApi.cancelPublish(id, platformId);
      return { id, platformId };
    } catch (error) {
      return rejectWithValue(error.error?.message || '取消发布失败');
    }
  }
);

// 初始状态
const initialState = {
  // 文章列表
  articles: [],
  total: 0,
  currentPage: 1,
  pageSize: 10,

  // 当前编辑的文章
  currentArticle: null,
  draftArticle: null,

  // 加载状态
  loading: false,
  saving: false,
  publishing: false,
  deleting: false,

  // 错误状态
  error: null,

  // 分页和筛选
  filters: {
    status: 'all', // all, draft, published, failed
    platform: 'all',
    keyword: '',
    dateRange: null,
  },

  // 排序
  sortBy: 'updatedAt',
  sortOrder: 'desc',

  // 发布状态
  publishStatus: {},

  // 编辑器状态
  editorState: {
    content: '',
    wordCount: 0,
    charCount: 0,
    lastSaved: null,
    autoSaveEnabled: true,
    dirty: false,
  },

  // 历史记录
  history: {
    undoStack: [],
    redoStack: [],
    currentIndex: -1,
  },

  // 标签和分类
  tags: [],
  categories: [],

  // 最近使用的平台
  recentPlatforms: [],
};

const articleSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    // 设置当前文章
    setCurrentArticle: (state, action) => {
      state.currentArticle = action.payload;
      state.draftArticle = action.payload ? { ...action.payload } : null;

      // 重置编辑器状态
      if (action.payload) {
        state.editorState.content = action.payload.content || '';
        state.editorState.wordCount = action.payload.wordCount || 0;
        state.editorState.charCount = action.payload.charCount || 0;
        state.editorState.lastSaved = action.payload.updatedAt;
        state.editorState.dirty = false;
      }
    },

    // 创建新文章
    createNewArticle: (state) => {
      const newArticle = {
        id: `draft_${Date.now()}`, // 临时ID
        title: '无标题',
        content: '',
        status: 0, // 草稿
        wordCount: 0,
        charCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        platforms: [],
      };

      state.currentArticle = newArticle;
      state.draftArticle = { ...newArticle };
      state.editorState.content = '';
      state.editorState.wordCount = 0;
      state.editorState.charCount = 0;
      state.editorState.lastSaved = null;
      state.editorState.dirty = false;
      state.error = null;
    },

    // 更新当前文章
    updateCurrentArticle: (state, action) => {
      const updates = action.payload;
      if (state.currentArticle) {
        state.currentArticle = { ...state.currentArticle, ...updates };
        state.draftArticle = { ...state.draftArticle, ...updates };
        state.editorState.dirty = true;
      }
    },

    // 更新草稿文章
    updateDraftArticle: (state, action) => {
      state.draftArticle = { ...state.draftArticle, ...action.payload };
      state.editorState.dirty = true;
    },

    // 更新编辑器内容
    updateEditorContent: (state, action) => {
      const content = action.payload;
      state.editorState.content = content;
      state.editorState.wordCount = content.replace(/\s+/g, '').length;
      state.editorState.charCount = content.length;
      state.editorState.dirty = true;

      // 更新草稿内容
      if (state.draftArticle) {
        state.draftArticle.content = content;
        state.draftArticle.wordCount = state.editorState.wordCount;
        state.draftArticle.charCount = state.editorState.charCount;
      }
    },

    // 设置已保存状态
    setSaved: (state, action) => {
      state.editorState.lastSaved = action.payload;
      state.editorState.dirty = false;
      state.saving = false;
    },

    // 设置保存状态
    setSaving: (state, action) => {
      state.saving = action.payload;
    },

    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1; // 重置到第一页
    },

    // 重置筛选条件
    resetFilters: (state) => {
      state.filters = {
        status: 'all',
        platform: 'all',
        keyword: '',
        dateRange: null,
      };
      state.currentPage = 1;
    },

    // 设置分页
    setPagination: (state, action) => {
      state.currentPage = action.payload.currentPage || state.currentPage;
      state.pageSize = action.payload.pageSize || state.pageSize;
    },

    // 设置排序
    setSorting: (state, action) => {
      state.sortBy = action.payload.sortBy || state.sortBy;
      state.sortOrder = action.payload.sortOrder || state.sortOrder;
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    },

    // 添加标签
    addTag: (state, action) => {
      const tag = action.payload;
      if (!state.tags.includes(tag)) {
        state.tags.push(tag);
      }
    },

    // 移除标签
    removeTag: (state, action) => {
      const tag = action.payload;
      state.tags = state.tags.filter(t => t !== tag);
    },

    // 设置分类
    setCategories: (state, action) => {
      state.categories = action.payload;
    },

    // 更新发布状态
    updatePublishStatus: (state, action) => {
      const { articleId, platformId, status, message } = action.payload;
      if (!state.publishStatus[articleId]) {
        state.publishStatus[articleId] = {};
      }
      state.publishStatus[articleId][platformId] = {
        status,
        message,
        timestamp: Date.now(),
      };
    },

    // 添加最近使用的平台
    addRecentPlatform: (state, action) => {
      const platformId = action.payload;
      state.recentPlatforms = state.recentPlatforms.filter(id => id !== platformId);
      state.recentPlatforms.unshift(platformId);
      state.recentPlatforms = state.recentPlatforms.slice(0, 5); // 只保留最近5个
    },

    // 历史记录操作
    saveToHistory: (state, action) => {
      const content = action.payload;
      // 清除重做栈
      state.history.redoStack = [];
      // 添加到撤销栈
      state.history.undoStack.push(content);
      // 限制历史记录数量
      if (state.history.undoStack.length > 50) {
        state.history.undoStack.shift();
      }
    },

    // 撤销
    undo: (state) => {
      if (state.history.undoStack.length > 0) {
        const currentContent = state.editorState.content;
        const previousContent = state.history.undoStack.pop();

        state.history.redoStack.push(currentContent);
        state.editorState.content = previousContent;
        state.editorState.dirty = true;

        // 更新草稿内容
        if (state.draftArticle) {
          state.draftArticle.content = previousContent;
        }
      }
    },

    // 重做
    redo: (state) => {
      if (state.history.redoStack.length > 0) {
        const currentContent = state.editorState.content;
        const nextContent = state.history.redoStack.pop();

        state.history.undoStack.push(currentContent);
        state.editorState.content = nextContent;
        state.editorState.dirty = true;

        // 更新草稿内容
        if (state.draftArticle) {
          state.draftArticle.content = nextContent;
        }
      }
    },

    // 清空历史记录
    clearHistory: (state) => {
      state.history.undoStack = [];
      state.history.redoStack = [];
      state.history.currentIndex = -1;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取文章列表
      .addCase(fetchArticles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.loading = false;
        const { articles, total, currentPage, pageSize } = action.payload.data || action.payload;
        state.articles = articles || [];
        state.total = total || 0;
        state.currentPage = currentPage || 1;
        state.pageSize = pageSize || 10;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 获取文章详情
      .addCase(fetchArticleById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticleById.fulfilled, (state, action) => {
        state.loading = false;
        const article = action.payload.data || action.payload;
        state.currentArticle = article;
        state.draftArticle = article ? { ...article } : null;

        if (article) {
          state.editorState.content = article.content || '';
          state.editorState.wordCount = article.wordCount || 0;
          state.editorState.charCount = article.charCount || 0;
          state.editorState.lastSaved = article.updatedAt;
          state.editorState.dirty = false;
        }
      })
      .addCase(fetchArticleById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 创建文章
      .addCase(createArticle.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createArticle.fulfilled, (state, action) => {
        state.saving = false;
        const article = action.payload.data || action.payload;
        state.articles.unshift(article);
        state.currentArticle = article;
        state.draftArticle = { ...article };
        state.editorState.dirty = false;
      })
      .addCase(createArticle.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // 更新文章
      .addCase(updateArticle.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateArticle.fulfilled, (state, action) => {
        state.saving = false;
        const { data: article, id } = action.payload;
        const index = state.articles.findIndex(a => a.id === id);
        if (index !== -1) {
          state.articles[index] = article;
        }
        state.currentArticle = article;
        state.draftArticle = { ...article };
        state.editorState.lastSaved = article.updatedAt;
        state.editorState.dirty = false;
      })
      .addCase(updateArticle.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // 删除文章
      .addCase(deleteArticle.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.deleting = false;
        const deletedId = action.payload;
        state.articles = state.articles.filter(a => a.id !== deletedId);

        if (state.currentArticle?.id === deletedId) {
          state.currentArticle = null;
          state.draftArticle = null;
        }
      })
      .addCase(deleteArticle.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      })

      // 发布文章
      .addCase(publishArticle.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(publishArticle.fulfilled, (state, action) => {
        state.publishing = false;
        const { id, platformIds } = action.payload;

        // 更新文章状态
        const articleIndex = state.articles.findIndex(a => a.id === id);
        if (articleIndex !== -1) {
          state.articles[articleIndex].status = 'publishing';
        }

        // 初始化发布状态
        if (!state.publishStatus[id]) {
          state.publishStatus[id] = {};
        }
        platformIds.forEach(platformId => {
          state.publishStatus[id][platformId] = {
            status: 'pending',
            message: '准备发布...',
            timestamp: Date.now(),
          };
        });
      })
      .addCase(publishArticle.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload;
      })

      // 获取发布状态
      .addCase(fetchPublishStatus.fulfilled, (state, action) => {
        const { id, data: statusData } = action.payload;
        if (statusData && Array.isArray(statusData)) {
          if (!state.publishStatus[id]) {
            state.publishStatus[id] = {};
          }
          statusData.forEach(status => {
            state.publishStatus[id][status.platformId] = {
              status: status.status,
              message: status.message,
              timestamp: status.timestamp,
            };
          });
        }
      })

      // 取消发布
      .addCase(cancelPublish.fulfilled, (state, action) => {
        const { id, platformId } = action.payload;
        if (state.publishStatus[id] && state.publishStatus[id][platformId]) {
          delete state.publishStatus[id][platformId];
        }
      });
  },
});

export const {
  setCurrentArticle,
  createNewArticle,
  updateCurrentArticle,
  updateDraftArticle,
  updateEditorContent,
  setSaved,
  setSaving,
  setFilters,
  resetFilters,
  setPagination,
  setSorting,
  clearError,
  addTag,
  removeTag,
  setCategories,
  updatePublishStatus,
  addRecentPlatform,
  saveToHistory,
  undo,
  redo,
  clearHistory,
} = articleSlice.actions;

export default articleSlice.reducer;