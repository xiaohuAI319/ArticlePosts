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

      // 恢复已保存的登录会话
      await this.restoreExistingSessions();

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
   * 恢复已保存的登录会话
   */
  async restoreExistingSessions() {
    try {
      console.log('开始恢复已保存的登录会话...');

      // 获取所有活跃平台
      const platformsResult = await this.platformService.getAllPlatforms();
      if (!platformsResult.success) {
        console.log('无法获取平台列表，跳过会话恢复');
        return;
      }

      const platforms = platformsResult.data.filter(p => p.is_active);
      console.log(`检查 ${platforms.length} 个活跃平台的登录会话`);

      let restoredCount = 0;

      for (const platform of platforms) {
        try {
          // 获取平台的活跃会话
          const sessionsResult = await this.loginSessionService.getActiveSessions(platform.id);

          if (sessionsResult.success && sessionsResult.data.length > 0) {
            console.log(`发现平台 ${platform.name} 有 ${sessionsResult.data.length} 个活跃会话`);

            // 获取最佳会话
            const bestSessionResult = await this.loginSessionService.getBestSession(platform.id);

            if (bestSessionResult.success) {
              const session = bestSessionResult.data;

              // 检查会话是否仍然有效
              const expiryResult = await this.loginSessionService.checkSessionExpiry(session.id);

              if (expiryResult.success && !expiryResult.data.isExpired) {
                // 创建已登录状态的登录记录
                const loginId = this.generateLoginId();
                const loginState = {
                  id: loginId,
                  platformId: platform.id,
                  platformName: platform.name,
                  status: 'success', // 已登录状态
                  method: session.login_method || 'qr_code',
                  startTime: new Date(session.created_at).getTime(),
                  browserId: null, // 会话恢复不需要浏览器
                  page: null,
                  sessionId: session.id,
                  qrCodeData: null,
                  error: null,
                  options: {},
                  isRestored: true // 标记为恢复的会话
                };

                this.activeLogins.set(loginId, loginState);
                restoredCount++;

                console.log(`已恢复平台 ${platform.name} 的登录会话 (SessionID: ${session.id})`);

                // 发送会话恢复事件
                this.emitLoginEvent(loginId, 'session_restored', {
                  sessionId: session.id,
                  platform: platform.name,
                  loginMethod: session.login_method,
                  expiresAt: session.expires_at
                });
              } else {
                console.log(`平台 ${platform.name} 的会话已过期，停用会话`);
                await this.loginSessionService.deactivateSession(session.id);
              }
            }
          } else {
            console.log(`平台 ${platform.name} 没有活跃会话`);
          }
        } catch (error) {
          console.error(`恢复平台 ${platform.name} 会话失败:`, error);
        }
      }

      console.log(`会话恢复完成，共恢复 ${restoredCount} 个登录会话`);

      // 发送恢复完成事件
      this.emitLoginEvent('system', 'sessions_restored', {
        restoredCount,
        totalPlatforms: platforms.length
      });

    } catch (error) {
      console.error('恢复已保存登录会话失败:', error);
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
      const page = await browser.newPage();
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
      let qrSelector = authConfig.qr_selector || '.qrcode';
      const maxAttempts = authConfig.max_attempts || 120; // 增加最大尝试次数
      const refreshInterval = authConfig.refresh_interval || 2000; // 减少检查间隔，提高响应速度

      // 针对知乎平台，优化Canvas检测
      if (platform.name === '知乎') {
        qrSelector = 'canvas, .sign-in-qrcode img, .QRCode img, img[alt*="二维码"], .qrcode img, img[src*="qr"], canvas[id*="qr"], .yidun_smsbox-qrcode--img, [class*="qr"] canvas, [class*="QR"] canvas';
        console.log('知乎平台，使用优化的Canvas选择器');
      }

      console.log(`等待二维码加载，选择器: ${qrSelector}`);

      // 等待二维码元素出现
      let qrElement = null;
      let foundSelector = null;

      // 支持多个选择器，逐个尝试
      const selectors = qrSelector.split(',').map(s => s.trim());
      console.log(`尝试寻找二维码元素，选择器列表: ${selectors.join(', ')}`);

      // 先检查页面加载状态
      const pageReady = await page.evaluate(() => {
        return document.readyState === 'complete';
      });
      console.log(`页面加载状态: ${pageReady ? 'complete' : 'loading'}`);

      // 等待页面完全加载
      if (!pageReady) {
        console.log('等待页面完全加载...');
        try {
          await page.waitForLoadState('networkidle');
        } catch (error) {
          console.log('waitForLoadState失败，使用setTimeout代替:', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); // 额外等待3秒，给二维码更多加载时间
      }

      // 检查页面内容
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`当前页面标题: ${pageTitle}`);
      console.log(`当前页面URL: ${pageUrl}`);

      // 分析页面DOM结构，特别关注Canvas元素
      const pageAnalysis = await page.evaluate(() => {
        const allImages = document.querySelectorAll('img');
        const allCanvas = document.querySelectorAll('canvas');
        const allDivs = document.querySelectorAll('div');

        // 分析Canvas元素
        const canvasAnalysis = Array.from(allCanvas).map(canvas => {
          const rect = canvas.getBoundingClientRect();
          return {
            id: canvas.id,
            className: canvas.className,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
            hasContext: !!canvas.getContext('2d')
          };
        });

        return {
          imageCount: allImages.length,
          canvasCount: allCanvas.length,
          divCount: allDivs.length,
          imagesWithQR: Array.from(allImages).filter(img =>
            img.src.includes('qr') || img.src.includes('QR') ||
            img.alt.includes('二维码') || img.alt.includes('QR')
          ).length,
          canvasDetails: canvasAnalysis,
          bodyText: document.body.innerText.substring(0, 200) + '...'
        };
      });

      console.log('页面DOM分析结果:', JSON.stringify(pageAnalysis, null, 2));

      for (const selector of selectors) {
        try {
          console.log(`尝试选择器: ${selector}`);

          // 先检查选择器是否存在
          const selectorExists = await page.evaluate((sel) => {
            return document.querySelector(sel) !== null;
          }, selector);

          console.log(`选择器 ${selector} 是否存在: ${selectorExists}`);

          if (selectorExists) {
            qrElement = await page.$(selector);
            if (qrElement) {
              foundSelector = selector;
              console.log(`找到二维码元素，使用选择器: ${selector}`);

              // 获取元素的详细信息
              const elementInfo = await page.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return {
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  src: el.src,
                  alt: el.alt,
                  width: rect.width,
                  height: rect.height,
                  visible: rect.width > 0 && rect.height > 0
                };
              }, qrElement);

              console.log(`二维码元素详细信息:`, JSON.stringify(elementInfo, null, 2));
              break;
            }
          } else {
            console.log(`选择器 ${selector} 在页面中不存在`);
          }

          // 如果当前选择器没找到，尝试等待一下
          await page.waitForSelector(selector, { timeout: 3000 });
          qrElement = await page.$(selector);
          if (qrElement) {
            foundSelector = selector;
            console.log(`等待后找到二维码元素，使用选择器: ${selector}`);
            break;
          }

        } catch (error) {
          console.log(`选择器 ${selector} 检测失败: ${error.message}`);
          // 继续尝试下一个选择器
        }
      }

      if (!qrElement) {
        // 如果所有选择器都失败，尝试通用方法
        console.log('所有指定选择器都失败，尝试通用二维码检测方法');

        // 方法1: 查找包含二维码的图片
        const possibleImgSelectors = [
          'img[src*="qr"]',
          'img[src*="QR"]',
          'img[alt*="二维码"]',
          'img[alt*="QR"]',
          'canvas[id*="qr"]',
          'canvas[id*="QR"]',
          '.qrcode img',
          '.QRCode img',
          '.sign-in-qrcode img',
          '[class*="qr"] img',
          '[class*="QR"] img'
        ];

        for (const selector of possibleImgSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements && elements.length > 0) {
              qrElement = elements[0];
              foundSelector = selector;
              console.log(`通用方法找到二维码元素: ${selector}`);
              break;
            }
          } catch (error) {
            // 继续尝试
          }
        }
      }

      if (!qrElement) {
        // 最后尝试：截图分析页面内容
        console.log('开始页面截图分析以寻找二维码');
        try {
          const pageContent = await page.content();
          if (pageContent.includes('二维码') || pageContent.includes('qr') || pageContent.includes('QR')) {
            console.log('页面包含二维码相关内容，但无法定位元素');
            // 尝试等待更长时间让二维码加载
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 再次尝试所有选择器
            for (const selector of selectors) {
              try {
                qrElement = await page.$(selector);
                if (qrElement) {
                  foundSelector = selector;
                  console.log(`延迟等待后找到二维码元素: ${selector}`);
                  break;
                }
              } catch (error) {
                // 继续
              }
            }
          }
        } catch (error) {
          console.log('页面内容分析失败:', error.message);
        }
      }

      if (!qrElement) {
        console.log('所有二维码检测方法都失败，保存调试信息');

        // 保存页面截图用于调试
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = `debug_zhihu_${timestamp}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`已保存调试截图: ${screenshotPath}`);
        } catch (error) {
          console.log('保存截图失败:', error.message);
        }

        // 保存页面HTML源码用于调试
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const htmlPath = `debug_zhihu_${timestamp}.html`;
          const htmlContent = await page.content();
          await require('fs').promises.writeFile(htmlPath, htmlContent, 'utf8');
          console.log(`已保存调试HTML: ${htmlPath}`);
        } catch (error) {
          console.log('保存HTML失败:', error.message);
        }

        // 进行更详细的页面分析
        const detailedAnalysis = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          const qrRelatedElements = [];

          allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();
            const className = el.className;
            const id = el.id;
            const src = el.src;
            const alt = el.alt;
            const text = el.innerText || '';

            if (tagName === 'img' || tagName === 'canvas' || tagName === 'div') {
              if (
                (src && (src.includes('qr') || src.includes('QR'))) ||
                (alt && (alt.includes('二维码') || alt.includes('QR'))) ||
                (className && (className.includes('qr') || className.includes('QR'))) ||
                (id && (id.includes('qr') || id.includes('QR'))) ||
                (text && (text.includes('二维码') || text.includes('扫码') || text.includes('QR')))
              ) {
                const rect = el.getBoundingClientRect();
                qrRelatedElements.push({
                  tagName,
                  className,
                  id,
                  src,
                  alt,
                  text: text.substring(0, 100),
                  width: rect.width,
                  height: rect.height,
                  visible: rect.width > 0 && rect.height > 0
                });
              }
            }
          });

          return {
            qrRelatedCount: qrRelatedElements.length,
            qrRelatedElements: qrRelatedElements.slice(0, 10), // 最多返回10个
            totalElements: allElements.length
          };
        });

        console.log('详细页面分析结果:', JSON.stringify(detailedAnalysis, null, 2));

        console.log('二维码元素检测失败，但页面可能已包含登录信息，尝试直接监控登录状态');
        // 直接跳过二维码阶段，进入登录状态监控
        loginState.status = 'monitoring_login';
        this.emitLoginEvent(loginState.id, 'monitoring_login', {
          message: '跳过二维码检测，直接监控登录状态'
        });

        // 监控登录状态
        await this.monitorQRCodeLogin(loginState, platform, page, qrSelector, maxAttempts, refreshInterval);
        return;
      }

      console.log(`成功定位二维码元素，使用选择器: ${foundSelector}`);

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
        const screenshot = await qrElement.screenshot({
          encoding: 'base64',
          // 限制截图尺寸以减少数据量
          type: 'jpeg',
          quality: 80
        });

        // 检查数据长度，如果过长则进行压缩
        if (screenshot && screenshot.length > 500000) { // 500KB限制
          console.log(`二维码截图数据过大 (${screenshot.length} 字节)，尝试压缩`);
          // 获取元素边界框，裁剪到中心区域
          const boundingBox = await qrElement.boundingBox();
          if (boundingBox) {
            const croppedScreenshot = await page.screenshot({
              encoding: 'base64',
              clip: {
                x: boundingBox.x + boundingBox.width * 0.1,
                y: boundingBox.y + boundingBox.height * 0.1,
                width: boundingBox.width * 0.8,
                height: boundingBox.height * 0.8
              },
              type: 'jpeg',
              quality: 60
            });
            qrDataUrl = croppedScreenshot;
          }
        } else {
          qrDataUrl = screenshot;
        }
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
            // 验证URL长度，避免过长的数据URL
            if (imageUrl.length < 10000) {
              qrDataUrl = imageUrl;
            }
          }
        } catch (error) {
          console.log('无法获取二维码背景图片');
        }
      }

      // 方法3: 获取页面截图作为备用（最后手段，限制质量）
      if (!qrDataUrl) {
        try {
          const boundingBox = await qrElement.boundingBox();
          const pageScreenshot = await page.screenshot({
            encoding: 'base64',
            clip: {
              x: boundingBox.x + boundingBox.width * 0.1,
              y: boundingBox.y + boundingBox.height * 0.1,
              width: boundingBox.width * 0.8,
              height: boundingBox.height * 0.8
            },
            type: 'jpeg',
            quality: 50 // 低质量以减少数据量
          });

          // 如果仍然过长，返回错误而不是过长的数据
          if (pageScreenshot && pageScreenshot.length > 300000) { // 300KB限制
            console.log(`二维码数据仍然过大 (${pageScreenshot.length} 字节)，使用占位符`);
            qrDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
          } else {
            qrDataUrl = pageScreenshot;
          }
        } catch (error) {
          console.log('页面截图也失败，使用占位符');
          qrDataUrl = null;
        }
      }

      // 如果所有方法都失败，返回一个指示二维码存在但无法获取图像的标记
      if (!qrDataUrl) {
        console.log('所有二维码获取方法都失败，返回状态标记');
        return {
          type: 'qrcode_status',
          data: 'qrcode_detected_but_unable_to_capture',
          platform: platform.name,
          timestamp: Date.now(),
          message: '二维码已检测到，但无法获取图像数据'
        };
      }

      // 最终验证数据长度
      if (qrDataUrl && qrDataUrl.length > 1000000) { // 1MB硬限制
        console.log(`二维码数据超过硬限制 (${qrDataUrl.length} 字节)，截断数据`);
        qrDataUrl = qrDataUrl.substring(0, 1000000);
      }

      return {
        type: 'qrcode',
        data: qrDataUrl,
        platform: platform.name,
        timestamp: Date.now(),
        dataSize: qrDataUrl ? qrDataUrl.length : 0
      };

    } catch (error) {
      console.error('生成二维码数据失败:', error);
      // 返回错误状态而不是抛出异常，避免登录流程中断
      return {
        type: 'qrcode_error',
        data: null,
        platform: platform.name,
        timestamp: Date.now(),
        error: error.message
      };
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
      console.log(`检查登录状态 - 当前URL: ${currentUrl}`);

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
          // 检查知乎登录成功的标志 - 更新更准确的选择器
          const zhihuSelectors = [
            '.AppHeader-profile',           // 顶部头像
            '.ProfileHeader-name',          // 个人主页用户名
            '[data-za-detail-view-element_name="User"]',  // 用户相关元素
            '.SearchBar-searchInput',       // 搜索框（登录后才出现）
            '.AppHeader-notifications',     // 通知图标
            '.Popover-content',             // 用户下拉菜单
            'button[aria-label="用户菜单"]', // 用户菜单按钮
            '.CreatorEntry-entryText',      // 创作者入口
            '.css-1iy2dy3',                // 知乎新版选择器
            '.css-1mzs1h'                  // 知乎新版选择器
          ];

          // 检查页面文本内容
          const pageText = await page.evaluate(() => document.body.innerText);
          const isLoggedInByContent = pageText.includes('首页') ||
                                     pageText.includes('想法') ||
                                     pageText.includes('通知') ||
                                     pageText.includes('私信') ||
                                     pageText.includes('创作');

          if (isLoggedInByContent) {
            console.log('通过页面内容检测到知乎登录成功');
            return true;
          }

          // 检查DOM元素
          for (const selector of zhihuSelectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                const isVisible = await page.evaluate((el) => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                }, element);

                if (isVisible) {
                  console.log(`检测到知乎登录成功标志: ${selector}`);
                  return true;
                }
              }
            } catch (error) {
              // 继续检查下一个选择器
            }
          }

          // 检查localStorage或sessionStorage中的登录状态
          try {
            const hasLoginToken = await page.evaluate(() => {
              return localStorage.getItem('zse93') ||
                     localStorage.getItem('token') ||
                     sessionStorage.getItem('zse93') ||
                     document.cookie.includes('z_c0');
            });

            if (hasLoginToken) {
              console.log('通过存储信息检测到知乎登录成功');
              return true;
            }
          } catch (error) {
            console.log('检查存储信息失败:', error.message);
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
        error: loginState.error,
        isRestored: loginState.isRestored || false
      });
    }
    return logins;
  }
}

module.exports = PlatformAutoLoginService;