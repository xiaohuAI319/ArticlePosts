/**
 * Redux Store 测试
 */

// 模拟浏览器环境
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('Redux Store', () => {
  let store;

  beforeEach(() => {
    // 重置localStorage模拟
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    // 动态导入store
    const { configureStore } = require('../../../src/renderer/store');
    store = configureStore();
  });

  describe('Store 初始化', () => {
    test('应该正确创建store', () => {
      expect(store).toBeDefined();
      expect(store.dispatch).toBeDefined();
      expect(store.getState).toBeDefined();
      expect(store.subscribe).toBeDefined();
    });

    test('应该包含所有必要的slice', () => {
      const state = store.getState();

      expect(state.app).toBeDefined();
      expect(state.articles).toBeDefined();
      expect(state.platforms).toBeDefined();
      expect(state.publish).toBeDefined();
    });

    test('应该设置初始状态', () => {
      const state = store.getState();

      // app slice初始状态
      expect(state.app.isLoading).toBe(false);
      expect(state.app.error).toBeNull();
      expect(state.app.version).toBeDefined();

      // articles slice初始状态
      expect(state.articles.items).toEqual([]);
      expect(state.articles.currentArticle).toBeNull();
      expect(state.articles.isLoading).toBe(false);
      expect(state.articles.error).toBeNull();

      // platforms slice初始状态
      expect(state.platforms.items).toEqual([]);
      expect(state.platforms.activePlatforms).toEqual([]);
      expect(state.platforms.isLoading).toBe(false);
      expect(state.platforms.error).toBeNull();

      // publish slice初始状态
      expect(state.publish.isPublishing).toBe(false);
      expect(state.publish.currentTask).toBeNull();
      expect(state.publish.history).toEqual([]);
      expect(state.publish.error).toBeNull();
    });
  });

  describe('App Slice', () => {
    test('应该处理loading状态变化', () => {
      const { setLoading } = require('../../../src/renderer/store/slices/appSlice');

      store.dispatch(setLoading(true));
      expect(store.getState().app.isLoading).toBe(true);

      store.dispatch(setLoading(false));
      expect(store.getState().app.isLoading).toBe(false);
    });

    test('应该处理错误状态', () => {
      const { setError, clearError } = require('../../../src/renderer/store/slices/appSlice');

      const errorMessage = '测试错误';
      store.dispatch(setError(errorMessage));
      expect(store.getState().app.error).toBe(errorMessage);

      store.dispatch(clearError());
      expect(store.getState().app.error).toBeNull();
    });

    test('应该设置应用信息', () => {
      const { setAppInfo } = require('../../../src/renderer/store/slices/appSlice');

      const appInfo = {
        version: '1.0.0',
        platform: 'win32',
        userDataPath: '/mock/path'
      };

      store.dispatch(setAppInfo(appInfo));
      const state = store.getState().app;
      expect(state.version).toBe(appInfo.version);
      expect(state.platform).toBe(appInfo.platform);
      expect(state.userDataPath).toBe(appInfo.userDataPath);
    });
  });

  describe('Articles Slice', () => {
    test('应该设置文章列表', () => {
      const { setArticles } = require('../../../src/renderer/store/slices/articlesSlice');

      const articles = [
        { id: 1, title: '文章1', content: '内容1' },
        { id: 2, title: '文章2', content: '内容2' }
      ];

      store.dispatch(setArticles(articles));
      expect(store.getState().articles.items).toEqual(articles);
    });

    test('应该添加文章', () => {
      const { addArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      const article = { id: 1, title: '新文章', content: '新内容' };
      store.dispatch(addArticle(article));

      const state = store.getState().articles;
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual(article);
    });

    test('应该更新文章', () => {
      const { setArticles, updateArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      // 先添加一篇文章
      const article = { id: 1, title: '原标题', content: '原内容' };
      store.dispatch(setArticles([article]));

      // 更新文章
      const updatedData = { title: '更新标题' };
      store.dispatch(updateArticle({ id: 1, data: updatedData }));

      const state = store.getState().articles;
      expect(state.items[0].title).toBe(updatedData.title);
      expect(state.items[0].content).toBe(article.content); // 其他字段保持不变
    });

    test('应该删除文章', () => {
      const { setArticles, removeArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      // 先添加文章
      const articles = [
        { id: 1, title: '文章1' },
        { id: 2, title: '文章2' }
      ];
      store.dispatch(setArticles(articles));

      // 删除文章
      store.dispatch(removeArticle(1));

      const state = store.getState().articles;
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe(2);
    });

    test('应该设置当前文章', () => {
      const { setCurrentArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      const article = { id: 1, title: '当前文章' };
      store.dispatch(setCurrentArticle(article));

      expect(store.getState().articles.currentArticle).toEqual(article);
    });

    test('应该清除当前文章', () => {
      const { setCurrentArticle, clearCurrentArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      const article = { id: 1, title: '当前文章' };
      store.dispatch(setCurrentArticle(article));
      store.dispatch(clearCurrentArticle());

      expect(store.getState().articles.currentArticle).toBeNull();
    });

    test('应该处理loading和错误状态', () => {
      const { setLoading, setError, clearError } = require('../../../src/renderer/store/slices/articlesSlice');

      store.dispatch(setLoading(true));
      expect(store.getState().articles.isLoading).toBe(true);

      store.dispatch(setError('加载失败'));
      expect(store.getState().articles.error).toBe('加载失败');

      store.dispatch(clearError());
      expect(store.getState().articles.error).toBeNull();
    });
  });

  describe('Platforms Slice', () => {
    test('应该设置平台列表', () => {
      const { setPlatforms } = require('../../../src/renderer/store/slices/platformsSlice');

      const platforms = [
        { id: 1, name: '知乎', platform_code: 'zhihu', is_active: true },
        { id: 2, name: '微信公众号', platform_code: 'wechat', is_active: false }
      ];

      store.dispatch(setPlatforms(platforms));
      expect(store.getState().platforms.items).toEqual(platforms);
    });

    test('应该设置活跃平台', () => {
      const { setActivePlatforms } = require('../../../src/renderer/store/slices/platformsSlice');

      const activePlatforms = [
        { id: 1, name: '知乎', platform_code: 'zhihu', is_active: true }
      ];

      store.dispatch(setActivePlatforms(activePlatforms));
      expect(store.getState().platforms.activePlatforms).toEqual(activePlatforms);
    });

    test('应该添加平台', () => {
      const { addPlatform } = require('../../../src/renderer/store/slices/platformsSlice');

      const platform = { id: 1, name: '新平台', platform_code: 'new_platform' };
      store.dispatch(addPlatform(platform));

      const state = store.getState().platforms;
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual(platform);
    });

    test('应该更新平台', () => {
      const { setPlatforms, updatePlatform } = require('../../../src/renderer/store/slices/platformsSlice');

      // 先添加平台
      const platform = { id: 1, name: '原平台', is_active: false };
      store.dispatch(setPlatforms([platform]));

      // 更新平台
      const updatedData = { name: '更新平台', is_active: true };
      store.dispatch(updatePlatform({ id: 1, data: updatedData }));

      const state = store.getState().platforms;
      expect(state.items[0].name).toBe(updatedData.name);
      expect(state.items[0].is_active).toBe(updatedData.is_active);
    });

    test('应该删除平台', () => {
      const { setPlatforms, removePlatform } = require('../../../src/renderer/store/slices/platformsSlice');

      const platforms = [
        { id: 1, name: '平台1' },
        { id: 2, name: '平台2' }
      ];
      store.dispatch(setPlatforms(platforms));

      store.dispatch(removePlatform(1));

      const state = store.getState().platforms;
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe(2);
    });

    test('应该处理loading和错误状态', () => {
      const { setLoading, setError, clearError } = require('../../../src/renderer/store/slices/platformsSlice');

      store.dispatch(setLoading(true));
      expect(store.getState().platforms.isLoading).toBe(true);

      store.dispatch(setError('平台加载失败'));
      expect(store.getState().platforms.error).toBe('平台加载失败');

      store.dispatch(clearError());
      expect(store.getState().platforms.error).toBeNull();
    });
  });

  describe('Publish Slice', () => {
    test('应该设置发布状态', () => {
      const { setPublishing } = require('../../../src/renderer/store/slices/publishSlice');

      store.dispatch(setPublishing(true));
      expect(store.getState().publish.isPublishing).toBe(true);

      store.dispatch(setPublishing(false));
      expect(store.getState().publish.isPublishing).toBe(false);
    });

    test('应该设置当前任务', () => {
      const { setCurrentTask } = require('../../../src/renderer/store/slices/publishSlice');

      const task = {
        id: 1,
        articleId: 1,
        platformId: 1,
        status: 'pending'
      };

      store.dispatch(setCurrentTask(task));
      expect(store.getState().publish.currentTask).toEqual(task);
    });

    test('应该添加发布历史', () => {
      const { addPublishHistory } = require('../../../src/renderer/store/slices/publishSlice');

      const historyItem = {
        id: 1,
        articleId: 1,
        platformId: 1,
        status: 'success',
        publishedAt: new Date().toISOString()
      };

      store.dispatch(addPublishHistory(historyItem));
      const state = store.getState().publish;
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toEqual(historyItem);
    });

    test('应该清除发布历史', () => {
      const { addPublishHistory, clearHistory } = require('../../../src/renderer/store/slices/publishSlice');

      const historyItem = {
        id: 1,
        articleId: 1,
        platformId: 1,
        status: 'success'
      };

      store.dispatch(addPublishHistory(historyItem));
      store.dispatch(clearHistory());

      expect(store.getState().publish.history).toEqual([]);
    });

    test('应该处理错误状态', () => {
      const { setError, clearError } = require('../../../src/renderer/store/slices/publishSlice');

      store.dispatch(setError('发布失败'));
      expect(store.getState().publish.error).toBe('发布失败');

      store.dispatch(clearError());
      expect(store.getState().publish.error).toBeNull();
    });
  });

  describe('Store 持久化', () => {
    test('应该正确配置持久化', () => {
      // 这个测试验证store是否正确配置了持久化
      // 实际的持久化测试需要模拟localStorage

      const { persistConfig } = require('../../../src/renderer/store');

      expect(persistConfig).toBeDefined();
      expect(persistConfig.key).toBe('root');
      expect(persistConfig.storage).toBeDefined();
    });

    test('应该持久化特定slice', () => {
      const { persistConfig } = require('../../../src/renderer/store');

      // 验证只持久化必要的slice
      expect(persistConfig.whitelist).toContain('articles');
      expect(persistConfig.whitelist).toContain('platforms');
      // app slice可能不需要持久化（loading状态等）
    });
  });

  describe('Store 中间件', () => {
    test('应该配置正确的中间件', () => {
      const storeConfig = require('../../../src/renderer/store');

      // 验证store配置包含中间件
      expect(storeConfig.middleware).toBeDefined();
    });

    test('应该处理异步操作', () => {
      // 这个测试验证Redux Thunk中间件是否正确工作
      const thunk = (dispatch, getState) => {
        expect(dispatch).toBeDefined();
        expect(getState).toBeDefined();
        return 'thunk result';
      };

      const result = store.dispatch(thunk);
      expect(result).toBe('thunk result');
    });
  });

  describe('Store 选择器', () => {
    test('应该提供正确的选择器', () => {
      const state = store.getState();

      // 验证各slice的选择器
      expect(state.app).toBeDefined();
      expect(state.articles).toBeDefined();
      expect(state.platforms).toBeDefined();
      expect(state.publish).toBeDefined();

      // 验证初始状态
      expect(state.app.isLoading).toBe(false);
      expect(state.articles.items).toEqual([]);
      expect(state.platforms.items).toEqual([]);
      expect(state.publish.isPublishing).toBe(false);
    });

    test('应该正确获取嵌套状态', () => {
      // 测试获取嵌套状态的能力
      const articlesSlice = store.getState().articles;

      expect(articlesSlice.items).toBeDefined();
      expect(articlesSlice.currentArticle).toBeDefined();
      expect(articlesSlice.isLoading).toBeDefined();
      expect(articlesSlice.error).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的action', () => {
      // store应该能处理无效的action而不崩溃
      expect(() => {
        store.dispatch({ type: 'INVALID_ACTION' });
      }).not.toThrow();
    });

    test('应该处理action payload错误', () => {
      const { addArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      // store应该能处理无效的payload
      expect(() => {
        store.dispatch(addArticle(null));
      }).not.toThrow();
    });
  });

  describe('性能测试', () => {
    test('应该高效处理大量数据', () => {
      const { setArticles } = require('../../../src/renderer/store/slices/articlesSlice');

      // 创建大量文章数据
      const largeArticleList = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        title: `文章 ${index + 1}`,
        content: `内容 ${index + 1}`
      }));

      const startTime = performance.now();
      store.dispatch(setArticles(largeArticleList));
      const endTime = performance.now();

      // 操作应该在合理时间内完成（< 100ms）
      expect(endTime - startTime).toBeLessThan(100);
      expect(store.getState().articles.items).toHaveLength(1000);
    });

    test('应该高效处理频繁更新', () => {
      const { updateArticle } = require('../../../src/renderer/store/slices/articlesSlice');

      // 先添加一些文章
      const articles = Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        title: `文章 ${index + 1}`,
        content: `内容 ${index + 1}`
      }));

      store.dispatch(require('../../../src/renderer/store/slices/articlesSlice').setArticles(articles));

      const startTime = performance.now();

      // 快速更新多篇文章
      for (let i = 1; i <= 10; i++) {
        store.dispatch(updateArticle({
          id: i,
          data: { title: `更新标题 ${i}` }
        }));
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);

      // 验证更新是否成功
      const state = store.getState().articles;
      for (let i = 1; i <= 10; i++) {
        const article = state.items.find(a => a.id === i);
        expect(article.title).toBe(`更新标题 ${i}`);
      }
    });
  });
});