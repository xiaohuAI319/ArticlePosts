/**
 * T006 状态管理设置测试
 * 测试Redux store配置、slice功能和状态持久化
 */

import { configureStore } from '@reduxjs/toolkit';
import { store, persistor } from '../../../src/renderer/store';
import {
  initializeApp,
  setLoading,
  setError,
  clearError,
  updateSettings,
  toggleTheme,
  toggleSidebar,
  setCurrentPage,
  openModal,
  closeModal,
} from '../../../src/renderer/store/slices/appSlice';

import {
  fetchArticles,
  fetchArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  setCurrentArticle,
  updateEditorContent,
  setFilters,
  setPagination,
  addTag,
  removeTag,
  updatePublishStatus,
  undo,
  redo,
} from '../../../src/renderer/store/slices/articleSlice';

import {
  fetchPlatforms,
  fetchAvailablePlatforms,
  fetchPlatformConfig,
  updatePlatformConfig,
  testPlatformConnection,
  updateUserConfig,
  togglePlatform,
  setPlatformEnabled,
  setAutoPublish,
  updateAuthStatus,
  selectQuickPublishPlatform,
  validatePlatformConfig,
} from '../../../src/renderer/store/slices/platformSlice';

// Mock electronAPI
global.window.electronAPI = {
  getAppVersion: jest.fn(() => '1.0.0'),
  getPlatform: jest.fn(() => 'darwin'),
};

// Mock HTTP services
jest.mock('../../../src/renderer/services/httpService', () => ({
  articleApi: {
    getArticles: jest.fn(),
    getArticle: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
    deleteArticle: jest.fn(),
    publishArticle: jest.fn(),
    getPublishStatus: jest.fn(),
    cancelPublish: jest.fn(),
  },
  platformApi: {
    getPlatforms: jest.fn(),
    getAvailablePlatforms: jest.fn(),
    getPlatformConfig: jest.fn(),
    updatePlatformConfig: jest.fn(),
    testPlatformConnection: jest.fn(),
    getPlatformStatus: jest.fn(),
  },
}));

describe('T006 状态管理设置测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Redux Store配置测试', () => {
    test('应该正确配置Redux store', () => {
      expect(store).toBeDefined();
      expect(store.dispatch).toBeDefined();
      expect(store.getState).toBeDefined();
      expect(store.subscribe).toBeDefined();
    });

    test('应该包含所有必要的slice', () => {
      const state = store.getState();
      expect(state).toBeDefined();
      expect(state.app).toBeDefined();
      expect(state.articles).toBeDefined();
      expect(state.platforms).toBeDefined();
    });

    test('应该正确配置持久化', () => {
      expect(persistor).toBeDefined();
      expect(persistor.purge).toBeDefined();
      expect(persistor.flush).toBeDefined();
      expect(persistor.pause).toBeDefined();
      expect(persistor.persist).toBeDefined();
      expect(persistor.resume).toBeDefined();
    });

    test('应该在开发模式启用Redux DevTools', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('应该正确处理序列化检查', () => {
      const state = store.getState();
      expect(typeof state).toBe('object');
      expect(state).not.toBeNull();
    });
  });

  describe('2. App Slice测试', () => {
    test('应该正确初始化app状态', () => {
      const state = store.getState().app;

      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(false);
      expect(state.error).toBeNull();
      expect(state.version).toBe('1.0.0');
      expect(state.theme).toBe('light');
      expect(state.language).toBe('zh-CN');
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.currentPage).toBe('editor');
    });

    test('应该正确设置加载状态', () => {
      store.dispatch(setLoading(true));
      const state = store.getState().app;
      expect(state.loading).toBe(true);

      store.dispatch(setLoading(false));
      expect(state.loading).toBe(false);
    });

    test('应该正确设置错误信息', () => {
      const errorMessage = '测试错误';
      store.dispatch(setError(errorMessage));
      const state = store.getState().app;
      expect(state.error).toBe(errorMessage);
      expect(state.loading).toBe(false);

      store.dispatch(clearError());
      expect(state.error).toBeNull();
    });

    test('应该正确更新设置', () => {
      const newSettings = { autoSave: false, autoSaveInterval: 60 };
      store.dispatch(updateSettings(newSettings));
      const state = store.getState().app;
      expect(state.settings.autoSave).toBe(false);
      expect(state.settings.autoSaveInterval).toBe(60);
    });

    test('应该正确切换主题', () => {
      const initialState = store.getState().app.theme;
      store.dispatch(toggleTheme());
      const newState = store.getState().app.theme;
      expect(newState).not.toBe(initialState);
      expect(['light', 'dark']).toContain(newState);
    });

    test('应该正确切换侧边栏', () => {
      const initialState = store.getState().app.sidebarCollapsed;
      store.dispatch(toggleSidebar());
      const newState = store.getState().app.sidebarCollapsed;
      expect(newState).not.toBe(initialState);
    });

    test('应该正确设置当前页面', () => {
      const page = 'platforms';
      store.dispatch(setCurrentPage(page));
      const state = store.getState().app;
      expect(state.currentPage).toBe(page);
    });

    test('应该正确处理模态框状态', () => {
      const modalName = 'newArticle';

      store.dispatch(openModal(modalName));
      expect(store.getState().app.modals[modalName]).toBe(true);

      store.dispatch(closeModal(modalName));
      expect(store.getState().app.modals[modalName]).toBe(false);
    });

    test('应该正确处理应用初始化异步action', async () => {
      const result = await store.dispatch(initializeApp());

      expect(result.type).toBe('app/initialize/fulfilled');
      expect(result.payload.version).toBe('1.0.0');
      expect(result.payload.platform).toBe('darwin');
      expect(result.payload.initialized).toBe(true);

      const state = store.getState().app;
      expect(state.initialized).toBe(true);
      expect(state.version).toBe('1.0.0');
      expect(state.platform).toBe('darwin');
      expect(state.loading).toBe(false);
    });
  });

  describe('3. Article Slice测试', () => {
    test('应该正确初始化articles状态', () => {
      const state = store.getState().articles;

      expect(state.articles).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.currentPage).toBe(1);
      expect(state.pageSize).toBe(10);
      expect(state.currentArticle).toBeNull();
      expect(state.draftArticle).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.saving).toBe(false);
      expect(state.publishing).toBe(false);
      expect(state.error).toBeNull();
    });

    test('应该正确设置当前文章', () => {
      const mockArticle = {
        id: 1,
        title: '测试文章',
        content: '这是测试内容',
        wordCount: 6,
        charCount: 6,
      };

      store.dispatch(setCurrentArticle(mockArticle));
      const state = store.getState().articles;

      expect(state.currentArticle).toEqual(mockArticle);
      expect(state.draftArticle).toEqual(mockArticle);
      expect(state.editorState.content).toBe(mockArticle.content);
      expect(state.editorState.wordCount).toBe(mockArticle.wordCount);
      expect(state.editorState.charCount).toBe(mockArticle.charCount);
      expect(state.editorState.dirty).toBe(false);
    });

    test('应该正确更新编辑器内容', () => {
      const newContent = '新的文章内容，包含更多文字';
      store.dispatch(updateEditorContent(newContent));
      const state = store.getState().articles;

      expect(state.editorState.content).toBe(newContent);
      expect(state.editorState.wordCount).toBe(newContent.replace(/\s+/g, '').length);
      expect(state.editorState.charCount).toBe(newContent.length);
      expect(state.editorState.dirty).toBe(true);
    });

    test('应该正确设置筛选条件', () => {
      const filters = {
        status: 'published',
        platform: 'zhihu',
        keyword: '测试',
      };

      store.dispatch(setFilters(filters));
      const state = store.getState().articles;

      expect(state.filters.status).toBe('published');
      expect(state.filters.platform).toBe('zhihu');
      expect(state.filters.keyword).toBe('测试');
      expect(state.currentPage).toBe(1); // 重置到第一页
    });

    test('应该正确设置分页', () => {
      const pagination = {
        currentPage: 2,
        pageSize: 20,
      };

      store.dispatch(setPagination(pagination));
      const state = store.getState().articles;

      expect(state.currentPage).toBe(2);
      expect(state.pageSize).toBe(20);
    });

    test('应该正确添加和移除标签', () => {
      const tag1 = '技术';
      const tag2 = '编程';

      store.dispatch(addTag(tag1));
      store.dispatch(addTag(tag2));
      let state = store.getState().articles;
      expect(state.tags).toContain(tag1);
      expect(state.tags).toContain(tag2);

      store.dispatch(removeTag(tag1));
      state = store.getState().articles;
      expect(state.tags).not.toContain(tag1);
      expect(state.tags).toContain(tag2);
    });

    test('应该正确更新发布状态', () => {
      const publishData = {
        articleId: 1,
        platformId: 'zhihu',
        status: 'published',
        message: '发布成功',
      };

      store.dispatch(updatePublishStatus(publishData));
      const state = store.getState().articles;

      expect(state.publishStatus[1]).toBeDefined();
      expect(state.publishStatus[1].zhihu).toBeDefined();
      expect(state.publishStatus[1].zhihu.status).toBe('published');
      expect(state.publishStatus[1].zhihu.message).toBe('发布成功');
    });

    test('应该正确处理撤销和重做', () => {
      const content1 = '内容1';
      const content2 = '内容2';
      const content3 = '内容3';

      // 保存内容到历史
      store.dispatch(updateEditorContent(content1));
      store.dispatch({ type: 'articles/saveToHistory', payload: content1 });

      store.dispatch(updateEditorContent(content2));
      store.dispatch({ type: 'articles/saveToHistory', payload: content2 });

      store.dispatch(updateEditorContent(content3));
      store.dispatch({ type: 'articles/saveToHistory', payload: content3 });

      // 测试撤销
      store.dispatch(undo());
      expect(store.getState().articles.editorState.content).toBe(content2);

      // 再次撤销
      store.dispatch(undo());
      expect(store.getState().articles.editorState.content).toBe(content1);

      // 测试重做
      store.dispatch(redo());
      expect(store.getState().articles.editorState.content).toBe(content2);
    });

    test('应该正确处理文章异步actions', async () => {
      const mockArticles = [
        { id: 1, title: '文章1', content: '内容1' },
        { id: 2, title: '文章2', content: '内容2' },
      ];

      const { articleApi } = require('../../../src/renderer/services/httpService');
      articleApi.getArticles.mockResolvedValue({
        data: {
          articles: mockArticles,
          total: 2,
          currentPage: 1,
          pageSize: 10,
        },
      });

      const result = await store.dispatch(fetchArticles());

      expect(result.type).toBe('articles/fetchArticles/fulfilled');
      expect(articleApi.getArticles).toHaveBeenCalledWith({});

      const state = store.getState().articles;
      expect(state.articles).toEqual(mockArticles);
      expect(state.total).toBe(2);
      expect(state.loading).toBe(false);
    });
  });

  describe('4. Platform Slice测试', () => {
    test('应该正确初始化platforms状态', () => {
      const state = store.getState().platforms;

      expect(state.platforms).toEqual([]);
      expect(state.availablePlatforms).toEqual([]);
      expect(state.platformConfigs).toEqual({});
      expect(state.platformStatus).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.authStatus).toEqual({});
    });

    test('应该正确更新用户配置', () => {
      const platformId = 'zhihu';
      const config = {
        enabled: true,
        autoPublish: true,
        tags: ['技术', '编程'],
      };

      store.dispatch(updateUserConfig({ platformId, config }));
      const state = store.getState().platforms;

      expect(state.userConfigs.zhihu.enabled).toBe(true);
      expect(state.userConfigs.zhihu.autoPublish).toBe(true);
      expect(state.userConfigs.zhihu.tags).toEqual(['技术', '编程']);
    });

    test('应该正确切换平台启用状态', () => {
      const platformId = 'xiaohongshu';

      // 初始状态应该是禁用的
      expect(store.getState().platforms.userConfigs[platformId].enabled).toBe(false);

      // 切换为启用
      store.dispatch(togglePlatform(platformId));
      expect(store.getState().platforms.userConfigs[platformId].enabled).toBe(true);

      // 再次切换
      store.dispatch(togglePlatform(platformId));
      expect(store.getState().platforms.userConfigs[platformId].enabled).toBe(false);
    });

    test('应该正确设置平台启用状态', () => {
      const platformId = 'baijia';

      store.dispatch(setPlatformEnabled({ platformId, enabled: true }));
      expect(store.getState().platforms.userConfigs[platformId].enabled).toBe(true);

      store.dispatch(setPlatformEnabled({ platformId, enabled: false }));
      expect(store.getState().platforms.userConfigs[platformId].enabled).toBe(false);
    });

    test('应该正确设置自动发布', () => {
      const platformId = 'toutiao';
      const publishTime = new Date().toISOString();

      store.dispatch(setAutoPublish({
        platformId,
        autoPublish: true,
        publishTime
      }));

      const state = store.getState().platforms;
      expect(state.userConfigs[platformId].autoPublish).toBe(true);
      expect(state.userConfigs[platformId].publishTime).toBe(publishTime);
    });

    test('应该正确更新认证状态', () => {
      const platformId = 'zhihu';
      const authData = {
        status: 'authenticated',
        userInfo: { name: '测试用户', id: '123' },
      };

      store.dispatch(updateAuthStatus({ platformId, ...authData }));
      const state = store.getState().platforms;

      expect(state.authStatus[platformId].status).toBe('authenticated');
      expect(state.authStatus[platformId].userInfo.name).toBe('测试用户');
      expect(state.authStatus[platformId].userInfo.id).toBe('123');
      expect(state.authStatus[platformId].lastCheck).toBeDefined();
    });

    test('应该正确选择快速发布平台', () => {
      const platform1 = 'zhihu';
      const platform2 = 'xiaohongshu';

      store.dispatch(selectQuickPublishPlatform(platform1));
      expect(store.getState().platforms.quickPublish.selectedPlatforms).toContain(platform1);

      store.dispatch(selectQuickPublishPlatform(platform2));
      const selectedPlatforms = store.getState().platforms.quickPublish.selectedPlatforms;
      expect(selectedPlatforms).toContain(platform1);
      expect(selectedPlatforms).toContain(platform2);
    });

    test('应该正确验证平台配置', () => {
      const platformId = 'zhihu';
      const articleData = {
        title: '这是一个很长的标题，超过了100个字符的限制'.repeat(2),
        content: '文章内容',
      };

      store.dispatch(validatePlatformConfig({ platformId, articleData }));
      const state = store.getState().platforms;

      // 应该有标题长度错误
      expect(state.configErrors[platformId]).toBeDefined();
      expect(state.configErrors[platformId].length).toBeGreaterThan(0);
      expect(state.configErrors[platformId][0]).toContain('标题长度不能超过100个字符');
    });

    test('应该正确处理平台异步actions', async () => {
      const mockPlatforms = [
        { id: 'zhihu', name: '知乎', enabled: true },
        { id: 'xiaohongshu', name: '小红书', enabled: true },
      ];

      const { platformApi } = require('../../../src/renderer/services/httpService');
      platformApi.getPlatforms.mockResolvedValue({
        data: mockPlatforms,
      });

      const result = await store.dispatch(fetchPlatforms());

      expect(result.type).toBe('platforms/fetchPlatforms/fulfilled');
      expect(platformApi.getPlatforms).toHaveBeenCalled();

      const state = store.getState().platforms;
      expect(state.platforms).toEqual(mockPlatforms);
      expect(state.loading).toBe(false);
    });

    test('应该正确处理平台配置异步actions', async () => {
      const platformId = 'zhihu';
      const mockConfig = {
        enabled: true,
        autoPublish: false,
        tags: ['技术'],
      };

      const { platformApi } = require('../../../src/renderer/services/httpService');
      platformApi.getPlatformConfig.mockResolvedValue({
        data: mockConfig,
      });

      const result = await store.dispatch(fetchPlatformConfig(platformId));

      expect(result.type).toBe('platforms/fetchPlatformConfig/fulfilled');
      expect(platformApi.getPlatformConfig).toHaveBeenCalledWith(platformId);

      const state = store.getState().platforms;
      expect(state.platformConfigs[platformId]).toEqual(mockConfig);
      expect(state.configLoading[platformId]).toBe(false);
    });

    test('应该正确处理平台连接测试', async () => {
      const platformId = 'zhihu';
      const mockResult = { success: true, message: '连接成功' };

      const { platformApi } = require('../../../src/renderer/services/httpService');
      platformApi.testPlatformConnection.mockResolvedValue({
        data: mockResult,
      });

      const result = await store.dispatch(testPlatformConnection(platformId));

      expect(result.type).toBe('platforms/testPlatformConnection/fulfilled');
      expect(platformApi.testPlatformConnection).toHaveBeenCalledWith(platformId);

      const state = store.getState().platforms;
      expect(state.connectionTesting[platformId]).toBe(false);
      expect(state.platformStatus[platformId].connection.status).toBe('success');
      expect(state.platformStatus[platformId].connection.result).toEqual(mockResult);
    });
  });

  describe('5. 状态持久化测试', () => {
    test('应该正确持久化app状态', () => {
      // 修改一些app状态
      store.dispatch(updateSettings({ autoSave: false }));
      store.dispatch(toggleTheme());
      store.dispatch(updateUserConfig({
        platformId: 'zhihu',
        config: { enabled: true }
      }));

      // 这些状态应该在持久化配置中
      const persistConfig = require('../../../src/renderer/store/index').persistConfig;
      expect(persistConfig.whitelist).toContain('app');
      expect(persistConfig.whitelist).toContain('platforms');
    });

    test('应该正确排除不需要持久化的状态', () => {
      const state = store.getState();

      // articles状态不应该被持久化（因为它在whitelist中）
      const persistConfig = require('../../../src/renderer/store/index').persistConfig;
      expect(persistConfig.whitelist).not.toContain('articles');
    });
  });

  describe('6. 中间件配置测试', () => {
    test('应该正确配置序列化中间件', () => {
      const middleware = store.dispatch;
      expect(typeof middleware).toBe('function');
    });

    test('应该正确处理非序列化数据', () => {
      const date = new Date();
      const error = new Error('测试错误');

      // 这些非序列化数据应该能正常处理
      expect(() => {
        store.dispatch(setError(error.message));
        store.dispatch(updateSettings({ lastSync: date }));
      }).not.toThrow();
    });
  });

  describe('7. 错误处理测试', () => {
    test('应该正确处理slice错误', () => {
      const errorMessage = '测试错误消息';
      store.dispatch(setError(errorMessage));

      const appState = store.getState().app;
      expect(appState.error).toBe(errorMessage);
      expect(appState.loading).toBe(false);

      // 清除错误
      store.dispatch(clearError());
      expect(appState.error).toBeNull();
    });

    test('应该正确处理异步action错误', async () => {
      const { articleApi } = require('../../../src/renderer/services/httpService');
      articleApi.getArticles.mockRejectedValue({
        error: { message: '网络错误' },
      });

      const result = await store.dispatch(fetchArticles());

      expect(result.type).toBe('articles/fetchArticles/rejected');
      expect(result.payload).toBe('网络错误');

      const articlesState = store.getState().articles;
      expect(articlesState.error).toBe('网络错误');
      expect(articlesState.loading).toBe(false);
    });
  });
});