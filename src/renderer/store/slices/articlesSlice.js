import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

// 异步thunk：创建新文章
export const createArticle = createAsyncThunk(
  'articles/create',
  async (articleData, { rejectWithValue }) => {
    try {
      const newArticle = {
        id: uuidv4(),
        title: articleData.title || '无标题文章',
        content: articleData.content || '',
        html_content: articleData.html_content || '',
        cover_image: articleData.cover_image || '',
        tags: articleData.tags || [],
        category: articleData.category || '',
        status: 0, // 草稿
        word_count: 0,
        reading_time: 0,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // TODO: 调用主进程API保存到数据库
      await new Promise(resolve => setTimeout(resolve, 500));

      return newArticle;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：保存文章
export const saveArticle = createAsyncThunk(
  'articles/save',
  async ({ id, ...articleData }, { rejectWithValue }) => {
    try {
      const updatedArticle = {
        ...articleData,
        updated_at: Date.now(),
        word_count: calculateWordCount(articleData.content),
        reading_time: calculateReadingTime(articleData.content)
      };

      // TODO: 调用主进程API更新数据库
      await new Promise(resolve => setTimeout(resolve, 500));

      return { id, changes: updatedArticle };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：删除文章
export const deleteArticle = createAsyncThunk(
  'articles/delete',
  async (id, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API删除
      await new Promise(resolve => setTimeout(resolve, 300));
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：获取文章列表
export const fetchArticles = createAsyncThunk(
  'articles/fetch',
  async (params = {}, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API获取文章列表
      await new Promise(resolve => setTimeout(resolve, 800));

      // 模拟数据
      return [];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 工具函数：计算字数
function calculateWordCount(content) {
  if (!content) return 0;
  // 简单的中英文字数统计
  const text = content.replace(/<[^>]*>/g, '');
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

// 工具函数：计算阅读时间（分钟）
function calculateReadingTime(content) {
  const wordCount = calculateWordCount(content);
  // 假设阅读速度：中文300字/分钟，英文200词/分钟
  return Math.max(1, Math.ceil(wordCount / 300));
}

// 初始状态
const initialState = {
  // 文章列表
  articles: [],
  currentArticle: null,

  // 状态
  loading: false,
  saving: false,
  error: null,

  // 分页
  pagination: {
    current: 1,
    pageSize: 10,
    total: 0
  },

  // 筛选条件
  filters: {
    status: 'all', // all, draft, published, failed
    category: 'all',
    tags: [],
    search: ''
  },

  // 自动保存
  lastSaveTime: null,
  autoSaveEnabled: true
};

const articlesSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    // 设置当前文章
    setCurrentArticle: (state, action) => {
      state.currentArticle = action.payload;
    },

    // 更新当前文章内容
    updateCurrentArticle: (state, action) => {
      if (state.currentArticle) {
        state.currentArticle = {
          ...state.currentArticle,
          ...action.payload,
          updated_at: Date.now()
        };
      }
    },

    // 清除当前文章
    clearCurrentArticle: (state) => {
      state.currentArticle = null;
    },

    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    // 重置筛选条件
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },

    // 设置分页
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    // 更新文章状态
    updateArticleStatus: (state, action) => {
      const { id, status } = action.payload;
      const article = state.articles.find(a => a.id === id);
      if (article) {
        article.status = status;
        article.updated_at = Date.now();
      }
    },

    // 设置自动保存
    setAutoSave: (state, action) => {
      state.autoSaveEnabled = action.payload;
    },

    // 更新最后保存时间
    updateLastSaveTime: (state) => {
      state.lastSaveTime = Date.now();
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 创建文章
      .addCase(createArticle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createArticle.fulfilled, (state, action) => {
        state.loading = false;
        state.articles.unshift(action.payload);
        state.currentArticle = action.payload;
        state.error = null;
      })
      .addCase(createArticle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 保存文章
      .addCase(saveArticle.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveArticle.fulfilled, (state, action) => {
        state.saving = false;
        const { id, changes } = action.payload;
        const articleIndex = state.articles.findIndex(a => a.id === id);
        if (articleIndex !== -1) {
          state.articles[articleIndex] = {
            ...state.articles[articleIndex],
            ...changes
          };
        }
        if (state.currentArticle && state.currentArticle.id === id) {
          state.currentArticle = {
            ...state.currentArticle,
            ...changes
          };
        }
        state.lastSaveTime = Date.now();
      })
      .addCase(saveArticle.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      // 删除文章
      .addCase(deleteArticle.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteArticle.fulfilled, (state, action) => {
        state.loading = false;
        state.articles = state.articles.filter(a => a.id !== action.payload);
        if (state.currentArticle && state.currentArticle.id === action.payload) {
          state.currentArticle = null;
        }
      })
      .addCase(deleteArticle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 获取文章列表
      .addCase(fetchArticles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        state.loading = false;
        state.articles = action.payload;
        state.pagination.total = action.payload.length;
        state.error = null;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setCurrentArticle,
  updateCurrentArticle,
  clearCurrentArticle,
  setFilters,
  resetFilters,
  setPagination,
  updateArticleStatus,
  setAutoSave,
  updateLastSaveTime,
  clearError
} = articlesSlice.actions;

export default articlesSlice.reducer;