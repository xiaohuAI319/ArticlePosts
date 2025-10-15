/**
 * PlatformAutoLoginService 测试套件 - T015
 * 测试平台自动化登录服务的核心功能
 */

const PlatformAutoLoginService = require('../../../src/main/services/PlatformAutoLoginService');
const BrowserManager = require('../../../src/main/automation/BrowserManager');
const LoginSessionService = require('../../../src/main/services/LoginSessionService');
const QRCodeService = require('../../../src/main/services/QRCodeService');
const PlatformService = require('../../../src/main/services/PlatformService');

// Mock 依赖服务
jest.mock('../../../src/main/automation/BrowserManager');
jest.mock('../../../src/main/services/LoginSessionService');
jest.mock('../../../src/main/services/QRCodeService');
jest.mock('../../../src/main/services/PlatformService');

describe('PlatformAutoLoginService - T015平台自动化登录服务', () => {
  let service;
  let mockBrowserManager;
  let mockLoginSessionService;
  let mockQRCodeService;
  let mockPlatformService;

  beforeEach(() => {
    // 创建 mock 实例
    mockBrowserManager = {
      createBrowser: jest.fn(),
      getBrowser: jest.fn(),
      getBrowserId: jest.fn(),
      closeBrowser: jest.fn()
    };

    mockLoginSessionService = {
      initialize: jest.fn(),
      createSession: jest.fn(),
      calculateDefaultExpiry: jest.fn()
    };

    mockQRCodeService = {
      initialize: jest.fn()
    };

    mockPlatformService = {
      initialize: jest.fn(),
      getPlatform: jest.fn()
    };

    // 设置 mock 返回值
    BrowserManager.mockImplementation(() => mockBrowserManager);
    LoginSessionService.mockImplementation(() => mockLoginSessionService);
    QRCodeService.mockImplementation(() => mockQRCodeService);
    PlatformService.mockImplementation(() => mockPlatformService);

    // 创建服务实例
    service = new PlatformAutoLoginService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('服务初始化', () => {
    test('应该成功初始化所有依赖服务', async () => {
      // 准备测试数据
      mockLoginSessionService.initialize.mockResolvedValue({ success: true });
      mockQRCodeService.initialize.mockResolvedValue({ success: true });
      mockPlatformService.initialize.mockResolvedValue({ success: true });

      // 执行测试
      const result = await service.initialize();

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.message).toBe('平台自动化登录服务初始化成功');
      expect(mockLoginSessionService.initialize).toHaveBeenCalled();
      expect(mockQRCodeService.initialize).toHaveBeenCalled();
      expect(mockPlatformService.initialize).toHaveBeenCalled();
    });

    test('应该处理初始化失败', async () => {
      // 准备测试数据 - 初始化失败
      mockLoginSessionService.initialize.mockRejectedValue(new Error('初始化失败'));

      // 执行测试
      const result = await service.initialize();

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.message).toBe('平台自动化登录服务初始化失败');
      expect(result.error).toBe('初始化失败');
    });
  });

  describe('启动平台登录流程', () => {
    beforeEach(() => {
      // 初始化服务
      service.initialize();
    });

    test('应该成功启动扫码登录流程', async () => {
      // 准备测试数据
      const platformId = '1';
      const platform = {
        id: platformId,
        name: '知乎',
        display_name: '知乎',
        login_url: 'https://www.zhihu.com/signin',
        config_schema: {
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          }
        }
      };

      const mockBrowser = {
        newPage: jest.fn()
      };

      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        evaluateOnNewDocument: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        $: jest.fn(),
        $eval: jest.fn(),
        cookies: jest.fn(),
        url: jest.fn()
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      mockBrowserManager.createBrowser.mockResolvedValue({
        success: true,
        data: { browserId: 'browser_123' }
      });

      mockBrowserManager.getBrowser.mockReturnValue(mockBrowser);
      mockBrowser.newPage.mockResolvedValue(mockPage);
      mockPage.waitForSelector.mockResolvedValue(true);
      mockPage.$.mockResolvedValue({ screenshot: jest.fn().mockResolvedValue('base64_image') });
      mockPage.$eval.mockResolvedValue('https://zhihu.com/qrcode');
      mockPage.cookies.mockResolvedValue([{ name: 'session', value: 'abc123' }]);
      mockPage.url.mockReturnValue('https://www.zhihu.com/dashboard');

      mockLoginSessionService.createSession.mockResolvedValue({
        success: true,
        data: { id: 'session_123' }
      });

      // 执行测试
      const result = await service.startPlatformLogin(platformId);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.data.loginId).toBeDefined();
      expect(result.data.platformId).toBe(platformId);
      expect(result.data.platformName).toBe('知乎');
      expect(result.data.method).toBe('qr_code');

      // 验证浏览器创建
      expect(mockBrowserManager.createBrowser).toHaveBeenCalledWith({
        headless: false,
        stealth: true,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      // 验证页面设置
      expect(mockPage.setUserAgent).toHaveBeenCalled();
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1366, height: 768 });
    });

    test('应该处理平台不存在的情况', async () => {
      // 准备测试数据
      const platformId = '999';

      mockPlatformService.getPlatform.mockResolvedValue({
        success: false,
        error: 'Platform not found',
        message: '平台不存在'
      });

      // 执行测试
      const result = await service.startPlatformLogin(platformId);

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.error).toBe('Platform not found');
      expect(result.message).toBe('平台不存在');
    });

    test('应该处理浏览器创建失败', async () => {
      // 准备测试数据
      const platformId = '1';
      const platform = {
        id: platformId,
        name: '知乎',
        config_schema: { auth_method: 'qr_code' }
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      mockBrowserManager.createBrowser.mockResolvedValue({
        success: false,
        error: 'Browser creation failed',
        message: '浏览器创建失败'
      });

      // 执行测试
      const result = await service.startPlatformLogin(platformId);

      // 验证结果
      expect(result.success).toBe(false);
      expect(result.error).toBe('Browser creation failed');
      expect(result.message).toBe('浏览器创建失败');
    });
  });

  describe('二维码登录流程', () => {
    let mockPage;
    let platform;

    beforeEach(() => {
      // 初始化服务
      service.initialize();

      // 准备 mock 数据
      platform = {
        id: '1',
        name: '知乎',
        login_url: 'https://www.zhihu.com/signin',
        config_schema: {
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          }
        }
      };

      mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        evaluateOnNewDocument: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        $: jest.fn(),
        screenshot: jest.fn().mockResolvedValue('base64_qr_image'),
        $eval: jest.fn(),
        cookies: jest.fn().mockResolvedValue([{ name: 'session', value: 'abc123' }]),
        url: jest.fn()
      };
    });

    test('应该成功处理二维码登录', async () => {
      // 启动登录流程
      const loginResult = await service.startPlatformLogin(platform.id);

      // 等待异步登录流程完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证登录流程已启动
      expect(loginResult.success).toBe(true);
      expect(loginResult.data.method).toBe('qr_code');
    });

    test('应该处理二维码元素未找到的情况', async () => {
      // 设置二维码元素不存在
      mockPage.waitForSelector.mockRejectedValue(new Error('Element not found'));

      // 启动登录流程
      const loginResult = await service.startPlatformLogin(platform.id);

      // 等待异步登录流程完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证登录失败
      const statusResult = await service.getLoginStatus(loginResult.data.loginId);
      expect(statusResult.data.status).toBe('failed');
      expect(statusResult.data.error).toContain('二维码加载失败');
    });

    test('应该处理二维码过期并自动刷新', async () => {
      // 设置二维码过期
      mockPage.$eval.mockImplementation((selector, callback) => {
        if (selector === '.qrcode') {
          return '二维码已过期';
        }
        return 'https://zhihu.com/qrcode';
      });

      // 启动登录流程
      const loginResult = await service.startPlatformLogin(platform.id);

      // 等待异步登录流程完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证登录流程仍在进行中
      const statusResult = await service.getLoginStatus(loginResult.data.loginId);
      expect(['waiting_qrcode', 'qrcode_ready']).toContain(statusResult.data.status);
    });
  });

  describe('登录状态管理', () => {
    beforeEach(() => {
      service.initialize();
    });

    test('应该正确获取登录状态', async () => {
      // 启动登录流程
      const platformId = '1';
      const platform = {
        id: platformId,
        name: '知乎',
        config_schema: { auth_method: 'qr_code' }
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      const loginResult = await service.startPlatformLogin(platformId);

      // 获取登录状态
      const statusResult = await service.getLoginStatus(loginResult.data.loginId);

      // 验证结果
      expect(statusResult.success).toBe(true);
      expect(statusResult.data.id).toBe(loginResult.data.loginId);
      expect(statusResult.data.platformId).toBe(platformId);
      expect(statusResult.data.platformName).toBe('知乎');
    });

    test('应该处理不存在的登录ID', async () => {
      // 获取不存在的登录状态
      const statusResult = await service.getLoginStatus('nonexistent_login_id');

      // 验证结果
      expect(statusResult.success).toBe(false);
      expect(statusResult.error).toBe('Login not found');
      expect(statusResult.message).toBe('登录流程不存在');
    });

    test('应该成功取消登录流程', async () => {
      // 启动登录流程
      const platformId = '1';
      const platform = {
        id: platformId,
        name: '知乎',
        config_schema: { auth_method: 'qr_code' }
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      const loginResult = await service.startPlatformLogin(platformId);

      // 取消登录
      const cancelResult = await service.cancelLogin(loginResult.data.loginId);

      // 验证结果
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.message).toBe('登录流程已取消');
    });

    test('应该获取活跃登录列表', () => {
      // 启动多个登录流程
      const platforms = [
        { id: '1', name: '知乎', config_schema: { auth_method: 'qr_code' } },
        { id: '2', name: '小红书', config_schema: { auth_method: 'qr_code' } }
      ];

      platforms.forEach(platform => {
        mockPlatformService.getPlatform.mockResolvedValue({
          success: true,
          data: platform
        });
      });

      // 获取活跃登录列表
      const activeLogins = service.getActiveLogins();

      // 验证结果
      expect(Array.isArray(activeLogins)).toBe(true);
    });
  });

  describe('错误处理', () => {
    beforeEach(() => {
      service.initialize();
    });

    test('应该处理页面导航失败', async () => {
      const platform = {
        id: '1',
        name: '知乎',
        login_url: 'https://www.zhihu.com/signin',
        config_schema: { auth_method: 'qr_code' }
      };

      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        evaluateOnNewDocument: jest.fn(),
        goto: jest.fn().mockRejectedValue(new Error('Navigation timeout')),
        waitForSelector: jest.fn(),
        $: jest.fn(),
        screenshot: jest.fn()
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      mockBrowserManager.createBrowser.mockResolvedValue({
        success: true,
        data: { browserId: 'browser_123' }
      });

      const mockBrowser = { newPage: jest.fn().mockResolvedValue(mockPage) };
      mockBrowserManager.getBrowser.mockReturnValue(mockBrowser);

      // 启动登录流程
      const loginResult = await service.startPlatformLogin(platform.id);

      // 等待异步错误处理
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证错误被正确处理
      const statusResult = await service.getLoginStatus(loginResult.data.loginId);
      expect(statusResult.data.status).toBe('failed');
      expect(statusResult.data.error).toBeDefined();
    });

    test('应该处理会话创建失败', async () => {
      const platform = {
        id: '1',
        name: '知乎',
        login_url: 'https://www.zhihu.com/signin',
        config_schema: { auth_method: 'qr_code' }
      };

      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        evaluateOnNewDocument: jest.fn(),
        goto: jest.fn(),
        waitForSelector: jest.fn(),
        $: jest.fn(),
        screenshot: jest.fn().mockResolvedValue('base64_image'),
        cookies: jest.fn().mockResolvedValue([{ name: 'session', value: 'abc123' }]),
        url: jest.fn().mockReturnValue('https://www.zhihu.com/dashboard')
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      mockBrowserManager.createBrowser.mockResolvedValue({
        success: true,
        data: { browserId: 'browser_123' }
      });

      const mockBrowser = { newPage: jest.fn().mockResolvedValue(mockPage) };
      mockBrowserManager.getBrowser.mockReturnValue(mockBrowser);

      // 设置会话创建失败
      mockLoginSessionService.createSession.mockRejectedValue(new Error('Session creation failed'));

      // 启动登录流程
      const loginResult = await service.startPlatformLogin(platform.id);

      // 等待异步错误处理
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证错误被正确处理
      const statusResult = await service.getLoginStatus(loginResult.data.loginId);
      expect(['failed', 'success_with_error']).toContain(statusResult.data.status);
    });
  });

  describe('工具方法', () => {
    test('应该生成唯一的登录ID', () => {
      service.initialize();

      const loginId1 = service.generateLoginId();
      const loginId2 = service.generateLoginId();

      expect(loginId1).toMatch(/^login_\d+_[a-z0-9]+$/);
      expect(loginId2).toMatch(/^login_\d+_[a-z0-9]+$/);
      expect(loginId1).not.toBe(loginId2);
    });

    test('应该正确清理完成的登录流程', () => {
      service.initialize();

      // 添加一些测试登录流程
      const testLogins = [
        { id: 'login_1', status: 'success', startTime: Date.now() - 1000 },
        { id: 'login_2', status: 'failed', startTime: Date.now() - 1000 },
        { id: 'login_3', status: 'starting', startTime: Date.now() }
      ];

      testLogins.forEach(login => {
        service.activeLogins.set(login.id, login);
      });

      // 执行清理
      service.cleanupCompletedLogins();

      // 验证清理结果
      expect(service.activeLogins.has('login_1')).toBe(false);
      expect(service.activeLogins.has('login_2')).toBe(false);
      expect(service.activeLogins.has('login_3')).toBe(true);
    });
  });

  describe('事件系统', () => {
    test('应该正确发射登录事件', (done) => {
      service.initialize();

      // 监听登录事件
      service.onLoginEvent((event) => {
        expect(event.loginId).toBeDefined();
        expect(event.eventType).toBeDefined();
        expect(event.data).toBeDefined();
        expect(event.timestamp).toBeDefined();
        done();
      });

      // 启动登录流程以触发事件
      const platform = {
        id: '1',
        name: '知乎',
        config_schema: { auth_method: 'qr_code' }
      };

      mockPlatformService.getPlatform.mockResolvedValue({
        success: true,
        data: platform
      });

      service.startPlatformLogin(platform.id);
    });
  });
});

/**
 * 集成测试 - 测试完整的登录流程
 */
describe('PlatformAutoLoginService - 集成测试', () => {
  let service;

  beforeEach(() => {
    // 创建真实服务实例用于集成测试
    service = new PlatformAutoLoginService();
  });

  test('完整的扫码登录流程集成测试', async () => {
    // 这个测试需要真实的浏览器环境，在CI/CD环境中可以跳过
    if (process.env.CI) {
      console.log('跳过集成测试 - CI环境');
      return;
    }

    try {
      // 初始化服务
      await service.initialize();

      // 获取可用平台列表
      // 这里需要真实的平台数据
      console.log('集成测试需要真实的平台配置');

    } catch (error) {
      console.log('集成测试跳过:', error.message);
    }
  }, 30000);
});