/**
 * 二维码生成服务 - T013
 * 负责生成平台登录二维码，支持会话管理和状态检查
 */

const { getDatabaseService } = require('../database/DatabaseService');
const QRCode = require('qrcode');
const crypto = require('crypto');

class QRCodeService {
  constructor() {
    this.dbService = null;
    this.activeSessions = new Map(); // 存储活跃的二维码会话
  }

  /**
   * 初始化二维码服务
   */
  async initialize() {
    try {
      this.dbService = getDatabaseService();

      return {
        success: true,
        message: '二维码服务初始化成功'
      };
    } catch (error) {
      console.error('二维码服务初始化失败:', error);
      return {
        success: false,
        error: error.message,
        message: '二维码服务初始化失败'
      };
    }
  }

  /**
   * 生成二维码
   */
  async generateQRCode(loginUrl, options = {}) {
    try {
      const {
        platformId,
        sessionId,
        platformName,
        expiresAt,
        width = 200,
        margin = 1
      } = options;

      // 验证必需参数
      if (!loginUrl || !platformId || !sessionId) {
        return {
          success: false,
          error: 'Missing required parameters',
          message: '缺少必需参数'
        };
      }

      // 生成二维码数据
      const qrOptions = {
        width,
        margin,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      };

      // 生成二维码图片（base64格式）
      const qrCodeDataUrl = await QRCode.toDataURL(loginUrl, qrOptions);

      // 创建会话记录
      const sessionRecord = {
        id: this.generateSessionId(),
        platformId,
        sessionId,
        platformName,
        loginUrl,
        qrCode: qrCodeDataUrl,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || new Date(Date.now() + 120 * 1000).toISOString(), // 默认2分钟
        lastCheckedAt: new Date().toISOString()
      };

      // 存储会话记录
      this.activeSessions.set(sessionId, sessionRecord);

      return {
        success: true,
        data: {
          qrCode: qrCodeDataUrl,
          sessionId,
          expiresAt: sessionRecord.expiresAt
        },
        message: '二维码生成成功'
      };
    } catch (error) {
      console.error('生成二维码失败:', error);
      return {
        success: false,
        error: error.message,
        message: '生成二维码失败'
      };
    }
  }

  /**
   * 检查二维码状态
   */
  async checkQRCodeStatus(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
          message: '会话不存在或已过期'
        };
      }

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      // 检查是否过期
      if (now > expiresAt) {
        session.status = 'expired';
        this.activeSessions.set(sessionId, session);

        return {
          success: true,
          data: {
            status: 'expired',
            message: '二维码已过期'
          }
        };
      }

      // 检查登录状态（模拟实现，实际应该从登录会话服务获取）
      const loginStatus = await this.checkLoginStatus(session.platformId, sessionId);

      // 更新会话状态
      session.status = loginStatus.status;
      session.lastCheckedAt = now.toISOString();
      this.activeSessions.set(sessionId, session);

      return {
        success: true,
        data: {
          status: loginStatus.status,
          message: loginStatus.message,
          data: loginStatus.data
        }
      };
    } catch (error) {
      console.error('检查二维码状态失败:', error);
      return {
        success: false,
        error: error.message,
        message: '检查二维码状态失败'
      };
    }
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions() {
    try {
      const now = new Date();
      const expiredSessions = [];

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now > new Date(session.expiresAt)) {
          expiredSessions.push(sessionId);
        }
      }

      // 清理过期会话
      for (const sessionId of expiredSessions) {
        this.activeSessions.delete(sessionId);
      }

      return {
        success: true,
        data: {
          cleanedCount: expiredSessions.length
        },
        message: `清理了 ${expiredSessions.length} 个过期会话`
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
   * 获取会话信息
   */
  getSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      ...session,
      isExpired: new Date() > new Date(session.expiresAt)
    };
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions() {
    const sessions = [];
    const now = new Date();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now <= new Date(session.expiresAt)) {
        sessions.push({
          ...session,
          isExpired: false
        });
      }
    }

    return sessions;
  }

  /**
   * 检查登录状态（模拟实现）
   */
  async checkLoginStatus(platformId, sessionId) {
    try {
      // 这里应该集成实际的登录检查逻辑
      // 比如检查login_sessions表中是否有对应的记录

      const db = this.dbService.db;

      // 查询对应的登录会话
      const stmt = db.prepare(`
        SELECT * FROM login_sessions
        WHERE session_name = ? AND platform_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);

      const session = stmt.get([sessionId, platformId]);

      if (!session) {
        return {
          status: 'waiting',
          message: '等待用户扫描二维码'
        };
      }

      const now = new Date();
      const lastUsedAt = new Date(session.last_used_at);

      // 模拟登录状态检查逻辑
      const timeSinceLastCheck = now - lastUsedAt;

      if (timeSinceLastCheck < 5000) { // 5秒内
        return {
          status: 'scanned',
          message: '二维码已扫描，请确认登录'
        };
      } else if (timeSinceLastCheck < 15000) { // 15秒内
        return {
          status: 'confirmed',
          message: '登录成功',
          data: {
            userId: session.id,
            username: session.session_name
          }
        };
      } else {
        return {
          status: 'waiting',
          message: '等待用户扫描二维码'
        };
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      return {
        status: 'error',
        message: '检查登录状态失败'
      };
    }
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 生成唯一的二维码标识符
   */
  generateQRCodeId() {
    return `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 验证二维码参数
   */
  validateQRCodeParams(params) {
    const { loginUrl, platformId, sessionId } = params;

    const errors = [];

    if (!loginUrl) {
      errors.push('登录URL不能为空');
    }

    if (!platformId) {
      errors.push('平台ID不能为空');
    }

    if (!sessionId) {
      errors.push('会话ID不能为空');
    }

    // 验证URL格式
    try {
      new URL(loginUrl);
    } catch (error) {
      errors.push('登录URL格式无效');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = QRCodeService;