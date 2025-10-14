const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.argv.includes('--dev');

// 在开发环境中禁用Electron的安全警告
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
}

// 导入数据库服务
const { getDatabaseService, DatabaseService } = require('./database/DatabaseService');

// 保持对窗口对象的全局引用，如果不这样做，当JavaScript对象被垃圾回收时，窗口将自动关闭
let mainWindow;

function createWindow() {
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
    icon: path.join(__dirname, '../assets/icon.png'), // 应用图标
    show: false, // 先不显示，等加载完成后再显示
    titleBarStyle: 'default' // 标题栏样式
  });

  // 加载应用
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // 当窗口准备好显示时显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // 开发模式下打开开发者工具
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 当窗口关闭时触发
  mainWindow.on('closed', () => {
    // 取消引用window对象，如果你的应用支持多窗口的话，通常会把多个window对象存放在一个数组里面，与此同时，你应该删除相应的元素
    mainWindow = null;
  });

  // 设置CSP安全策略
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // 在开发环境中允许内联脚本，生产环境中使用更严格的策略
    const cspPolicy = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

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

// 当全部窗口关闭时退出应用
app.on('window-all-closed', () => {
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

// 文章相关的IPC处理
ipcMain.handle('articles:create', async (event, articleData) => {
  try {
    const dbService = getDatabaseService();
    const articleModel = dbService.getModel('article');
    return articleModel.create(articleData);
  } catch (error) {
    console.error('创建文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:findAll', async (event, options = {}) => {
  try {
    const dbService = getDatabaseService();
    const articleModel = dbService.getModel('article');
    return articleModel.findAll(options);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:findById', async (event, id) => {
  try {
    const dbService = getDatabaseService();
    const articleModel = dbService.getModel('article');
    return articleModel.findById(id);
  } catch (error) {
    console.error('获取文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:update', async (event, id, updateData) => {
  try {
    const dbService = getDatabaseService();
    const articleModel = dbService.getModel('article');
    return articleModel.update(id, updateData);
  } catch (error) {
    console.error('更新文章失败:', error);
    throw error;
  }
});

ipcMain.handle('articles:delete', async (event, id) => {
  try {
    const dbService = getDatabaseService();
    const articleModel = dbService.getModel('article');
    return articleModel.delete(id);
  } catch (error) {
    console.error('删除文章失败:', error);
    throw error;
  }
});

// 平台相关的IPC处理
ipcMain.handle('platforms:findAll', async (event, activeOnly = true) => {
  try {
    const dbService = getDatabaseService();
    const platformModel = dbService.getModel('platform');
    return platformModel.findAll(activeOnly);
  } catch (error) {
    console.error('获取平台列表失败:', error);
    throw error;
  }
});

ipcMain.handle('platforms:getAvailable', async () => {
  try {
    const dbService = getDatabaseService();
    const platformModel = dbService.getModel('platform');
    return platformModel.getAvailable();
  } catch (error) {
    console.error('获取可用平台失败:', error);
    throw error;
  }
});

// 处理来自渲染进程的消息
ipcMain.on('renderer-message', (event, data) => {
  console.log('来自渲染进程的消息:', data);
  // TODO: 处理具体的消息
});