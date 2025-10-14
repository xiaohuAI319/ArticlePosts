import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 异步thunk：获取平台列表
export const fetchPlatforms = createAsyncThunk(
  'platforms/fetch',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API获取平台列表
      await new Promise(resolve => setTimeout(resolve, 500));

      // 模拟数据
      return [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          icon_url: '/assets/icons/zhihu.png',
          base_url: 'https://www.zhihu.com',
          login_url: 'https://www.zhihu.com/signin',
          publish_url: 'https://zhuanlan.zhihu.com/write',
          is_active: true,
          priority: 1,
          login_status: 'logged_out', // logged_out, logged_in, expired
          last_login: null,
          config: {}
        }
      ];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：更新平台登录状态
export const updatePlatformLoginStatus = createAsyncThunk(
  'platforms/updateLoginStatus',
  async ({ platformId, status, sessionData }, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API更新登录状态
      await new Promise(resolve => setTimeout(resolve, 300));

      return {
        platformId,
        loginStatus: status,
        sessionData,
        timestamp: Date.now()
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步thunk：平台扫码登录
export const platformQRLogin = createAsyncThunk(
  'platforms/qrLogin',
  async ({ platformName }, { rejectWithValue }) => {
    try {
      // TODO: 调用主进程API启动扫码登录
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟登录结果
      return {
        platformName,
        success: true,
        sessionData: {
          cookies: 'encrypted_cookies_here',
          user_agent: 'custom_user_agent',
          expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天后过期
        }
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 初始状态
const initialState = {
  // 平台列表
  platforms: [],
  activePlatforms: [],

  // 状态
  loading: false,
  error: null,

  // 登录状态
  loginInProgress: false,
  currentLoginPlatform: null,

  // 平台配置
  platformConfigs: {},

  // 发布状态
  publishingPlatforms: [], // 正在发布的平台
  publishedPlatforms: []  // 已发布成功的平台
};

const platformsSlice = createSlice({
  name: 'platforms',
  initialState,
  reducers: {
    // 设置当前登录平台
    setCurrentLoginPlatform: (state, action) => {
      state.currentLoginPlatform = action.payload;
    },

    // 清除当前登录平台
    clearCurrentLoginPlatform: (state) => {
      state.currentLoginPlatform = null;
    },

    // 更新平台配置
    updatePlatformConfig: (state, action) => {
      const { platformId, config } = action.payload;
      state.platformConfigs[platformId] = {
        ...state.platformConfigs[platformId],
        ...config
      };
    },

    // 设置发布状态
    setPublishingPlatform: (state, action) => {
      const platformId = action.payload;
      if (!state.publishingPlatforms.includes(platformId)) {
        state.publishingPlatforms.push(platformId);
      }
    },

    // 清除发布状态
    clearPublishingPlatform: (state, action) => {
      const platformId = action.payload;
      state.publishingPlatforms = state.publishingPlatforms.filter(id => id !== platformId);
    },

    // 添加已发布平台
    addPublishedPlatform: (state, action) => {
      const { platformId, articleUrl } = action.payload;
      const existingIndex = state.publishedPlatforms.findIndex(p => p.platformId === platformId);

      if (existingIndex !== -1) {
        state.publishedPlatforms[existingIndex] = { platformId, articleUrl, timestamp: Date.now() };
      } else {
        state.publishedPlatforms.push({ platformId, articleUrl, timestamp: Date.now() });
      }
    },

    // 清除已发布记录
    clearPublishedPlatforms: (state) => {
      state.publishedPlatforms = [];
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 获取平台列表
      .addCase(fetchPlatforms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlatforms.fulfilled, (state, action) => {
        state.loading = false;
        state.platforms = action.payload;
        state.activePlatforms = action.payload.filter(p => p.is_active);
        state.error = null;
      })
      .addCase(fetchPlatforms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 更新登录状态
      .addCase(updatePlatformLoginStatus.fulfilled, (state, action) => {
        const { platformId, loginStatus, sessionData } = action.payload;
        const platform = state.platforms.find(p => p.id === platformId);
        if (platform) {
          platform.login_status = loginStatus;
          platform.last_login = Date.now();
          if (sessionData) {
            platform.sessionData = sessionData;
          }
        }
      })

      // 扫码登录
      .addCase(platformQRLogin.pending, (state, action) => {
        state.loginInProgress = true;
        state.currentLoginPlatform = action.meta.arg.platformName;
        state.error = null;
      })
      .addCase(platformQRLogin.fulfilled, (state, action) => {
        state.loginInProgress = false;
        const { platformName, success, sessionData } = action.payload;

        const platform = state.platforms.find(p => p.name === platformName);
        if (platform && success) {
          platform.login_status = 'logged_in';
          platform.last_login = Date.now();
          platform.sessionData = sessionData;
        }

        state.currentLoginPlatform = null;
      })
      .addCase(platformQRLogin.rejected, (state, action) => {
        state.loginInProgress = false;
        state.currentLoginPlatform = null;
        state.error = action.payload;
      });
  }
});

export const {
  setCurrentLoginPlatform,
  clearCurrentLoginPlatform,
  updatePlatformConfig,
  setPublishingPlatform,
  clearPublishingPlatform,
  addPublishedPlatform,
  clearPublishedPlatforms,
  clearError
} = platformsSlice.actions;

export default platformsSlice.reducer;