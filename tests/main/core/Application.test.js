/**
 * T003 核心应用结构测试
 * 测试Electron主进程设置、React渲染进程、IPC通信和应用菜单
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 模拟Electron应用
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    getVersion: jest.fn(() => '1.0.0'),
    quit: jest.fn(),
    on: jest.fn(),
    getPath: jest.fn(() => '/mock/path')
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
    // 模拟BrowserWindow构造函数
    mockConstructor: jest.fn().mockImplementation((options) => ({
      loadURL: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      webContents: {
        on: jest.fn(),
        send: jest.fn(),
        openDevTools: jest.fn()
      },
      show: jest.fn(),
      close: jest.fn()
    }))
  },
  Menu: {
    buildFromTemplate: jest.fn(() => ({ setApplicationMenu: jest.fn() })),
    setApplicationMenu: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
}));

// 修复BrowserWindow mock
const BrowserWindowMock = require('electron').BrowserWindow.mockConstructor;

describe('T003 核心应用结构测试', () => {
  let mainProcess;
  let mockMainWindow;

  beforeEach(() => {
    // 清除所有mock调用记录
    jest.clearAllMocks();

    // 创建模拟的主窗口
    mockMainWindow = {
      loadURL: jest.fn(),
      once: jest.fn((event, callback) => {
        if (event === 'ready-to-show') {
          setTimeout(callback, 10);
        }
      }),
      on: jest.fn(),
      webContents: {
        on: jest.fn(),
        send: jest.fn(),
        openDevTools: jest.fn()
      },
      show: jest.fn(),
      close: jest.fn()
    };

    // 模拟BrowserWindow构造函数返回我们的mock对象
    BrowserWindowMock.mockImplementation(() => mockMainWindow);
  });

  afterEach(() => {
    if (mainProcess) {
      // 清理资源
    }
  });

  describe('1. Electron主进程设置和浏览器窗口创建', () => {
    test('应该成功创建主进程模块', async () => {
      // 导入主进程模块
      mainProcess = require('../../../src/main/index.js');

      expect(mainProcess).toBeDefined();
      expect(typeof mainProcess).toBe('object');
    });

    test('应该正确配置BrowserWindow选项', async () => {
      mainProcess = require('../../../src/main/index.js');

      // 等待app.whenReady被调用
      await new Promise(resolve => setTimeout(resolve, 20));

      // 验证BrowserWindow被调用
      expect(BrowserWindowMock).toHaveBeenCalledTimes(1);

      // 获取调用参数
      const windowOptions = BrowserWindowMock.mock.calls[0][0];

      // 验证窗口配置
      expect(windowOptions.width).toBe(1200);
      expect(windowOptions.height).toBe(800);
      expect(windowOptions.minWidth).toBe(800);
      expect(windowOptions.minHeight).toBe(600);
      expect(windowOptions.webPreferences.nodeIntegration).toBe(false);
      expect(windowOptions.webPreferences.contextIsolation).toBe(true);
      expect(windowOptions.webPreferences.enableRemoteModule).toBe(false);
      expect(windowOptions.show).toBe(false);
      expect(windowOptions.titleBarStyle).toBe('default');
    });

    test('应该正确设置preload脚本路径', async () => {
      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      const windowOptions = BrowserWindowMock.mock.calls[0][0];
      const preloadPath = windowOptions.webPreferences.preload;

      expect(preloadPath).toContain('preload.js');
      expect(preloadPath).toContain('src/main');
    });

    test('应该正确加载应用URL', async () => {
      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      // 验证loadURL被调用
      expect(mockMainWindow.loadURL).toHaveBeenCalledTimes(1);

      const loadUrl = mockMainWindow.loadURL.mock.calls[0][0];

      // 在测试环境中，应该加载开发服务器URL
      expect(loadUrl).toContain('localhost:3000');
    });

    test('应该正确处理窗口生命周期事件', async () => {
      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      // 验证ready-to-show事件
      expect(mockMainWindow.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));

      // 验证closed事件
      expect(mockMainWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));

      // 验证did-fail-load事件
      expect(mockMainWindow.webContents.on).toHaveBeenCalledWith('did-fail-load', expect.any(Function));
    });
  });

  describe('2. 应用菜单和窗口管理', () => {
    test('应该创建完整的应用菜单', async () => {
      const { Menu } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      // 验证Menu.buildFromTemplate被调用
      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(1);

      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];

      // 验证菜单结构
      expect(menuTemplate).toHaveLength(4); // 文件、编辑、发布、帮助

      // 验证文件菜单
      const fileMenu = menuTemplate.find(menu => menu.label === '文件');
      expect(fileMenu).toBeDefined();
      expect(fileMenu.submenu).toHaveLength(4); // 新建文章、保存草稿、分隔符、退出

      // 验证编辑菜单
      const editMenu = menuTemplate.find(menu => menu.label === '编辑');
      expect(editMenu).toBeDefined();

      // 验证发布菜单
      const publishMenu = menuTemplate.find(menu => menu.label === '发布');
      expect(publishMenu).toBeDefined();
      expect(publishMenu.submenu).toHaveLength(3); // 一键发布、分隔符、平台管理

      // 验证帮助菜单
      const helpMenu = menuTemplate.find(menu => menu.label === '帮助');
      expect(helpMenu).toBeDefined();
    });

    test('应该正确设置快捷键', async () => {
      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      const menuTemplate = require('electron').Menu.buildFromTemplate.mock.calls[0][0];
      const fileMenu = menuTemplate.find(menu => menu.label === '文件');

      // 验证快捷键配置
      const newArticleItem = fileMenu.submenu.find(item => item.label === '新建文章');
      expect(newArticleItem.accelerator).toBe('CmdOrCtrl+N');

      const saveDraftItem = fileMenu.submenu.find(item => item.label === '保存草稿');
      expect(saveDraftItem.accelerator).toBe('CmdOrCtrl+S');

      const exitItem = fileMenu.submenu.find(item => item.label === '退出');
      expect(exitItem.accelerator).toBeDefined();
    });

    test('应该设置应用菜单', async () => {
      const { Menu } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      await new Promise(resolve => setTimeout(resolve, 20));

      // 验证setApplicationMenu被调用
      expect(Menu.setApplicationMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. IPC通信设置', () => {
    test('应该注册应用信息相关的IPC处理器', async () => {
      const { ipcMain } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证app-version处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('app-version', expect.any(Function));

      // 验证platform处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('platform', expect.any(Function));
    });

    test('应该注册数据库相关的IPC处理器', async () => {
      const { ipcMain } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证数据库统计处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('db:stats', expect.any(Function));

      // 验证数据库健康检查处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('db:health', expect.any(Function));
    });

    test('应该注册文章相关的IPC处理器', async () => {
      const { ipcMain } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证文章CRUD处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findById', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:update', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:delete', expect.any(Function));
    });

    test('应该注册平台相关的IPC处理器', async () => {
      const { ipcMain } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证平台处理器
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:getAvailable', expect.any(Function));
    });

    test('应该注册消息处理器', async () => {
      const { ipcMain } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证消息处理器
      expect(ipcMain.on).toHaveBeenCalledWith('renderer-message', expect.any(Function));
    });
  });

  describe('4. 应用生命周期管理', () => {
    test('应该正确处理应用启动流程', async () => {
      const { app } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证app.whenReady被调用
      expect(app.whenReady).toHaveBeenCalledTimes(1);
    });

    test('应该正确处理窗口全部关闭事件', async () => {
      const { app } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证window-all-closed事件监听器
      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });

    test('应该正确处理macOS激活事件', async () => {
      const { app } = require('electron');

      mainProcess = require('../../../src/main/index.js');

      // 验证activate事件监听器
      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));
    });
  });
});