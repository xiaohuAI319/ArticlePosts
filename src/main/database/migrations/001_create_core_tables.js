/**
 * 创建核心表结构
 * 版本: 001
 * 描述: 创建应用程序所需的核心数据表
 */

/**
 * 执行迁移
 */
function up(db) {
  // 1. 文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,                    -- Quill Delta格式
      html_content TEXT,                        -- 渲染后的HTML
      cover_image TEXT,                         -- 封面图片URL
      tags TEXT,                                -- JSON数组
      category TEXT,
      status INTEGER DEFAULT 0,                 -- 0:草稿 1:已发布 2:发布失败
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      word_count INTEGER DEFAULT 0,
      reading_time INTEGER DEFAULT 0            -- 预估阅读时间(分钟)
    )
  `);

  // 2. 平台表
  db.exec(`
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,                -- 平台名称: zhihu, xiaohongshu等
      display_name TEXT NOT NULL,              -- 显示名称: 知乎, 小红书
      icon_url TEXT,                           -- 平台图标
      base_url TEXT NOT NULL,                  -- 平台基础URL
      login_url TEXT,                          -- 登录页面URL
      publish_url TEXT,                        -- 发布页面URL
      config_schema TEXT,                      -- JSON: 平台特定配置项
      is_active BOOLEAN DEFAULT 1,
      priority INTEGER DEFAULT 0,              -- 发布优先级
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. 用户平台配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_platform_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL,
      config_name TEXT NOT NULL,               -- 配置名称
      config_data TEXT NOT NULL,               -- JSON: 配置数据
      is_default BOOLEAN DEFAULT 0,           -- 是否默认配置
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
    )
  `);

  // 4. 登录会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL,
      session_name TEXT NOT NULL,              -- 会话名称
      cookies TEXT NOT NULL,                   -- JSON: 加密的Cookie数据
      user_agent TEXT,                         -- 用户代理
      login_method TEXT,                       -- 登录方式: qr_code, password等
      expires_at DATETIME,                     -- 过期时间
      is_active BOOLEAN DEFAULT 1,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
    )
  `);

  // 5. 发布任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS publish_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      platform_id INTEGER NOT NULL,
      session_id INTEGER,                      -- 使用的登录会话
      config_id INTEGER,                       -- 使用的配置ID
      status INTEGER DEFAULT 0,               -- 0:待处理 1:进行中 2:成功 3:失败
      progress INTEGER DEFAULT 0,              -- 进度百分比
      error_message TEXT,                      -- 错误信息
      retry_count INTEGER DEFAULT 0,           -- 重试次数
      max_retries INTEGER DEFAULT 3,           -- 最大重试次数
      published_url TEXT,                      -- 发布后的文章URL
      platform_article_id TEXT,                -- 平台返回的文章ID
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES login_sessions(id) ON DELETE SET NULL,
      FOREIGN KEY (config_id) REFERENCES user_platform_configs(id) ON DELETE SET NULL
    )
  `);

  // 6. 发布日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS publish_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      level TEXT NOT NULL,                     -- log level: info, warn, error
      message TEXT NOT NULL,
      details TEXT,                            -- JSON: 详细信息
      screenshot_path TEXT,                    -- 截图路径
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES publish_tasks(id) ON DELETE CASCADE
    )
  `);

  // 7. 系统配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      config_type TEXT DEFAULT 'string',       -- string, number, boolean, json
      description TEXT,
      is_encrypted BOOLEAN DEFAULT 0,          -- 是否加密存储
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. 媒体文件表
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT UNIQUE NOT NULL,          -- 文件哈希值(去重)
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,                 -- 本地文件路径
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,                           -- 图片宽度
      height INTEGER,                          -- 图片高度
      upload_status INTEGER DEFAULT 0,         -- 0:待上传 1:已上传 2:上传失败
      platform_urls TEXT,                     -- JSON: 各平台的上传URL
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建索引
  createIndexes(db);

  // 插入初始数据
  insertInitialData(db);
}

/**
 * 回滚迁移
 */
function down(db) {
  // 删除表（按依赖关系逆序）
  const tables = [
    'media_files',
    'system_configs',
    'publish_logs',
    'publish_tasks',
    'login_sessions',
    'user_platform_configs',
    'platforms',
    'articles'
  ];

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  });
}

/**
 * 创建索引
 */
function createIndexes(db) {
  // 文章查询优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC)');

  // 发布任务查询优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON publish_tasks(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_article_platform ON publish_tasks(article_id, platform_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON publish_tasks(created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_article_id ON publish_tasks(article_id)');

  // 登录会话优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_platform_active ON login_sessions(platform_id, is_active)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON login_sessions(expires_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_last_used ON login_sessions(last_used_at DESC)');

  // 媒体文件优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_media_hash ON media_files(file_hash)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_media_upload_status ON media_files(upload_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_media_created_at ON media_files(created_at DESC)');

  // 发布日志优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_task_id ON publish_logs(task_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_created_at ON publish_logs(created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_level ON publish_logs(level)');

  // 系统配置优化
  db.exec('CREATE INDEX IF NOT EXISTS idx_configs_key ON system_configs(config_key)');
}

/**
 * 插入初始数据
 */
function insertInitialData(db) {
  // 插入默认平台
  const platforms = [
    {
      name: 'zhihu',
      display_name: '知乎',
      base_url: 'https://www.zhihu.com',
      login_url: 'https://www.zhihu.com/signin',
      publish_url: 'https://zhuanlan.zhihu.com/write',
      priority: 1,
      is_active: 1
    },
    {
      name: 'xiaohongshu',
      display_name: '小红书',
      base_url: 'https://www.xiaohongshu.com',
      login_url: 'https://www.xiaohongshu.com/login',
      publish_url: 'https://creator.xiaohongshu.com/publish/publish',
      priority: 2,
      is_active: 1
    },
    {
      name: 'baijiahao',
      display_name: '百家号',
      base_url: 'https://baijiahao.baidu.com',
      login_url: 'https://baijiahao.baidu.com/builder/rc/login',
      publish_url: 'https://baijiahao.baidu.com/builder/rc/edit',
      priority: 3,
      is_active: 1
    },
    {
      name: 'toutiaohao',
      display_name: '头条号',
      base_url: 'https://mp.toutiao.com',
      login_url: 'https://mp.toutiao.com/profile_v4/index',
      publish_url: 'https://mp.toutiao.com/profile_v4/graph/publish/entry',
      priority: 4,
      is_active: 1
    },
    {
      name: 'zhishixingqiu',
      display_name: '知识星球',
      base_url: 'https://wx.zsxq.com',
      login_url: 'https://wx.zsxq.com/dweb2/login',
      publish_url: 'https://wx.zsxq.com/dweb2/creation',
      priority: 5,
      is_active: 1
    },
    {
      name: 'juejin',
      display_name: '掘金',
      base_url: 'https://juejin.cn',
      login_url: 'https://juejin.cn/login',
      publish_url: 'https://juejin.cn/editor/drafts/new',
      priority: 6,
      is_active: 1
    },
    {
      name: 'csdn',
      display_name: 'CSDN',
      base_url: 'https://mp.csdn.net',
      login_url: 'https://passport.csdn.net/login',
      publish_url: 'https://mp.csdn.net/mpblog/album',
      priority: 7,
      is_active: 1
    }
  ];

  platforms.forEach(platform => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO platforms (
        name, display_name, base_url, login_url, publish_url,
        priority, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run([
      platform.name,
      platform.display_name,
      platform.base_url,
      platform.login_url,
      platform.publish_url,
      platform.priority,
      platform.is_active
    ]);
  });

  // 插入系统配置
  const configs = [
    { key: 'app_version', value: '1.0.0', type: 'string', description: '应用版本' },
    { key: 'auto_save_interval', value: '30', type: 'number', description: '自动保存间隔(秒)' },
    { key: 'max_retry_count', value: '3', type: 'number', description: '最大重试次数' },
    { key: 'enable_cloud_backup', value: 'false', type: 'boolean', description: '启用云端备份' },
    { key: 'publish_timeout', value: '300', type: 'number', description: '发布超时时间(秒)' },
    { key: 'max_concurrent_publish', value: '3', type: 'number', description: '最大并发发布数' },
    { key: 'image_upload_max_size', value: '10485760', type: 'number', description: '图片上传最大尺寸(字节)' },
    { key: 'enable_auto_retry', value: 'true', type: 'boolean', description: '启用自动重试' },
    { key: 'log_retention_days', value: '30', type: 'number', description: '日志保留天数' },
    { key: 'enable_debug_mode', value: 'false', type: 'boolean', description: '启用调试模式' }
  ];

  configs.forEach(config => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO system_configs (
        config_key, config_value, config_type, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run([config.key, config.value, config.type, config.description]);
  });

  console.log('初始数据插入完成');
}

module.exports = { up, down };