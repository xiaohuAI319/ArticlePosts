/**
 * 平台自动化登录服务 - T015
 * 负责各平台的自动化登录实现，支持扫码登录、密码登录等多种方式
 * 集成T014浏览器管理和T012登录会话管理
 */

const { BrowserManager } = require('../automation/BrowserManager');
const LoginSessionService = require('./LoginSessionService');
const QRCodeService = require('./QRCodeService');
const PlatformService = require('./PlatformService');

class PlatformAutoLoginService {
  constructor() {
    this.browserManager = new BrowserManager();
    this.loginSessionService = null;
    this.qrCodeService = null;
    this.platformService = null;
    this.activeLogins = new Map(); // 存储活跃的登录流程
    this.loginEventEmitter = null; // 登录事件发射器
  }

  /**
   * 初始化平台自动化登录服务
   */
  async initialize() {
    try {
      // 初始化依赖服务
      this.loginSessionService = new LoginSessionService();
      await this.loginSessionService.initialize();

      this.qrCodeService = new QRCodeService();
      await this.qrCodeService.initialize();

      this.platformService = new PlatformService();
      await this.platformService.initialize();

      // 初始化事件发射器
      this.loginEventEmitter = new (require('events').EventEmitter)();

      console.log('平台自动化登录服务初始化成功');

      return {
        success: true,
        message: '平台自动化登录服务初始化成功'
      };
    } catch (error) {
      console.error('平台自动化登录服务初始化失败:', error);
      return {
        success: false,
        error: error.message,
        message: '平台自动化登录服务初始化失败'
      };
    }
  }

  /**
   * 启动平台登录流程
   * @param {string} platformId - 平台ID
   * @param {object} options - 登录选项
   */
  async startPlatformLogin(platformId, options = {}) {
    try {
      // 验证平台配置
      const platformResult = await this.platformService.getPlatform(platformId);
      if (!platformResult.success) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      const platform = platformResult.data;
      const loginId = this.generateLoginId();

      console.log(`开始平台登录流程: ${platform.name} (ID: ${platformId}, LoginID: ${loginId})`);

      // 创建登录流程状态
      const loginState = {
        id: loginId,
        platformId,
        platformName: platform.name,
        status: 'starting',
        method: platform.config_schema?.auth_method || 'qr_code',
        startTime: Date.now(),
        browserId: null,
        page: null,
        sessionId: null,
        qrCodeData: null,
        error: null,
        options
      };

      this.activeLogins.set(loginId, loginState);

      // 异步执行登录流程
      this.executeLoginFlow(loginState, platform).catch(error => {
        console.error(`登录流程执行失败 (${loginId}):`, error);
        loginState.status = 'failed';
        loginState.error = error.message;
        this.emitLoginEvent(loginId, 'login_failed', { error: error.message });
      });

      return {
        success: true,
        data: {
          loginId,
          platformId,
          platformName: platform.name,
          method: loginState.method,
          status: loginState.status
        },
        message: '登录流程已启动'
      };
    } catch (error) {
      console.error('启动平台登录失败:', error);
      return {
        success: false,
        error: error.message,
        message: '启动平台登录失败'
      };
    }
  }

  /**
   * 执行登录流程
   * @param {object} loginState - 登录状态
   * @param {object} platform - 平台配置
   */
  async executeLoginFlow(loginState, platform) {
    try {
      // 创建浏览器实例
      const browserResult = await this.browserManager.createBrowser({
        headless: false, // 登录过程需要用户可见
        stealth: true,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      if (!browserResult.success) {
        throw new Error(`创建浏览器失败: ${browserResult.message}`);
      }

      loginState.browserId = browserResult.data.browserId;
      loginState.status = 'browser_created';
      this.emitLoginEvent(loginState.id, 'browser_created', { browserId: loginState.browserId });

      // 获取浏览器实例和页面
      const browser = this.browserManager.getBrowser(loginState.browserId);
      if (!browser) {
        throw new Error('浏览器实例获取失败');
      }

      // 创建新页面
      const page = await browser.browser.newPage();
      loginState.page = page;

      // 设置页面配置
      await this.setupPageForLogin(page, platform);

      // 根据登录方法执行不同的登录策略
      switch (loginState.method) {
        case 'qr_code':
          await this.executeQRCodeLogin(loginState, platform, page);
          break;
        case 'password':
          await this.executePasswordLogin(loginState, platform, page);
          break;
        default:
          throw new Error(`不支持的登录方法: ${loginState.method}`);
      }

    } catch (error) {
      console.error(`登录流程执行失败 (${loginState.id}):`, error);
      loginState.status = 'failed';
      loginState.error = error.message;
      this.emitLoginEvent(loginState.id, 'login_failed', { error: error.message });
    }
  }

  /**
   * 设置页面登录配置
   * @param {object} page - Puppeteer页面实例
   * @param {object} platform - 平台配置
   */
  async setupPageForLogin(page, platform) {
    // 设置用户代理
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ];

    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    // 设置视口
    await page.setViewport({ width: 1366, height: 768 });

    // 添加反检测脚本
    await page.evaluateOnNewDocument(() => {
      // 移除webdriver标识
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // 修改插件信息
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 修改语言信息
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en'],
      });
    });

    console.log(`页面配置完成，准备访问登录页面: ${platform.login_url}`);
  }

  /**
   * 执行扫码登录
   * @param {object} loginState - 登录状态
   * @param {object} platform - 平台配置
   * @param {object} page - Puppeteer页面实例
   */
  async executeQRCodeLogin(loginState, platform, page) {
    try {
      loginState.status = 'navigating_to_login';
      this.emitLoginEvent(loginState.id, 'navigating_to_login', { url: platform.login_url });

      // 访问登录页面
      await page.goto(platform.login_url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`已访问登录页面: ${platform.login_url}`);

      // 等待二维码加载
      loginState.status = 'waiting_qrcode';
      this.emitLoginEvent(loginState.id, 'waiting_qrcode');

      // 获取二维码配置
      const authConfig = platform.config_schema?.auth_config || {};
      const qrSelector = authConfig.qr_selector || '.qrcode';
      const maxAttempts = authConfig.max_attempts || 60;
      const refreshInterval = authConfig.refresh_interval || 3000;

      console.log(`等待二维码加载，选择器: ${qrSelector}`);

      // 等待二维码元素出现
      let qrElement = null;
      try {
        await page.waitForSelector(qrSelector, { timeout: 10000 });
        qrElement = await page.$(qrSelector);
      } catch (error) {
        console.error('二维码元素未找到:', error);
        throw new Error('二维码加载失败，请检查页面结构');
      }

      // 生成二维码数据
      const qrCodeData = await this.generateQRCodeData(page, qrElement, platform);
      loginState.qrCodeData = qrCodeData;

      console.log('二维码数据已生成');

      // 发送二维码就绪事件
      this.emitLoginEvent(loginState.id, 'qrcode_ready', {
        qrCodeData,
        loginUrl: platform.login_url
      });

      // 监控登录状态
      await this.monitorQRCodeLogin(loginState, platform, page, qrSelector, maxAttempts, refreshInterval);

    } catch (error) {
      console.error(`扫码登录失败 (${loginState.id}):`, error);
      throw error;
    }
  }

  /**
   * 生成二维码数据
   * @param {object} page - Puppeteer页面实例
   * @param {object} qrElement - 二维码元素
   * @param {object} platform - 平台配置
   */
  async generateQRCodeData(page, qrElement, platform) {
    try {
      // 方法1: 尝试获取二维码图片
      let qrDataUrl = null;
      try {
        qrDataUrl = await qrElement.screenshot({ encoding: 'base64' });
      } catch (error) {
        console.log('无法直接截图二维码元素，尝试其他方法');
      }

      // 方法2: 尝试获取二维码背景图片
      if (!qrDataUrl) {
        try {
          const backgroundImage = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.backgroundImage;
          }, qrElement);

          if (backgroundImage && backgroundImage.startsWith('url(')) {
            const imageUrl = backgroundImage.slice(5, -2); // 移除 url(" 和 ")
            // 这里可以进一步处理图片URL
            qrDataUrl = imageUrl;
          }
        } catch (error) {
          console.log('无法获取二维码背景图片');
        }
      }

      // 方法3: 获取页面截图作为备用
      if (!qrDataUrl) {
        const pageScreenshot = await page.screenshot({
          encoding: 'base64',
          clip: await qrElement.boundingBox()
        });
        qrDataUrl = pageScreenshot;
      }

      return {
        type: 'qrcode',
        data: qrDataUrl,
        platform: platform.name,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('生成二维码数据失败:', error);
      throw new Error('二维码数据生成失败');
    }
  }

  /**
   * 监控扫码登录状态
   * @param {object} loginState - 登录状态
   * @param {object} platform - 平台配置
   * @param {object} page - Puppeteer页面实例
   * @param {string} qrSelector - 二维码选择器
   * @param {number} maxAttempts - 最大尝试次数
   * @param {number} refreshInterval - 检查间隔
   */
  async monitorQRCodeLogin(loginState, platform, page, qrSelector, maxAttempts, refreshInterval) {
    console.log(`开始监控扫码状态，最大尝试次数: ${maxAttempts}，检查间隔: ${refreshInterval}ms`);

    let attempts = 0;

    while (attempts < maxAttempts && loginState.status !== 'success') {
      attempts++;

      try {
        // 检查是否还在二维码页面
        const currentUrl = page.url();
        console.log(`第${attempts}次检查，当前URL: ${currentUrl}`);

        // 检查登录成功的标志
        const isLoggedIn = await this.checkLoginStatus(page, platform);

        if (isLoggedIn) {
          await this.handleLoginSuccess(loginState, platform, page);
          return;
        }

        // 检查二维码是否过期
        const isQRExpired = await this.checkQRCodeExpired(page, qrSelector);
        if (isQRExpired) {
          // 刷新二维码
          console.log('二维码已过期，尝试刷新');
          await this.refreshQRCode(page, qrSelector);

          // 重新生成二维码数据
          const qrElement = await page.$(qrSelector);
          if (qrElement) {
            const newQRData = await this.generateQRCodeData(page, qrElement, platform);
            loginState.qrCodeData = newQRData;

            this.emitLoginEvent(loginState.id, 'qrcode_refreshed', {
              qrCodeData: newQRData,
              attempt: attempts
            });
          }
        }

        // 发送进度事件
        this.emitLoginEvent(loginState.id, 'login_progress', {
          attempt: attempts,
          maxAttempts,
          status: 'waiting_scan'
        });

        // 等待下次检查
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, refreshInterval));
        }

      } catch (error) {
        console.error(`登录状态检查失败 (${loginState.id}, attempt ${attempts}):`, error);

        if (attempts >= maxAttempts) {
          throw error;
        }

        // 继续尝试
        await new Promise(resolve => setTimeout(resolve, refreshInterval));
      }
    }

    // 超时处理
    throw new Error(`登录超时，已尝试${maxAttempts}次`);
  }

  /**
   * 检查登录状态
   * @param {object} page - Puppeteer页面实例
   * @param {object} platform - 平台配置
   */
  async checkLoginStatus(page, platform) {
    try {
      const currentUrl = page.url();

      // 通用登录成功检查：URL变化
      const loginUrl = platform.login_url;
      const publishUrl = platform.publish_url;
      const baseUrl = platform.base_url;

      // 如果不再是登录页面，可能已登录成功
      if (!currentUrl.startsWith(loginUrl) || currentUrl.includes('/dashboard') || currentUrl.includes('/home')) {
        console.log('检测到URL变化，可能登录成功');
        return true;
      }

      // 平台特定检查
      switch (platform.name) {
        case '知乎':
          // 检查知乎登录成功的标志
          const zhihuSelectors = ['.AppHeader-profile', '.ProfileHeader-name', '[data-za-detail-view-element_name="User"]'];
          for (const selector of zhihuSelectors) {
            const element = await page.$(selector);
            if (element) {
              console.log(`检测到知乎登录成功标志: ${selector}`);
              return true;
            }
          }
          break;

        case '小红书':
          // 检查小红书登录成功的标志
          const xhsSelectors = ['.user-info', '.avatar', '.profile-name'];
          for (const selector of xhsSelectors) {
            const element = await page.$(selector);
            if (element) {
              console.log(`检测到小红书登录成功标志: ${selector}`);
              return true;
            }
          }
          break;
      }

      return false;

    } catch (error) {
      console.error('检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 检查二维码是否过期
   * @param {object} page - Puppeteer页面实例
   * @param {string} qrSelector - 二维码选择器
   */
  async checkQRCodeExpired(page, qrSelector) {
    try {
      // 检查二维码元素是否存在
      const qrElement = await page.$(qrSelector);
      if (!qrElement) {
        return true; // 元素不存在，可能已过期
      }

      // 检查是否有过期提示文本
      const expiredTexts = ['二维码已过期', 'refresh', '重新加载', '刷新'];
      const pageText = await page.evaluate(() => document.body.innerText);

      return expiredTexts.some(text => pageText.includes(text));

    } catch (error) {
      console.error('检查二维码过期状态失败:', error);
      return false;
    }
  }

  /**
   * 刷新二维码
   * @param {object} page - Puppeteer页面实例
   * @param {string} qrSelector - 二维码选择器
   */
  async refreshQRCode(page, qrSelector) {
    try {
      // 尝试点击刷新按钮
      const refreshSelectors = [
        '.refresh-btn', '.reload-btn', '[title="刷新"]',
        '.qrcode-refresh', '.refresh-qrcode'
      ];

      for (const selector of refreshSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            console.log('已点击刷新按钮');
            return;
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      // 如果没有刷新按钮，尝试重新加载页面
      console.log('未找到刷新按钮，重新加载页面');
      await page.reload();

    } catch (error) {
      console.error('刷新二维码失败:', error);
    }
  }

  /**
   * 处理登录成功
   * @param {object} loginState - 登录状态
   * @param {object} platform - 平台配置
   * @param {object} page - Puppeteer页面实例
   */
  async handleLoginSuccess(loginState, platform, page) {
    try {
      console.log(`登录成功: ${platform.name} (${loginState.id})`);

      loginState.status = 'success';

      // 获取登录后的cookies
      const cookies = await page.cookies();
      const userAgent = await page.evaluate(() => navigator.userAgent);

      // 创建登录会话
      const sessionResult = await this.loginSessionService.createSession(platform.id, {
        sessionName: `${platform.name}登录_${new Date().toLocaleString()}`,
        cookies,
        userAgent,
        loginMethod: 'qr_code',
        expiresAt: this.loginSessionService.calculateDefaultExpiry()
      });

      if (sessionResult.success) {
        loginState.sessionId = sessionResult.data.id;
        console.log(`登录会话创建成功: ${sessionResult.data.id}`);
      }

      // 发送登录成功事件
      this.emitLoginEvent(loginState.id, 'login_success', {
        sessionId: sessionResult.data?.id,
        platform: platform.name,
        cookies: cookies.length
      });

    } catch (error) {
      console.error(`处理登录成功失败 (${loginState.id}):`, error);
      loginState.status = 'success_with_error';
      loginState.error = error.message;
      this.emitLoginEvent(loginState.id, 'login_success_with_error', { error: error.message });
    }
  }

  /**
   * 执行密码登录（预留接口）
   * @param {object} loginState - 登录状态
   * @param {object} platform - 平台配置
   * @param {object} page - Puppeteer页面实例
   */
  async executePasswordLogin(loginState, platform, page) {
    // TODO: 实现密码登录逻辑
    throw new Error('密码登录功能暂未实现');
  }

  /**
   * 获取登录状态
   * @param {string} loginId - 登录ID
   */
  async getLoginStatus(loginId) {
    const loginState = this.activeLogins.get(loginId);
    if (!loginState) {
      return {
        success: false,
        error: 'Login not found',
        message: '登录流程不存在'
      };
    }

    return {
      success: true,
      data: {
        id: loginState.id,
        platformId: loginState.platformId,
        platformName: loginState.platformName,
        status: loginState.status,
        method: loginState.method,
        startTime: loginState.startTime,
        sessionId: loginState.sessionId,
        qrCodeData: loginState.qrCodeData,
        error: loginState.error
      },
      message: '获取登录状态成功'
    };
  }

  /**
   * 取消登录流程
   * @param {string} loginId - 登录ID
   */
  async cancelLogin(loginId) {
    try {
      const loginState = this.activeLogins.get(loginId);
      if (!loginState) {
        return {
          success: false,
          error: 'Login not found',
          message: '登录流程不存在'
        };
      }

      // 关闭浏览器
      if (loginState.browserId) {
        await this.browserManager.closeBrowser(loginState.browserId);
      }

      // 更新状态
      loginState.status = 'cancelled';
      this.emitLoginEvent(loginId, 'login_cancelled');

      // 清理登录状态
      this.activeLogins.delete(loginId);

      return {
        success: true,
        message: '登录流程已取消'
      };
    } catch (error) {
      console.error('取消登录失败:', error);
      return {
        success: false,
        error: error.message,
        message: '取消登录失败'
      };
    }
  }

  /**
   * 发射登录事件
   * @param {string} loginId - 登录ID
   * @param {string} eventType - 事件类型
   * @param {object} data - 事件数据
   */
  emitLoginEvent(loginId, eventType, data = {}) {
    if (this.loginEventEmitter) {
      this.loginEventEmitter.emit('login_event', {
        loginId,
        eventType,
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 监听登录事件
   * @param {function} listener - 事件监听器
   */
  onLoginEvent(listener) {
    if (this.loginEventEmitter) {
      this.loginEventEmitter.on('login_event', listener);
    }
  }

  /**
   * 生成登录ID
   */
  generateLoginId() {
    return `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理完成的登录流程
   */
  cleanupCompletedLogins() {
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10分钟超时

    for (const [loginId, loginState] of this.activeLogins.entries()) {
      const age = now - loginState.startTime;

      // 清理超时或已完成的登录流程
      if (age > timeout || ['success', 'failed', 'cancelled'].includes(loginState.status)) {
        if (loginState.browserId) {
          this.browserManager.closeBrowser(loginState.browserId).catch(console.error);
        }
        this.activeLogins.delete(loginId);
      }
    }
  }

  /**
   * 获取活跃登录列表
   */
  getActiveLogins() {
    const logins = [];
    for (const [loginId, loginState] of this.activeLogins.entries()) {
      logins.push({
        id: loginId,
        platformId: loginState.platformId,
        platformName: loginState.platformName,
        status: loginState.status,
        method: loginState.method,
        startTime: loginState.startTime,
        sessionId: loginState.sessionId,
        error: loginState.error
      });
    }
    return logins;
  }
}

module.exports = PlatformAutoLoginService;