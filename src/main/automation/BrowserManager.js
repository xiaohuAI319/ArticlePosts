/**
 * T014 BrowserManager Puppeteer浏览器集成核心服务
 * 提供浏览器实例管理、隐身模式、反检测功能
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

class BrowserManager {
  constructor(config = {}) {
    // 默认配置
    this.config = {
      headless: false, // 可视化模式
      stealth: true, // 隐身模式
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      userDataDir: null, // 自动生成用户数据目录
      executablePath: null, // 自动检测Chrome路径
      args: [], // 额外的Chrome参数
      ...config
    };

    // 浏览器实例管理
    this.browsers = new Map(); // browserId -> browser实例
    this.browserMetadata = new Map(); // browserId -> 元数据
    this.stats = {
      totalCreated: 0,
      totalClosed: 0,
      activeBrowsers: 0
    };

    // 健康状态
    this.isHealthy = true;
    this.errors = [];
    this.maxErrors = 50; // 最大错误记录数

    // 资源清理定时器
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 5 * 60 * 1000; // 5分钟清理一次

    // 验证配置
    this._validateConfig();
  }

  /**
   * 验证配置参数
   */
  _validateConfig() {
    if (typeof this.config.headless !== 'boolean') {
      throw new Error('headless配置必须是布尔值');
    }

    if (this.config.executablePath && typeof this.config.executablePath !== 'string') {
      throw new Error('executablePath配置必须是字符串');
    }

    if (this.config.defaultViewport && typeof this.config.defaultViewport !== 'object') {
      throw new Error('defaultViewport配置必须是对象');
    }
  }

  /**
   * 自动检测Chrome可执行文件路径
   */
  _detectChromePath() {
    const platform = os.platform();
    let chromePath = null;

    try {
      if (platform === 'win32') {
        // Windows系统检测Chrome路径 - 优先使用用户目录，避免权限问题
        const possiblePaths = [
          path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];

        for (const chromePath of possiblePaths) {
          try {
            // 仅检查文件是否存在，避免执行Chrome命令
            const fs = require('fs');
            if (fs.existsSync(chromePath)) {
              // 检查文件是否为可执行文件
              const stats = fs.statSync(chromePath);
              if (stats.isFile() && stats.size > 0) {
                return chromePath;
              }
            }
          } catch (e) {
            // 继续尝试下一个路径
          }
        }

        // 尝试通过注册表查找
        try {
          const regOutput = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /v Path', {
            encoding: 'utf8',
            timeout: 3000 // 3秒超时
          });
          const match = regOutput.match(/REG_\w+\s+(.+)/);
          if (match) {
            const regPath = match[1].trim();
            const fullChromePath = path.join(regPath, 'chrome.exe');
            const fs = require('fs');
            // 验证注册表路径中的文件是否存在
            if (fs.existsSync(fullChromePath)) {
              return fullChromePath;
            }
          }
        } catch (e) {
          // 注册表查找失败
        }

      } else if (platform === 'darwin') {
        // macOS系统检测Chrome路径
        const possiblePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ];

        for (const chromePath of possiblePaths) {
          try {
            execSync(`"${chromePath}" --version`, { stdio: 'ignore' });
            return chromePath;
          } catch (e) {
            // 继续尝试下一个路径
          }
        }

      } else if (platform === 'linux') {
        // Linux系统检测Chrome路径
        try {
          const chromePath = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf8' });
          return chromePath.trim();
        } catch (e) {
          // Linux Chrome查找失败
        }
      }
    } catch (error) {
      this._recordError(`Chrome路径检测失败: ${error.message}`);
    }

    return null;
  }

  /**
   * 获取隐身模式配置
   */
  getStealthConfig() {
    return {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-sync'
      ],
      userDataDir: this.config.userDataDir || path.join(os.tmpdir(), `browser-${crypto.randomBytes(8).toString('hex')}`),
      viewport: this.config.defaultViewport,
      ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled']
    };
  }

  /**
   * 获取兼容性启动配置（用于fallback）
   */
  getCompatibleConfig() {
    return {
      args: [], // 完全不使用任何自定义参数
      viewport: this.config.defaultViewport,
      ignoreDefaultArgs: [] // 不忽略任何默认参数
    };
  }

  /**
   * 创建浏览器实例
   */
  async createBrowser(customConfig = {}) {
    try {
      const browserId = this._generateBrowserId();
      const mergedConfig = { ...this.config, ...customConfig };

      // 构建启动参数
      const launchOptions = {
        headless: mergedConfig.headless,
        defaultViewport: mergedConfig.defaultViewport,
        // 移除userDataDir，让Chrome使用默认配置
        ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled']
      };

      // 添加隐身模式参数
      if (mergedConfig.stealth) {
        const stealthConfig = this.getStealthConfig();
        launchOptions.args = [...(mergedConfig.args || []), ...stealthConfig.args];
      } else {
        launchOptions.args = mergedConfig.args || [];
      }

      // 设置可执行路径
      if (mergedConfig.executablePath) {
        launchOptions.executablePath = mergedConfig.executablePath;
      } else {
        // 自动检测Chrome路径
        const detectedPath = this._detectChromePath();
        if (detectedPath) {
          launchOptions.executablePath = detectedPath;
          this._recordSuccess(`自动检测到Chrome路径: ${detectedPath}`);
        } else {
          throw new Error('未找到Chrome浏览器，请确保已安装Google Chrome');
        }
      }

      let browser = null;
      let usingFallback = false;

      // 尝试使用隐身模式启动
      try {
        browser = await Promise.race([
          puppeteer.launch(launchOptions),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('浏览器启动超时')), 15000)
          )
        ]);
      } catch (stealthError) {
        // 使用兼容性配置重试
        const compatibleConfig = this.getCompatibleConfig();
        const fallbackOptions = {
          ...launchOptions,
          args: [...(mergedConfig.args || []), ...compatibleConfig.args],
          ignoreDefaultArgs: compatibleConfig.ignoreDefaultArgs
        };

        try {
          browser = await Promise.race([
            puppeteer.launch(fallbackOptions),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('浏览器启动超时')), 15000)
            )
          ]);
          usingFallback = true;
        } catch (fallbackError) {
          throw new Error(`浏览器启动失败 - 隐身模式: ${stealthError.message}, 兼容模式: ${fallbackError.message}`);
        }
      }

      // 验证浏览器是否正确启动并连接
      if (!browser) {
        throw new Error('浏览器启动失败');
      }

      // 等待浏览器完全连接
      let connectionAttempts = 0;
      const maxConnectionAttempts = 10;
      while (!browser.isConnected() && connectionAttempts < maxConnectionAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        connectionAttempts++;
      }

      if (!browser.isConnected()) {
        throw new Error('浏览器启动后未正确连接');
      }

      // 验证进程是否存在
      const process = browser.process();
      if (!process || !process.pid) {
        throw new Error('浏览器进程未正确启动');
      }

      // 存储浏览器实例
      this.browsers.set(browserId, browser);
      this.browserMetadata.set(browserId, {
        id: browserId,
        createdAt: new Date(),
        config: mergedConfig,
        lastActivity: new Date(),
        processId: process.pid
      });

      // 更新统计
      this.stats.totalCreated++;
      this.stats.activeBrowsers++;

      // 监听浏览器断开事件
      browser.on('disconnected', () => {
        this._handleBrowserDisconnection(browserId);
      });

      // 监听进程退出事件
      if (process) {
        process.on('exit', () => {
          this._handleBrowserDisconnection(browserId);
        });
      }

      // 记录成功事件
      this._recordSuccess(`浏览器实例创建成功 [${browserId}]`);

      return {
        success: true,
        data: {
          browserId,
          browser,
          processId: process.pid
        },
        message: '浏览器实例创建成功'
      };

    } catch (error) {
      const errorMsg = `创建浏览器实例失败: ${error.message}`;
      this._recordError(errorMsg);
      return {
        success: false,
        error: error.message,
        message: errorMsg
      };
    }
  }

  /**
   * 关闭浏览器实例
   */
  async closeBrowser(browser) {
    try {
      const browserId = this._getBrowserId(browser);

      if (!browserId) {
        throw new Error('浏览器实例未找到');
      }

      // 检查浏览器是否连接
      if (browser && browser.isConnected()) {
        await browser.close();
      }

      // 清理元数据
      this.browserMetadata.delete(browserId);

      // 更新统计
      this.stats.totalClosed++;
      this.stats.activeBrowsers--;

      this._recordSuccess(`浏览器实例关闭成功 [${browserId}]`);

    } catch (error) {
      const errorMsg = `关闭浏览器实例失败: ${error.message}`;
      this._recordError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * 获取浏览器实例
   */
  getBrowser(browserId) {
    const browser = this.browsers.get(browserId);

    if (!browser) {
      return null;
    }

    // 检查浏览器是否仍然连接
    if (!browser.isConnected()) {
      this.browsers.delete(browserId);
      this.browserMetadata.delete(browserId);
      this.stats.activeBrowsers--;
      return null;
    }

    // 更新最后活动时间
    const metadata = this.browserMetadata.get(browserId);
    if (metadata) {
      metadata.lastActivity = new Date();
    }

    return browser;
  }

  /**
   * 获取所有浏览器实例
   */
  getAllBrowsers() {
    const activeBrowsers = [];

    for (const [browserId, browser] of this.browsers.entries()) {
      if (browser.isConnected()) {
        activeBrowsers.push({
          id: browserId,
          browser,
          metadata: this.browserMetadata.get(browserId)
        });
      } else {
        // 清理已断开的浏览器
        this.browsers.delete(browserId);
        this.browserMetadata.delete(browserId);
        this.stats.activeBrowsers--;
      }
    }

    return activeBrowsers;
  }

  /**
   * 获取活跃浏览器数量
   */
  getActiveBrowsersCount() {
    return this.stats.activeBrowsers;
  }

  /**
   * 检查浏览器是否连接
   */
  isBrowserConnected(browser) {
    return browser && browser.isConnected();
  }

  /**
   * 获取浏览器ID
   */
  getBrowserId(browser) {
    for (const [browserId, storedBrowser] of this.browsers.entries()) {
      if (storedBrowser === browser) {
        return browserId;
      }
    }
    return null;
  }

  /**
   * 获取健康状态
   */
  getHealthStatus() {
    const memoryUsage = process.memoryUsage();

    return {
      healthy: this.isHealthy,
      browsersCount: this.stats.activeBrowsers,
      errors: [...this.errors],
      memoryUsage: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      uptime: process.uptime(),
      lastCleanup: this.lastCleanupTime
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 清理所有浏览器实例
   */
  async cleanup() {
    try {
      const closePromises = [];

      for (const [browserId, browser] of this.browsers.entries()) {
        if (browser.isConnected()) {
          closePromises.push(
            browser.close().catch(error => {
              this._recordError(`关闭浏览器 [${browserId}] 失败: ${error.message}`);
            })
          );
        }
      }

      await Promise.all(closePromises);

      // 清理所有数据
      this.browsers.clear();
      this.browserMetadata.clear();
      this.stats.activeBrowsers = 0;

      // 清理定时器
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      this.lastCleanupTime = new Date();
      this._recordSuccess('所有浏览器实例清理完成');

    } catch (error) {
      const errorMsg = `清理浏览器实例失败: ${error.message}`;
      this._recordError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * 启动自动清理
   */
  startAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this._performAutoCleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 执行自动清理
   */
  _performAutoCleanup() {
    try {
      const now = new Date();
      const browsersToCleanup = [];
      const disconnectedBrowsers = [];

      // 首先检查所有浏览器的连接状态
      for (const [browserId, browser] of this.browsers.entries()) {
        if (!browser.isConnected()) {
          disconnectedBrowsers.push(browserId);
        }
      }

      // 清理已断开的浏览器
      disconnectedBrowsers.forEach(browserId => {
        this._handleBrowserDisconnection(browserId);
      });

      // 然后检查长时间不活跃的浏览器
      for (const [browserId, metadata] of this.browserMetadata.entries()) {
        const inactiveTime = now - metadata.lastActivity;
        const maxInactiveTime = 30 * 60 * 1000; // 30分钟

        if (inactiveTime > maxInactiveTime) {
          browsersToCleanup.push(browserId);
        }
      }

      // 清理长时间不活跃的浏览器
      browsersToCleanup.forEach(browserId => {
        const browser = this.browsers.get(browserId);
        if (browser && browser.isConnected()) {
          browser.close().catch(() => {});
        }
        this.browsers.delete(browserId);
        this.browserMetadata.delete(browserId);
        if (this.stats.activeBrowsers > 0) {
          this.stats.activeBrowsers--;
          this.stats.totalClosed++;
        }
      });

      if (disconnectedBrowsers.length > 0) {
        this._recordSuccess(`自动清理了 ${disconnectedBrowsers.length} 个已断开的浏览器实例`);
      }

      if (browsersToCleanup.length > 0) {
        this._recordSuccess(`自动清理了 ${browsersToCleanup.length} 个不活跃的浏览器实例`);
      }

    } catch (error) {
      this._recordError(`自动清理失败: ${error.message}`);
    }
  }

  /**
   * 处理浏览器断开连接
   */
  _handleBrowserDisconnection(browserId) {
    this.browsers.delete(browserId);
    this.browserMetadata.delete(browserId);

    // 更新统计信息
    if (this.stats.activeBrowsers > 0) {
      this.stats.activeBrowsers--;
      this.stats.totalClosed++;
    }

    this._recordSuccess(`浏览器实例断开连接 [${browserId}]`);
  }

  /**
   * 生成浏览器ID
   */
  _generateBrowserId() {
    return `browser_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 获取浏览器ID（通过实例）
   */
  _getBrowserId(browser) {
    for (const [browserId, storedBrowser] of this.browsers.entries()) {
      if (storedBrowser === browser) {
        return browserId;
      }
    }
    return null;
  }

  /**
   * 记录错误
   */
  _recordError(message) {
    const error = {
      message,
      timestamp: new Date(),
      type: 'error'
    };

    this.errors.push(error);

    // 保持错误记录数量限制
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.isHealthy = false;
  }

  /**
   * 记录成功事件
   */
  _recordSuccess(message) {
    const event = {
      message,
      timestamp: new Date(),
      type: 'success'
    };

    this.errors.push(event);

    // 保持记录数量限制
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.isHealthy = true;
  }

  /**
   * 销毁实例
   */
  async destroy() {
    await this.cleanup();
    this.stopAutoCleanup();
  }
}

module.exports = { BrowserManager };