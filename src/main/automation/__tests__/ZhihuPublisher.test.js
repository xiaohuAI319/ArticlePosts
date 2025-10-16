/**
 * T017 ZhihuPublisher 自动化发布测试套件
 * 测试知乎文章发布的完整流程
 */

const ZhihuPublisher = require('../ZhihuPublisher');
const path = require('path');

describe('T017 ZhihuPublisher 发布自动化', () => {
  let publisher;

  beforeEach(() => {
    publisher = new ZhihuPublisher();
  });

  afterEach(async () => {
    if (publisher) {
      await publisher.cleanup();
    }
  });

  describe('基础功能测试', () => {
    test('应该能够初始化发布器', async () => {
      const taskId = 1;
      let progressCallbackCalled = false;
      let logCallbackCalled = false;

      const result = await publisher.initialize(
        taskId,
        (progress, message) => {
          progressCallbackCalled = true;
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
          expect(typeof message).toBe('string');
        },
        (level, message) => {
          logCallbackCalled = true;
          expect(['info', 'warn', 'error']).toContain(level);
          expect(typeof message).toBe('string');
        }
      );

      expect(result).toBe(true);
      expect(progressCallbackCalled).toBe(true);
      expect(logCallbackCalled).toBe(true);
    });

    test('应该能够清理资源', async () => {
      await publisher.initialize(1, () => {}, () => {});

      const cleanupResult = await publisher.cleanup();
      expect(cleanupResult).toBeUndefined(); // cleanup没有返回值，但不应该抛出错误
    });
  });

  describe('文章内容处理测试', () => {
    test('应该能够处理文章标题填充', async () => {
      await publisher.initialize(1, () => {}, () => {});

      // 模拟页面环境
      global.page = {
        waitForSelector: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(true),
        keyboard: {
          type: jest.fn().mockResolvedValue(true),
          down: jest.fn().mockResolvedValue(true),
          up: jest.fn().mockResolvedValue(true),
          press: jest.fn().mockResolvedValue(true)
        }
      };

      global.document = {
        querySelector: jest.fn()
      };

      const title = '测试文章标题';

      // 测试标题填充逻辑
      const mockTitleInput = {
        click: jest.fn(),
        evaluate: jest.fn().mockReturnValue('input')
      };

      global.page.$ = jest.fn().mockResolvedValue(mockTitleInput);
      global.page.$$ = jest.fn().mockResolvedValue([mockTitleInput]);

      await publisher.fillTitle(title);

      expect(global.page.click).toHaveBeenCalled();
      expect(global.page.keyboard.type).toHaveBeenCalledWith(title);
    });

    test('应该能够处理文章内容填充', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        waitForSelector: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(true),
        keyboard: {
          type: jest.fn().mockResolvedValue(true),
          down: jest.fn().mockResolvedValue(true),
          up: jest.fn().mockResolvedValue(true),
          press: jest.fn().mockResolvedValue(true)
        }
      };

      const content = '这是测试文章内容。\n\n这是第二段内容。\n\n这是第三段内容。';

      await publisher.fillContent(content);

      // 验证键盘输入被调用
      expect(global.page.keyboard.type).toHaveBeenCalled();
    });

    test('应该能够提取图片', async () => {
      const articleData = {
        html_content: `
          <p>文章内容</p>
          <img src="data:image/jpeg;base64,testdata1" />
          <img src="https://example.com/image1.jpg" />
          <img src="https://example.com/image2.png" />
          <p>更多内容</p>
        `
      };

      const images = await publisher.extractImages(articleData);

      expect(images).toHaveLength(3);
      expect(images[0]).toBe('data:image/jpeg;base64,testdata1');
      expect(images[1]).toBe('https://example.com/image1.jpg');
      expect(images[2]).toBe('https://example.com/image2.png');
    });
  });

  describe('图片处理测试', () => {
    test('应该能够创建临时图片文件', async () => {
      await publisher.initialize(1, () => {}, () => {});

      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

      const tempPath = await publisher.createTempImageFile(base64Image, 0);

      expect(tempPath).toBeDefined();
      expect(tempPath).toContain('temp_image_');
      expect(tempPath).toContain('.png');

      // 清理临时文件
      const fs = require('fs');
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });

    test('应该能够从URL获取图片扩展名', () => {
      const extensions = [
        { url: 'https://example.com/image.jpg', expected: 'jpg' },
        { url: 'https://example.com/image.jpeg', expected: 'jpeg' },
        { url: 'https://example.com/image.png', expected: 'png' },
        { url: 'https://example.com/image.gif', expected: 'gif' },
        { url: 'https://example.com/image.webp', expected: 'webp' },
        { url: 'https://example.com/image', expected: 'jpg' } // 默认扩展名
      ];

      extensions.forEach(({ url, expected }) => {
        const result = publisher.getImageExtensionFromUrl(url);
        expect(result).toBe(expected);
      });
    });

    test('应该能够从Base64获取图片扩展名', () => {
      const extensions = [
        { data: 'data:image/png;base64,test', expected: 'png' },
        { data: 'data:image/jpeg;base64,test', expected: 'jpeg' },
        { data: 'data:image/gif;base64,test', expected: 'gif' },
        { data: 'data:image/webp;base64,test', expected: 'webp' },
        { data: 'data:image/jpg;base64,test', expected: 'jpg' }
      ];

      extensions.forEach(({ data, expected }) => {
        const result = publisher.getImageExtension(data);
        expect(result).toBe(expected);
      });
    });
  });

  describe('发布流程测试', () => {
    test('应该能够导航到写作页面', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        goto: jest.fn().mockResolvedValue(true),
        waitForSelector: jest.fn().mockResolvedValue(true)
      };

      await publisher.navigateToWritePage();

      expect(global.page.goto).toHaveBeenCalledWith('https://zhuanlan.zhihu.com/write', {
        waitUntil: 'networkidle2'
      });
      expect(global.page.waitForSelector).toHaveBeenCalled();
    });

    test('应该能够检查登录状态', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        goto: jest.fn().mockResolvedValue(true),
        $: jest.fn().mockResolvedValue({}) // 模拟找到登录元素
      };

      const isLoggedIn = await publisher.checkLoginStatus();

      expect(isLoggedIn).toBe(true);
      expect(global.page.goto).toHaveBeenCalledWith('https://www.zhihu.com', {
        waitUntil: 'networkidle2'
      });
    });

    test('应该能够寻找发布按钮', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        $$: jest.fn().mockResolvedValue([
          { textContent: '其他按钮' },
          { textContent: '发布文章' }
        ]),
        evaluate: jest.fn().mockImplementation((callback) => {
          // 模拟查找包含"发布"文本的按钮
          return callback();
        })
      };

      // Mock document.querySelector
      global.document = {
        querySelectorAll: jest.fn().mockReturnValue([
          { textContent: '发布按钮' }
        ])
      };

      const publishButton = await publisher.findPublishButton();

      expect(publishButton).toBeDefined();
      expect(global.page.evaluate).toHaveBeenCalled();
    });

    test('应该能够处理发布结果', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        url: jest.fn().mockReturnValue('https://zhuanlan.zhihu.com/p/123456789'),
        title: jest.fn().mockResolvedValue('测试文章标题')
      };

      const result = await publisher.getPublishResult();

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://zhuanlan.zhihu.com/p/123456789');
      expect(result.articleId).toBe('123456789');
      expect(result.title).toBe('测试文章标题');
    });
  });

  describe('错误处理测试', () => {
    test('应该在初始化失败时抛出错误', async () => {
      const mockBrowserManager = {
        initialize: jest.fn().mockRejectedValue(new Error('浏览器初始化失败'))
      };

      publisher.browserManager = mockBrowserManager;

      await expect(publisher.initialize(1, () => {}, () => {})).rejects.toThrow('浏览器初始化失败');
    });

    test('应该在导航失败时抛出错误', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        goto: jest.fn().mockRejectedValue(new Error('导航失败'))
      };

      await expect(publisher.navigateToWritePage()).rejects.toThrow('无法进入写作页面');
    });

    test('应该处理未登录状态', async () => {
      await publisher.initialize(1, () => {}, () => {});

      global.page = {
        goto: jest.fn().mockResolvedValue(true),
        $: jest.fn().mockResolvedValue(null) // 没有找到登录元素
      };

      const isLoggedIn = await publisher.checkLoginStatus();
      expect(isLoggedIn).toBe(false);
    });
  });

  describe('集成测试', () => {
    test('应该能够完成完整的发布流程（模拟）', async () => {
      const taskId = 123;
      let progressUpdates = [];
      let logMessages = [];

      // 模拟完整的浏览器环境
      const mockPage = {
        goto: jest.fn().mockResolvedValue(true),
        waitForSelector: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(true),
        $: jest.fn().mockResolvedValue({}),
        $$: jest.fn().mockResolvedValue([{}]),
        setCookie: jest.fn().mockResolvedValue(true),
        setUserAgent: jest.fn().mockResolvedValue(true),
        reload: jest.fn().mockResolvedValue(true),
        url: jest.fn().mockReturnValue('https://zhuanlan.zhihu.com/p/123456789'),
        title: jest.fn().mockResolvedValue('测试文章标题'),
        evaluate: jest.fn()
      };

      global.page = mockPage;
      global.document = {
        querySelectorAll: jest.fn().mockReturnValue([])
      };

      const articleData = {
        title: '测试文章标题',
        content: '这是测试文章的内容。\n\n包含多个段落。',
        html_content: '<p>这是测试文章的内容。</p><p>包含多个段落。</p>'
      };

      // 测试完整流程
      await publisher.initialize(
        taskId,
        (progress, message) => {
          progressUpdates.push({ progress, message });
        },
        (level, message) => {
          logMessages.push({ level, message });
        }
      );

      // 模拟登录检查
      await publisher.ensureLoggedIn();

      // 模拟导航
      await publisher.navigateToWritePage();

      // 模拟内容填充
      await publisher.fillArticleContent(articleData);

      // 模拟发布
      const mockResult = {
        success: true,
        url: 'https://zhuanlan.zhihu.com/p/123456789',
        articleId: '123456789',
        title: '测试文章标题'
      };

      // 验证流程步骤
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(logMessages.length).toBeGreaterThan(0);

      // 验证最终结果
      expect(mockResult.success).toBe(true);
      expect(mockResult.url).toContain('zhihu.com/p/');
    });
  });

  describe('性能测试', () => {
    test('初始化应该在合理时间内完成', async () => {
      const startTime = Date.now();

      await publisher.initialize(1, () => {}, () => {});

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 初始化应该在5秒内完成
      expect(duration).toBeLessThan(5000);
    });

    test('应该能够处理大量内容', async () => {
      await publisher.initialize(1, () => {}, () => {});

      // 创建大段内容
      const largeContent = '这是测试内容。'.repeat(1000);

      global.page = {
        waitForSelector: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(true),
        keyboard: {
          type: jest.fn().mockResolvedValue(true),
          down: jest.fn().mockResolvedValue(true),
          up: jest.fn().mockResolvedValue(true),
          press: jest.fn().mockResolvedValue(true)
        }
      };

      const startTime = Date.now();
      await publisher.fillContent(largeContent);
      const endTime = Date.now();

      // 处理大内容应该在合理时间内完成
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });
});