/**
 * 平台状态管理 - T006状态管理设置
 * 管理发布平台的配置、状态和认证信息
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { platformApi } from '../../services/httpService';

// 异步thunk：获取平台列表
export const fetchPlatforms = createAsyncThunk(
  'platforms/fetchPlatforms',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformApi.getPlatforms();
      return response;
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取平台列表失败');
    }
  }
);

// 异步thunk：获取可用平台
export const fetchAvailablePlatforms = createAsyncThunk(
  'platforms/fetchAvailablePlatforms',
  async (_, { rejectWithValue }) => {
    try {
      const response = await platformApi.getAvailablePlatforms();
      return response;
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取可用平台失败');
    }
  }
);

// 异步thunk：获取平台配置
export const fetchPlatformConfig = createAsyncThunk(
  'platforms/fetchPlatformConfig',
  async (platformId, { rejectWithValue }) => {
    try {
      const response = await platformApi.getPlatformConfig(platformId);
      return { platformId, config: response.data || response };
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取平台配置失败');
    }
  }
);

// 异步thunk：更新平台配置
export const updatePlatformConfig = createAsyncThunk(
  'platforms/updatePlatformConfig',
  async ({ platformId, config }, { rejectWithValue }) => {
    try {
      const response = await platformApi.updatePlatformConfig(platformId, config);
      return { platformId, config: response.data || response };
    } catch (error) {
      return rejectWithValue(error.error?.message || '更新平台配置失败');
    }
  }
);

// 异步thunk：测试平台连接
export const testPlatformConnection = createAsyncThunk(
  'platforms/testPlatformConnection',
  async (platformId, { rejectWithValue }) => {
    try {
      const response = await platformApi.testPlatformConnection(platformId);
      return { platformId, result: response.data || response };
    } catch (error) {
      return rejectWithValue(error.error?.message || '测试平台连接失败');
    }
  }
);

// 异步thunk：获取平台状态
export const fetchPlatformStatus = createAsyncThunk(
  'platforms/fetchPlatformStatus',
  async (platformId, { rejectWithValue }) => {
    try {
      const response = await platformApi.getPlatformStatus(platformId);
      return { platformId, status: response.data || response };
    } catch (error) {
      return rejectWithValue(error.error?.message || '获取平台状态失败');
    }
  }
);

// 初始状态
const initialState = {
  // 平台列表
  platforms: [],
  availablePlatforms: [],

  // 平台配置
  platformConfigs: {},

  // 平台状态
  platformStatus: {},

  // 加载状态
  loading: false,
  configLoading: {},
  connectionTesting: {},

  // 错误状态
  error: null,
  configErrors: {},
  connectionErrors: {},

  // 用户配置
  userConfigs: {
    // 知乎
    zhihu: {
      enabled: false,
      autoPublish: false,
      publishTime: null, // 定时发布
      tags: [],
      category: '',
      summary: '',
      addSignature: true,
      signature: '',
    },

    // 小红书
    xiaohongshu: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      tags: [],
      location: '',
      addWatermark: false,
      watermarkText: '',
    },

    // 百家号
    baijia: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      category: '',
      tags: [],
      original: true, // 原创
      showOriginal: true,
      adEnabled: false,
    },

    // 头条号
    toutiao: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      category: '',
      tags: [],
      original: true,
      showAds: false,
      commentEnabled: true,
    },

    // 知识星球
    knowledgePlanet: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      category: '',
      price: 0, // 付费内容
      visibleToAll: false,
    },

    // 掘金
    juejin: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      category: '',
      tags: [],
      original: true,
      rewardEnabled: false,
    },

    // CSDN
    csdn: {
      enabled: false,
      autoPublish: false,
      publishTime: null,
      category: '',
      tags: [],
      original: true,
      blogType: 'original', // original, translated, repost
    },
  },

  // 认证状态
  authStatus: {},

  // 发布统计
  publishStats: {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    todayStats: {
      published: 0,
      failed: 0,
    },
  },

  // 平台规则
  platformRules: {
    zhihu: {
      maxTitleLength: 100,
      maxContentLength: 50000,
      supportedFormats: ['markdown', 'html'],
      maxTags: 5,
      requiredFields: ['title', 'content'],
    },
    xiaohongshu: {
      maxTitleLength: 100,
      maxContentLength: 10000,
      supportedFormats: ['text', 'image'],
      maxImages: 9,
      requiredFields: ['title', 'content'],
    },
    baijia: {
      maxTitleLength: 100,
      maxContentLength: 20000,
      supportedFormats: ['html', 'markdown'],
      maxTags: 10,
      requiredFields: ['title', 'content'],
    },
    toutiao: {
      maxTitleLength: 100,
      maxContentLength: 30000,
      supportedFormats: ['html', 'markdown'],
      maxTags: 10,
      requiredFields: ['title', 'content'],
    },
    // 其他平台规则...
  },

  // 快速发布设置
  quickPublish: {
    selectedPlatforms: [],
    defaultSettings: {},
    lastUsedPlatforms: [],
  },
};

const platformSlice = createSlice({
  name: 'platforms',
  initialState,
  reducers: {
    // 设置平台列表
    setPlatforms: (state, action) => {
      state.platforms = action.payload;
    },

    // 设置可用平台
    setAvailablePlatforms: (state, action) => {
      state.availablePlatforms = action.payload;
    },

    // 更新用户配置
    updateUserConfig: (state, action) => {
      const { platformId, config } = action.payload;
      state.userConfigs[platformId] = { ...state.userConfigs[platformId], ...config };
    },

    // 批量更新用户配置
    batchUpdateUserConfigs: (state, action) => {
      state.userConfigs = { ...state.userConfigs, ...action.payload };
    },

    // 启用/禁用平台
    togglePlatform: (state, action) => {
      const platformId = action.payload;
      if (state.userConfigs[platformId]) {
        state.userConfigs[platformId].enabled = !state.userConfigs[platformId].enabled;
      }
    },

    // 设置平台启用状态
    setPlatformEnabled: (state, action) => {
      const { platformId, enabled } = action.payload;
      if (state.userConfigs[platformId]) {
        state.userConfigs[platformId].enabled = enabled;
      }
    },

    // 设置自动发布
    setAutoPublish: (state, action) => {
      const { platformId, autoPublish, publishTime } = action.payload;
      if (state.userConfigs[platformId]) {
        state.userConfigs[platformId].autoPublish = autoPublish;
        if (publishTime !== undefined) {
          state.userConfigs[platformId].publishTime = publishTime;
        }
      }
    },

    // 更新认证状态
    updateAuthStatus: (state, action) => {
      const { platformId, status, userInfo } = action.payload;
      state.authStatus[platformId] = {
        status, // 'authenticated', 'unauthenticated', 'expired'
        userInfo,
        lastCheck: Date.now(),
      };
    },

    // 清除认证信息
    clearAuth: (state, action) => {
      const platformId = action.payload;
      delete state.authStatus[platformId];
    },

    // 更新发布统计
    updatePublishStats: (state, action) => {
      const { platformId, stats } = action.payload;
      if (!state.publishStats[platformId]) {
        state.publishStats[platformId] = {};
      }
      state.publishStats[platformId] = { ...state.publishStats[platformId], ...stats };
    },

    // 更新平台规则
    updatePlatformRules: (state, action) => {
      const { platformId, rules } = action.payload;
      state.platformRules[platformId] = { ...state.platformRules[platformId], ...rules };
    },

    // 选择快速发布平台
    selectQuickPublishPlatform: (state, action) => {
      const platformId = action.payload;
      if (!state.quickPublish.selectedPlatforms.includes(platformId)) {
        state.quickPublish.selectedPlatforms.push(platformId);
      }
    },

    // 取消选择快速发布平台
    deselectQuickPublishPlatform: (state, action) => {
      const platformId = action.payload;
      state.quickPublish.selectedPlatforms = state.quickPublish.selectedPlatforms.filter(
        id => id !== platformId
      );
    },

    // 设置快速发布平台列表
    setQuickPublishPlatforms: (state, action) => {
      state.quickPublish.selectedPlatforms = action.payload;
    },

    // 添加到最近使用平台
    addToLastUsedPlatforms: (state, action) => {
      const platformId = action.payload;
      state.quickPublish.lastUsedPlatforms = state.quickPublish.lastUsedPlatforms.filter(
        id => id !== platformId
      );
      state.quickPublish.lastUsedPlatforms.unshift(platformId);
      // 只保留最近10个
      state.quickPublish.lastUsedPlatforms = state.quickPublish.lastUsedPlatforms.slice(0, 10);
    },

    // 重置平台配置
    resetPlatformConfig: (state, action) => {
      const platformId = action.payload;
      if (state.userConfigs[platformId]) {
        // 重置为默认配置
        const defaultConfig = {
          enabled: false,
          autoPublish: false,
          publishTime: null,
        };
        state.userConfigs[platformId] = { ...defaultConfig };
      }
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    },

    // 清除平台配置错误
    clearConfigError: (state, action) => {
      const platformId = action.payload;
      delete state.configErrors[platformId];
    },

    // 清除连接错误
    clearConnectionError: (state, action) => {
      const platformId = action.payload;
      delete state.connectionErrors[platformId];
    },

    // 重置所有状态
    resetAllStates: (state) => {
      state.authStatus = {};
      state.publishStats = {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        todayStats: {
          published: 0,
          failed: 0,
        },
      };
    },

    // 验证平台配置
    validatePlatformConfig: (state, action) => {
      const { platformId, articleData } = action.payload;
      const rules = state.platformRules[platformId];
      const config = state.userConfigs[platformId];
      const errors = [];

      if (!rules) return;

      // 验证标题长度
      if (articleData.title && articleData.title.length > rules.maxTitleLength) {
        errors.push(`标题长度不能超过${rules.maxTitleLength}个字符`);
      }

      // 验证内容长度
      if (articleData.content && articleData.content.length > rules.maxContentLength) {
        errors.push(`内容长度不能超过${rules.maxContentLength}个字符`);
      }

      // 验证必需字段
      if (rules.requiredFields) {
        rules.requiredFields.forEach(field => {
          if (!articleData[field]) {
            errors.push(`${field}是必填字段`);
          }
        });
      }

      // 保存验证错误
      if (errors.length > 0) {
        state.configErrors[platformId] = errors;
      } else {
        delete state.configErrors[platformId];
      }
    },
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
        const platforms = action.payload.data || action.payload;
        state.platforms = Array.isArray(platforms) ? platforms : [];
      })
      .addCase(fetchPlatforms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 获取可用平台
      .addCase(fetchAvailablePlatforms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAvailablePlatforms.fulfilled, (state, action) => {
        state.loading = false;
        const platforms = action.payload.data || action.payload;
        state.availablePlatforms = Array.isArray(platforms) ? platforms : [];
      })
      .addCase(fetchAvailablePlatforms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 获取平台配置
      .addCase(fetchPlatformConfig.pending, (state, action) => {
        const platformId = action.meta.arg;
        state.configLoading[platformId] = true;
        delete state.configErrors[platformId];
      })
      .addCase(fetchPlatformConfig.fulfilled, (state, action) => {
        const { platformId, config } = action.payload;
        state.configLoading[platformId] = false;
        state.platformConfigs[platformId] = config;
      })
      .addCase(fetchPlatformConfig.rejected, (state, action) => {
        const platformId = action.meta.arg;
        state.configLoading[platformId] = false;
        state.configErrors[platformId] = action.payload;
      })

      // 更新平台配置
      .addCase(updatePlatformConfig.pending, (state, action) => {
        const platformId = action.meta.arg.platformId;
        state.configLoading[platformId] = true;
        delete state.configErrors[platformId];
      })
      .addCase(updatePlatformConfig.fulfilled, (state, action) => {
        const { platformId, config } = action.payload;
        state.configLoading[platformId] = false;
        state.platformConfigs[platformId] = config;
      })
      .addCase(updatePlatformConfig.rejected, (state, action) => {
        const platformId = action.meta.arg.platformId;
        state.configLoading[platformId] = false;
        state.configErrors[platformId] = action.payload;
      })

      // 测试平台连接
      .addCase(testPlatformConnection.pending, (state, action) => {
        const platformId = action.meta.arg;
        state.connectionTesting[platformId] = true;
        delete state.connectionErrors[platformId];
      })
      .addCase(testPlatformConnection.fulfilled, (state, action) => {
        const { platformId, result } = action.payload;
        state.connectionTesting[platformId] = false;
        // 更新连接状态到平台状态中
        if (!state.platformStatus[platformId]) {
          state.platformStatus[platformId] = {};
        }
        state.platformStatus[platformId].connection = {
          status: 'success',
          lastTest: Date.now(),
          result,
        };
      })
      .addCase(testPlatformConnection.rejected, (state, action) => {
        const platformId = action.meta.arg;
        state.connectionTesting[platformId] = false;
        state.connectionErrors[platformId] = action.payload;
        // 更新连接状态
        if (!state.platformStatus[platformId]) {
          state.platformStatus[platformId] = {};
        }
        state.platformStatus[platformId].connection = {
          status: 'failed',
          lastTest: Date.now(),
          error: action.payload,
        };
      })

      // 获取平台状态
      .addCase(fetchPlatformStatus.fulfilled, (state, action) => {
        const { platformId, status } = action.payload;
        state.platformStatus[platformId] = { ...state.platformStatus[platformId], ...status };
      });
  },
});

export const {
  setPlatforms,
  setAvailablePlatforms,
  updateUserConfig,
  batchUpdateUserConfigs,
  togglePlatform,
  setPlatformEnabled,
  setAutoPublish,
  updateAuthStatus,
  clearAuth,
  updatePublishStats,
  updatePlatformRules,
  selectQuickPublishPlatform,
  deselectQuickPublishPlatform,
  setQuickPublishPlatforms,
  addToLastUsedPlatforms,
  resetPlatformConfig,
  clearError,
  clearConfigError,
  clearConnectionError,
  resetAllStates,
  validatePlatformConfig,
} = platformSlice.actions;

export default platformSlice.reducer;