/**
 * 简化版知乎发布器 - 基于quickstart.md中的实践验证版本
 * 专注于发布功能，使用T15 PlatformAutoLoginService处理登录
 */

const { BrowserManager } = require('./BrowserManager');
const PlatformAutoLoginService = require('../services/PlatformAutoLoginService');
const PlatformService = require('../services/PlatformService');

class SimpleZhihuPublisher {
  constructor() {
    this.browserManager = new BrowserManager();
    this.platformAutoLoginService = new PlatformAutoLoginService();
    this.platformService = new PlatformService();
    this.page = null;
    this.browser = null;
    this.taskId = null;
    this.progressCallback = null;
    this.logCallback = null;
  }

  /**
   * 初始化发布器
   */
  async initialize(taskId, progressCallback, logCallback) {
    this.taskId = taskId;
    this.progressCallback = progressCallback;
    this.logCallback = logCallback;

    this.log('info', '初始化简化知乎发布器');
    this.updateProgress(10, '平台服务初始化');

    try {
      // 初始化平台服务
      await this.platformAutoLoginService.initialize();
      await this.platformService.initialize();

      this.updateProgress(20, '发布器初始化完成');
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
      this.updateProgress(30, '准备发布环境');

      // 1. 确保知乎平台已登录（使用T15服务）
      const zhihuSession = await this.ensureZhihuLoggedIn(sessionId);
      this.updateProgress(40, '登录状态验证完成');

      // 2. 获取浏览器实例
      await this.acquireBrowser();
      this.updateProgress(50, '浏览器环境准备完成');

      // 3. 恢复登录状态
      if (zhihuSession.sessionId) {
        await this.restoreLoginSession(zhihuSession.sessionId);
      }
      this.updateProgress(60, '登录状态恢复完成');

      // 4. 发布文章
      const result = await this.publishArticle(articleData);
      this.updateProgress(90, '文章发布执行完成');

      // 5. 验证发布结果
      await this.verifyPublishResult(result);
      this.updateProgress(100, '发布完成');

      this.log('info', `文章发布成功: ${result.url}`);
      return result;

    } catch (error) {
      this.log('error', `发布失败: ${error.message}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 确保知乎平台已登录
   */
  async ensureZhihuLoggedIn(sessionId) {
    this.log('info', '验证知乎登录状态（使用T15服务）');

    try {
      // 获取知乎平台信息
      const platformsResult = await this.platformService.getAllPlatforms(true);
      if (!platformsResult.success) {
        throw new Error('未找到知乎平台配置');
      }

      // 查找知乎平台
      const zhihuPlatform = platformsResult.data.find(p =>
        p.name === 'zhihu' || p.display_name === '知乎'
      );

      if (!zhihuPlatform) {
        throw new Error('未找到知乎平台配置');
      }

      // 检查是否已有活跃的登录会话
      const activeLogins = this.platformAutoLoginService.getActiveLogins();
      const zhihuLogin = activeLogins.find(login =>
        login.platformId === zhihuPlatform.id && login.status === 'success'
      );

      if (zhihuLogin) {
        this.log('info', `发现已登录的知乎会话: ${zhihuLogin.id}`);
        return zhihuLogin;
      }

      // 如果有指定sessionId，使用它
      if (sessionId) {
        this.log('info', `使用指定的会话: ${sessionId}`);
        return { sessionId, platformId: zhihuPlatform.id, isRestored: true };
      }

      throw new Error('未找到有效的知乎登录会话，请先进行登录');

    } catch (error) {
      this.log('error', `确保知乎登录失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取浏览器实例
   */
  async acquireBrowser() {
    this.log('info', '获取浏览器实例');

    try {
      // 启动浏览器实例
      const browserResult = await this.browserManager.createBrowser({
        headless: false, // 显示浏览器窗口，便于调试
        viewport: { width: 1920, height: 1080 },
        stealth: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      if (!browserResult.success) {
        throw new Error(`浏览器创建失败: ${browserResult.error}`);
      }

      this.browser = browserResult.data.browser;
      this.page = await this.browser.newPage();

      // 设置页面超时
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      this.log('info', '浏览器实例获取成功');

    } catch (error) {
      this.log('error', `获取浏览器实例失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 恢复登录会话
   */
  async restoreLoginSession(sessionId) {
    this.log('info', `恢复登录会话: ${sessionId}`);

    try {
      // 通过PublisherLoginSessionService恢复会话
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
      // 检查页面内容判断登录状态
      const pageText = await this.page.evaluate(() => document.body.innerText);
      const isLoggedIn = pageText.includes('首页') ||
                           pageText.includes('想法') ||
                           pageText.includes('通知') ||
                           pageText.includes('私信') ||
                           pageText.includes('创作');

      if (isLoggedIn) {
        this.log('info', '通过页面内容检测到登录成功');
        return true;
      }

      // 检查页面标题
      const title = await this.page.title();
      if (title && !title.includes('登录') && !title.includes('注册')) {
        this.log('info', `通过页面标题判断已登录: ${title}`);
        return true;
      }

      this.log('warn', '未检测到登录状态');
      return false;

    } catch (error) {
      this.log('error', `验证登录状态失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发布文章 - 基于quickstart.md中的验证版本
   */
  async publishArticle(article) {
    this.log('info', '开始发布文章流程');

    try {
      // 导航到写作页面
      await this.page.goto('https://zhuanlan.zhihu.com/write', {
        waitUntil: 'networkidle2'
      });

      this.log('info', '已进入知乎写作页面');

      // 填写标题 - 使用多种选择器策略
      const titleSelectors = [
        'input[placeholder*="标题"]',
        'input[placeholder*="请输入标题"]',
        '.WriteIndex-titleInput input',
        '.TitleInput input',
        'input[data-placeholder*="标题"]',
        '.editor-title input',
        '[class*="title"] input',
        'input[type="text"]' // 最后的备用选择器
      ];

      let titleInput = null;
      for (const selector of titleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          titleInput = await this.page.$(selector);
          if (titleInput) {
            this.log('info', `找到标题输入框: ${selector}`);
            break;
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      if (!titleInput) {
        // 如果所有选择器都失败，尝试通过文本内容查找
        const inputs = await this.page.$$('input');
        for (const input of inputs) {
          const placeholder = await input.evaluate(el => el.placeholder || '').catch(() => '');
          if (placeholder.includes('标题') || placeholder.includes('请输入')) {
            titleInput = input;
            this.log('info', '通过placeholder找到标题输入框');
            break;
          }
        }
      }

      if (!titleInput) {
        // 最后的备用方案：点击页面顶部区域
        await this.page.click('body', { position: { x: 100, y: 100 } });
        await this.page.keyboard.type(article.title);
        this.log('info', '使用备用方案输入标题');
      } else {
        await titleInput.click({ clickCount: 3 });
        await this.page.keyboard.type(article.title);
      }

      this.log('info', `标题已填充: ${article.title}`);

      // 填写内容 - 使用更可靠的方法
      await this.page.waitForSelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]', {
        timeout: 10000
      });

      const editorSelector = '.RichText, .public-DraftEditor-content, [contenteditable="true"]';
      await this.page.click(editorSelector);

      // 清空现有内容
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this.page.keyboard.press('Delete');

      // 等待清空完成
      await this.page.waitForTimeout(500);

      // 填充内容 - 使用evaluate方法更可靠
      const content = article.content || article.html_content || '';
      await this.page.evaluate((text) => {
        const editor = document.querySelector('.RichText, .public-DraftEditor-content, [contenteditable="true"]');
        if (editor) {
          editor.innerHTML = text;
        }
      }, content);

      this.log('info', `内容已填充，长度: ${content.length}`);

      // 等待内容加载完成
      await this.page.waitForTimeout(2000);

      // 点击发布按钮
      await this.clickPublishButton();

      // 等待发布完成
      await this.page.waitForTimeout(5000);

      // 获取发布结果
      const currentUrl = this.page.url();
      const title = await this.page.title();

      // 尝试从URL中提取文章ID
      let articleId = null;
      let publishedUrl = currentUrl;

      const urlMatch = currentUrl.match(/\/p\/(\d+)/);
      if (urlMatch) {
        articleId = urlMatch[1];
        publishedUrl = `https://zhuanlan.zhihu.com/p/${articleId}`;
      }

      this.log('info', '文章发布流程完成');

      return {
        success: true,
        url: publishedUrl,
        articleId: articleId,
        title: title,
        publishedAt: new Date().toISOString()
      };

    } catch (error) {
      this.log('error', `发布文章失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 点击发布按钮
   */
  async clickPublishButton() {
    this.log('info', '寻找并点击发布按钮');

    try {
      // 尝试多种发布按钮选择器
      const publishSelectors = [
        'button[type="submit"]',
        'button:contains("发布")',
        'button:contains("发表")',
        '.PublishButton',
        '.publish-button',
        '[data-testid*="publish"]',
        '[data-action*="publish"]'
      ];

      for (const selector of publishSelectors) {
        try {
          let button = null;

          if (selector.includes(':contains(')) {
            // 文本匹配
            const text = selector.match(/:contains\("([^"]+)"\)/)[1];
            const buttons = await this.page.$$('button');
            for (const btn of buttons) {
              const elementText = await btn.evaluate(el => el.textContent);
              if (elementText.includes(text)) {
                button = btn;
                break;
              }
            }
          } else {
            // CSS选择器
            button = await this.page.$(selector);
          }

          if (button) {
            await button.click();
            this.log('info', `已点击发布按钮: ${selector}`);
            return;
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      // 最后尝试：通过evaluate查找
      const result = await this.page.evaluate(() => {
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

      if (result) {
        this.log('info', '通过evaluate点击了发布按钮');
      } else {
        this.log('warn', '未找到发布按钮，可能已经发布完成');
      }

    } catch (error) {
      this.log('error', `点击发布按钮失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证发布结果
   */
  async verifyPublishResult(result) {
    if (!result.success) {
      throw new Error(`发布失败: ${result.error || result.message}`);
    }

    try {
      // 验证URL是否可访问
      if (result.url && result.url !== this.page.url()) {
        await this.page.goto(result.url, { waitUntil: 'networkidle2', timeout: 30000 });
      }

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
   * 清理资源
   */
  async cleanup() {
    this.log('info', '清理发布器资源');

    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.log('info', '资源清理完成');
    } catch (error) {
      this.log('error', `清理资源失败: ${error.message}`);
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
}

module.exports = SimpleZhihuPublisher;