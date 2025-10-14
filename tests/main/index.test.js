/**
 * index.js 主进程功能测试
 */

const path = require('path');
const fs = require('fs');

// 模拟Electron app
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn((name) => {
      if (name === 'userData') return path.join(__dirname, '../../test-user-data');
      return '/mock/path';
    }),
    on: jest.fn(),
    quit: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve())
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn(),
      send: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn()
  }
}));

describe('主进程功能测试', () => {
  const TEST_DB_PATH = path.join(__dirname, '../../test-main.db');

  beforeEach(() => {
    // 清理测试环境
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // 重置模拟
    jest.clearAllMocks();

    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB_PATH = TEST_DB_PATH;
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('应用初始化', () => {
    test('应该正确初始化应用', async () => {
      // 动态导入主进程代码
      const mainProcess = require('../../../src/main/index.js');

      // 验证app事件监听器已设置
      expect(app.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));

      // 验证BrowserWindow已创建
      expect(BrowserWindow).toHaveBeenCalled();
    });

    test('应该创建主窗口', () => {
      // 模拟窗口创建
      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      // 动态导入主进程代码
      require('../../../src/main/index.js');

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, '../../../src/main/preload.js')
        }
      });
    });

    test('应该在开发模式下打开开发者工具', () => {
      process.env.NODE_ENV = 'development';

      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      require('../../../src/main/index.js');

      expect(mockWindow.webContents.openDevTools).toHaveBeenCalled();
    });
  });

  describe('IPC处理器', () => {
    beforeEach(() => {
      // 导入主进程代码以设置IPC处理器
      require('../../../src/main/index.js');
    });

    test('应该设置数据库相关的IPC处理器', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('db:stats', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('db:health', expect.any(Function));
    });

    test('应该设置文章相关的IPC处理器', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:findById', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:update', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('articles:delete', expect.any(Function));
    });

    test('应该设置平台相关的IPC处理器', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:findAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('platforms:getAvailable', expect.any(Function));
    });

    test('应该设置应用信息相关的IPC处理器', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('app-version', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('platform', expect.any(Function));
    });
  });

  describe('数据库操作IPC处理器', () => {
    let mockEvent;
    let dbService;

    beforeEach(async () => {
      mockEvent = {
        sender: {
          send: jest.fn()
        }
      };

      // 导入主进程代码
      require('../../../src/main/index.js');

      // 获取数据库服务
      const { getDatabaseService } = require('../../../src/main/database/DatabaseService');
      dbService = getDatabaseService();
      await dbService.initialize();
    });

    afterEach(async () => {
      if (dbService) {
        await dbService.close();
      }
    });

    test('应该处理获取数据库统计信息', async () => {
      // 找到db:stats处理器
      const dbStatsHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'db:stats')[1];

      const stats = await dbStatsHandler(mockEvent);

      expect(stats).toBeDefined();
      expect(stats.database).toBeDefined();
      expect(stats.articles).toBeDefined();
      expect(stats.platforms).toBeDefined();
    });

    test('应该处理数据库健康检查', async () => {
      const dbHealthHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'db:health')[1];

      const health = await dbHealthHandler(mockEvent);

      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.connected).toBe(true);
    });

    test('应该处理文章创建', async () => {
      const articleCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:create')[1];

      const articleData = {
        title: '测试文章',
        content: '{"ops":[{"insert":"测试内容"}]}',
        html_content: '<p>测试内容</p>',
        tags: ['测试'],
        category: '技术',
        status: 0
      };

      const article = await articleCreateHandler(mockEvent, articleData);

      expect(article).toBeDefined();
      expect(article.id).toBeDefined();
      expect(article.title).toBe(articleData.title);
    });

    test('应该处理获取文章列表', async () => {
      const articleCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:create')[1];
      const articleFindAllHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:findAll')[1];

      // 先创建一篇文章
      await articleCreateHandler(mockEvent, {
        title: '测试文章',
        content: '{"ops":[{"insert":"测试内容"}]}',
        status: 0
      });

      // 获取文章列表
      const articles = await articleFindAllHandler(mockEvent, { status: 0 });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('测试文章');
    });

    test('应该处理文章更新', async () => {
      const articleCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:create')[1];
      const articleUpdateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:update')[1];

      // 创建文章
      const article = await articleCreateHandler(mockEvent, {
        title: '原始标题',
        content: '{"ops":[{"insert":"原始内容"}]}',
        status: 0
      });

      // 更新文章
      const updatedArticle = await articleUpdateHandler(mockEvent, article.id, {
        title: '更新后的标题'
      });

      expect(updatedArticle.title).toBe('更新后的标题');
    });

    test('应该处理文章删除', async () => {
      const articleCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:create')[1];
      const articleDeleteHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:delete')[1];
      const articleFindByIdHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:findById')[1];

      // 创建文章
      const article = await articleCreateHandler(mockEvent, {
        title: '待删除文章',
        content: '{"ops":[{"insert":"内容"}]}',
        status: 0
      });

      // 删除文章
      await articleDeleteHandler(mockEvent, article.id);

      // 验证文章已删除
      const foundArticle = await articleFindByIdHandler(mockEvent, article.id);
      expect(foundArticle).toBeNull();
    });

    test('应该处理平台查询', async () => {
      const platformFindAllHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'platforms:findAll')[1];
      const platformCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'platforms:create')[1];

      // 创建测试平台（如果处理器存在）
      if (platformCreateHandler) {
        await platformCreateHandler(mockEvent, {
          name: '测试平台',
          platform_code: 'test_platform',
          base_url: 'https://test.com',
          login_type: 'qrcode',
          is_active: true
        });
      }

      const platforms = await platformFindAllHandler(mockEvent, true);

      expect(Array.isArray(platforms)).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('应该处理IPC操作中的错误', async () => {
      const mockEvent = {
        sender: {
          send: jest.fn()
        }
      };

      require('../../../src/main/index.js');

      const articleCreateHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'articles:create')[1];

      // 尝试创建无效文章
      await expect(
        articleCreateHandler(mockEvent, { invalid: 'data' })
      ).rejects.toThrow();
    });

    test('应该处理数据库连接错误', async () => {
      // 模拟数据库连接失败
      process.env.TEST_DB_PATH = '/invalid/path/database.db';

      const mockEvent = {
        sender: {
          send: jest.fn()
        }
      };

      require('../../../src/main/index.js');

      const dbStatsHandler = ipcMain.handle.mock.calls.find(call => call[0] === 'db:stats')[1];

      await expect(dbStatsHandler(mockEvent)).rejects.toThrow();
    });
  });

  describe('应用菜单', () => {
    test('应该创建应用菜单', () => {
      const { Menu } = require('electron');

      require('../../../src/main/index.js');

      expect(Menu.setApplicationMenu).toHaveBeenCalled();
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
    });

    test('应该包含必要的菜单项', () => {
      const { Menu } = require('electron');

      require('../../../src/main/index.js');

      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];

      expect(Array.isArray(menuTemplate)).toBe(true);
      // 验证包含文件、编辑、视图等菜单
      const hasFileMenu = menuTemplate.some(item => item.label === '文件');
      const hasEditMenu = menuTemplate.some(item => item.label === '编辑');
      const hasViewMenu = menuTemplate.some(item => item.label === '视图');

      expect(hasFileMenu || hasEditMenu || hasViewMenu).toBe(true);
    });
  });

  describe('窗口管理', () => {
    test('应该处理窗口关闭事件', () => {
      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      require('../../../src/main/index.js');

      expect(mockWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });

    test('应该处理窗口最小化到托盘', () => {
      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        minimize: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      require('../../../src/main/index.js');

      // 验证窗口事件监听器已设置
      expect(mockWindow.on).toHaveBeenCalledWith('minimize', expect.any(Function));
    });
  });

  describe('应用生命周期', () => {
    test('应该在所有窗口关闭时退出应用（非macOS）', () => {
      // 模拟非macOS平台
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const mockEvent = {};
      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      require('../../../src/main/index.js');

      // 获取window-all-closed事件处理器
      const windowAllClosedHandler = app.on.mock.calls.find(call => call[0] === 'window-all-closed')[1];

      windowAllClosedHandler(mockEvent);

      expect(app.quit).toHaveBeenCalled();
    });

    test('应该在macOS上保持应用运行', () => {
      // 模拟macOS平台
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const mockEvent = {};
      const mockWindow = {
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
          openDevTools: jest.fn(),
          on: jest.fn(),
          send: jest.fn()
        }
      };

      BrowserWindow.mockImplementation(() => mockWindow);

      require('../../../src/main/index.js');

      const windowAllClosedHandler = app.on.mock.calls.find(call => call[0] === 'window-all-closed')[1];

      windowAllClosedHandler(mockEvent);

      expect(app.quit).not.toHaveBeenCalled();
    });
  });
});