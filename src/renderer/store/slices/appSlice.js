import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 异步thunk：初始化应用
export const initializeApp = createAsyncThunk(
  'app/initialize',
  async (_, { rejectWithValue }) => {
    try {
      // 获取应用版本
      const version = window.electronAPI?.getAppVersion() || '1.0.0';
      const platform = window.electronAPI?.getPlatform() || 'unknown';

      // 模拟其他初始化操作
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        version,
        platform,
        initialized: true,
        timestamp: Date.now()
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 初始状态
const initialState = {
  // 应用状态
  loading: false,
  initialized: false,
  error: null,

  // 应用信息
  version: '1.0.0',
  platform: 'unknown',
  theme: 'light',
  language: 'zh-CN',

  // 用户设置
  settings: {
    autoSave: true,
    autoSaveInterval: 30, // 秒
    showPreview: true,
    confirmBeforePublish: true
  },

  // 界面状态
  sidebarCollapsed: false,
  currentPage: 'editor', // editor, platforms, settings
  modals: {
    newArticle: false,
    platformManage: false,
    settings: false
  }
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // 设置加载状态
    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    // 设置错误信息
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },

    // 清除错误信息
    clearError: (state) => {
      state.error = null;
    },

    // 更新设置
    updateSettings: (state, action) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    // 切换主题
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },

    // 切换侧边栏
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    // 设置侧边栏状态
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },

    // 设置当前页面
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },

    // 打开模态框
    openModal: (state, action) => {
      const modalName = action.payload;
      state.modals[modalName] = true;
    },

    // 关闭模态框
    closeModal: (state, action) => {
      const modalName = action.payload;
      state.modals[modalName] = false;
    },

    // 关闭所有模态框
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key] = false;
      });
    }
  },
  extraReducers: (builder) => {
    builder
      // 初始化应用
      .addCase(initializeApp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeApp.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.version = action.payload.version;
        state.platform = action.payload.platform;
        state.error = null;
      })
      .addCase(initializeApp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.initialized = false;
      });
  }
});

export const {
  setLoading,
  setError,
  clearError,
  updateSettings,
  toggleTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setCurrentPage,
  openModal,
  closeModal,
  closeAllModals
} = appSlice.actions;

export default appSlice.reducer;