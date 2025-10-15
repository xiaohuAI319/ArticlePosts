/**
 * T014 BrowserManager 简化测试套件
 * 测试核心功能，不依赖实际的Puppeteer浏览器创建
 */

const path = require('path');
const os = require('os');

// 模拟puppeteer-core
jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue({
    process: () => ({ pid: 12345 }),
    isConnected: () => true,
    close: jest.fn().mockResolvedValue(true),
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue(true),
      title: jest.fn().mockResolvedValue('Test Page'),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      viewport: () => ({ width: 1920, height: 1080 }),
      close: jest.fn().mockResolvedValue(true)
    }),
    pages: jest.fn().mockResolvedValue([
      {
        title: jest.fn().mockResolvedValue('Test Page'),
        viewport: () => ({ width: 1920, height: 1080 })
      }
    ]),
    on: jest.fn()
  })
}));

// 模拟electron.app模块
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/temp/path'),
    isPackaged: jest.fn().mockReturnValue(false)
  }
}));

const { BrowserManager } = require('../../../src/main/automation/BrowserManager');

describe('T014 BrowserManager 核心功能测试', () => {
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

    test('应该验证配置参数', () => {
      expect(() => {
        new BrowserManager({ headless: 'invalid' });
      }).toThrow();

      expect(() => {
        new BrowserManager({ executablePath: null });
      }).toThrow();
    });
  });

  describe('🌐 浏览器实例管理', () => {
    test('应该能够创建浏览器实例', async () => {
      const browser = await browserManager.createBrowser();

      expect(browser).toBeDefined();
      expect(browserManager.getActiveBrowsersCount()).toBe(1);
      expect(browserManager.getAllBrowsers()).toHaveLength(1);

      await browserManager.closeBrowser(browser);
    });

    test('应该能够管理多个浏览器实例', async () => {
      const browser1 = await browserManager.createBrowser();
      const browser2 = await browserManager.createBrowser();

      expect(browserManager.getActiveBrowsersCount()).toBe(2);
      expect(browserManager.getAllBrowsers()).toHaveLength(2);

      await browserManager.closeBrowser(browser1);
      await browserManager.closeBrowser(browser2);
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
    });

    test('应该能够通过ID获取浏览器实例', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      const retrievedBrowser = browserManager.getBrowser(browserId);
      expect(retrievedBrowser).toBe(browser);

      await browserManager.closeBrowser(browser);
    });

    test('应该验证浏览器状态', async () => {
      const browser = await browserManager.createBrowser();

      expect(browserManager.isBrowserConnected(browser)).toBe(true);

      await browserManager.closeBrowser(browser);
    });
  });

  describe('🔒 隐身模式和反检测', () => {
    test('应该配置隐身模式', async () => {
      const stealthConfig = browserManager.getStealthConfig();
      expect(stealthConfig).toBeDefined();
      expect(stealthConfig).toMatchObject({
        args: expect.arrayContaining(['--disable-web-security']),
        userDataDir: expect.any(String),
        viewport: expect.any(Object)
      });
    });

    test('应该配置反检测参数', async () => {
      const browser = await browserManager.createBrowser();
      const mockPuppeteer = require('puppeteer-core');

      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
          ])
        })
      );

      await browserManager.closeBrowser(browser);
    });
  });

  describe('📊 健康状态和统计', () => {
    test('应该提供健康状态检查', () => {
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
    });
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
    });
  });

  describe('🧹 资源管理和清理', () => {
    test('应该能够清理浏览器资源', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      expect(browserManager.getActiveBrowsersCount()).toBe(1);

      await browserManager.closeBrowser(browser);
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
      expect(browserManager.getBrowser(browserId)).toBeNull();
    });

    test('应该能够清理所有浏览器', async () => {
      const browser1 = await browserManager.createBrowser();
      const browser2 = await browserManager.createBrowser();

      expect(browserManager.getActiveBrowsersCount()).toBe(2);

      await browserManager.cleanup();
      expect(browserManager.getActiveBrowsersCount()).toBe(0);
    });
  });

  describe('⚡ 错误处理和恢复', () => {
    test('应该处理浏览器创建失败', async () => {
      // 模拟无效的浏览器创建参数
      const mockPuppeteer = require('puppeteer-core');
      mockPuppeteer.launch.mockRejectedValueOnce(new Error('启动失败'));

      await expect(browserManager.createBrowser({}))
        .rejects.toThrow('启动失败');
    });

    test('应该处理浏览器意外关闭', async () => {
      const browser = await browserManager.createBrowser();
      const browserId = browserManager.getBrowserId(browser);

      // 模拟浏览器意外关闭
      browser.isConnected = jest.fn().mockReturnValue(false);

      expect(browserManager.isBrowserConnected(browser)).toBe(false);
    });

    test('应该提供错误恢复机制', async () => {
      // 模拟部分错误状态
      browserManager.isHealthy = false;

      expect(browserManager.getHealthStatus()).toMatchObject({
        healthy: false,
        browsersCount: expect.any(Number),
        errors: expect.any(Array)
      });

      // 恢复健康状态
      browserManager.isHealthy = true;
      expect(browserManager.getHealthStatus()).toMatchObject({
        healthy: true,
        browsersCount: expect.any(Number),
        errors: expect.any(Array)
      });
    });
  });
});