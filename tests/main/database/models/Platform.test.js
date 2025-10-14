/**
 * Platform.js 平台数据模型测试
 */

const Platform = require('../../../../src/main/database/models/Platform');
const Database = require('../../../../src/main/database/Database');
const path = require('path');
const fs = require('fs');

// 测试数据库路径
const TEST_DB_PATH = path.join(__dirname, '../../../../test-platform-data.db');

// 测试工具函数
const createTestPlatform = (overrides = {}) => ({
  name: '测试平台',
  platform_code: 'test_platform',
  base_url: 'https://test.com',
  login_type: 'qrcode',
  is_active: true,
  config: {},
  ...overrides
});

describe('Platform 平台数据模型', () => {
  let database;
  let platformModel;

  beforeAll(async () => {
    // 清理测试数据库
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    database = new Database(TEST_DB_PATH);
    await database.initialize();

    // 创建平台表
    await database.run(`
      CREATE TABLE IF NOT EXISTS platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        platform_code TEXT NOT NULL UNIQUE,
        base_url TEXT NOT NULL,
        login_type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    platformModel = new Platform(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
      // 清理测试数据库文件
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await database.run('DELETE FROM platforms');
  });

  describe('创建平台', () => {
    test('应该成功创建平台', async () => {
      const platformData = createTestPlatform();
      const platform = await platformModel.create(platformData);

      expect(platform.id).toBeDefined();
      expect(platform.name).toBe(platformData.name);
      expect(platform.platform_code).toBe(platformData.platform_code);
      expect(platform.base_url).toBe(platformData.base_url);
      expect(platform.login_type).toBe(platformData.login_type);
      expect(platform.is_active).toBe(true);
      expect(platform.created_at).toBeDefined();
      expect(platform.updated_at).toBeDefined();
    });

    test('应该验证必需字段', async () => {
      const invalidPlatform = {
        name: '测试平台'
        // 缺少其他必需字段
      };

      await expect(platformModel.create(invalidPlatform)).rejects.toThrow();
    });

    test('应该处理平台配置', async () => {
      const config = {
        apiVersion: 'v1',
        timeout: 30000,
        retryCount: 3
      };

      const platformData = createTestPlatform({
        config: config
      });

      const platform = await platformModel.create(platformData);

      expect(JSON.parse(platform.config)).toEqual(config);
    });

    test('应该确保平台名称唯一性', async () => {
      const platformData = createTestPlatform();
      await platformModel.create(platformData);

      const duplicatePlatform = createTestPlatform({
        platform_code: 'different_code',
        name: platformData.name // 相同名称
      });

      await expect(platformModel.create(duplicatePlatform)).rejects.toThrow();
    });

    test('应该确保平台代码唯一性', async () => {
      const platformData = createTestPlatform();
      await platformModel.create(platformData);

      const duplicatePlatform = createTestPlatform({
        name: '不同名称',
        platform_code: platformData.platform_code // 相同代码
      });

      await expect(platformModel.create(duplicatePlatform)).rejects.toThrow();
    });
  });

  describe('查询平台', () => {
    beforeEach(async () => {
      // 创建测试平台
      await platformModel.create(createTestPlatform({
        name: '知乎',
        platform_code: 'zhihu',
        is_active: true
      }));
      await platformModel.create(createTestPlatform({
        name: '微信公众号',
        platform_code: 'wechat',
        is_active: false
      }));
      await platformModel.create(createTestPlatform({
        name: '简书',
        platform_code: 'jianshu',
        is_active: true
      }));
    });

    test('应该根据ID查找平台', async () => {
      const platforms = await platformModel.findAll();
      const firstPlatform = platforms[0];

      const foundPlatform = await platformModel.findById(firstPlatform.id);

      expect(foundPlatform).toBeDefined();
      expect(foundPlatform.id).toBe(firstPlatform.id);
      expect(foundPlatform.name).toBe(firstPlatform.name);
    });

    test('应该查找所有平台', async () => {
      const platforms = await platformModel.findAll();

      expect(platforms).toHaveLength(3);
      expect(platforms[0].name).toBeDefined();
      expect(platforms[0].platform_code).toBeDefined();
    });

    test('应该只查找活跃平台', async () => {
      const activePlatforms = await platformModel.findAll({ activeOnly: true });

      expect(activePlatforms).toHaveLength(2);
      activePlatforms.forEach(platform => {
        expect(platform.is_active).toBe(true);
      });
    });

    test('应该根据平台代码查找', async () => {
      const zhihuPlatform = await platformModel.findByCode('zhihu');

      expect(zhihuPlatform).toBeDefined();
      expect(zhihuPlatform.name).toBe('知乎');
      expect(zhihuPlatform.platform_code).toBe('zhihu');
    });

    test('应该处理不存在的平台代码', async () => {
      const foundPlatform = await platformModel.findByCode('nonexistent');
      expect(foundPlatform).toBeNull();
    });
  });

  describe('更新平台', () => {
    let testPlatform;

    beforeEach(async () => {
      testPlatform = await platformModel.create(createTestPlatform());
    });

    test('应该成功更新平台', async () => {
      const updateData = {
        name: '更新后的平台名称',
        base_url: 'https://updated.com',
        is_active: false
      };

      const updatedPlatform = await platformModel.update(testPlatform.id, updateData);

      expect(updatedPlatform.name).toBe(updateData.name);
      expect(updatedPlatform.base_url).toBe(updateData.base_url);
      expect(updatedPlatform.is_active).toBe(updateData.is_active);
      expect(updatedPlatform.updated_at).not.toBe(testPlatform.updated_at);
    });

    test('应该更新平台配置', async () => {
      const newConfig = {
        apiVersion: 'v2',
        timeout: 60000,
        newFeature: true
      };

      const updatedPlatform = await platformModel.update(testPlatform.id, {
        config: newConfig
      });

      expect(JSON.parse(updatedPlatform.config)).toEqual(newConfig);
    });

    test('应该处理部分更新', async () => {
      const updateData = { is_active: false };

      const updatedPlatform = await platformModel.update(testPlatform.id, updateData);

      expect(updatedPlatform.is_active).toBe(false);
      expect(updatedPlatform.name).toBe(testPlatform.name); // 其他字段保持不变
    });

    test('应该处理不存在的平台ID', async () => {
      await expect(
        platformModel.update(99999, { name: '更新名称' })
      ).rejects.toThrow();
    });
  });

  describe('删除平台', () => {
    let testPlatform;

    beforeEach(async () => {
      testPlatform = await platformModel.create(createTestPlatform());
    });

    test('应该成功删除平台', async () => {
      await platformModel.delete(testPlatform.id);

      const foundPlatform = await platformModel.findById(testPlatform.id);
      expect(foundPlatform).toBeNull();
    });

    test('应该处理不存在的平台ID', async () => {
      await expect(platformModel.delete(99999)).rejects.toThrow();
    });
  });

  describe('平台可用性检查', () => {
    let activePlatform, inactivePlatform;

    beforeEach(async () => {
      activePlatform = await platformModel.create(createTestPlatform({
        name: '活跃平台',
        platform_code: 'active',
        is_active: true
      }));

      inactivePlatform = await platformModel.create(createTestPlatform({
        name: '非活跃平台',
        platform_code: 'inactive',
        is_active: false
      }));
    });

    test('应该获取可用平台列表', async () => {
      const availablePlatforms = await platformModel.getAvailable();

      expect(availablePlatforms).toHaveLength(1);
      expect(availablePlatforms[0].id).toBe(activePlatform.id);
      expect(availablePlatforms[0].name).toBe('活跃平台');
    });

    test('应该检查平台是否可用', async () => {
      const isActive = await platformModel.isAvailable(activePlatform.id);
      const isInactive = await platformModel.isAvailable(inactivePlatform.id);

      expect(isActive).toBe(true);
      expect(isInactive).toBe(false);
    });

    test('应该处理不存在的平台ID', async () => {
      const isAvailable = await platformModel.isAvailable(99999);
      expect(isAvailable).toBe(false);
    });
  });

  describe('平台配置验证', () => {
    let testPlatform;

    beforeEach(async () => {
      testPlatform = await platformModel.create(createTestPlatform({
        config: {
          apiUrl: 'https://api.example.com',
          apiKey: 'test-key',
          timeout: 30000
        }
      }));
    });

    test('应该验证有效配置', async () => {
      const validation = await platformModel.validateConfig(testPlatform.id);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('应该检测无效配置', async () => {
      // 更新为无效配置
      await platformModel.update(testPlatform.id, {
        config: {
          apiUrl: 'invalid-url',
          timeout: -1 // 负数超时
        }
      });

      const validation = await platformModel.validateConfig(testPlatform.id);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('应该处理必需配置项', async () => {
      const platformWithRequiredConfig = await platformModel.create(createTestPlatform({
        platform_code: 'config_required',
        config: {
          apiUrl: 'https://api.example.com'
          // 缺少必需的apiKey
        }
      }));

      const validation = await platformModel.validateConfig(platformWithRequiredConfig.id, {
        required: ['apiUrl', 'apiKey']
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required config: apiKey');
    });
  });

  describe('批量操作', () => {
    beforeEach(async () => {
      await platformModel.create(createTestPlatform({
        name: '平台1',
        platform_code: 'platform1',
        is_active: true
      }));
      await platformModel.create(createTestPlatform({
        name: '平台2',
        platform_code: 'platform2',
        is_active: false
      }));
      await platformModel.create(createTestPlatform({
        name: '平台3',
        platform_code: 'platform3',
        is_active: true
      }));
    });

    test('应该批量更新平台状态', async () => {
      const platforms = await platformModel.findAll();
      const platformIds = platforms.map(p => p.id);

      await platformModel.batchUpdateStatus(platformIds, false);

      const updatedPlatforms = await platformModel.findAll();
      updatedPlatforms.forEach(platform => {
        expect(platform.is_active).toBe(false);
      });
    });

    test('应该处理批量操作中的错误', async () => {
      const invalidIds = [1, 99999, 3]; // 包含无效ID

      const results = await platformModel.batchUpdateStatus(invalidIds, true);

      expect(results.success).toBeGreaterThan(0);
      expect(results.failed).toBeGreaterThan(0);
      expect(results.errors).toBeDefined();
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await platformModel.create(createTestPlatform({
        name: '平台1',
        platform_code: 'platform1',
        login_type: 'qrcode'
      }));
      await platformModel.create(createTestPlatform({
        name: '平台2',
        platform_code: 'platform2',
        login_type: 'password'
      }));
      await platformModel.create(createTestPlatform({
        name: '平台3',
        platform_code: 'platform3',
        is_active: false
      }));
    });

    test('应该返回正确的统计信息', async () => {
      const stats = await platformModel.getStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
      expect(stats.loginTypes.qrcode).toBe(2);
      expect(stats.loginTypes.password).toBe(1);
    });

    test('应该按登录类型统计', async () => {
      const qrcodeStats = await platformModel.getStatsByLoginType('qrcode');
      const passwordStats = await platformModel.getStatsByLoginType('password');

      expect(qrcodeStats.count).toBe(2);
      expect(passwordStats.count).toBe(1);
    });
  });
});