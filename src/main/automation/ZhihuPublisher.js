/**
 * 知乎文章发布自动化
 * 实现完整的知乎发布流程，包括导航、内容填充、图片上传、发布确认等
 */

const { BrowserManager } = require('./BrowserManager');
const PlatformAutoLoginService = require('../services/PlatformAutoLoginService');
const PlatformService = require('../services/PlatformService');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 模块加载即输出日志，用于确证命中文件
console.log('[ZH_PUB_DBG] ZhihuPublisher module loaded:', __filename);

class ZhihuPublisher {
  constructor() {
    this.browserManager = new BrowserManager();
    this.platformAutoLoginService = new PlatformAutoLoginService();
    this.platformService = new PlatformService();
    this.page = null;
    this.browser = null;
    this.taskId = null;
    this.progressCallback = null;
    this.logCallback = null;

    // 配置：默认关闭高级反检测（可按需开启）
    this.enableAdvancedAntiDetection = false;
    // 风控冷却（40362）相关
    this.cooldownUntil = 0; // 时间戳，处于冷却期内则拒绝执行
    this.COOLDOWN_MS = 2 * 60 * 60 * 1000; // 默认冷却2小时，可按需调整
  }

  /**
   * 初始化发布器
   */
  async initialize(taskId, progressCallback, logCallback) {
    this.taskId = taskId;
    this.progressCallback = progressCallback;
    this.logCallback = logCallback;

    this.log('info', `[ZH_PUB_DBG] init taskId=${this.taskId}`);
    this.log('info', '初始化知乎发布器');
    console.log(`[ZH_PUB_DBG] init taskId=${this.taskId}`);
    this.updateProgress(5, '初始化平台服务');

    try {
      // 初始化平台自动登录服务
      await this.platformAutoLoginService.initialize();
      await this.platformService.initialize();

      this.updateProgress(10, '平台服务初始化完成');
      return true;
    } catch (error) {
      this.log('error', `初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 发布文章到知乎
   */
  async publish(articleData, sessionId = null) {
    try {
      this.log('info', '开始发布文章到知乎');
      console.log(`[ZH_PUB_DBG] publish entry taskId=${this.taskId}`);
      this.updateProgress(15, '准备发布环境');
      this.currentArticle = articleData;
      // 冷却窗口检查：若仍在冷却期内则拒绝执行
      if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
        const mins = Math.ceil((this.cooldownUntil - Date.now()) / 60000);
        throw new Error(`知乎风控冷却中，剩余约 ${mins} 分钟后再试`);
      }
      this.currentArticle = articleData;

      // 1. 确保知乎平台已登录
      const zhihuSession = await this.ensureZhihuLoggedIn(sessionId);
      this.updateProgress(25, '知乎登录状态验证完成');

      // 2. 获取已登录的浏览器页面
      await this.acquireBrowserPage(zhihuSession);
      this.updateProgress(35, '浏览器环境准备完成');

      // 3. 导航到写作页面
      await this.navigateToWritePage();
      this.updateProgress(45, '已进入写作页面');
      console.log(`[ZH_PUB_DBG] after navigateToWritePage url=${this.page.url()}`);

      // 4. 填充文章内容
      await this.fillArticleContent(articleData);
      this.updateProgress(70, '文章内容填充完成');

      // 5. 处理图片上传
      await this.handleImageUploads(articleData);
      this.updateProgress(85, '图片处理完成');

      // 5.5 专栏收录（若可用）
      await this.selectColumnIfAvailable();
      this.updateProgress(88, '专栏收录已尝试');

      // 6. 发布文章
      const publishResult = await this.publishArticle();
      this.updateProgress(95, '文章发布中');

      // 7. 诊断发布结果，不关闭浏览器
      await this.diagnosePublishResult(publishResult);
      this.updateProgress(100, '发布完成（浏览器保持开启）');

      this.log('info', `发布流程完成，浏览器保持开启以便诊断`);
      return publishResult;

    } catch (error) {
      this.log('error', `发布失败: ${error.message}`);
      // 即使失败也不关闭浏览器，便于诊断
      this.log('info', '浏览器保持开启以便诊断失败原因');
      throw error;
    }
    // 注意：移除finally中的cleanup()，保持浏览器开启
  }

  /**
   * 确保知乎平台已登录（使用T15 PlatformAutoLoginService）
   */
  async ensureZhihuLoggedIn(sessionId) {
    this.log('info', '验证知乎登录状态（使用T15服务）');

    try {
      // 获取知乎平台信息
      const platformsResult = await this.platformService.getPlatformBySlug('zhihu');
      if (!platformsResult.success) {
        throw new Error('未找到知乎平台配置');
      }
      const zhihuPlatform = platformsResult.data;

      // 检查是否已有活跃的登录会话
      const activeLogins = this.platformAutoLoginService.getActiveLogins();
      const zhihuLogin = activeLogins.find(login =>
        login.platformId === zhihuPlatform.id && login.status === 'success'
      );

      if (zhihuLogin) {
        this.log('info', `发现已登录的知乎会话: ${zhihuLogin.id}`);
        return zhihuLogin;
      }

      // 如果没有活跃会话，检查是否有可恢复的会话
      if (sessionId) {
        this.log('info', `尝试使用指定的会话: ${sessionId}`);
        // 这里可以验证指定会话的有效性
        return { sessionId, platformId: zhihuPlatform.id, isRestored: true };
      }

      throw new Error('未找到有效的知乎登录会话，请先进行登录');

    } catch (error) {
      this.log('error', `确保知乎登录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取已登录的浏览器页面
   */
  async acquireBrowserPage(zhihuSession) {
    this.log('info', '获取浏览器页面用于发布');

    try {
      // 生成随机的用户代理，避免被识别
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
      ];

      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      // 启动浏览器实例 - 增强反检测配置
      const browserResult = await this.browserManager.createBrowser({
        headless: false, // 显示浏览器窗口，便于调试
        viewport: {
          width: 1920 + Math.floor(Math.random() * 100), // 随机宽度
          height: 1080 + Math.floor(Math.random() * 100) // 随机高度
        },
        stealth: false,
        userAgent: randomUserAgent,
        // 精简参数：按 blog-auto-publishing-tools 思路，不使用反检测 flags
        args: []
      });

      if (!browserResult.success) {
        throw new Error(`浏览器创建失败: ${browserResult.error}`);
      }

      this.browser = browserResult.data.browser;
      this.page = await this.browser.newPage();

      // 设置页面超时
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      // 页面控制台与错误监听（诊断刷新/脚本异常）
      this.page.on('console', (msg) => {
        try {
          const type = msg.type();
          const text = msg.text();
          this.log(type === 'error' ? 'error' : 'info', `页面console[${type}]: ${text}`);
        } catch (e) {
          this.log('warn', `读取页面console失败: ${e.message}`);
        }
      });
      this.page.on('pageerror', (err) => {
        this.log('error', `页面脚本错误: ${err.message}`);
      });

      // 跳过反检测脚本注入（与 blog-auto-publishing-tools 对齐）
      this.log('info', '跳过反检测脚本注入');

      // 如果是恢复的会话，需要恢复登录状态
      if (zhihuSession.sessionId) {
        await this.restoreLoginSession(zhihuSession.sessionId);
      } else if (zhihuSession.isRestored) {
        // 对于已恢复的会话，直接访问知乎首页验证登录状态
        await this.verifyLoginStatus();
      }

      this.log('info', '浏览器页面获取成功');

    } catch (error) {
      this.log('error', `获取浏览器页面失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 恢复登录会话
   */
  async restoreLoginSession(sessionId) {
    this.log('info', `恢复登录会话: ${sessionId}`);

    try {
      // 通过PublisherLoginSessionService恢复会话（使用包装器类避免修改现有类）
      const PublisherLoginSessionService = require('./PublisherLoginSessionService');
      const loginSessionService = new PublisherLoginSessionService();
      await loginSessionService.initialize();

      const sessionResult = await loginSessionService.getById(sessionId);
      if (!sessionResult.success) {
        throw new Error(`会话不存在: ${sessionId}`);
      }

      const sessionData = sessionResult.data;

      // 设置Cookies
      if (sessionData.cookies) {
        let cookies = sessionData.cookies;
        // 处理cookies格式：如果是字符串则解析，如果是对象则直接使用
        if (typeof cookies === 'string') {
          try {
            cookies = JSON.parse(cookies);
          } catch (error) {
            this.log('warn', `Cookies解析失败，跳过设置: ${error.message}`);
            cookies = null;
          }
        }
        if (cookies && Array.isArray(cookies)) {
          await this.page.setCookie(...cookies);
        }
      }

      // 设置用户代理
      if (sessionData.user_agent) {
        await this.page.setUserAgent(sessionData.user_agent);
      }

      // 访问知乎首页以应用登录状态
      await this.page.goto('https://www.zhihu.com', { waitUntil: 'networkidle2' });

      // 等待登录完成
      await this.page.waitForTimeout(3000);

      // 验证登录状态
      const isLoggedIn = await this.verifyLoginStatus();
      if (!isLoggedIn) {
        throw new Error('会话恢复后登录状态验证失败');
      }

      this.log('info', '登录会话恢复成功');

    } catch (error) {
      this.log('error', `恢复登录会话失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证登录状态
   */
  async verifyLoginStatus() {
    try {
      // 检查多个可能的登录状态元素
      const loginSelectors = [
        '.AppHeader-profile', // 头像按钮
        '.ProfileHeader-name', // 用户名
        '[data-za-detail-view-element_name="User"]', // 用户元素
        '.Header-profile', // 另一种头像按钮
        '.member-info', // 会员信息
        'a[href*="/people/"]', // 个人主页链接
        '.PushNotifications-item' // 通知按钮（登录后才显示）
      ];

      for (const selector of loginSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            const isVisible = await this.page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }, element);

            if (isVisible) {
              this.log('info', `检测到登录状态元素: ${selector}`);
              return true;
            }
          }
        } catch (e) {
          // 继续检查下一个选择器
        }
      }

      // 通过页面内容判断
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const isLoggedInByContent = pageText.includes('首页') ||
                                 pageText.includes('想法') ||
                                 pageText.includes('通知') ||
                                 pageText.includes('私信') ||
                                 pageText.includes('创作');

      if (isLoggedInByContent) {
        this.log('info', '通过页面内容检测到登录成功');
        return true;
      }

      // 通过页面标题判断
      const title = await this.page.title();
      if (title && !title.includes('登录') && !title.includes('注册')) {
        this.log('info', `通过页面标题判断已登录: ${title}`);
        return true;
      }

      this.log('warn', '未检测到登录状态元素');
      return false;

    } catch (error) {
      this.log('error', `验证登录状态失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 导航到写作页面
   */
  async navigateToWritePage() {
    this.log('info', '导航到知乎写作页面');

    try {
      await this.page.goto('https://zhuanlan.zhihu.com/write', {
        waitUntil: 'networkidle2'
      });

      // 等待编辑器加载
      await this.page.waitForSelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]', {
        timeout: 30000
      });

      this.log('info', '已成功进入写作页面');
      // 写作页加载后检测是否被风控拦截（40362）
      try {
        const bodyText = await this.page.evaluate(() => {
          try { return document.body.innerText || ''; } catch (e) { return ''; }
        });
        const hit = (bodyText && (bodyText.includes('40362') || bodyText.includes('您当前请求存在异常') || bodyText.includes('"code":40362')));
        if (hit) {
          this.cooldownUntil = Date.now() + this.COOLDOWN_MS;
          const mins = Math.ceil((this.cooldownUntil - Date.now()) / 60000);
          this.log('warn', `检测到知乎风控(40362) 于 navigateToWritePage，进入冷却约 ${mins} 分钟`);
          throw new Error(`知乎风控(40362)，已进入冷却，约 ${mins} 分钟后再试`);
        }
      } catch (e) {
        this.log('warn', `风控检测过程异常（忽略继续）：${e.message}`);
      }
    } catch (error) {
      this.log('error', `导航到写作页面失败: ${error.message}`);
      throw new Error('无法进入写作页面');
    }
  }

  /**
   * 填充文章内容 - 模拟人类行为，增加自然延迟
   */
  async fillArticleContent(articleData) {
    this.log('info', '开始填充文章内容');
    this.log('info', `[ZH_PUB_DBG] fillArticleContent entry taskId=${this.taskId}`);
    console.log(`[ZH_PUB_DBG] fillArticleContent entry taskId=${this.taskId}`);

    try {
      // 1. 先等待一下，模拟用户进入页面后的思考时间
      await this.randomDelay(2000, 4000);

      // 2. 填充标题 - 模拟用户先想标题
      this.log('info', '开始填写标题');
      await this.fillTitle(articleData.title);
      this.updateProgress(45, '标题填写完成');
      this.log('info', '[ZH_PUB_DBG] title filled, waiting stabilize');
      console.log('[ZH_PUB_DBG] title filled, waiting stabilize');

      // 标题后等待页面稳定（避免草稿保存导致的刷新/重渲染）
      await this.waitForStabilizeAfterTitle();

      // 3. 模拟用户写完标题后的思考时间
      this.log('info', '标题填写完成，模拟思考时间...');
      await this.randomDelay(3000, 6000);

      // 4. 模拟用户滚动到内容区域
      await this.simulateHumanScroll(200);
      await this.randomDelay(1000, 2000);

      // 5. 填充正文内容 - 模拟用户开始写正文
      this.log('info', '开始填写正文内容');
      await this.fillContent(articleData.html_content || articleData.content);
      this.updateProgress(65, '正文内容填写完成');

      // 6. 模拟用户写完内容后的检查时间
      this.log('info', '正文内容填写完成，模拟检查时间...');
      await this.randomDelay(2000, 4000);

      this.log('info', '文章内容填充完成');
    } catch (error) {
      this.log('error', `填充文章内容失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 填充文章标题 - 稳健版（多选择器兜底 + 逐字输入）
   */
  async fillTitle(title) {
    this.log('info', '开始填充标题');
    const titleSelectors = [
      'textarea[placeholder*="请输入标题"]',
      'textarea[placeholder*="输入文章标题"]',
      'textarea[placeholder*="标题"]',
      'input[placeholder*="请输入标题"]',
      'input[placeholder*="输入文章标题"]',
      'input[placeholder*="标题"]',
      '.WriteIndex-titleInput textarea, .WriteIndex-titleInput input',
      '.TitleInput textarea, .TitleInput input',
      '[class*="title"] textarea, [class*="title"] input',
      '[data-testid*="title"]',
    ];

    const tryFill = async () => {
      for (const selector of titleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          const el = await this.page.$(selector);
          if (!el) continue;

          // 点击聚焦
          try {
            await el.click({ clickCount: 1 });
          } catch {
            await this.page.click(selector);
          }

          // 选中并清空旧文本
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('a');
          await this.page.keyboard.up('Control');
          await this.page.keyboard.press('Delete');

          // 逐字输入（延迟更贴近人类打字）
          await this.page.type(selector, title, { delay: 80 });

          // 简单校验
          const typed = await this.page.evaluate(s => {
            const node = document.querySelector(s);
            if (!node) return '';
            return node.value || node.textContent || '';
          }, selector);

          if (typed && typed.length >= Math.min(title.length, 2)) {
            // 移出标题焦点，避免后续粘贴正文时粘到标题（使用点击空白区而非Tab）
            await this.page.mouse.click(50, 50);
            await this.page.waitForTimeout(300);
            this.log('info', `标题填充完成并移出焦点，选择器: ${selector}`);
            return true;
          } else {
            this.log('warn', `标题填充长度校验未通过，选择器: ${selector}，实际: ${typed.length}`);
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
      return false;
    };

    try {
      let ok = await tryFill();
      if (!ok) {
        this.log('warn', '首次定位标题失败，滚动到顶部并重试');
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(800);
        ok = await tryFill();
      }

      if (!ok) {
        this.log('warn', '使用兜底方案：页面顶部直接键入标题');
        await this.page.click('body', { position: { x: 120, y: 120 } }).catch(() => {});
        await this.page.keyboard.type(title, { delay: 80 });
        // 改为点击空白区移出焦点
        await this.page.mouse.click(50, 50);
        await this.page.waitForTimeout(300);
      }

      this.log('info', '标题填充流程结束');
    } catch (error) {
      this.log('error', `填充标题失败: ${error.message}`);
      throw new Error('无法找到或填充标题输入框');
    }
  }

  /**
   * 填充正文内容 - 使用“复制-粘贴”策略
   */
  async fillContent(htmlContent) {
    this.log('info', '开始使用“复制-粘贴”策略填充正文内容');
    let tempPage = null;
    try {
      // 1. 创建一个新的临时页面
      this.log('info', '创建一个临时页面用于复制内容');
      tempPage = await this.browser.newPage();
      await tempPage.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
      await tempPage.waitForTimeout(1000);

      // 2. 在临时页面中执行“全选”和“复制”
      this.log('info', '在临时页面中执行“全选”和“复制”');
      await tempPage.keyboard.down('Control');
      await tempPage.keyboard.press('A');
      await tempPage.keyboard.up('Control');
      await tempPage.waitForTimeout(400);

      await tempPage.keyboard.down('Control');
      await tempPage.keyboard.press('C');
      await tempPage.keyboard.up('Control');
      await tempPage.waitForTimeout(400);

      this.log('info', '内容已复制到剪贴板');

      // 3. 关闭临时页面
      await tempPage.close();
      tempPage = null;

      // 4. 切回知乎编辑器页面并粘贴
      this.log('info', '切换回知乎编辑器并执行“粘贴”');
      await this.page.bringToFront();

      // 先 blur 所有输入，避免标题保留焦点
      await this.page.evaluate(() => {
        document.querySelectorAll('input, textarea').forEach(el => {
          try { el.blur(); } catch (e) {}
        });
      });

      // 确保编辑器选择器
      const editorSelector = '.public-DraftEditor-content, .RichText, [contenteditable="true"]';
      await this.page.waitForSelector(editorSelector, { timeout: 10000 });

      // 点击编辑器以确保焦点
      await this.page.click(editorSelector);
      await this.page.waitForTimeout(500);

      // 校验当前焦点是否在编辑器
      const isEditorFocused = await this.page.evaluate((selector) => {
        const active = document.activeElement;
        const editor = document.querySelector(selector);
        if (!active || !editor) return false;
        // active 本身是编辑器或其子节点
        return active === editor || editor.contains(active);
      }, editorSelector);

      if (!isEditorFocused) {
        this.log('warn', '编辑器未获得焦点，重试点击');
        await this.page.click(editorSelector);
        await this.page.waitForTimeout(400);
      }

      // 再次检测，若仍不在编辑器，则强制滚动到顶部并再点一次
      const focusedFinal = await this.page.evaluate((selector) => {
        const active = document.activeElement;
        const editor = document.querySelector(selector);
        return active && editor && (active === editor || editor.contains(active));
      }, editorSelector);

      if (!focusedFinal) {
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(300);
        await this.page.click(editorSelector);
        await this.page.waitForTimeout(300);
      }

      // 执行粘贴
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('V');
      await this.page.keyboard.up('Control');

      this.log('info', '正文内容粘贴完成');
      this.log('info', '[ZH_PUB_DBG] content pasted');
      console.log('[ZH_PUB_DBG] content pasted');
      await this.page.waitForTimeout(1500);

    } catch (error) {
      this.log('error', `使用“复制-粘贴”策略填充内容失败: ${error.message}`);
      if (tempPage) {
        await tempPage.close();
      }
      throw new Error('无法填充正文内容');
    }
  }

  /**
   * 在标题输入后等待页面稳定，避免自动保存导致的刷新/重渲染
   */
  async waitForStabilizeAfterTitle() {
    try {
      this.log('info', '标题输入后等待页面稳定...');
      const startUrl = this.page.url();
      let navigated = false;

      const onNavigated = () => { navigated = true; };
      this.page.once('framenavigated', onNavigated);

      // 等待短时间让草稿保存/网络请求完成
      await this.page.waitForTimeout(2000);

      // 如果发生了导航或URL变化，则重新进入写作页并等待编辑器就绪
      const currentUrl = this.page.url();
      if (navigated || currentUrl !== startUrl || !currentUrl.includes('/write')) {
        this.log('warn', '检测到页面刷新/导航，重新进入写作页并校准编辑器焦点');
        await this.page.goto('https://zhuanlan.zhihu.com/write', { waitUntil: 'networkidle2' });
        await this.page.waitForSelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]', { timeout: 15000 });
      } else {
        this.log('info', '页面保持稳定，继续填充正文');
      }
    } catch (e) {
      this.log('warn', `页面稳定等待过程出现问题，但继续流程: ${e.message}`);
    }
  }

  /**
   * 处理图片上传
   */
  async handleImageUploads(articleData) {
    if (!articleData.images || articleData.images.length === 0) {
      this.log('info', '没有图片需要上传');
      return;
    }

    this.log('info', `开始处理 ${articleData.images.length} 张图片`);

    try {
      for (let i = 0; i < articleData.images.length; i++) {
        const imageData = articleData.images[i];
        await this.uploadImage(imageData, i);
        this.updateProgress(70 + Math.floor((i + 1) / articleData.images.length * 15), `图片上传进度: ${i + 1}/${articleData.images.length}`);
      }

      this.log('info', '所有图片上传完成');
    } catch (error) {
      this.log('error', `图片上传失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 上传单张图片
   */
  async uploadImage(imageData, index) {
    try {
      this.log('info', `上传第 ${index + 1} 张图片`);

      // 创建临时图片文件
      const tempImagePath = await this.createTempImageFile(imageData, index);

      try {
        // 寻找图片上传按钮
        const uploadButton = await this.findImageUploadButton();
        if (!uploadButton) {
          throw new Error('未找到图片上传按钮');
        }

        // 点击上传按钮
        await uploadButton.click();

        // 等待文件选择对话框
        await this.page.waitForTimeout(1000);

        // 上传文件
        const fileInput = await this.page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(tempImagePath);
        } else {
          throw new Error('未找到文件输入框');
        }

        // 等待上传完成
        await this.waitForImageUpload();

        this.log('info', `第 ${index + 1} 张图片上传成功`);

      } finally {
        // 清理临时文件
        if (fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);
        }
      }

    } catch (error) {
      this.log('error', `上传第 ${index + 1} 张图片失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建临时图片文件
   */
  async createTempImageFile(imageData, index) {
    const tempDir = path.join(process.cwd(), 'temp', 'images');

    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let imagePath = '';

    if (imageData.startsWith('data:image')) {
      // Base64图片数据
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const extension = this.getImageExtension(imageData);
      imagePath = path.join(tempDir, `temp_image_${Date.now()}_${index}.${extension}`);
      fs.writeFileSync(imagePath, buffer);
    } else if (imageData.startsWith('http')) {
      // 网络图片URL
      const response = await this.page.evaluate(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }, imageData);

      const buffer = Buffer.from(response);
      const extension = this.getImageExtensionFromUrl(imageData);
      imagePath = path.join(tempDir, `temp_image_${Date.now()}_${index}.${extension}`);
      fs.writeFileSync(imagePath, buffer);
    } else if (fs.existsSync(imageData)) {
      // 本地文件路径
      imagePath = imageData;
    } else {
      throw new Error('不支持的图片数据格式');
    }

    return imagePath;
  }

  /**
   * 获取图片扩展名
   */
  getImageExtension(imageData) {
    const match = imageData.match(/data:image\/(\w+);/);
    return match ? match[1] : 'jpg';
  }

  /**
   * 从URL获取图片扩展名
   */
  getImageExtensionFromUrl(url) {
    const urlPath = new URL(url).pathname;
    const extension = urlPath.split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) ? extension : 'jpg';
  }

  /**
   * 寻找图片上传按钮
   */
  async findImageUploadButton() {
    const selectors = [
      'button[title*="图片"]',
      'button[aria-label*="图片"]',
      '.UploadImageButton',
      '.image-upload-button',
      'input[type="file"]',
      '[data-testid*="image"]',
      '[class*="image"] button',
      '[class*="picture"] button'
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }

    // 尝试通过文本查找
    const textSelectors = await this.page.$$('button, [role="button"]');
    for (const element of textSelectors) {
      try {
        const text = await element.evaluate(el => el.textContent || el.title || '');
        if (text.includes('图片') || text.includes('插入图片') || text.includes('上传图片')) {
          return element;
        }
      } catch (error) {
        // 继续尝试
      }
    }

    return null;
  }

  /**
   * 等待图片上传完成
   */
  async waitForImageUpload() {
    try {
      // 等待上传进度条消失或图片显示
      await this.page.waitForTimeout(3000);

      // 检查是否有上传完成的标志
      const uploadComplete = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('.upload-progress, .image-uploading, [data-uploading="true"]');
        return elements.length === 0;
      });

      if (!uploadComplete) {
        this.log('warn', '图片上传可能仍在进行中，继续执行');
      }
    } catch (error) {
      this.log('warn', `等待图片上传完成时出错: ${error.message}`);
    }
  }

  /**
   * 发布文章 - 参考工具的完整流程（稳健化）
   */
  /**
   * 对齐 blog-auto-publishing-tools：专栏收录（若存在则勾选）
   */
  async selectColumnIfAvailable() {
    try {
      this.log('info', '尝试勾选“专栏收录”');
      const candidates = [
        'label[for="PublishPanel-columnLabel-1"]',
        'label[for*="PublishPanel-columnLabel"]',
        '[class*="PublishPanel"] label',
      ];
      let clicked = false;
      for (const sel of candidates) {
        try {
          const el = await this.page.$(sel);
          if (el) {
            try { await this.page.evaluate((n)=>{ try{ n.scrollIntoView({block:"center"});}catch{} }, el); } catch {}
            try { await el.click({ delay: 50 }); } catch { await this.page.evaluate((n)=>{ try{ n.click(); }catch{} }, el); }
            clicked = true;
            this.log('info', `已尝试勾选“专栏收录” via ${sel}`);
            break;
          }
        } catch {}
      }
      if (!clicked) this.log('warn', '未发现“专栏收录”控件，跳过');
    } catch (e) {
      this.log('warn', `专栏收录步骤异常，跳过：${e.message}`);
    }
  }

  async publishArticle() {
    this.log('info', '开始发布文章');
    this.log('info', `[ZH_PUB_DBG] publishArticle start url=${this.page.url()}`);
    console.log(`[ZH_PUB_DBG] publishArticle start url=${this.page.url()}`);
    const tryOnce = async () => {
      // 等编辑器就绪后短暂稳定等待，避免中途切换到 edit/预览态
      await this.page.waitForSelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]', { timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(1500);

      // 预滚动：尝试滚动页面与典型容器以暴露底部按钮
      this.log('info', '尝试滚动容器以暴露“发布”按钮');
      await this.page.evaluate(() => {
        const containers = [
          document.scrollingElement,
          document.querySelector('main'),
          document.querySelector('.WriteIndex'),
          document.querySelector('.ContentLayout'),
          document.querySelector('[class*="Editor"]'),
          document.body
        ].filter(Boolean);
        for (const el of containers) {
          try { el.scrollTop = el.scrollHeight; } catch {}
        }
        // 再回到顶部，确保后续定位不受遮挡
        for (const el of containers) {
          try { el.scrollTop = 0; } catch {}
        }
      }).catch(() => {});

      // 发布前二次校验：如标题为空则补填一次
      try {
        const titleSelCandidates = [
          'textarea[placeholder*="请输入标题"]',
          'textarea[placeholder*="标题"]',
          'input[placeholder*="请输入标题"]',
          'input[placeholder*="标题"]'
        ];
        for (const s of titleSelCandidates) {
          const el = await this.page.$(s);
          if (el) {
            const cur = await this.page.evaluate(elm => (elm.value || elm.textContent || '').trim(), el);
            if (!cur && this.currentArticle && this.currentArticle.title) {
              try { await el.click({ clickCount: 1 }); } catch {}
              await this.page.keyboard.down('Control'); await this.page.keyboard.press('a'); await this.page.keyboard.up('Control');
              await this.page.keyboard.press('Delete');
              await this.page.type(s, this.currentArticle.title, { delay: 60 });
              await this.page.waitForTimeout(500);
              // 失焦防止粘贴干扰标题
              await this.page.mouse.click(50, 50);
              await this.page.waitForTimeout(200);
            }
            break;
          }
        }
      } catch {}
      // 1) 寻找并点击“发布”按钮
      this.log('info', '定位“发布”按钮');
      const publishSelectors = [
        '[data-za-detail-view-element_name="发布文章按钮"]',
        'button[type="submit"]',
        '.PublishButton',
        '.publish-button',
        '[data-testid*="publish"]',
        '[data-action*="publish"]'
      ];
      let publishBtn = null;

      // 优先属性选择器
      for (const sel of publishSelectors) {
        try {
          await this.page.waitForSelector(sel, { timeout: 1500 });
          const el = await this.page.$(sel);
          if (el) { publishBtn = el; this.log('info', `使用选择器找到发布按钮: ${sel}`); break; }
        } catch {}
      }
      // 兜底：遍历所有按钮，通过文本包含匹配
      if (!publishBtn) {
        const buttons = await this.page.$$('button');
        for (const btn of buttons) {
          try {
            const txt = await btn.evaluate(el => (el.textContent || '').trim());
            if (txt.includes('发布') || txt.includes('发表') || txt.includes('提交')) { publishBtn = btn; this.log('info', `通过文本匹配找到发布按钮: ${txt}`); break; }
          } catch {}
        }
      }
      if (!publishBtn) {
        // 记录所有按钮文本，辅助诊断
        const allTexts = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('button, [role="button"]'))
            .map(b => (b.textContent || '').trim())
            .filter(t => t);
        }).catch(() => []);
        this.log('warn', `未找到“发布”按钮，当前页面按钮文本清单: ${JSON.stringify(allTexts.slice(0, 50))}`);
        throw new Error('未找到“发布”按钮');
      }

      // 尝试将按钮滚动到可视区域并点击，失败则用evaluate触发
      this.log('info', '[ZH_PUB_DBG] ready to click publish');
      console.log('[ZH_PUB_DBG] ready to click publish');
      // 点击前等待按钮可用（非 disabled 且可见）
      try {
        await this.page.waitForFunction((x) => {
          const el = document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!el) return false;
          const disabled = el.getAttribute('disabled') !== null || el.ariaDisabled === 'true';
          const style = window.getComputedStyle(el);
          return !disabled && style.visibility !== 'hidden' && style.display !== 'none';
        }, { timeout: 20000 }, '//button[contains(normalize-space(.),"发布")]');
      } catch {}
      try {
        await this.page.evaluate((el) => { try { el.scrollIntoView({ block: 'center' }); } catch {} }, publishBtn);
      } catch {}
      try {
        await publishBtn.click();
      } catch (e) {
        this.log('warn', `按钮直接点击失败，尝试evaluate触发: ${e.message}`);
        await this.page.evaluate((el) => { try { el.click(); } catch {} }, publishBtn);
      }

      // 2) 在弹层/对话框中点击“确认发布”
      this.log('info', '等待弹层并点击“确认发布”');
      await this.page.waitForTimeout(800);
      const confirmTexts = ['确认发布', '确认', '确定', '发布文章', '发布'];
      let confirmBtn = null;

      // 在典型弹层/底栏容器内查找（部分页面发布按钮在底栏/弹层内）
      const dialogContainers = await this.page.$$('.modal, .dialog, .popup, [role="dialog"], [class*="Footer"], [class*="Bottom"], [class*="Bar"]');
      const probeInContainer = async (container) => {
        const btns = await container.$$('button, [role="button"]');
        for (const b of btns) {
          const t = await b.evaluate(el => (el.textContent || '').trim());
          if (confirmTexts.some(k => t.includes(k))) return b;
        }
        return null;
      };
      for (const container of dialogContainers) {
        confirmBtn = await probeInContainer(container);
        if (confirmBtn) break;
      }
      // 兜底全局按钮文本匹配
      if (!confirmBtn) {
        const allBtns = await this.page.$$('button, [role="button"]');
        for (const b of allBtns) {
          const t = await b.evaluate(el => (el.textContent || '').trim());
          if (confirmTexts.some(k => t.includes(k))) { confirmBtn = b; break; }
        }
      }
      if (!confirmBtn) this.log('warn', '未检测到“确认发布”按钮，可能不需要确认');

      // 点击确认（若存在），并等待导航
      const waitNav = this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
      if (confirmBtn) {
        this.log('info', '[ZH_PUB_DBG] ready to click confirm');
        console.log('[ZH_PUB_DBG] ready to click confirm');
        await confirmBtn.click();
      }
      const navResult = await waitNav;

      // 3) 结果解析与预览态识别
      const currentUrl = this.page.url();
      this.log('info', `[ZH_PUB_DBG] tryOnce url=${currentUrl}`);
      console.log(`[ZH_PUB_DBG] tryOnce url=${currentUrl}`);
      // 发布尝试后检测是否触发风控（40362）
      try {
        const bodyText2 = await this.page.evaluate(() => {
          try { return document.body.innerText || ''; } catch (e) { return ''; }
        });
        const hit2 = (bodyText2 && (bodyText2.includes('40362') || bodyText2.includes('您当前请求存在异常') || bodyText2.includes('"code":40362')));
        if (hit2) {
          this.cooldownUntil = Date.now() + this.COOLDOWN_MS;
          const mins2 = Math.ceil((this.cooldownUntil - Date.now()) / 60000);
          this.log('warn', `检测到知乎风控(40362) 于 afterPublishAttempt，进入冷却约 ${mins2} 分钟`);
          throw new Error(`知乎风控(40362)，已进入冷却，约 ${mins2} 分钟后再试`);
        }
      } catch (e) {
        this.log('warn', `风控检测过程异常（忽略继续）：${e.message}`);
      }
      const isArticle = /\/p\/\d+/.test(currentUrl);
      const inEdit = /\/p\/\d+\/edit/.test(currentUrl);
      const looksPreview = !currentUrl || currentUrl === 'about:blank' || currentUrl.includes('/edit') || currentUrl.includes('/preview');

      if (isArticle) {
        const res = await this.getPublishResult();
        if (res && res.success) { this.log('info', '文章发布成功'); return res; }
      }

      // 如落入编辑态，先就地补救一次：补标题（如需）并再次点击发布
      if (inEdit) {
        this.log('warn', '当前处于编辑态(/edit)，尝试就地补救并再次发布');
        try {
          const titleSel = 'textarea[placeholder*="请输入标题"],textarea[placeholder*="标题"],input[placeholder*="请输入标题"],input[placeholder*="标题"]';
          const el = await this.page.$(titleSel);
          if (el) {
            const cur = await this.page.evaluate(elm => (elm.value || elm.textContent || '').trim(), el);
            if (!cur && this.currentArticle && this.currentArticle.title) {
              await el.click({ clickCount: 1 }).catch(()=>{});
              await this.page.keyboard.down('Control'); await this.page.keyboard.press('a'); await this.page.keyboard.up('Control');
              await this.page.keyboard.press('Delete');
              await this.page.type(titleSel, this.currentArticle.title, { delay: 60 });
              await this.page.waitForTimeout(600);
            }
          }
        } catch {}

        const [btnAgain] = await this.page.$x('//button[contains(normalize-space(.),"发布")]');
        if (btnAgain) {
          try { await this.page.evaluate(el => el.scrollIntoView({block:'center'}), btnAgain); } catch {}
          try {
            await this.page.waitForFunction((x) => {
              const el = document.evaluate(x, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              if (!el) return false;
              const disabled = el.getAttribute('disabled') !== null || el.ariaDisabled === 'true';
              const style = window.getComputedStyle(el);
              return !disabled && style.visibility !== 'hidden' && style.display !== 'none';
            }, { timeout: 20000 }, '//button[contains(normalize-space(.),"发布")]');
          } catch {}
          try { await btnAgain.click(); } catch { await this.page.evaluate(el => el.click(), btnAgain); }
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(()=>{});
        }

        const url2 = this.page.url();
        if (/\/p\/\d+($|[^/])/.test(url2) && !/\/edit/.test(url2)) {
          const res2 = await this.getPublishResult();
          if (res2 && res2.success) { this.log('info', '编辑态补救后发布成功'); return res2; }
        }
      }

      // 若看起来进入预览/编辑态，认为未最终发布
      if (looksPreview || !isArticle) {
        this.log('warn', `未进入文章页，当前URL: ${currentUrl || '空'}，将视为预览/中间态`);
        throw new Error('预览或中间态，尚未完成发布');
      }

      // 默认返回当前解析
      const res = await this.getPublishResult();
      return res;
    };

    try {
      // 首次尝试
      const first = await tryOnce();
      if (first && first.success) return first;

      // 一次重试：回到写作页再走发布流程
      this.log('warn', '准备重试发布流程：返回写作页');
      await this.page.goto('https://zhuanlan.zhihu.com/write', { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]', { timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(1000);

      const second = await tryOnce();
      if (second && second.success) return second;

      // 若仍失败，给出诊断信息
      const url = this.page.url();
      const title = await this.page.title();
      this.log('error', `发布失败：两次尝试均未进入文章页。当前URL: ${url}, 页面标题: ${title}`);
      throw new Error('发布文章失败');

    } catch (error) {
      this.log('error', `发布文章失败: ${error.message}`);
      throw new Error('发布文章失败');
    }
  }



  /**
   * 等待发布完成 - 检查多种成功标志
   */
  async waitForPublishComplete() {
    this.log('info', '等待发布完成，检查成功标志');

    const successSelectors = [
      '[data-za-detail-view-element_name="发布成功"]',
      '.success-message',
      '.publish-success',
      '[data-success="true"]',
      'button:contains("查看文章")',
      'a[href*="/p/"]'
    ];

    // 等待最多30秒，检查是否有成功标志
    for (let i = 0; i < 30; i++) {
      await this.page.waitForTimeout(1000);

      // 检查URL是否已经变为文章页面
      const currentUrl = this.page.url();
      if (currentUrl.includes('/p/')) {
        this.log('info', '检测到URL已变为文章页面，发布成功');
        return true;
      }

      // 检查页面是否有成功标志
      for (const selector of successSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            this.log('info', `检测到发布成功标志: ${selector}`);
            return true;
          }
        } catch (e) {
          // 继续
        }
      }

      // 检查页面内容
      const pageContent = await this.page.evaluate(() => document.body.innerText);
      if (pageContent.includes('发布成功') || pageContent.includes('文章已发布')) {
        this.log('info', '通过页面内容检测到发布成功');
        return true;
      }
    }

    this.log('warn', '30秒内未检测到明确的发布成功标志');
    return false;
  }

  /**
   * 寻找发布按钮 - 基于quickstart.md的简化实现
   */
  async findPublishButton() {
    try {
      // 使用quickstart.md中的简洁选择器
      await this.page.waitForSelector('[data-za-detail-view-element_name="发布文章按钮"]', {
        timeout: 10000
      });

      return await this.page.$('[data-za-detail-view-element_name="发布文章按钮"]');
    } catch (error) {
      this.log('warn', `主选择器失败，尝试备用方案: ${error.message}`);

      // 备用方案：使用多种选择器
      const selectors = [
        'button[type="submit"]',
        'button:contains("发布")',
        'button:contains("发表")',
        '.PublishButton',
        '.publish-button',
        '[data-testid*="publish"]',
        '[data-action*="publish"]',
        '.Button--primary',
        'button[class*="primary"]'
      ];

      for (const selector of selectors) {
        try {
          let element = null;

          if (selector.includes(':contains(')) {
            // 文本匹配
            const text = selector.match(/:contains\("([^"]+)"\)/)[1];
            const buttons = await this.page.$$('button');
            for (const btn of buttons) {
              const elementText = await btn.evaluate(el => el.textContent);
              if (elementText.includes(text)) {
                element = btn;
                break;
              }
            }
          } else {
            // CSS选择器
            element = await this.page.$(selector);
          }

          if (element) {
            this.log('info', `使用备用选择器找到发布按钮: ${selector}`);
            return element;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      // 最后尝试：通过evaluate查找
      return await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          const text = button.textContent || '';
          if (text.includes('发布') || text.includes('发表') || text.includes('提交')) {
            button.click();
            return true;
          }
        }
        return false;
      });
    }
  }

  /**
   * 寻找发布确认按钮
   */
  async findPublishConfirmButton() {
    try {
      await this.page.waitForSelector('.modal button, .dialog button, .popup button', {
        timeout: 5000
      });

      const confirmSelectors = [
        'button:contains("确认发布")',
        'button:contains("确认")',
        'button:contains("确定")',
        '.confirm-button',
        '.modal-confirm',
        '.dialog-confirm'
      ];

      for (const selector of confirmSelectors) {
        try {
          if (selector.includes(':contains(')) {
            const text = selector.match(/:contains\("([^"]+)"\)/)[1];
            const elements = await this.page.$$('.modal button, .dialog button, .popup button');
            for (const element of elements) {
              const elementText = await element.evaluate(el => el.textContent);
              if (elementText.includes(text)) {
                return element;
              }
            }
          }
        } catch (error) {
          // 继续尝试
        }
      }

      return null;
    } catch (error) {
      this.log('warn', '未找到发布确认按钮，可能不需要确认');
      return null;
    }
  }

  /**
   * 等待发布完成
   */
  async waitForPublishComplete() {
    try {
      // 等待页面跳转或成功提示
      await this.page.waitForTimeout(5000);

      // 检查是否有成功提示
      const success = await this.page.evaluate(() => {
        const successElements = document.querySelectorAll(
          '.success-message, .publish-success, [data-success="true"]'
        );
        return successElements.length > 0;
      });

      if (success) {
        this.log('info', '检测到发布成功提示');
      } else {
        this.log('info', '未检测到成功提示，但继续执行');
      }
    } catch (error) {
      this.log('warn', `等待发布完成时出错: ${error.message}`);
    }
  }

  /**
   * 获取发布结果（严格判定，仅当进入非 /edit 的 /p/{id} 页面才算成功）
   */
  async getPublishResult() {
    try {
      const currentUrl = this.page.url();
      const title = await this.page.title();
      const inEdit = /\/p\/\d+\/edit/.test(currentUrl);
      this.log('info', `[ZH_PUB_DBG] getPublishResult url=${currentUrl} inEdit=${inEdit}`);
      console.log(`[ZH_PUB_DBG] getPublishResult url=${currentUrl} inEdit=${inEdit}`);

      const m = currentUrl.match(/\/p\/(\d+)/);
      const articleId = m ? m[1] : null;
      const isPublished = !!articleId && !/\/edit/.test(currentUrl);
      const publishedUrl = articleId ? `https://zhuanlan.zhihu.com/p/${articleId}` : currentUrl;

      if (isPublished) {
        return {
          success: true,
          url: publishedUrl,
          articleId,
          title,
          publishedAt: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          error: inEdit ? '仍在编辑态（/edit），未完成最终发布' : '未进入文章页（/p/{id}），发布不成功',
          url: currentUrl,
          title
        };
      }
    } catch (error) {
      this.log('error', `获取发布结果失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 诊断发布结果 - 详细分析发布状态，不关闭浏览器
   */
  async diagnosePublishResult(publishResult) {
    this.log('info', '开始诊断发布结果...');
    this.log('info', `[ZH_PUB_DBG] diagnosePublishResult entry url=${this.page.url()}`);
    console.log(`[ZH_PUB_DBG] diagnosePublishResult entry url=${this.page.url()}`);

    try {
      // 等待页面稳定
      await this.page.waitForTimeout(5000);

      // 获取当前页面信息
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      const pageContent = await this.page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 500), // 前500字符
          hasErrorElements: document.querySelectorAll('.error, .warning, [class*="error"]').length > 0,
          hasSuccessElements: document.querySelectorAll('.success, [class*="success"], [data-success="true"]').length > 0
        };
      });

      this.log('info', `=== 发布结果诊断 ===`);
      this.log('info', `当前URL: ${currentUrl}`);
      this.log('info', `页面标题: ${pageTitle}`);
      this.log('info', `页面内容预览: ${pageContent.bodyText.substring(0, 100)}...`);

      // 分析URL特征
      if (currentUrl.includes('/p/')) {
        const articleId = currentUrl.match(/\/p\/(\d+)/)?.[1];
        this.log('info', `✅ 检测到文章页面，文章ID: ${articleId}`);
        this.log('info', `✅ 文章URL: https://zhuanlan.zhihu.com/p/${articleId}`);
        publishResult.success = true;
        publishResult.url = `https://zhuanlan.zhihu.com/p/${articleId}`;
        publishResult.articleId = articleId;
      } else if (currentUrl.includes('write')) {
        this.log('warn', `⚠️ 仍在写作页面，可能发布失败`);
        publishResult.success = false;
        publishResult.error = '仍在写作页面，发布可能失败';
      } else if (currentUrl.includes('captcha') || currentUrl.includes('verify')) {
        this.log('warn', `⚠️ 检测到验证码页面，需要人工处理`);
        publishResult.success = false;
        publishResult.error = '需要验证码验证';
      } else if (pageTitle.includes('荒漠') || currentUrl.includes('desert')) {
        this.log('warn', `⚠️ 检测到荒漠页面，可能触发反爬虫机制`);
        publishResult.success = false;
        publishResult.error = '触发反爬虫机制';
      } else {
        this.log('info', `ℹ️ 页面状态未知，需要人工检查`);
        publishResult.success = false;
        publishResult.error = '页面状态未知，需要人工检查';
      }

      // 检查页面元素
      if (pageContent.hasErrorElements) {
        this.log('warn', `⚠️ 页面包含错误元素`);
      }
      if (pageContent.hasSuccessElements) {
        this.log('info', `✅ 页面包含成功元素`);
      }

      // 检查是否成功发布
      if (publishResult.success) {
        this.log('info', `🎉 发布成功！文章已发布到知乎`);
        this.log('info', `🔗 文章链接: ${publishResult.url}`);
      } else {
        this.log('error', `❌ 发布失败: ${publishResult.error}`);
        this.log('info', `📋 浏览器保持开启，请检查页面状态`);
      }

      // 等待更长时间，让用户观察页面
      this.log('info', `等待30秒供人工检查页面状态...`);
      await this.page.waitForTimeout(30000);

      return publishResult;

    } catch (error) {
      this.log('error', `诊断过程中出错: ${error.message}`);
      publishResult.success = false;
      publishResult.error = `诊断失败: ${error.message}`;
      return publishResult;
    }
  }

  /**
   * 验证发布结果
   */
  async verifyPublishResult(publishResult) {
    if (!publishResult.success) {
      throw new Error(`发布失败: ${publishResult.error}`);
    }

    try {
      // 验证URL是否可访问
      await this.page.goto(publishResult.url, { waitUntil: 'networkidle2', timeout: 30000 });

      // 检查文章是否成功发布
      const articleTitle = await this.page.$eval('h1, .Post-title, .article-title',
        el => el.textContent).catch(() => null);

      if (articleTitle) {
        this.log('info', `文章发布验证成功: ${articleTitle}`);
      } else {
        this.log('warn', '无法验证文章标题，但URL可访问');
      }

    } catch (error) {
      this.log('warn', `验证发布结果时出错: ${error.message}`);
      // 不抛出错误，因为发布可能已经成功
    }
  }

  /**
   * 手动清理资源 - 在需要时手动调用
   */
  async manualCleanup() {
    this.log('info', '手动清理发布器资源');

    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.log('info', '手动资源清理完成');
    } catch (error) {
      this.log('error', `手动清理资源失败: ${error.message}`);
    }
  }

  /**
   * 清理资源 - 保留浏览器实例不关闭
   */
  async cleanup() {
    this.log('info', '发布器资源清理（保留浏览器）');

    try {
      // 不关闭页面和浏览器，保持开启状态供诊断
      this.log('info', '浏览器实例保持开启，便于诊断发布结果');

      // 如果需要清理，可以调用 manualCleanup()
      this.log('info', '如需清理浏览器，请调用 manualCleanup() 方法');

    } catch (error) {
      this.log('error', `资源清理失败: ${error.message}`);
    }
  }

  /**
   * 记录日志
   */
  log(level, message) {
    if (this.logCallback) {
      this.logCallback(level, message);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 更新进度
   */
  updateProgress(progress, message = '') {
    if (this.progressCallback) {
      this.progressCallback(progress, message);
    }
  }

  /**
   * 随机延迟，模拟人类操作间隔
   */
  async randomDelay(minMs, maxMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await this.page.waitForTimeout(delay);
  }

  /**
   * 模拟人类输入，包含打字速度和错误
   */
  async simulateHumanTyping(selector, text) {
    try {
      // 先点击输入框获得焦点
      await this.page.click(selector);

      // 等待一下，模拟人类反应时间
      await this.randomDelay(200, 800);

      // 模拟人类打字，每次输入1-3个字符
      const chars = text.split('');
      let currentText = '';

      for (let i = 0; i < chars.length; i++) {
        // 每次输入1-3个字符
        const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, chars.length - i);
        const chunk = chars.slice(i, i + chunkSize).join('');

        await this.page.type(selector, chunk);
        currentText += chunk;

        // 打字间隔，模拟人类打字速度
        await this.randomDelay(50, 200);

        // 偶尔有小的停顿，模拟思考
        if (Math.random() < 0.1) {
          await this.randomDelay(300, 800);
        }
      }

      // 检查是否需要修正（模拟人类可能的小错误）
      if (currentText !== text && Math.random() < 0.05) {
        // 5%的概率修正内容
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('a');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Delete');
        await this.page.type(selector, text);
      }

    } catch (error) {
      // 如果模拟输入失败，回退到普通输入
      this.log('warn', `模拟人类输入失败，使用普通输入: ${error.message}`);
      await this.page.type(selector, text);
    }
  }

  /**
   * 模拟人类点击，包含移动轨迹
   */
  async simulateHumanClick(selector) {
    try {
      const element = await this.page.$(selector);
      if (!element) {
        throw new Error('元素不存在');
      }

      const boundingBox = await element.boundingBox();
      if (!boundingBox) {
        throw new Error('无法获取元素位置');
      }

      // 在元素内部随机位置点击
      const x = boundingBox.x + boundingBox.width * (0.3 + Math.random() * 0.4);
      const y = boundingBox.y + boundingBox.height * (0.3 + Math.random() * 0.4);

      await this.page.mouse.move(x, y);
      await this.randomDelay(100, 300);
      await this.page.mouse.click();

    } catch (error) {
      // 如果模拟点击失败，回退到普通点击
      this.log('warn', `模拟人类点击失败，使用普通点击: ${error.message}`);
      await this.page.click(selector);
    }
  }

  /**
   * 模拟人类滚动
   */
  async simulateHumanScroll(distance = 300) {
    try {
      const currentScroll = await this.page.evaluate(() => window.scrollY);
      const targetScroll = currentScroll + distance;

      // 分步滚动，模拟平滑滚动
      const steps = 5;
      const stepSize = distance / steps;

      for (let i = 0; i < steps; i++) {
        await this.page.evaluate((step) => {
          window.scrollBy(0, step);
        }, stepSize);
        await this.page.waitForTimeout(50 + Math.random() * 100);
      }

    } catch (error) {
      this.log('warn', `模拟滚动失败: ${error.message}`);
    }
  }

  /**
   * 检查页面是否被重定向到反爬页面
   */
  async checkAntiBotRedirect() {
    try {
      const url = this.page.url();
      const title = await this.page.title();

      // 检查常见的反爬虫页面特征
      const antiBotPatterns = [
        /captcha/i,
        /verify.*human/i,
        /安全验证/i,
        /robot.*check/i,
        /403.*forbidden/i,
        /access.*denied/i
      ];

      for (const pattern of antiBotPatterns) {
        if (url.match(pattern) || title.match(pattern)) {
          this.log('warn', `检测到反爬虫页面: ${url} - ${title}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log('warn', `检查反爬虫页面失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查是否被限制或阻止
   */
  async checkRateLimit() {
    try {
      // 检查页面内容是否有限制提示
      const pageText = await this.page.evaluate(() => {
        return document.body.innerText;
      });

      const rateLimitPatterns = [
        /操作.*频繁/i,
        /请求.*过多/i,
        /限制.*访问/i,
        /请稍后/i,
        /try.*later/i,
        /403.*too.*many/i
      ];

      for (const pattern of rateLimitPatterns) {
        if (pageText.match(pattern)) {
          this.log('warn', `检测到访问限制: ${pattern.source}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log('warn', `检查访问限制失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 添加额外的反检测脚本
   */
  async injectAntiDetectionScript() {
    try {
      await this.page.evaluateOnNewDocument(() => {
        // 移除webdriver标记
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // 修改plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
              1: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" }
            },
            {
              length: 1
            }
          ]
        });

        // 修改languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['zh-CN', 'zh', 'en'],
        });

        // 添加Chrome对象
        window.chrome = {
          runtime: {},
        };

        // 修改权限查询结果
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          return Promise.resolve({ state: "granted" });
        };
      });

      this.log('info', '注入反检测脚本成功');
    } catch (error) {
      this.log('warn', `注入反检测脚本失败: ${error.message}`);
    }
  }

  /**
   * 注入高级反检测脚本
   */
  async injectAdvancedAntiDetection() {
    try {
      await this.page.evaluateOnNewDocument(() => {
        // 完全移除webdriver标记
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // 修改navigator.plugins使其看起来更真实
        const originalPlugins = navigator.plugins;
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = Array.prototype.slice.call(originalPlugins);
            // 确保有一些常见的插件
            if (plugins.length < 3) {
              return [
                {
                  0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
                  1: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
                  name: "Chrome PDF Plugin",
                  filename: "internal-pdf-viewer",
                  description: "Portable Document Format",
                  length: 2
                },
                {
                  0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", },
                  name: "Chrome PDF Viewer",
                  filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                  description: "Portable Document Format",
                  length: 1
                }
              ];
            }
            return plugins;
          },
        });

        // 设置语言属性
        Object.defineProperty(navigator, 'languages', {
          get: () => ['zh-CN', 'zh', 'en-US', 'en'],
        });

        // 添加完整的Chrome对象
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined
          },
          loadTimes: function() {
            return {
              requestTime: Date.now() / 1000 - Math.random(),
              startLoadTime: Date.now() / 1000 - Math.random() - 1,
              commitLoadTime: Date.now() / 1000 - Math.random() - 0.5,
              finishDocumentLoadTime: Date.now() / 1000 - Math.random() - 0.3,
              finishLoadTime: Date.now() / 1000 - Math.random() - 0.1,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: Date.now() / 1000 - Math.random() - 0.8,
              navigationType: "Other",
              wasFetchedViaSpdy: false,
              wasNpnNegotiated: false,
              npnNegotiatedProtocol: "unknown",
              wasAlternateProtocolAvailable: false,
              connectionInfo: "http/1.1"
            };
          },
          csi: function() {
            return {
              pageT: Date.now(),
              startE: Date.now(),
              tran: 15
            };
          }
        };

        // 修改权限查询结果
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {
          return Promise.resolve({ state: "granted" });
        };

        // 修改navigator.vendor
        Object.defineProperty(navigator, 'vendor', {
          get: () => 'Google Inc.',
        });

        // 添加deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });

        // 添加hardwareConcurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 4,
        });

        // 重写Date.now以添加微小偏差
        const originalDateNow = Date.now;
        Date.now = function() {
          return originalDateNow() + Math.floor(Math.random() * 3) - 1;
        };

        // 添加随机的鼠标移动事件
        let mouseMoveCount = 0;
        document.addEventListener('mousemove', function(e) {
          mouseMoveCount++;
          if (mouseMoveCount % 50 === 0) {
            // 偶尔添加一些微小的随机偏移
            if (Math.random() < 0.1) {
              e.clientX += Math.random() * 2 - 1;
              e.clientY += Math.random() * 2 - 1;
            }
          }
        });

        // 模拟人类的滚动行为
        let scrollCount = 0;
        window.addEventListener('scroll', function() {
          scrollCount++;
          // 偶尔模拟人类的不规律滚动
          if (Math.random() < 0.05 && scrollCount > 10) {
            window.scrollBy(0, Math.random() * 20 - 10);
          }
        });

        // 防止通过window.outerWidth/Height检测自动化
        Object.defineProperty(window, 'outerWidth', {
          get: () => 1920,
        });
        Object.defineProperty(window, 'outerHeight', {
          get: () => 1080,
        });

        // 修改screen属性
        Object.defineProperty(screen, 'availWidth', {
          get: () => 1920,
        });
        Object.defineProperty(screen, 'availHeight', {
          get: () => 1040,
        });

        // 防止通过notification检测
        const originalNotification = window.Notification;
        Object.defineProperty(window, 'Notification', {
          get: () => {
            return {
              permission: 'default',
              requestPermission: () => Promise.resolve('default')
            };
          }
        });
      });

      this.log('info', '注入高级反检测脚本成功');
    } catch (error) {
      this.log('warn', `注入高级反检测脚本失败: ${error.message}`);
    }
  }

  /**
   * 检测并处理反爬虫页面
   */
  async handleAntiBotDetection() {
    try {
      const isAntiBotPage = await this.checkAntiBotRedirect();
      if (isAntiBotPage) {
        this.log('warn', '检测到反爬虫页面，尝试处理');

        // 尝试多种处理策略
        const strategies = [
          () => this.handleDesertPage()
        ];

        for (const strategy of strategies) {
          try {
            const result = await strategy();
            if (result) {
              this.log('info', '反爬虫页面处理成功');
              return true;
            }
          } catch (error) {
            this.log('warn', `处理策略失败: ${error.message}`);
          }
        }

        this.log('error', '所有反爬虫处理策略都失败');
        return false;
      }
      return true;
    } catch (error) {
      this.log('error', `处理反爬虫检测失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理"荒漠"页面（知乎特有的反爬虫页面）
   */
  async handleDesertPage() {
    try {
      this.log('info', '尝试处理荒漠页面');

      // 检查页面标题和URL
      const title = await this.page.title();
      const url = this.page.url();

      if (title.includes('荒漠') || url.includes('desert') || url.includes('captcha')) {
        this.log('warn', `检测到荒漠页面: ${title} - ${url}`);

        // 策略1：等待并刷新
        await this.page.waitForTimeout(15000);
        await this.page.reload({ waitUntil: 'networkidle2' });

        // 检查是否还在荒漠页面
        const newTitle = await this.page.title();
        if (!newTitle.includes('荒漠')) {
          this.log('info', '通过刷新脱离了荒漠页面');
          return true;
        }

        // 策略2：返回上一页
        await this.page.goBack();
        await this.page.waitForTimeout(3000);

        // 策略3：重新导航到目标页面
        await this.page.goto('https://zhuanlan.zhihu.com/write', {
          waitUntil: 'networkidle2'
        });

        // 再次检查
        const finalTitle = await this.page.title();
        if (!finalTitle.includes('荒漠')) {
          this.log('info', '通过重新导航脱离了荒漠页面');
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log('warn', `处理荒漠页面失败: ${error.message}`);
      return false;
    }
  }
}

module.exports = ZhihuPublisher;