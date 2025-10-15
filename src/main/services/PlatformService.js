/**
 * 平台配置服务 - T011平台配置管理
 * 负责平台配置管理、状态检查、认证方法配置等功能
 */

const Platform = require('../database/models/Platform');
const https = require('https');
const http = require('http');

class PlatformService {
  constructor() {
    this.platformModel = new Platform();
    this.platformConfigs = new Map();
    this.statusCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 初始化平台服务
   */
  async initialize() {
    try {
      // 初始化默认平台配置
      const result = await this.initializeDefaultPlatforms();

      if (result.success) {
        return {
          success: true,
          message: '平台服务初始化成功'
        };
      } else {
        console.error('平台服务初始化失败:', result.message);
        return {
          success: false,
          error: result.error,
          message: result.message
        };
      }
    } catch (error) {
      console.error('平台服务初始化失败:', error);
      return {
        success: false,
        error: error.message,
        message: '平台服务初始化失败'
      };
    }
  }

  /**
   * 获取所有平台配置
   */
  async getAllPlatforms(activeOnly = true) {
    try {
      const platforms = await this.platformModel.findAll(activeOnly);

      return {
        success: true,
        data: platforms,
        message: '获取平台列表成功'
      };
    } catch (error) {
      console.error('获取平台列表失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取平台列表失败'
      };
    }
  }

  /**
   * 获取可用平台
   */
  async getAvailablePlatforms() {
    try {
      const platforms = await this.platformModel.getAvailable();

      return {
        success: true,
        data: platforms,
        message: '获取可用平台成功'
      };
    } catch (error) {
      console.error('获取可用平台失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取可用平台失败'
      };
    }
  }

  /**
   * 根据ID获取平台配置
   */
  async getPlatform(id) {
    return this.getPlatformById(id);
  }

  /**
   * 根据ID获取平台配置（内部方法）
   */
  async getPlatformById(id) {
    try {
      const platform = await this.platformModel.findById(id);
      if (!platform) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      return {
        success: true,
        data: platform,
        message: '获取平台配置成功'
      };
    } catch (error) {
      console.error('获取平台配置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取平台配置失败'
      };
    }
  }

  /**
   * 根据标识符获取平台配置
   */
  async getPlatformBySlug(slug) {
    try {
      const platform = await this.platformModel.findBySlug(slug);
      if (!platform) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      return {
        success: true,
        data: platform,
        message: '获取平台配置成功'
      };
    } catch (error) {
      console.error('获取平台配置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取平台配置失败'
      };
    }
  }

  /**
   * 更新平台配置
   */
  async updatePlatform(id, updateData) {
    try {
      // 验证平台是否存在
      const existing = await this.platformModel.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      // 过滤掉数据库中不存在的字段
      const allowedFields = [
        'name', 'display_name', 'icon_url', 'base_url', 'login_url', 'publish_url',
        'config_schema', 'is_active', 'priority'
      ];

      const filteredData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      // 验证更新数据
      const validationResult = this.validatePlatformConfig(filteredData);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          message: validationResult.message
        };
      }

      // 更新平台配置
      const updated = await this.platformModel.update(id, filteredData);
      if (!updated) {
        return {
          success: false,
          error: 'Update failed',
          message: '更新平台配置失败'
        };
      }

      // 清除缓存
      this.clearCache(id);

      // 获取更新后的平台配置
      const platform = await this.platformModel.findById(id);

      return {
        success: true,
        data: platform,
        message: '平台配置更新成功'
      };
    } catch (error) {
      console.error('更新平台配置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新平台配置失败'
      };
    }
  }

  /**
   * 创建平台配置
   */
  async createPlatform(platformData) {
    try {
      // 验证平台数据
      const validationResult = this.validatePlatformConfig(platformData);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          message: validationResult.message
        };
      }

      const platform = await this.platformModel.create({
        name: platformData.name, // 使用name字段作为标识符
        display_name: platformData.display_name, // 使用display_name字段作为显示名称
        icon_url: platformData.icon || '',
        base_url: platformData.base_url || '',
        login_url: platformData.login_url || '',
        publish_url: platformData.publish_url || '',
        config_schema: {
          auth_method: platformData.auth_method || 'qr_code',
          auth_config: platformData.auth_config || {},
          publish_config: platformData.publish_config || {},
          settings: platformData.settings || {},
          color: platformData.color || '#1890ff',
          description: platformData.description || ''
        },
        is_active: platformData.status !== undefined ? platformData.status : 1,
        priority: 0
      });

      return {
        success: true,
        data: platform,
        message: '平台创建成功'
      };
    } catch (error) {
      console.error('创建平台失败:', error);
      return {
        success: false,
        error: error.message,
        message: '创建平台失败'
      };
    }
  }

  /**
   * 删除平台配置
   */
  async deletePlatform(id) {
    try {
      const deleted = await this.platformModel.delete(id);
      if (!deleted) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      // 清除缓存
      this.clearCache(id);

      return {
        success: true,
        message: '平台删除成功'
      };
    } catch (error) {
      console.error('删除平台失败:', error);
      return {
        success: false,
        error: error.message,
        message: '删除平台失败'
      };
    }
  }

  /**
   * 检查平台状态
   */
  async checkPlatformStatus(id) {
    try {
      // 检查缓存
      const cached = this.statusCache.get(id);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          message: '平台状态（缓存）'
        };
      }

      // 获取平台配置
      const platformResult = await this.getPlatformById(id);
      if (!platformResult.success) {
        return platformResult;
      }

      const platform = platformResult.data;
      const status = await this.pingPlatform(platform);

      // 更新缓存
      this.statusCache.set(id, {
        data: status,
        timestamp: Date.now()
      });

      return {
        success: true,
        data: status,
        message: '平台状态检查成功'
      };
    } catch (error) {
      console.error('检查平台状态失败:', error);
      return {
        success: false,
        error: error.message,
        message: '检查平台状态失败'
      };
    }
  }

  /**
   * 检查所有平台状态
   */
  async checkAllPlatformsStatus() {
    try {
      const platformsResult = await this.getAllPlatforms();
      if (!platformsResult.success) {
        return platformsResult;
      }

      const platforms = platformsResult.data;
      const statusChecks = await Promise.all(
        platforms.map(platform => this.checkPlatformStatus(platform.id))
      );

      const results = statusChecks.map((result, index) => ({
        platform: platforms[index],
        ...result
      }));

      return {
        success: true,
        data: results,
        message: '所有平台状态检查完成'
      };
    } catch (error) {
      console.error('检查所有平台状态失败:', error);
      return {
        success: false,
        error: error.message,
        message: '检查所有平台状态失败'
      };
    }
  }

  /**
   * Ping平台可访问性
   */
  async pingPlatform(platform) {
    try {
      if (!platform.base_url) {
        return {
          status: 'error',
          message: '平台未配置基础URL',
          response_time: 0
        };
      }

      const startTime = Date.now();
      const url = new URL(platform.base_url);

      const response = await this.makeHttpRequest(url);
      const responseTime = Date.now() - startTime;

      return {
        status: response.success ? 'online' : 'offline',
        message: response.success ? '平台可访问' : '平台不可访问',
        response_time,
        http_status: response.status,
        last_check: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        response_time: 0,
        last_check: new Date().toISOString()
      };
    }
  }

  /**
   * 发起HTTP请求
   */
  makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;

      const request = client.request(url, {
        method: 'HEAD',
        timeout: 5000
      }, (response) => {
        resolve({
          success: response.statusCode < 400,
          status: response.statusCode
        });
      });

      request.on('error', () => {
        resolve({
          success: false,
          status: 0
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          status: 0
        });
      });

      request.end();
    });
  }

  /**
   * 获取平台登录配置
   */
  async getLoginConfig(id) {
    try {
      const platformResult = await this.getPlatformById(id);
      if (!platformResult.success) {
        return platformResult;
      }

      const platform = platformResult.data;
      const loginConfig = this.buildLoginConfig(platform);

      return {
        success: true,
        data: {
          platform,
          loginConfig
        },
        message: '获取登录配置成功'
      };
    } catch (error) {
      console.error('获取登录配置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取登录配置失败'
      };
    }
  }

  /**
   * 构建登录配置
   */
  buildLoginConfig(platform) {
    // 从config_schema中获取认证配置
    const configSchema = platform.config_schema || {};
    const authConfig = configSchema.auth_config || {};

    const config = {
      method: configSchema.auth_method || 'qr_code',
      baseUrl: platform.base_url || '',
      loginUrl: platform.login_url || '',
      authConfig: authConfig
    };

    // 根据认证方法构建特定配置
    switch (configSchema.auth_method) {
      case 'qr_code':
        config.qrCodeConfig = {
          selector: authConfig.qr_selector || '.qrcode',
          refreshInterval: authConfig.refresh_interval || 3000,
          maxAttempts: authConfig.max_attempts || 60
        };
        break;

      case 'password':
        config.passwordConfig = {
          usernameSelector: authConfig.username_selector || 'input[name="username"]',
          passwordSelector: authConfig.password_selector || 'input[name="password"]',
          submitSelector: authConfig.submit_selector || 'button[type="submit"]'
        };
        break;

      case 'oauth':
        config.oauthConfig = {
          authorizeUrl: authConfig.authorize_url || '',
          clientId: authConfig.client_id || '',
          redirectUri: authConfig.redirect_uri || '',
          scope: authConfig.scope || ''
        };
        break;
    }

    return config;
  }

  /**
   * 获取平台发布配置
   */
  async getPublishConfig(id) {
    try {
      const platformResult = await this.getPlatformById(id);
      if (!platformResult.success) {
        return platformResult;
      }

      const platform = platformResult.data;
      const publishConfig = this.buildPublishConfig(platform);

      return {
        success: true,
        data: {
          platform,
          publishConfig
        },
        message: '获取发布配置成功'
      };
    } catch (error) {
      console.error('获取发布配置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取发布配置失败'
      };
    }
  }

  /**
   * 构建发布配置
   */
  buildPublishConfig(platform) {
    // 从config_schema中获取发布配置
    const configSchema = platform.config_schema || {};
    const publishConfig = configSchema.publish_config || {};

    const config = {
      baseUrl: platform.base_url || '',
      publishUrl: platform.publish_url || '',
      publishConfig: publishConfig
    };

    // 通用发布配置
    config.titleSelector = publishConfig.title_selector || 'input[name="title"]';
    config.contentSelector = publishConfig.content_selector || 'textarea[name="content"]';
    config.submitSelector = publishConfig.submit_selector || 'button[type="submit"]';

    // 平台特定配置（基于name字段）
    switch (platform.name) {
      case 'zhihu':
        config.zhihuConfig = {
          articleEditorUrl: 'https://zhuanlan.zhihu.com/write',
          draftSelector: '.DraftEditor',
          titleSelector: '.DraftEditor-titleInput',
          contentSelector: '.DraftEditor-content',
          publishButtonSelector: '.PublishButton'
        };
        break;

      case 'xiaohongshu':
        config.xiaohongshuConfig = {
          publishUrl: 'https://creator.xiaohongshu.com/publish/publish',
          titleSelector: '.title-input',
          contentSelector: '.content-input',
          imageSelector: '.image-upload'
        };
        break;
    }

    return config;
  }

  /**
   * 验证平台配置
   */
  validatePlatformConfig(platformData) {
    // 标识符验证（使用name字段作为标识符）
    if (!platformData.name || platformData.name.trim().length === 0) {
      return {
        valid: false,
        error: 'name_required',
        message: '平台标识符不能为空'
      };
    }

    // 验证标识符格式（只能包含字母、数字、下划线和连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(platformData.name)) {
      return {
        valid: false,
        error: 'name_invalid',
        message: '平台标识符只能包含字母、数字、下划线和连字符'
      };
    }

    if (platformData.name.length > 50) {
      return {
        valid: false,
        error: 'name_too_long',
        message: '平台标识符不能超过50个字符'
      };
    }

    // 显示名称验证
    if (!platformData.display_name || platformData.display_name.trim().length === 0) {
      return {
        valid: false,
        error: 'display_name_required',
        message: '平台名称不能为空'
      };
    }

    if (platformData.display_name.length > 100) {
      return {
        valid: false,
        error: 'display_name_too_long',
        message: '平台名称不能超过100个字符'
      };
    }

    // URL验证
    if (platformData.base_url) {
      try {
        new URL(platformData.base_url);
      } catch (error) {
        return {
          valid: false,
          error: 'base_url_invalid',
          message: '基础URL格式无效'
        };
      }
    }

    // 认证方法验证
    const validAuthMethods = ['qr_code', 'password', 'oauth', 'api_key'];
    if (platformData.auth_method && !validAuthMethods.includes(platformData.auth_method)) {
      return {
        valid: false,
        error: 'auth_method_invalid',
        message: '认证方法无效'
      };
    }

    // 状态验证
    if (platformData.status !== undefined && ![0, 1].includes(platformData.status)) {
      return {
        valid: false,
        error: 'status_invalid',
        message: '平台状态只能为0（禁用）或1（启用）'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * 清除缓存
   */
  clearCache(platformId = null) {
    if (platformId) {
      this.statusCache.delete(platformId);
      this.platformConfigs.delete(platformId);
    } else {
      this.statusCache.clear();
      this.platformConfigs.clear();
    }
  }

  /**
   * 获取平台统计信息
   */
  async getStats() {
    try {
      const stats = await this.platformModel.getStats();

      return {
        success: true,
        data: stats,
        message: '获取平台统计信息成功'
      };
    } catch (error) {
      console.error('获取平台统计信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取平台统计信息失败'
      };
    }
  }

  /**
   * 初始化默认平台配置
   */
  async initializeDefaultPlatforms() {
    try {
      const defaultPlatforms = [
        {
          name: '知乎',
          slug: 'zhihu',
          description: '知乎 - 知识分享社区',
          base_url: 'https://www.zhihu.com',
          login_url: 'https://www.zhihu.com/signin',
          publish_url: 'https://zhuanlan.zhihu.com/write',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: '.DraftEditor-titleInput',
            content_selector: '.DraftEditor-content',
            submit_selector: '.PublishButton'
          },
          status: 1,
          icon: 'zhihu',
          color: '#0066ff'
        },
        {
          name: '小红书',
          slug: 'xiaohongshu',
          description: '小红书 - 生活方式社区',
          base_url: 'https://www.xiaohongshu.com',
          login_url: 'https://creator.xiaohongshu.com',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: '.title-input',
            content_selector: '.content-input'
          },
          status: 1,
          icon: 'xiaohongshu',
          color: '#ff2442'
        },
        {
          name: '掘金',
          slug: 'juejin',
          description: '掘金 - 技术内容分享',
          base_url: 'https://juejin.cn',
          login_url: 'https://juejin.cn',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: 'input[placeholder*="输入文章标题"]',
            content_selector: '.CodeMirror textarea'
          },
          status: 0,
          icon: 'juejin',
          color: '#007bff'
        },
        {
          name: 'CSDN',
          slug: 'csdn',
          description: 'CSDN - IT技术社区',
          base_url: 'https://blog.csdn.net',
          login_url: 'https://passport.csdn.net/login',
          auth_method: 'password',
          auth_config: {
            username_selector: 'input[name="username"]',
            password_selector: 'input[name="password"]',
            submit_selector: 'button[type="submit"]'
          },
          publish_config: {
            title_selector: 'input[placeholder*="请输入标题"]',
            content_selector: '.editor-container'
          },
          status: 0,
          icon: 'csdn',
          color: '#ff5555'
        },
        {
          name: '百家号',
          slug: 'baijiahao',
          description: '百家号 - 百度内容创作平台',
          base_url: 'https://baijiahao.baidu.com',
          login_url: 'https://baijiahao.baidu.com',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: 'input[placeholder*="请输入标题"]',
            content_selector: '.editor-content'
          },
          status: 0,
          icon: 'baijiahao',
          color: '#2b7cff'
        },
        {
          name: '头条号',
          slug: 'toutiaohao',
          description: '头条号 - 今日头条内容平台',
          base_url: 'https://mp.toutiao.com',
          login_url: 'https://mp.toutiao.com',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: 'input[placeholder*="请输入标题"]',
            content_selector: '.editor-content'
          },
          status: 0,
          icon: 'toutiaohao',
          color: '#ed4014'
        },
        {
          name: '知识星球',
          slug: 'zhishixingqiu',
          description: '知识星球 - 知识付费平台',
          base_url: 'https://zsxq.com',
          login_url: 'https://zsxq.com',
          auth_method: 'qr_code',
          auth_config: {
            qr_selector: '.qrcode',
            refresh_interval: 3000,
            max_attempts: 60
          },
          publish_config: {
            title_selector: 'input[placeholder*="请输入标题"]',
            content_selector: '.editor-content'
          },
          status: 0,
          icon: 'zhishixingqiu',
          color: '#52c41a'
        }
      ];

      const results = [];

      for (const platformData of defaultPlatforms) {
        try {
          // 检查平台是否已存在
          const existing = await this.getPlatformBySlug(platformData.slug);

          if (!existing.success) {
            // 平台不存在，创建新平台
            const result = await this.createPlatform(platformData);
            results.push({
              platform: platformData.slug,
              action: 'created',
              result: result.success
            });
          } else {
            // 平台已存在，跳过
            results.push({
              platform: platformData.slug,
              action: 'skipped',
              result: true,
              message: '平台已存在'
            });
          }
        } catch (error) {
          console.error(`初始化平台 ${platformData.slug} 失败:`, error);
          results.push({
            platform: platformData.slug,
            action: 'error',
            result: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        data: results,
        message: '默认平台初始化完成'
      };
    } catch (error) {
      console.error('初始化默认平台失败:', error);
      return {
        success: false,
        error: error.message,
        message: '初始化默认平台失败'
      };
    }
  }

  /**
   * 切换平台启用/禁用状态
   */
  async togglePlatformActive(id, isActive) {
    try {
      // 验证平台是否存在
      const existing = await this.platformModel.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Platform not found',
          message: '平台不存在'
        };
      }

      // 调用数据库模型的toggleActive方法
      const updated = await this.platformModel.toggleActive(id, isActive);
      if (!updated) {
        return {
          success: false,
          error: 'Update failed',
          message: '更新平台状态失败'
        };
      }

      // 清除缓存
      this.clearCache(id);

      // 获取更新后的平台配置
      const platform = await this.platformModel.findById(id);

      return {
        success: true,
        data: platform,
        message: `平台已${isActive ? '启用' : '禁用'}`
      };
    } catch (error) {
      console.error('切换平台状态失败:', error);
      return {
        success: false,
        error: error.message,
        message: '切换平台状态失败'
      };
    }
  }
}

module.exports = PlatformService;