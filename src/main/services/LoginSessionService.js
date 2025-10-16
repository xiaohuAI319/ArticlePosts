/**
 * 登录会话管理服务 - T012
 * 负责平台登录会话的加密存储、过期检测、刷新机制和多会话管理
 */

const { getDatabaseService } = require('../database/DatabaseService');
const crypto = require('crypto');

class LoginSessionService {
  constructor() {
    this.dbService = null;
    this.encryptionKey = null;
    this.sessionCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10分钟缓存
  }

  /**
   * 初始化登录会话服务
   */
  async initialize() {
    try {
      this.dbService = getDatabaseService();
      this.encryptionKey = await this.getOrCreateEncryptionKey();

      return {
        success: true,
        message: '登录会话服务初始化成功'
      };
    } catch (error) {
      console.error('登录会话服务初始化失败:', error);
      return {
        success: false,
        error: error.message,
        message: '登录会话服务初始化失败'
      };
    }
  }

  /**
   * 获取或创建加密密钥
   */
  async getOrCreateEncryptionKey() {
    try {
      const db = this.dbService.db;

      // 尝试从系统配置中获取密钥
      const stmt = db.prepare(`
        SELECT config_value FROM system_configs
        WHERE config_key = 'session_encryption_key'
      `);

      const result = stmt.get();

      if (result) {
        return result.config_value;
      }

      // 生成新的加密密钥
      const key = crypto.randomBytes(32).toString('hex');

      // 存储密钥到系统配置
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO system_configs
        (config_key, config_value, config_type, description, is_encrypted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      insertStmt.run(['session_encryption_key', key, 'string', '会话加密密钥', 1]);

      return key;
    } catch (error) {
      console.error('获取或创建加密密钥失败:', error);
      throw error;
    }
  }

  /**
   * 加密会话数据 - 使用AES-256-CBC
   */
  encryptData(data) {
    try {
      const dataStr = JSON.stringify(data);

      // 创建初始化向量 (IV)
      const iv = crypto.randomBytes(16);

      // 创建密钥 (确保32字节用于AES-256)
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

      // 创建加密器
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(dataStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 将IV和加密数据组合
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('加密会话数据失败:', error);
      throw error;
    }
  }

  /**
   * 解密会话数据
   */
  decryptData(encryptedData) {
    try {
      // 分离IV和加密数据
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        // 兼容旧格式（没有IV的数据）- 使用旧的createDecipher方法
        console.log('检测到旧格式会话数据，使用兼容模式解密');
        try {
          const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
          let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return JSON.parse(decrypted);
        } catch (oldError) {
          console.error('旧格式解密失败，尝试新格式兼容:', oldError.message);
          // 如果旧方法失败，再尝试新的固定IV方法
          const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
          let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return JSON.parse(decrypted);
        }
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // 创建密钥
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

      // 创建解密器
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('解密会话数据失败:', error);
      // 不要抛出错误，返回null让调用方处理
      return null;
    }
  }

  /**
   * 创建新的登录会话
   */
  async createSession(platformId, sessionData) {
    try {
      const db = this.dbService.db;

      // 验证平台是否存在
      const platformStmt = db.prepare('SELECT id FROM platforms WHERE id = ?');
      const platform = platformStmt.get(platformId);

      if (!platform) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      // 准备会话数据
      const sessionName = sessionData.sessionName || `会话_${new Date().toLocaleString()}`;
      const expiresAt = sessionData.expiresAt ? new Date(sessionData.expiresAt) : this.calculateDefaultExpiry();

      // 加密Cookie数据
      const encryptedCookies = this.encryptData(sessionData.cookies);

      // 插入会话记录
      const stmt = db.prepare(`
        INSERT INTO login_sessions (
          platform_id, session_name, cookies, user_agent, login_method,
          expires_at, is_active, last_used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run([
        platformId,
        sessionName,
        encryptedCookies,
        sessionData.userAgent || '',
        sessionData.loginMethod || 'qr_code',
        expiresAt.toISOString(),
        1, // is_active
        new Date().toISOString()
      ]);

      // 清除缓存
      this.clearCache(platformId);

      // 获取创建的会话
      const session = await this.getSessionById(result.lastInsertRowid);

      return {
        success: true,
        data: session,
        message: '登录会话创建成功'
      };
    } catch (error) {
      console.error('创建登录会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '创建登录会话失败'
      };
    }
  }

  /**
   * 获取平台的所有活跃会话
   */
  async getActiveSessions(platformId) {
    try {
      // 检查缓存
      const cacheKey = `sessions_${platformId}`;
      const cached = this.sessionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          message: '获取会话列表（缓存）'
        };
      }

      const db = this.dbService.db;
      const stmt = db.prepare(`
        SELECT * FROM login_sessions
        WHERE platform_id = ? AND is_active = 1
        ORDER BY last_used_at DESC
      `);

      const sessions = stmt.all(platformId);

      // 解密Cookie数据
      const decryptedSessions = sessions.map(session => {
        const cookies = this.decryptData(session.cookies);

        if (cookies === null) {
          console.error(`解密会话 ${session.id} 失败，会话数据可能已损坏`);
          return {
            ...session,
            cookies: null,
            decryptError: true
          };
        }

        return {
          ...session,
          cookies
        };
      });

      // 更新缓存
      this.sessionCache.set(cacheKey, {
        data: decryptedSessions,
        timestamp: Date.now()
      });

      return {
        success: true,
        data: decryptedSessions,
        message: '获取会话列表成功'
      };
    } catch (error) {
      console.error('获取会话列表失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取会话列表失败'
      };
    }
  }

  /**
   * 根据ID获取会话
   */
  async getSessionById(sessionId) {
    try {
      const db = this.dbService.db;
      const stmt = db.prepare('SELECT * FROM login_sessions WHERE id = ?');
      const session = stmt.get(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在'
        };
      }

      // 解密Cookie数据
      const cookies = this.decryptData(session.cookies);

      if (cookies === null) {
        return {
          success: false,
          error: 'DecryptError',
          message: '会话数据解密失败'
        };
      }

      return {
        success: true,
        data: {
          ...session,
          cookies
        },
        message: '获取会话成功'
      };
    } catch (error) {
      console.error('获取会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取会话失败'
      };
    }
  }

  /**
   * 更新会话使用时间和状态
   */
  async updateSessionUsage(sessionId) {
    try {
      const db = this.dbService.db;
      const stmt = db.prepare(`
        UPDATE login_sessions
        SET last_used_at = ?, is_active = 1
        WHERE id = ?
      `);

      const result = stmt.run([new Date().toISOString(), sessionId]);

      if (result.changes === 0) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在'
        };
      }

      // 清除相关缓存
      this.clearSessionCache(sessionId);

      return {
        success: true,
        message: '会话使用时间更新成功'
      };
    } catch (error) {
      console.error('更新会话使用时间失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新会话使用时间失败'
      };
    }
  }

  /**
   * 检查会话是否过期
   */
  async checkSessionExpiry(sessionId) {
    try {
      const sessionResult = await this.getSessionById(sessionId);
      if (!sessionResult.success) {
        return sessionResult;
      }

      const session = sessionResult.data;
      const now = new Date();
      const expiresAt = new Date(session.expires_at);

      const isExpired = now > expiresAt;
      const isExpiringSoon = (expiresAt - now) < (24 * 60 * 60 * 1000); // 24小时内过期

      if (isExpired) {
        // 标记会话为非活跃状态
        await this.deactivateSession(sessionId);
      }

      return {
        success: true,
        data: {
          sessionId,
          isExpired,
          isExpiringSoon,
          expiresAt: session.expires_at,
          lastUsedAt: session.last_used_at
        },
        message: isExpired ? '会话已过期' : '会话有效'
      };
    } catch (error) {
      console.error('检查会话过期状态失败:', error);
      return {
        success: false,
        error: error.message,
        message: '检查会话过期状态失败'
      };
    }
  }

  /**
   * 刷新会话（更新过期时间和cookies）
   */
  async refreshSession(sessionId, newCookies) {
    try {
      const db = this.dbService.db;

      // 加密新的Cookie数据
      const encryptedCookies = this.encryptData(newCookies);
      const newExpiresAt = this.calculateDefaultExpiry();

      const stmt = db.prepare(`
        UPDATE login_sessions
        SET cookies = ?, expires_at = ?, last_used_at = ?, is_active = 1
        WHERE id = ?
      `);

      const result = stmt.run([
        encryptedCookies,
        newExpiresAt.toISOString(),
        new Date().toISOString(),
        sessionId
      ]);

      if (result.changes === 0) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在'
        };
      }

      // 清除缓存
      this.clearSessionCache(sessionId);

      // 获取更新后的会话
      const sessionResult = await this.getSessionById(sessionId);

      return {
        success: true,
        data: sessionResult.data,
        message: '会话刷新成功'
      };
    } catch (error) {
      console.error('刷新会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '刷新会话失败'
      };
    }
  }

  /**
   * 停用会话
   */
  async deactivateSession(sessionId) {
    try {
      const db = this.dbService.db;
      const stmt = db.prepare(`
        UPDATE login_sessions
        SET is_active = 0
        WHERE id = ?
      `);

      const result = stmt.run([sessionId]);

      if (result.changes === 0) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在'
        };
      }

      // 清除缓存
      this.clearSessionCache(sessionId);

      return {
        success: true,
        message: '会话已停用'
      };
    } catch (error) {
      console.error('停用会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '停用会话失败'
      };
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    try {
      const db = this.dbService.db;
      const stmt = db.prepare('DELETE FROM login_sessions WHERE id = ?');
      const result = stmt.run([sessionId]);

      if (result.changes === 0) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在'
        };
      }

      // 清除缓存
      this.clearSessionCache(sessionId);

      return {
        success: true,
        message: '会话删除成功'
      };
    } catch (error) {
      console.error('删除会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '删除会话失败'
      };
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions() {
    try {
      const db = this.dbService.db;
      const stmt = db.prepare(`
        UPDATE login_sessions
        SET is_active = 0
        WHERE expires_at < ? AND is_active = 1
      `);

      const result = stmt.run([new Date().toISOString()]);

      // 清除所有缓存
      this.sessionCache.clear();

      return {
        success: true,
        data: {
          cleanedCount: result.changes
        },
        message: `清理了 ${result.changes} 个过期会话`
      };
    } catch (error) {
      console.error('清理过期会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '清理过期会话失败'
      };
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(platformId = null) {
    try {
      const db = this.dbService.db;

      let query = `
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
          COUNT(CASE WHEN expires_at < ? THEN 1 END) as expired_sessions
        FROM login_sessions
      `;

      let params = [new Date().toISOString()];

      if (platformId) {
        query += ' WHERE platform_id = ?';
        params.push(platformId);
      }

      const stmt = db.prepare(query);
      const stats = stmt.get(...params);

      return {
        success: true,
        data: stats,
        message: '获取会话统计信息成功'
      };
    } catch (error) {
      console.error('获取会话统计信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取会话统计信息失败'
      };
    }
  }

  /**
   * 计算默认过期时间（30天）
   */
  calculateDefaultExpiry() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    return expiry;
  }

  /**
   * 清除缓存
   */
  clearCache(platformId = null) {
    if (platformId) {
      this.sessionCache.delete(`sessions_${platformId}`);
    } else {
      this.sessionCache.clear();
    }
  }

  /**
   * 清除特定会话的缓存
   */
  clearSessionCache(sessionId) {
    // 由于不知道sessionId对应的platformId，清除所有缓存
    this.sessionCache.clear();
  }

  /**
   * 获取最佳可用会话
   */
  async getBestSession(platformId) {
    try {
      const sessionsResult = await this.getActiveSessions(platformId);
      if (!sessionsResult.success || sessionsResult.data.length === 0) {
        return {
          success: false,
          error: 'No active sessions',
          message: '没有可用的登录会话'
        };
      }

      const sessions = sessionsResult.data;
      const now = new Date();

      // 优先选择最近使用且未过期的会话
      let bestSession = null;

      for (const session of sessions) {
        const expiresAt = new Date(session.expires_at);
        const lastUsedAt = new Date(session.last_used_at);

        // 跳过过期会话
        if (now > expiresAt) {
          await this.deactivateSession(session.id);
          continue;
        }

        // 选择最近使用的会话
        if (!bestSession || lastUsedAt > new Date(bestSession.last_used_at)) {
          bestSession = session;
        }
      }

      if (!bestSession) {
        return {
          success: false,
          error: 'No valid sessions',
          message: '没有有效的登录会话'
        };
      }

      // 更新使用时间
      await this.updateSessionUsage(bestSession.id);

      return {
        success: true,
        data: bestSession,
        message: '获取最佳会话成功'
      };
    } catch (error) {
      console.error('获取最佳会话失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取最佳会话失败'
      };
    }
  }
}

module.exports = LoginSessionService;