/**
 * T014 BrowserManager TDD测试套件
 * 测试Puppeteer浏览器集成功能
 */

const path = require('path');
const os = require('os');
const { BrowserManager } = require('../../../src/main/automation/BrowserManager');

// 模拟electron.app模块
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/temp/path'),
    isPackaged: jest.fn().mockReturnValue(false)
  }
}));

describe('T014 BrowserManager Puppeteer浏览器集成', () => {
  let browserManager;

  beforeEach(() => {
    browserManager = new BrowserManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (browserManager) {
      await browserManager.cleanup();
    }
  });

  describe('🎯 初始化测试', () => {
    test('应该能够创建BrowserManager实例', () => {
      expect(browserManager).toBeDefined();
      expect(browserManager.constructor.name).toBe('BrowserManager');
    });

    test('应该有默认配置', () => {
      expect(browserManager.config).toBeDefined();
      expect(browserManager.config.headless).toBe(false); // 可视化模式
      expect(browserManager.config.stealth).toBe(true); // 隐身模式
      expect(browserManager.config.defaultViewport).toBeDefined();
    });
  });

  describe('🌐 浏览器实例管理', () => {
    test('应该能够创建浏览器实例', async () => {
      const browser = await browserManager.createBrowser();

      expect(browser).toBeDefined();
      expect(browser.process()).toBeDefined();
      expect(browser.isConnected()).toBe(true);

      await browserManager.closeBrowser(browser);
    }, 30000);

    test('应该能够管理多个浏览器实例', async () => {
      const browser1 = await browserManager.createBrowser();
      const browser2 = await browserManager.createBrowser();

      expect(browserManager.getActiveBrowsersCount()).toBe(2);
      expect(browserManager.getAllBrowsers()).toHaveLength(2);

      await browserManager.closeBrowser(browser1);
      await browserManager.closeBrowser(browser2);
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
    }, 60000);

    test('应该能够通过ID获取浏览器实例', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      const retrievedBrowser = browserManager.getBrowser(browserId);
      expect(retrievedBrowser).toBe(browser);

      await browserManager.closeBrowser(browser);
    }, 30000);

    test('应该验证浏览器状态', async () => {
      const browser = await browserManager.createBrowser();

      expect(browserManager.isBrowserConnected(browser)).toBe(true);

      await browser.close();
      expect(browserManager.isBrowserConnected(browser)).toBe(false);

      await browserManager.cleanup();
    }, 30000);
  });

  describe('🔒 隐身模式和反检测', () => {
    test('应该配置隐身模式', async () => {
      const browser = await browserManager.createBrowser();

      const stealthConfig = browserManager.getStealthConfig();
      expect(stealthConfig).toBeDefined();
      expect(stealthConfig).toMatchObject({
        args: expect.arrayContaining(['--disable-web-security']),
        userDataDir: expect.any(String),
        viewport: expect.any(Object)
      });

      await browserManager.closeBrowser(browser);
    }, 30000);

    test('应该配置反检测参数', async () => {
      const browser = await browserManager.createBrowser();

      const args = browser.process().spawnargs;

      // 验证关键反检测参数
      expect(args).toContain('--disable-web-security');
      expect(args).toContain('--disable-features=IsolateOrigins,site-per-process');
      expect(args.some(arg => arg.includes('--user-data-dir=')));

      await browserManager.closeBrowser(browser);
    }, 30000);
  });

  describe('🪟 可视化浏览器窗口', () => {
    test('应该创建可视化窗口', async () => {
      const browser = await browserManager.createBrowser();

      expect(browser.process().pid).toBeDefined();
      expect(Number.isInteger(browser.process().pid)).toBe(true);

      await browserManager.closeBrowser(browser);
    }, 30000);

    test('应该支持窗口管理', async () => {
      const browser = await browserManager.createBrowser();
      const pages = await browser.pages();

      if (pages.length > 0) {
        const page = pages[0];
        expect(page).toBeDefined();

        // 测试窗口操作
        const originalTitle = await page.title();
        expect(typeof originalTitle).toBe('string');

        // 测试视口配置
        const viewport = page.viewport();
        expect(viewport).toBeDefined();
        expect(viewport.width).toBeGreaterThan(0);
        expect(viewport.height).toBeGreaterThan(0);
      }

      await browserManager.closeBrowser(browser);
    }, 30000);
  });

  describe('🧹 资源管理和清理', () => {
    test('应该能够清理浏览器资源', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      expect(browserManager.getActiveBrowsersCount()).toBe(1);

      await browserManager.closeBrowser(browser);
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
      expect(browserManager.getBrowser(browserId)).toBeNull();
    }, 30000);

    test('应该能够清理所有浏览器', async () => {
      const browser1 = await browserManager.createBrowser();
      const browser2 = await browserManager.createBrowser();

      expect(browserManager.getActiveBrowsersCount()).toBe(2);

      await browserManager.cleanup();
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
    }, 60000);

    test('应该防止内存泄漏', async () => {
      // 创建多个浏览器实例
      const browsers = [];
      for (let i = 0; i < 3; i++) {
        browsers.push(await browserManager.createBrowser());
      }

      expect(browserManager.getActiveBrowsersCount()).toBe(3);

      // 清理所有浏览器
      await browserManager.cleanup();
      expect(browserManager.getActiveBrowsersCount()).toBe(0);

      // 验证没有内存泄漏
      expect(browserManager.getAllBrowsers()).toHaveLength(0);
    }, 60000);
  });

  describe('⚡ 错误处理和恢复', () => {
    test('应该处理浏览器创建失败', async () => {
      // 模拟无效的浏览器创建参数
      const invalidConfig = {
        headless: 'invalid',
        executablePath: '/invalid/path'
      };

      await expect(browserManager.createBrowser(invalidConfig))
        .rejects.toThrow();
    });

    test('应该处理浏览器意外关闭', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      // 模拟浏览器意外关闭
      browser.connected = false;

      expect(browserManager.isBrowserConnected(browser)).toBe(false);
      expect(browserManager.getBrowser(browserId)).toBeNull();
    });

    test('应该提供错误恢复机制', async () => {
      const browser = await browserManager.createBrowser();

      // 模拟部分错误状态
      browserManager.isHealthy = false;

      expect(browserManager.getHealthStatus()).toMatchObject({
        healthy: false,
        browsersCount: 1,
        errors: expect.any(Array)
      });

      // 恢复健康状态
      browserManager.isHealthy = true;
      expect(browserManager.getHealthStatus()).toMatchObject({
        healthy: true,
        browsersCount: 1,
        errors: []
      });

      await browserManager.closeBrowser(browser);
    }, 30000);
  });

  describe('📊 健康状态和统计', () => {
    test('应该提供健康状态检查', async () => {
      const healthStatus = browserManager.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus).toMatchObject({
        healthy: expect.any(Boolean),
        browsersCount: expect.any(Number),
        errors: expect.any(Array),
        memoryUsage: expect.any(Object)
      });
    });

    test('应该跟踪浏览器统计信息', async () => {
      const initialStats = browserManager.getStats();

      expect(initialStats).toBeDefined();
      expect(initialStats).toMatchObject({
        totalCreated: expect.any(Number),
        activeBrowsers: expect.any(Number),
        totalClosed: expect.any(Number)
      });

      const browser = await browserManager.createBrowser();
      const statsWithBrowser = browserManager.getStats();

      expect(statsWithBrowser.activeBrowsers).toBe(initialStats.activeBrowsers + 1);
      expect(statsWithBrowser.totalCreated).toBe(initialStats.totalCreated + 1);

      await browserManager.closeBrowser(browser);
      const finalStats = browserManager.getStats();

      expect(finalStats.activeBrowsers).toBe(initialStats.activeBrowsers);
      expect(finalStats.totalClosed).toBe(initialStats.totalClosed + 1);
    }, 30000);
  });

  describe('🔧 配置管理', () => {
    test('应该支持自定义配置', () => {
      const customConfig = {
        headless: true,
        stealth: false,
        defaultViewport: { width: 800, height: 600 }
      };

      const customBrowserManager = new BrowserManager(customConfig);

      expect(customBrowserManager.config.headless).toBe(true);
      expect(customBrowserManager.config.stealth).toBe(false);
      expect(customBrowserManager.config.defaultViewport).toEqual({ width: 800, height: 600 });
    });

    test('应该验证配置参数', () => {
      expect(() => {
        new BrowserManager({ headless: 'invalid' });
      }).toThrow();

      expect(() => {
        new BrowserManager({ executablePath: null });
      }).toThrow();
    });
  });

  describe('🔄 IPC集成准备', () => {
    test('应该暴露必要的API接口', () => {
      const apiMethods = [
        'createBrowser',
        'closeBrowser',
        'getBrowser',
        'getAllBrowsers',
        'getActiveBrowsersCount',
        'cleanup',
        'getHealthStatus',
        'getStats'
      ];

      apiMethods.forEach(method => {
        expect(typeof browserManager[method]).toBe('function');
      });
    });

    test('应该支持异步操作', async () => {
      const browser = await browserManager.createBrowser();
      expect(browser).toBeDefined();
      await browserManager.closeBrowser(browser);
    }, 30000);
  });

  describe('🚀 性能测试', () => {
    test('应该在合理时间内创建浏览器', async () => {
      const startTime = Date.now();
      const browser = await browserManager.createBrowser();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(15000); // 15秒内

      await browserManager.closeBrowser(browser);
    }, 30000);

    test('应该支持并发浏览器创建', async () => {
      const startTime = Date.now();

      const browsers = await Promise.all([
        browserManager.createBrowser(),
        browserManager.createBrowser()
      ]);

      const endTime = Date.now();

      expect(browsers).toHaveLength(2);
      expect(endTime - startTime).toBeLessThan(30000); // 30秒内

      await browserManager.cleanup();
    }, 60000);
  });
});

// 集成测试套件
describe('T014 BrowserManager 集成测试', () => {
  let browserManager;

  beforeEach(() => {
    browserManager = new BrowserManager();
  });

  afterEach(async () => {
    await browserManager.cleanup();
  });

  test('完整的浏览器生命周期', async () => {
    // 1. 创建浏览器
    const browser = await browserManager.createBrowser();
    expect(browser).toBeDefined();

    // 2. 创建页面
    const page = await browser.newPage();
    expect(page).toBeDefined();

    // 3. 导航到测试页面
    await page.goto('https://www.example.com');
    const title = await page.title();
    expect(title).toContain('Example');

    // 4. 截图测试
    const screenshot = await page.screenshot();
    expect(screenshot).toBeDefined();

    // 5. 清理资源
    await page.close();
    await browserManager.closeBrowser(browser);

    // 6. 验证完全清理
    expect(browserManager.getActiveBrowsersCount()).toBe(0);
  }, 60000);

  test('多页面并发操作', async () => {
    const browser = await browserManager.createBrowser();

    // 创建多个页面
    const pages = await Promise.all([
      browser.newPage(),
      browser.newPage(),
      browser.newPage()
    ]);

    expect(pages).toHaveLength(3);

    // 并发导航
    await Promise.all([
      pages[0].goto('https://www.example.com'),
      pages[1].goto('https://httpbin.org'),
      pages[2].goto('https://jsonplaceholder.typicode.com')
    ]);

    // 验证所有页面都加载成功
    const titles = await Promise.all(
      pages.map(page => page.title())
    );

    expect(titles).toHaveLength(3);

    // 清理所有页面和浏览器
    await Promise.all(pages.map(page => page.close()));
    await browserManager.closeBrowser(browser);
  }, 60000);
});