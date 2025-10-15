/**
 * T012 登录会话管理服务测试
 * 测试登录会话的加密存储、过期检测、刷新机制和多会话管理功能
 */

const LoginSessionService = require('../../../src/main/services/LoginSessionService');
const { getDatabaseService } = require('../../../src/main/database/DatabaseService');

describe('T012 LoginSessionService', () => {
  let loginSessionService;
  let dbService;

  beforeAll(async () => {
    // 初始化数据库服务
    dbService = getDatabaseService();
    await dbService.initialize();

    // 初始化登录会话服务
    loginSessionService = new LoginSessionService();
    await loginSessionService.initialize();
  });

  afterAll(async () => {
    // 清理测试数据
    if (dbService) {
      const db = dbService.getDatabase();
      db.exec('DELETE FROM login_sessions WHERE session_name LIKE "TEST_%"');
    }
  });

  beforeEach(async () => {
    // 每个测试前清理测试数据
    const db = dbService.getDatabase();
    db.exec('DELETE FROM login_sessions WHERE session_name LIKE "TEST_%"');
  });

  describe('初始化测试', () => {
    test('应该成功初始化登录会话服务', () => {
      expect(loginSessionService).toBeDefined();
      expect(loginSessionService.encryptionKey).toBeDefined();
      expect(loginSessionService.encryptionKey).toMatch(/^[a-f0-9]{64}$/); // 32字节的hex字符串
    });
  });

  describe('加密和解密功能', () => {
    test('应该能够加密和解密会话数据', () => {
      const testData = {
        cookies: [
          { name: 'session_id', value: 'abc123', domain: '.example.com' },
          { name: 'token', value: 'xyz789', domain: '.example.com' }
        ],
        userAgent: 'Mozilla/5.0 Test Agent'
      };

      const encrypted = loginSessionService.encryptData(testData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = loginSessionService.decryptData(encrypted);
      expect(decrypted).toEqual(testData);
    });

    test('应该能够处理复杂的Cookie数据', () => {
      const complexData = {
        cookies: [
          {
            name: 'complex_cookie',
            value: JSON.stringify({ userId: 123, role: 'admin', permissions: ['read', 'write'] }),
            domain: '.example.com',
            path: '/',
            expires: Date.now() + 86400000,
            httpOnly: true,
            secure: true
          }
        ]
      };

      const encrypted = loginSessionService.encryptData(complexData);
      const decrypted = loginSessionService.decryptData(encrypted);
      expect(decrypted).toEqual(complexData);
    });
  });

  describe('会话创建功能', () => {
    test('应该能够创建新的登录会话', async () => {
      const platformId = 1; // 假设平台ID为1
      const sessionData = {
        sessionName: 'TEST_会话1',
        cookies: [
          { name: 'test_cookie', value: 'test_value', domain: '.zhihu.com' }
        ],
        userAgent: 'Test User Agent',
        loginMethod: 'qr_code'
      };

      const result = await loginSessionService.createSession(platformId, sessionData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.platform_id).toBe(platformId);
      expect(result.data.session_name).toBe('TEST_会话1');
      expect(result.data.cookies).toEqual(sessionData.cookies);
      expect(result.data.user_agent).toBe('Test User Agent');
      expect(result.data.login_method).toBe('qr_code');
      expect(result.data.is_active).toBe(1);
    });

    test('应该为不存在的平台返回错误', async () => {
      const invalidPlatformId = 99999;
      const sessionData = {
        sessionName: 'TEST_会话2',
        cookies: [{ name: 'test', value: 'test' }]
      };

      const result = await loginSessionService.createSession(invalidPlatformId, sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Platform not found');
      expect(result.message).toBe('平台不存在');
    });

    test('应该自动生成会话名称', async () => {
      const platformId = 1;
      const sessionData = {
        cookies: [{ name: 'test', value: 'test' }]
      };

      const result = await loginSessionService.createSession(platformId, sessionData);

      expect(result.success).toBe(true);
      expect(result.data.session_name).toMatch(/^会话_\d{4}\/\d{2}\/\d{2}/);
    });
  });

  describe('会话查询功能', () => {
    test('应该能够获取平台的活跃会话', async () => {
      const platformId = 1;

      // 创建测试会话
      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话3',
        cookies: [{ name: 'test1', value: 'value1' }]
      });

      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话4',
        cookies: [{ name: 'test2', value: 'value2' }]
      });

      const result = await loginSessionService.getActiveSessions(platformId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].session_name).toBe('TEST_会话4'); // 按last_used_at降序排列
      expect(result.data[1].session_name).toBe('TEST_会话3');
    });

    test('应该能够根据ID获取会话详情', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话5',
        cookies: [{ name: 'detail_test', value: 'detail_value' }]
      });

      const getResult = await loginSessionService.getSessionById(createResult.data.id);

      expect(getResult.success).toBe(true);
      expect(getResult.data.id).toBe(createResult.data.id);
      expect(getResult.data.session_name).toBe('TEST_会话5');
      expect(getResult.data.cookies).toEqual([{ name: 'detail_test', value: 'detail_value' }]);
    });

    test('应该返回缓存结果', async () => {
      const platformId = 1;

      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话6',
        cookies: [{ name: 'cache_test', value: 'cache_value' }]
      });

      // 第一次调用
      const result1 = await loginSessionService.getActiveSessions(platformId);
      expect(result1.cached).toBeUndefined();

      // 第二次调用应该使用缓存
      const result2 = await loginSessionService.getActiveSessions(platformId);
      expect(result2.cached).toBe(true);
    });
  });

  describe('会话更新功能', () => {
    test('应该能够更新会话使用时间', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话7',
        cookies: [{ name: 'update_test', value: 'update_value' }]
      });

      const originalLastUsed = createResult.data.last_used_at;

      // 等待1毫秒确保时间不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const result = await loginSessionService.updateSessionUsage(createResult.data.id);

      expect(result.success).toBe(true);

      // 验证时间已更新
      const getResult = await loginSessionService.getSessionById(createResult.data.id);
      expect(getResult.data.last_used_at).not.toBe(originalLastUsed);
    });

    test('应该能够刷新会话', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话8',
        cookies: [{ name: 'old_cookie', value: 'old_value' }]
      });

      const newCookies = [{ name: 'new_cookie', value: 'new_value' }];
      const result = await loginSessionService.refreshSession(createResult.data.id, newCookies);

      expect(result.success).toBe(true);
      expect(result.data.cookies).toEqual(newCookies);

      // 验证过期时间已更新
      const newExpiresAt = new Date(result.data.expires_at);
      const originalExpiresAt = new Date(createResult.data.expires_at);
      expect(newExpiresAt.getTime()).toBeGreaterThan(originalExpiresAt.getTime());
    });
  });

  describe('会话过期检测功能', () => {
    test('应该能够检测会话过期状态', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话9',
        cookies: [{ name: 'expiry_test', value: 'expiry_value' }]
      });

      const result = await loginSessionService.checkSessionExpiry(createResult.data.id);

      expect(result.success).toBe(true);
      expect(result.data.isExpired).toBe(false); // 新创建的会话不应该过期
      expect(result.data.isExpiringSoon).toBe(false);
    });

    test('应该标记过期会话为非活跃状态', async () => {
      const platformId = 1;

      // 创建一个已经过期的会话（通过直接修改数据库）
      const sessionData = {
        sessionName: 'TEST_会话10',
        cookies: [{ name: 'expired_test', value: 'expired_value' }]
      };

      const createResult = await loginSessionService.createSession(platformId, sessionData);

      // 直接修改数据库，设置过期时间为过去
      const db = dbService.getDatabase();
      const stmt = db.prepare(`
        UPDATE login_sessions
        SET expires_at = ?
        WHERE id = ?
      `);
      stmt.run([new Date(Date.now() - 86400000).toISOString(), createResult.data.id]);

      const result = await loginSessionService.checkSessionExpiry(createResult.data.id);

      expect(result.success).toBe(true);
      expect(result.data.isExpired).toBe(true);

      // 验证会话已被标记为非活跃
      const getResult = await loginSessionService.getSessionById(createResult.data.id);
      expect(getResult.data.is_active).toBe(0);
    });
  });

  describe('会话管理功能', () => {
    test('应该能够停用会话', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话11',
        cookies: [{ name: 'deactivate_test', value: 'deactivate_value' }]
      });

      const result = await loginSessionService.deactivateSession(createResult.data.id);

      expect(result.success).toBe(true);

      // 验证会话已被停用
      const getResult = await loginSessionService.getSessionById(createResult.data.id);
      expect(getResult.data.is_active).toBe(0);
    });

    test('应该能够删除会话', async () => {
      const platformId = 1;

      const createResult = await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话12',
        cookies: [{ name: 'delete_test', value: 'delete_value' }]
      });

      const result = await loginSessionService.deleteSession(createResult.data.id);

      expect(result.success).toBe(true);

      // 验证会话已被删除
      const getResult = await loginSessionService.getSessionById(createResult.data.id);
      expect(getResult.success).toBe(false);
      expect(getResult.error).toBe('Session not found');
    });

    test('应该能够清理过期会话', async () => {
      const platformId = 1;

      // 创建多个会话
      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话13',
        cookies: [{ name: 'cleanup_test1', value: 'cleanup_value1' }]
      });

      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话14',
        cookies: [{ name: 'cleanup_test2', value: 'cleanup_value2' }]
      });

      // 手动设置一个会话为过期状态
      const db = dbService.getDatabase();
      const stmt = db.prepare(`
        UPDATE login_sessions
        SET expires_at = ?, is_active = 1
        WHERE session_name = ?
      `);
      stmt.run([new Date(Date.now() - 86400000).toISOString(), 'TEST_会话13']);

      const result = await loginSessionService.cleanupExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.data.cleanedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('统计信息功能', () => {
    test('应该能够获取会话统计信息', async () => {
      const platformId = 1;

      // 创建多个会话
      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话15',
        cookies: [{ name: 'stats_test1', value: 'stats_value1' }]
      });

      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话16',
        cookies: [{ name: 'stats_test2', value: 'stats_value2' }]
      });

      const result = await loginSessionService.getSessionStats(platformId);

      expect(result.success).toBe(true);
      expect(result.data.total_sessions).toBeGreaterThanOrEqual(2);
      expect(result.data.active_sessions).toBeGreaterThanOrEqual(2);
    });
  });

  describe('最佳会话选择功能', () => {
    test('应该能够获取最佳可用会话', async () => {
      const platformId = 1;

      // 创建多个会话
      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话17',
        cookies: [{ name: 'best_test1', value: 'best_value1' }]
      });

      await loginSessionService.createSession(platformId, {
        sessionName: 'TEST_会话18',
        cookies: [{ name: 'best_test2', value: 'best_value2' }]
      });

      const result = await loginSessionService.getBestSession(platformId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.cookies).toBeDefined();

      // 应该返回最近使用的会话
      expect(['TEST_会话17', 'TEST_会话18']).toContain(result.data.session_name);
    });

    test('应该在没有会话时返回错误', async () => {
      const platformId = 99999; // 不存在的平台

      const result = await loginSessionService.getBestSession(platformId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active sessions');
    });
  });

  describe('多会话支持', () => {
    test('应该支持同一平台的多个会话', async () => {
      const platformId = 1;

      // 创建多个会话
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const result = await loginSessionService.createSession(platformId, {
          sessionName: `TEST_多会话${i + 1}`,
          cookies: [{ name: `multi_cookie_${i}`, value: `multi_value_${i}` }]
        });
        sessions.push(result.data);
      }

      // 获取所有活跃会话
      const activeResult = await loginSessionService.getActiveSessions(platformId);

      expect(activeResult.success).toBe(true);
      expect(activeResult.data.length).toBeGreaterThanOrEqual(3);

      // 验证所有会话都是独立的
      const sessionNames = activeResult.data.map(s => s.session_name);
      expect(sessionNames).toContain('TEST_多会话1');
      expect(sessionNames).toContain('TEST_多会话2');
      expect(sessionNames).toContain('TEST_多会话3');
    });
  });

  describe('错误处理', () => {
    test('应该正确处理无效的会话ID', async () => {
      const result = await loginSessionService.getSessionById(99999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    test('应该正确处理无效的平台ID', async () => {
      const result = await loginSessionService.getActiveSessions(99999);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test('应该正确处理加密解密错误', () => {
      const invalidEncryptedData = 'invalid_encrypted_data';

      expect(() => {
        loginSessionService.decryptData(invalidEncryptedData);
      }).toThrow();
    });
  });
});