const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.argv.includes('--dev');

// 设置控制台编码为UTF-8
if (process.platform === 'win32') {
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}

// 在开发环境中禁用Electron的安全警告
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
}

// 导入数据库服务
const { getDatabaseService, DatabaseService } = require('./database/DatabaseService');
// 导入文章管理服务
const ArticleService = require('./services/ArticleService');
// 导入平台配置服务
const PlatformService = require('./services/PlatformService');
// 导入登录会话管理服务
const LoginSessionService = require('./services/LoginSessionService');
// 导入二维码服务
const QRCodeService = require('./services/QRCodeService');
// 导入浏览器管理服务
const { BrowserManager } = require('./automation/BrowserManager');
// 导入平台自动化登录服务
const PlatformAutoLoginService = require('./services/PlatformAutoLoginService');

// 保持对窗口对象的全局引用，如果不这样做，当JavaScript对象被垃圾回收时，窗口将自动关闭
let mainWindow;
// 创建文章管理服务实例
const articleService = new ArticleService();
// 创建平台配置服务实例
const platformService = new PlatformService();
// 创建登录会话管理服务实例
const loginSessionService = new LoginSessionService();
// 创建二维码服务实例
const qrCodeService = new QRCodeService();
// 创建浏览器管理服务实例
const browserManager = new BrowserManager();
// 创建平台自动化登录服务实例
const platformAutoLoginService = new PlatformAutoLoginService();

function createWindow() {
  console.log('正在创建应用窗口...');

  try {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        // 添加安全的内容安全策略
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      // icon: path.join(__dirname, '../assets/icon.png'), // 应用图标 - 暂时注释掉，文件不存在
      show: false, // 先不显示，等加载完成后再显示
      titleBarStyle: 'default' // 标题栏样式
    });

    console.log('应用窗口创建成功');
  } catch (error) {
    console.error('创建窗口失败:', error);
    throw error;
  }

  // 加载应用
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../build/index.html')}`;

  console.log('正在加载应用URL:', startUrl);

  mainWindow.loadURL(startUrl);

  // 当窗口准备好显示时显示窗口
  mainWindow.once('ready-to-show', () => {
    console.log('应用窗口准备显示');
    mainWindow.show();

    // 开发模式下打开开发者工具
    if (isDev) {
      console.log('打开开发者工具');
      mainWindow.webContents.openDevTools();
    }
  });

  // 当窗口关闭时触发
  mainWindow.on('closed', () => {
    console.log('应用窗口已关闭');
    // 取消引用window对象，如果你的应用支持多窗口的话，通常会把多个window对象存放在一个数组里面，与此同时，你应该删除相应的元素
    mainWindow = null;
  });

  // 处理窗口加载事件
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
  });

  // 处理窗口加载失败事件
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
  });

  // 处理窗口崩溃事件
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('渲染进程崩溃:', killed ? '被杀死' : '崩溃');
  });

  // 处理窗口无响应事件
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('渲染进程无响应');
  });

  // 处理窗口恢复响应事件
  mainWindow.webContents.on('responsive', () => {
    console.log('渲染进程恢复响应');
  });

  // 开发环境禁用CSP，避免阻止资源加载
  if (!isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const cspPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;";

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [cspPolicy]
        }
      });
    });
  }

  // 处理窗口状态
  mainWindow.webContents.on('did-fail-load', () => {
    console.error('页面加载失败');
  });
}

// Electron 会在初始化后并准备创建浏览器窗口时，调用这个函数
// 部分 API 在 ready 事件触发后才能使用
app.whenReady().then(async () => {
  try {
    // 初始化数据库
    console.log('正在初始化数据库...');
    const dbService = getDatabaseService();
    await dbService.initialize();
    console.log('数据库初始化完成');

    // 初始化平台服务
    console.log('正在初始化平台服务...');
    await platformService.initialize();
    console.log('平台服务初始化完成');

    // 初始化登录会话服务
    console.log('正在初始化登录会话服务...');
    await loginSessionService.initialize();
    console.log('登录会话服务初始化完成');

    // 初始化二维码服务
    console.log('正在初始化二维码服务...');
    await qrCodeService.initialize();
    console.log('二维码服务初始化完成');

    // 初始化浏览器管理服务
    console.log('正在初始化浏览器管理服务...');
    browserManager.startAutoCleanup();
    console.log('浏览器管理服务初始化完成');

    // 初始化平台自动化登录服务
    console.log('正在初始化平台自动化登录服务...');
    await platformAutoLoginService.initialize();
    console.log('平台自动化登录服务初始化完成');

    // 创建应用窗口
    createWindow();

    // 在macOS上，当单击dock图标并且没有其他窗口打开时，通常在应用程序中重新创建一个窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    // 设置应用菜单
    createMenu();
  } catch (error) {
    console.error('应用启动失败:', error);
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', async () => {
  try {
    // 停止自动清理定时器
    browserManager.stopAutoCleanup();

    // 清理所有浏览器实例
    console.log('正在清理浏览器实例...');
    await browserManager.cleanup();
    console.log('浏览器实例清理完成');
  } catch (error) {
    console.error('清理浏览器实例失败:', error);
  }
});

// 当全部窗口关闭时退出应用
app.on('window-all-closed', async () => {
  // 在macOS上，除非用户用Cmd + Q确定地退出，否则绝大部分应用及其菜单栏会保持激活
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建文章',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // TODO: 实现新建文章功能
            mainWindow.webContents.send('menu-new-article');
          }
        },
        {
          label: '保存草稿',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // TODO: 实现保存草稿功能
            mainWindow.webContents.send('menu-save-draft');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '发布',
      submenu: [
        {
          label: '一键发布',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => {
            // TODO: 实现一键发布功能
            mainWindow.webContents.send('menu-publish');
          }
        },
        { type: 'separator' },
        {
          label: '平台管理',
          click: () => {
            // TODO: 打开平台管理窗口
            mainWindow.webContents.send('menu-platform-manage');
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            // TODO: 显示关于信息
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 处理程序
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('platform', () => {
  return process.platform;
});

// 配置相关的IPC处理
ipcMain.handle('config:get', async (event, key) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join(__dirname, '../../config.json');

    // 读取配置文件
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    // 支持嵌套键访问，如 "tinymce.apiKey"
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      value = value?.[k];
    }

    return value;
  } catch (error) {
    console.error(`读取配置失败 (${key}):`, error);
    return null;
  }
});

// 数据库相关的IPC处理
ipcMain.handle('db:stats', async () => {
  try {
    const dbService = getDatabaseService();
    return dbService.getStats();
  } catch (error) {
    console.error('获取数据库统计失败:', error);
    throw error;
  }
});

ipcMain.handle('db:health', async () => {
  try {
    const dbService = getDatabaseService();
    const health = await dbService.validate();
    return health;
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    throw error;
  }
});

// 文章相关的IPC处理 - 使用ArticleService
ipcMain.handle('articles:create', async (event, articleData) => {
  try {
    return await articleService.createArticle(articleData);
  } catch (error) {
    console.error('创建文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:findAll', async (event, options = {}) => {
  try {
    return await articleService.getArticles(options);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:findById', async (event, id) => {
  try {
    return await articleService.getArticle(id);
  } catch (error) {
    console.error('获取文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:update', async (event, id, updateData) => {
  try {
    return await articleService.updateArticle(id, updateData);
  } catch (error) {
    console.error('更新文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:delete', async (event, id) => {
  try {
    return await articleService.deleteArticle(id);
  } catch (error) {
    console.error('删除文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:autoSave', async (event, articleData) => {
  try {
    // 如果文章有ID且不是临时ID，更新；否则创建新文章
    if (articleData.id && typeof articleData.id === 'string' && !articleData.id.startsWith('draft_')) {
      return await articleService.updateArticle(articleData.id, articleData);
    } else {
      // 创建新文章时移除临时ID（如果存在）
      const { id, ...articleDataWithoutId } = articleData;
      return await articleService.createArticle(articleDataWithoutId);
    }
  } catch (error) {
    console.error('自动保存文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:publish', async (event, id, platformIds) => {
  try {
    // TODO: 实现文章发布功能
    // 这里暂时返回成功状态，后续会在平台集成中实现
    return {
      success: true,
      message: '文章发布功能将在后续版本中实现',
      data: {
        id,
        platformIds,
        status: 'pending'
      }
    };
  } catch (error) {
    console.error('发布文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:getPublishStatus', async (event, id) => {
  try {
    // TODO: 实现获取发布状态功能
    return {
      success: true,
      data: []
    };
  } catch (error) {
    console.error('获取发布状态失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:cancelPublish', async (event, id, platformId) => {
  try {
    // TODO: 实现取消发布功能
    return {
      success: true,
      message: '取消发布功能将在后续版本中实现'
    };
  } catch (error) {
    console.error('取消发布失败:', error);
    throw error;
  }
});

// 平台相关的IPC处理 - 使用PlatformService
ipcMain.handle('platforms:findAll', async (event, activeOnly = true) => {
  try {
    return await platformService.getAllPlatforms(activeOnly);
  } catch (error) {
    console.error('获取平台列表失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:getAvailable', async () => {
  try {
    return await platformService.getAvailablePlatforms();
  } catch (error) {
    console.error('获取可用平台失败:', error);
    throw error;
  }
});

// 新增平台管理IPC处理程序
ipcMain.handle('platforms:findById', async (event, id) => {
  try {
    return await platformService.getPlatform(id);
  } catch (error) {
    console.error('获取平台详情失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:create', async (event, platformData) => {
  try {
    return await platformService.createPlatform(platformData);
  } catch (error) {
    console.error('创建平台失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:update', async (event, id, updateData) => {
  try {
    return await platformService.updatePlatform(id, updateData);
  } catch (error) {
    console.error('更新平台失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:delete', async (event, id) => {
  try {
    return await platformService.deletePlatform(id);
  } catch (error) {
    console.error('删除平台失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:checkStatus', async (event, id) => {
  try {
    return await platformService.checkPlatformStatus(id);
  } catch (error) {
    console.error('检查平台状态失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:getLoginConfig', async (event, id) => {
  try {
    return await platformService.getLoginConfig(id);
  } catch (error) {
    console.error('获取平台登录配置失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:getPublishConfig', async (event, id) => {
  try {
    return await platformService.getPublishConfig(id);
  } catch (error) {
    console.error('获取平台发布配置失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:checkAllStatus', async () => {
  try {
    return await platformService.checkAllPlatformsStatus();
  } catch (error) {
    console.error('检查所有平台状态失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:toggleActive', async (event, id, isActive) => {
  try {
    return await platformService.togglePlatformActive(id, isActive);
  } catch (error) {
    console.error('切换平台状态失败:', error);
    throw error;
  }
});

// 登录会话相关的IPC处理程序 - 使用LoginSessionService
ipcMain.handle('sessions:create', async (event, platformId, sessionData) => {
  try {
    return await loginSessionService.createSession(platformId, sessionData);
  } catch (error) {
    console.error('创建登录会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:getActive', async (event, platformId) => {
  try {
    return await loginSessionService.getActiveSessions(platformId);
  } catch (error) {
    console.error('获取活跃会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:getById', async (event, sessionId) => {
  try {
    return await loginSessionService.getSessionById(sessionId);
  } catch (error) {
    console.error('获取会话详情失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:updateUsage', async (event, sessionId) => {
  try {
    return await loginSessionService.updateSessionUsage(sessionId);
  } catch (error) {
    console.error('更新会话使用时间失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:checkExpiry', async (event, sessionId) => {
  try {
    return await loginSessionService.checkSessionExpiry(sessionId);
  } catch (error) {
    console.error('检查会话过期状态失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:refresh', async (event, sessionId, newCookies) => {
  try {
    return await loginSessionService.refreshSession(sessionId, newCookies);
  } catch (error) {
    console.error('刷新会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:deactivate', async (event, sessionId) => {
  try {
    return await loginSessionService.deactivateSession(sessionId);
  } catch (error) {
    console.error('停用会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:delete', async (event, sessionId) => {
  try {
    return await loginSessionService.deleteSession(sessionId);
  } catch (error) {
    console.error('删除会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:cleanupExpired', async () => {
  try {
    return await loginSessionService.cleanupExpiredSessions();
  } catch (error) {
    console.error('清理过期会话失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:getStats', async (event, platformId) => {
  try {
    return await loginSessionService.getSessionStats(platformId);
  } catch (error) {
    console.error('获取会话统计信息失败:', error);
    throw error;
  }
});

ipcMain.handle('sessions:getBest', async (event, platformId) => {
  try {
    return await loginSessionService.getBestSession(platformId);
  } catch (error) {
    console.error('获取最佳会话失败:', error);
    throw error;
  }
});

// 二维码相关的IPC处理程序
ipcMain.handle('qrCode:generate', async (event, loginUrl, options) => {
  try {
    return await qrCodeService.generateQRCode(loginUrl, options);
  } catch (error) {
    console.error('生成二维码失败:', error);
    throw error;
  }
});

ipcMain.handle('qrCode:checkStatus', async (event, sessionId) => {
  try {
    return await qrCodeService.checkQRCodeStatus(sessionId);
  } catch (error) {
    console.error('检查二维码状态失败:', error);
    throw error;
  }
});

ipcMain.handle('qrCode:cleanup', async () => {
  try {
    return await qrCodeService.cleanupExpiredSessions();
  } catch (error) {
    console.error('清理过期二维码失败:', error);
    throw error;
  }
});

// 浏览器管理相关的IPC处理程序
ipcMain.handle('browser:create', async (event, config) => {
  try {
    const browser = await browserManager.createBrowser(config);
    const browserId = browserManager.getBrowserId(browser);

    // 获取进程ID，但如果进程还未启动则使用null
    let processId = null;
    try {
      processId = browser.process()?.pid || null;
    } catch (e) {
      processId = null;
    }

    return {
      success: true,
      data: {
        browserId,
        processId
      },
      message: '浏览器创建成功'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '浏览器创建失败'
    };
  }
});

ipcMain.handle('browser:close', async (event, browserId) => {
  try {
    const browser = browserManager.getBrowser(browserId);
    if (!browser) {
      throw new Error('浏览器实例未找到');
    }
    await browserManager.closeBrowser(browser);
    return {
      success: true,
      message: '浏览器关闭成功'
    };
  } catch (error) {
    console.error('关闭浏览器失败:', error);
    return {
      success: false,
      error: error.message,
      message: '浏览器关闭失败'
    };
  }
});

ipcMain.handle('browser:getAll', async () => {
  try {
    const browsers = browserManager.getAllBrowsers();
    return {
      success: true,
      data: browsers.map(b => ({
        id: b.id,
        metadata: b.metadata,
        connected: b.browser.isConnected()
      })),
      message: '获取浏览器列表成功'
    };
  } catch (error) {
    console.error('获取浏览器列表失败:', error);
    return {
      success: false,
      error: error.message,
      message: '获取浏览器列表失败'
    };
  }
});

ipcMain.handle('browser:getStats', async () => {
  try {
    const stats = browserManager.getStats();
    const healthStatus = browserManager.getHealthStatus();
    return {
      success: true,
      data: {
        ...stats,
        health: healthStatus
      },
      message: '获取浏览器统计信息成功'
    };
  } catch (error) {
    console.error('获取浏览器统计信息失败:', error);
    return {
      success: false,
      error: error.message,
      message: '获取浏览器统计信息失败'
    };
  }
});

ipcMain.handle('browser:cleanup', async () => {
  try {
    await browserManager.cleanup();
    return {
      success: true,
      message: '浏览器清理完成'
    };
  } catch (error) {
    console.error('清理浏览器失败:', error);
    return {
      success: false,
      error: error.message,
      message: '清理浏览器失败'
    };
  }
});

ipcMain.handle('browser:getStealthConfig', async () => {
  try {
    const config = browserManager.getStealthConfig();
    return {
      success: true,
      data: config,
      message: '获取隐身配置成功'
    };
  } catch (error) {
    console.error('获取隐身配置失败:', error);
    return {
      success: false,
      error: error.message,
      message: '获取隐身配置失败'
    };
  }
});


// 平台自动化登录相关的IPC处理程序 - 使用PlatformAutoLoginService
ipcMain.handle('autoLogin:start', async (event, platformId, options) => {
  try {
    return await platformAutoLoginService.startPlatformLogin(platformId, options);
  } catch (error) {
    console.error('启动平台自动登录失败:', error);
    throw error;
  }
});

ipcMain.handle('autoLogin:getStatus', async (event, loginId) => {
  try {
    return await platformAutoLoginService.getLoginStatus(loginId);
  } catch (error) {
    console.error('获取登录状态失败:', error);
    throw error;
  }
});

ipcMain.handle('autoLogin:cancel', async (event, loginId) => {
  try {
    return await platformAutoLoginService.cancelLogin(loginId);
  } catch (error) {
    console.error('取消登录失败:', error);
    throw error;
  }
});

ipcMain.handle('autoLogin:getActiveLogins', async () => {
  try {
    const activeLogins = platformAutoLoginService.getActiveLogins();
    return {
      success: true,
      data: activeLogins,
      message: '获取活跃登录列表成功'
    };
  } catch (error) {
    console.error('获取活跃登录列表失败:', error);
    throw error;
  }
});

ipcMain.handle('autoLogin:deactivateSession', async (event, sessionId) => {
  try {
    return await loginSessionService.deactivateSession(sessionId);
  } catch (error) {
    console.error('停用登录会话失败:', error);
    throw error;
  }
});

// 处理来自渲染进程的消息
ipcMain.on('renderer-message', (event, data) => {
  console.log('来自渲染进程的消息:', data);
  // TODO: 处理具体的消息
});