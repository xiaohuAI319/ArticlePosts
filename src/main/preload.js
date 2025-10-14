const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getPlatform: () => ipcRenderer.invoke('platform'),

  // 数据库相关API
  database: {
    // 获取数据库统计信息
    getStats: () => ipcRenderer.invoke('db:stats'),

    // 检查数据库健康状态
    checkHealth: () => ipcRenderer.invoke('db:health')
  },

  // 文章相关API
  articles: {
    // 创建文章
    create: (articleData) => ipcRenderer.invoke('articles:create', articleData),

    // 获取文章列表
    findAll: (options) => ipcRenderer.invoke('articles:findAll', options),

    // 根据ID获取文章
    findById: (id) => ipcRenderer.invoke('articles:findById', id),

    // 更新文章
    update: (id, updateData) => ipcRenderer.invoke('articles:update', id, updateData),

    // 删除文章
    delete: (id) => ipcRenderer.invoke('articles:delete', id)
  },

  // 平台相关API
  platforms: {
    // 获取平台列表
    findAll: (activeOnly) => ipcRenderer.invoke('platforms:findAll', activeOnly),

    // 获取可用平台
    getAvailable: () => ipcRenderer.invoke('platforms:getAvailable')
  },

  // 菜单事件监听
  onMenuAction: (callback) => {
    const menuActions = [
      'menu-new-article',
      'menu-save-draft',
      'menu-publish',
      'menu-platform-manage'
    ];

    menuActions.forEach(action => {
      ipcRenderer.on(action, callback);
    });
  },

  // 发送消息到主进程
  sendMessage: (channel, data) => {
    const validChannels = ['renderer-message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // 监听来自主进程的消息
  onMessage: (channel, callback) => {
    const validChannels = ['main-message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 开发模式下的调试工具
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('debugAPI', {
    openDevTools: () => ipcRenderer.send('open-dev-tools'),
    log: (...args) => console.log('[Renderer]', ...args)
  });
}