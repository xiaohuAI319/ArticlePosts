const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getPlatform: () => ipcRenderer.invoke('platform'),

  // 配置相关API
  config: {
    // 获取配置值
    get: (key) => ipcRenderer.invoke('config:get', key)
  },

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
    delete: (id) => ipcRenderer.invoke('articles:delete', id),

    // 自动保存文章
    autoSave: (articleData) => ipcRenderer.invoke('articles:autoSave', articleData),

    // 发布文章
    publish: (id, platformIds) => ipcRenderer.invoke('articles:publish', id, platformIds),

    // 获取发布状态
    getPublishStatus: (id) => ipcRenderer.invoke('articles:getPublishStatus', id),

    // 取消发布
    cancelPublish: (id, platformId) => ipcRenderer.invoke('articles:cancelPublish', id, platformId)
  },

  // 平台相关API
  platforms: {
    // 获取平台列表
    findAll: (activeOnly) => ipcRenderer.invoke('platforms:findAll', activeOnly),

    // 获取可用平台
    getAvailable: () => ipcRenderer.invoke('platforms:getAvailable'),

    // 根据ID获取平台详情
    findById: (id) => ipcRenderer.invoke('platforms:findById', id),

    // 创建平台
    create: (platformData) => ipcRenderer.invoke('platforms:create', platformData),

    // 更新平台
    update: (id, updateData) => ipcRenderer.invoke('platforms:update', id, updateData),

    // 删除平台
    delete: (id) => ipcRenderer.invoke('platforms:delete', id),

    // 检查平台状态
    checkStatus: (id) => ipcRenderer.invoke('platforms:checkStatus', id),

    // 获取平台登录配置
    getLoginConfig: (id) => ipcRenderer.invoke('platforms:getLoginConfig', id),

    // 获取平台发布配置
    getPublishConfig: (id) => ipcRenderer.invoke('platforms:getPublishConfig', id),

    // 检查所有平台状态
    checkAllStatus: () => ipcRenderer.invoke('platforms:checkAllStatus'),

    // 切换平台启用/禁用状态
    toggleActive: (id, isActive) => ipcRenderer.invoke('platforms:toggleActive', id, isActive)
  },

  // 登录会话相关API
  sessions: {
    // 创建登录会话
    create: (platformId, sessionData) => ipcRenderer.invoke('sessions:create', platformId, sessionData),

    // 获取平台的活跃会话
    getActive: (platformId) => ipcRenderer.invoke('sessions:getActive', platformId),

    // 根据ID获取会话详情
    getById: (sessionId) => ipcRenderer.invoke('sessions:getById', sessionId),

    // 更新会话使用时间
    updateUsage: (sessionId) => ipcRenderer.invoke('sessions:updateUsage', sessionId),

    // 检查会话是否过期
    checkExpiry: (sessionId) => ipcRenderer.invoke('sessions:checkExpiry', sessionId),

    // 刷新会话
    refresh: (sessionId, newCookies) => ipcRenderer.invoke('sessions:refresh', sessionId, newCookies),

    // 停用会话
    deactivate: (sessionId) => ipcRenderer.invoke('sessions:deactivate', sessionId),

    // 删除会话
    delete: (sessionId) => ipcRenderer.invoke('sessions:delete', sessionId),

    // 清理过期会话
    cleanupExpired: () => ipcRenderer.invoke('sessions:cleanupExpired'),

    // 获取会话统计信息
    getStats: (platformId) => ipcRenderer.invoke('sessions:getStats', platformId),

    // 获取最佳可用会话
    getBest: (platformId) => ipcRenderer.invoke('sessions:getBest', platformId)
  },

  // 二维码相关API
  qrCode: {
    // 生成二维码
    generate: (loginUrl, options) => ipcRenderer.invoke('qrCode:generate', loginUrl, options),

    // 检查二维码状态
    checkStatus: (sessionId) => ipcRenderer.invoke('qrCode:checkStatus', sessionId),

    // 清理过期二维码
    cleanup: () => ipcRenderer.invoke('qrCode:cleanup')
  },

  // 浏览器管理相关API
  browser: {
    // 创建浏览器实例
    create: (config) => ipcRenderer.invoke('browser:create', config),

    // 关闭浏览器实例
    close: (browserId) => ipcRenderer.invoke('browser:close', browserId),

    // 获取所有浏览器实例
    getAll: () => ipcRenderer.invoke('browser:getAll'),

    // 获取浏览器统计信息
    getStats: () => ipcRenderer.invoke('browser:getStats'),

    // 清理所有浏览器实例
    cleanup: () => ipcRenderer.invoke('browser:cleanup'),

    // 获取隐身配置
    getStealthConfig: () => ipcRenderer.invoke('browser:getStealthConfig')
  },

  // 平台自动化登录相关API
  autoLogin: {
    // 启动平台登录流程
    start: (platformId, options) => ipcRenderer.invoke('autoLogin:start', platformId, options),

    // 获取登录状态
    getStatus: (loginId) => ipcRenderer.invoke('autoLogin:getStatus', loginId),

    // 取消登录流程
    cancel: (loginId) => ipcRenderer.invoke('autoLogin:cancel', loginId),

    // 获取活跃登录列表
    getActiveLogins: () => ipcRenderer.invoke('autoLogin:getActiveLogins'),

    // 停用登录会话
    deactivateSession: (sessionId) => ipcRenderer.invoke('autoLogin:deactivateSession', sessionId)
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