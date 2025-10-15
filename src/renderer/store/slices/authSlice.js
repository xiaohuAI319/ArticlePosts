/**
 * 认证状态管理切片 - T013
 * 负责管理平台登录状态、会话信息和用户认证数据
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // 登录状态映射，按平台ID存储
  loginStatus: {},
  // 当前活跃的用户会话
  activeSessions: {},
  // 用户信息映射
  users: {},
  // 登录加载状态
  loading: false,
  // 错误信息
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 更新登录状态
    updateLoginStatus: (state, action) => {
      const { platformId, status, message, data } = action.payload;

      if (!state.loginStatus[platformId]) {
        state.loginStatus[platformId] = {};
      }

      state.loginStatus[platformId] = {
        ...state.loginStatus[platformId],
        status,
        message,
        data,
        lastUpdated: new Date().toISOString()
      };

      // 清除该平台的错误信息
      if (state.error && state.error.platformId === platformId) {
        state.error = null;
      }
    },

    // 设置登录加载状态
    setLoginLoading: (state, action) => {
      const { platformId, loading } = action.payload;

      if (!state.loginStatus[platformId]) {
        state.loginStatus[platformId] = {};
      }

      state.loginStatus[platformId].loading = loading;
    },

    // 添加活跃会话
    addActiveSession: (state, action) => {
      const { platformId, sessionId, sessionData } = action.payload;

      state.activeSessions[platformId] = {
        sessionId,
        ...sessionData,
        createdAt: new Date().toISOString()
      };
    },

    // 移除活跃会话
    removeActiveSession: (state, action) => {
      const { platformId } = action.payload;
      delete state.activeSessions[platformId];
    },

    // 更新会话使用时间
    updateSessionUsage: (state, action) => {
      const { platformId } = action.payload;

      if (state.activeSessions[platformId]) {
        state.activeSessions[platformId].lastUsedAt = new Date().toISOString();
      }
    },

    // 设置用户信息
    setUserInfo: (state, action) => {
      const { platformId, userInfo } = action.payload;
      state.users[platformId] = {
        ...userInfo,
        updatedAt: new Date().toISOString()
      };
    },

    // 清除平台登录信息
    clearPlatformAuth: (state, action) => {
      const { platformId } = action.payload;
      delete state.loginStatus[platformId];
      delete state.activeSessions[platformId];
      delete state.users[platformId];
    },

    // 清除所有认证信息
    clearAllAuth: (state) => {
      state.loginStatus = {};
      state.activeSessions = {};
      state.users = {};
      state.loading = false;
      state.error = null;
    },

    // 设置错误信息
    setAuthError: (state, action) => {
      const { platformId, error } = action.payload;
      state.error = {
        platformId,
        message: error,
        timestamp: new Date().toISOString()
      };
    },

    // 清除错误信息
    clearAuthError: (state) => {
      state.error = null;
    },

    // 刷新登录状态
    refreshLoginStatus: (state, action) => {
      const { platformId } = action.payload;

      if (state.loginStatus[platformId]) {
        state.loginStatus[platformId].lastChecked = new Date().toISOString();
      }
    }
  }
});

// 导出action creators
export const {
  updateLoginStatus,
  setLoginLoading,
  addActiveSession,
  removeActiveSession,
  updateSessionUsage,
  setUserInfo,
  clearPlatformAuth,
  clearAllAuth,
  setAuthError,
  clearAuthError,
  refreshLoginStatus
} = authSlice.actions;

// 选择器函数
export const selectLoginStatus = (state) => state.auth.loginStatus;
export const selectActiveSessions = (state) => state.auth.activeSessions;
export const selectUsers = (state) => state.auth.users;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

// 按平台选择状态
export const selectPlatformLoginStatus = (platformId) => (state) =>
  state.auth.loginStatus[platformId];

export const selectPlatformActiveSession = (platformId) => (state) =>
  state.auth.activeSessions[platformId];

export const selectPlatformUserInfo = (platformId) => (state) =>
  state.auth.users[platformId];

// 检查平台是否已登录
export const selectIsPlatformLoggedIn = (platformId) => (state) => {
  const status = state.auth.loginStatus[platformId];
  return status && status.status === 'success';
};

// 检查平台是否正在登录
export const selectIsPlatformLoggingIn = (platformId) => (state) => {
  const status = state.auth.loginStatus[platformId];
  return status && (status.loading || status.status === 'waiting' || status.status === 'scanned');
};

// 获取平台登录状态文本
export const selectPlatformStatusText = (platformId) => (state) => {
  const status = state.auth.loginStatus[platformId];
  return status ? status.message : '未登录';
};

// 获取所有已登录的平台
export const selectLoggedInPlatforms = (state) => {
  const loginStatus = state.auth.loginStatus;
  return Object.keys(loginStatus).filter(platformId =>
    loginStatus[platformId].status === 'success'
  );
};

// 默认导出reducer
export default authSlice.reducer;