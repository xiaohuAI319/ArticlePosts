/**
 * Jest测试环境设置
 */

const fs = require('fs');
const path = require('path');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, '../test-data.db');

// 在所有测试开始前清理测试环境
beforeAll(async () => {
  // 确保测试目录存在
  const testDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 清理之前的测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// 在每个测试文件结束后清理
afterEach(async () => {
  // 清理可能的测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// 全局测试工具
global.testUtils = {
  getTestDbPath: () => TEST_DB_PATH,

  // 创建测试数据
  createTestArticle: (overrides = {}) => ({
    title: '测试文章',
    content: '{"ops":[{"insert":"这是测试内容\n"}]}',
    html_content: '<p>这是测试内容</p>',
    tags: ['测试'],
    category: '技术',
    status: 0,
    ...overrides
  }),

  createTestPlatform: (overrides = {}) => ({
    name: '测试平台',
    platform_code: 'test_platform',
    base_url: 'https://test.com',
    login_type: 'qrcode',
    is_active: true,
    config: {},
    ...overrides
  }),

  // 等待异步操作
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// 控制台输出过滤
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.VERBOSE_TESTS) {
    originalConsoleLog(...args);
  }
};