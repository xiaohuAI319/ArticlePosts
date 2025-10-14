/**
 * T003 IPC通信测试
 * 测试主进程和渲染进程之间的IPC通信功能
 */

const { ipcMain } = require('electron');
const path = require('path');

// Mock Electron模块
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
}));

describe('T003 IPC通信测试', () => {
  let mockEvent;
  let preloadModule;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock IPC事件对象
    mockEvent = {
      sender: {
        id: 1
      }
    };

    // 创建模拟的contextBridge
    global.contextBridge = {
      exposeInMainWorld: jest.fn()
    };

    // 创建模拟的ipcRenderer
    global.ipcRenderer = {
      invoke: jest.fn(),
      on: jest.fn(),
      send: jest.fn(),
      removeAllListeners: jest.fn()
    };
  });

  describe('1. Preload脚本API暴露', () => {
    test('应该暴露electronAPI到渲染进程', () => {
      // 加载preload模块
      require('../../../src/main/preload.js');

      // 验证contextBridge.exposeInMainWorld被调用
      expect(global.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      );
    });

    test('应该暴露应用信息API', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证应用信息API
      expect(electronAPI.getAppVersion).toBeDefined();
      expect(electronAPI.getPlatform).toBeDefined();
      expect(typeof electronAPI.getAppVersion).toBe('function');
      expect(typeof electronAPI.getPlatform).toBe('function');
    });

    test('应该暴露数据库相关API', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证数据库API
      expect(electronAPI.database).toBeDefined();
      expect(electronAPI.database.getStats).toBeDefined();
      expect(electronAPI.database.checkHealth).toBeDefined();
      expect(typeof electronAPI.database.getStats).toBe('function');
      expect(typeof electronAPI.database.checkHealth).toBe('function');
    });

    test('应该暴露文章相关API', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证文章API
      expect(electronAPI.articles).toBeDefined();
      expect(electronAPI.articles.create).toBeDefined();
      expect(electronAPI.articles.findAll).toBeDefined();
      expect(electronAPI.articles.findById).toBeDefined();
      expect(electronAPI.articles.update).toBeDefined();
      expect(electronAPI.articles.delete).toBeDefined();
    });

    test('应该暴露平台相关API', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证平台API
      expect(electronAPI.platforms).toBeDefined();
      expect(electronAPI.platforms.findAll).toBeDefined();
      expect(electronAPI.platforms.getAvailable).toBeDefined();
    });

    test('应该暴露菜单事件监听API', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证菜单事件API
      expect(electronAPI.onMenuAction).toBeDefined();
      expect(electronAPI.sendMessage).toBeDefined();
      expect(electronAPI.onMessage).toBeDefined();
      expect(electronAPI.removeAllListeners).toBeDefined();
    });
  });

  describe('2. 主进程IPC处理器', () => {
    test('应该注册应用信息处理器', async () => {
      const { ipcMain } = require('electron');

      // 加载主进程模块
      const mainProcess = require('../../../src/main/index.js');

      // 验证app-version处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('app-version', expect.any(Function));

      // 验证platform处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('platform', expect.any(Function));

      // 测试处理器功能
      const appVersionHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'app-version'
      )[1];

      const platformHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'platform'
      )[1];

      // Mock app.getVersion
      const { app } = require('electron');
      app.getVersion.mockReturnValue('1.0.0');

      // 测试处理器返回值
      const version = await appVersionHandler(mockEvent);
      expect(version).toBe('1.0.0');

      // Mock process.platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const platform = await platformHandler(mockEvent);
      expect(platform).toBe('darwin');

      // 恢复原始platform值
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    test('应该注册数据库处理器', async () => {
      const { ipcMain } = require('electron');

      // 加载主进程模块
      require('../../../src/main/index.js');

      // 验证数据库处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('db:stats', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('db:health', expect.any(Function));
    });

    test('应该注册文章CRUD处理器', async () => {
      const { ipcMain } = require('electron');

      // 加载主进程模块
      require('../../../src/main/index.js');

      // 验证文章处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findById', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:update', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:delete', expect.any(Function));
    });

    test('应该注册平台处理器', async () => {
      const { ipcMain } = require('electron');

      // 加载主进程模块
      require('../../../src/main/index.js');

      // 验证平台处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:getAvailable', expect.any(Function));
    });
  });

  describe('3. 菜单事件IPC通信', () => {
    test('应该注册菜单事件监听器', () => {
      const { ipcMain } = require('electron');

      // 加载主进程模块
      require('../../../src/main/index.js');

      // 注意：菜单事件是通过ipcMain.on注册的，不是ipcMain.handle
      // 这里主要验证preload.js中的onMenuAction方法
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 验证onMenuAction方法
      expect(typeof electronAPI.onMenuAction).toBe('function');
    });

    test('应该正确设置菜单事件监听', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 调用onMenuAction
      const mockCallback = jest.fn();
      electronAPI.onMenuAction(mockCallback);

      // 验证ipcRenderer.on被调用
      expect(global.ipcRenderer.on).toHaveBeenCalledTimes(4); // 4个菜单事件
    });

    test('应该支持移除事件监听器', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 调用removeAllListeners
      electronAPI.removeAllListeners('test-channel');

      // 验证ipcRenderer.removeAllListeners被调用
      expect(global.ipcRenderer.removeAllListeners).toHaveBeenCalledWith('test-channel');
    });
  });

  describe('4. IPC调用验证', () => {
    test('应该正确映射API调用', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 测试数据库API调用
      const dbStatsPromise = electronAPI.database.getStats();
      expect(global.ipcRenderer.invoke).toHaveBeenCalledWith('db:stats');

      // 测试文章API调用
      const articlesListPromise = electronAPI.articles.findAll();
      expect(global.ipcRenderer.invoke).toHaveBeenCalledWith('articles:findAll', undefined);

      // 测试平台API调用
      const platformsPromise = electronAPI.platforms.getAvailable();
      expect(global.ipcRenderer.invoke).toHaveBeenCalledWith('platforms:getAvailable');
    });

    test('应该支持带参数的API调用', () => {
      require('../../../src/main/preload.js');

      const electronAPI = global.contextBridge.exposeInMainWorld.mock.calls[0][1];

      // 测试带参数的文章查询
      const articlesListPromise = electronAPI.articles.findAll({ limit: 10 });
      expect(global.ipcRenderer.invoke).toHaveBeenCalledWith('articles:findAll', { limit: 10 });

      // 测试文章更新
      const updatePromise = electronAPI.articles.update(1, { title: '新标题' });
      expect(global.ipcRenderer.invoke).toHaveBeenCalledWith('articles:update', 1, { title: '新标题' });
    });
  });

  describe('5. 开发模式调试API', () => {
    test('应该在开发模式下暴露调试API', () => {
      // 设置开发环境
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      require('../../../src/main/preload.js');

      // 验证debugAPI被暴露
      expect(global.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'debugAPI',
        expect.any(Object)
      );

      const debugAPI = global.contextBridge.exposeInMainWorld.mock.calls[1][1];

      // 验证调试API方法
      expect(debugAPI.openDevTools).toBeDefined();
      expect(debugAPI.log).toBeDefined();

      // 恢复环境变量
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('应该在生产模式下不暴露调试API', () => {
      // 设置生产环境
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      require('../../../src/main/preload.js');

      // 验证只有electronAPI被暴露
      expect(global.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);

      // 恢复环境变量
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});