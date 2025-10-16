/**
 * 发布器专用的登录会话服务包装器
 * 基于T012 LoginSessionService，为发布功能提供适配接口
 * 遵循代码复用原则：不修改原始类，通过包装器适配接口
 */

const LoginSessionService = require('../services/LoginSessionService');

class PublisherLoginSessionService {
  constructor() {
    this.loginSessionService = new LoginSessionService();
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (!this.initialized) {
      const result = await this.loginSessionService.initialize();
      this.initialized = result.success;
      return result;
    }
    return { success: true, message: '发布器登录会话服务已初始化' };
  }

  /**
   * 适配器方法：将getById适配到getSessionById
   * 为SimpleZhihuPublisher提供兼容接口
   */
  async getById(sessionId) {
    const result = await this.loginSessionService.getSessionById(sessionId);
    return result;
  }

  /**
   * 获取会话（转发到原始方法）
   */
  async getSessionById(sessionId) {
    return await this.loginSessionService.getSessionById(sessionId);
  }

  /**
   * 获取活跃会话（转发到原始方法）
   */
  async getActiveSessions(platformId) {
    return await this.loginSessionService.getActiveSessions(platformId);
  }

  /**
   * 更新会话使用时间（转发到原始方法）
   */
  async updateSessionUsage(sessionId) {
    return await this.loginSessionService.updateSessionUsage(sessionId);
  }

  /**
   * 检查会话过期（转发到原始方法）
   */
  async checkSessionExpiry(sessionId) {
    return await this.loginSessionService.checkSessionExpiry(sessionId);
  }

  /**
   * 刷新会话（转发到原始方法）
   */
  async refreshSession(sessionId, newCookies) {
    return await this.loginSessionService.refreshSession(sessionId, newCookies);
  }

  /**
   * 停用会话（转发到原始方法）
   */
  async deactivateSession(sessionId) {
    return await this.loginSessionService.deactivateSession(sessionId);
  }

  /**
   * 删除会话（转发到原始方法）
   */
  async deleteSession(sessionId) {
    return await this.loginSessionService.deleteSession(sessionId);
  }

  /**
   * 清理过期会话（转发到原始方法）
   */
  async cleanupExpiredSessions() {
    return await this.loginSessionService.cleanupExpiredSessions();
  }

  /**
   * 获取会话统计（转发到原始方法）
   */
  async getSessionStats(platformId = null) {
    return await this.loginSessionService.getSessionStats(platformId);
  }

  /**
   * 获取最佳会话（转发到原始方法）
   */
  async getBestSession(platformId) {
    return await this.loginSessionService.getBestSession(platformId);
  }

  /**
   * 创建会话（转发到原始方法）
   */
  async createSession(platformId, sessionData) {
    return await this.loginSessionService.createSession(platformId, sessionData);
  }
}

module.exports = PublisherLoginSessionService;