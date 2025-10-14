/**
 * HTTP API服务 - T005 HTTP API层
 * 提供统一的HTTP请求封装和API调用服务
 */

import axios from 'axios';
import { message } from 'antd';

// HTTP客户端配置
const httpClient = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
httpClient.interceptors.request.use(
  (config) => {
    // 添加请求时间戳
    config.metadata = { startTime: new Date() };

    // 添加认证token（如果存在）
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加设备信息
    config.headers['X-Device-Info'] = navigator.userAgent;
    config.headers['X-Platform'] = navigator.platform;

    console.log(`🚀 HTTP请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ HTTP请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
httpClient.interceptors.response.use(
  (response) => {
    // 计算请求耗时
    const endTime = new Date();
    const duration = endTime - response.config.metadata.startTime;

    console.log(`✅ HTTP响应: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);

    return response;
  },
  (error) => {
    const endTime = new Date();
    const duration = error.config?.metadata ? endTime - error.config.metadata.startTime : 0;

    console.error(`❌ HTTP错误: ${error.config?.method?.toUpperCase()} ${error.config?.url} (${duration}ms)`, error);

    // 统一错误处理
    handleHttpError(error);

    return Promise.reject(error);
  }
);

/**
 * HTTP错误处理
 * @param {Error} error HTTP错误对象
 */
function handleHttpError(error) {
  if (!error.response) {
    // 网络错误
    message.error('网络连接失败，请检查网络设置');
    return;
  }

  const { status, data } = error.response;

  switch (status) {
    case 400:
      message.error(data.message || '请求参数错误');
      break;
    case 401:
      message.error('身份验证失败，请重新登录');
      // 清除token并跳转到登录页
      localStorage.removeItem('authToken');
      break;
    case 403:
      message.error('权限不足，无法执行此操作');
      break;
    case 404:
      message.error('请求的资源不存在');
      break;
    case 429:
      message.error('请求过于频繁，请稍后再试');
      break;
    case 500:
      message.error('服务器内部错误，请稍后再试');
      break;
    case 502:
      message.error('网关错误，请稍后再试');
      break;
    case 503:
      message.error('服务暂时不可用，请稍后再试');
      break;
    default:
      message.error(`请求失败 (${status})`);
  }
}

/**
 * API服务基类
 */
class BaseApiService {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: new Date() };

        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        const endTime = new Date();
        const duration = endTime - response.config.metadata.startTime;

        console.log(`✅ API响应: ${response.config.url} (${duration}ms)`);
        return response;
      },
      (error) => {
        handleHttpError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET请求
   */
  async get(url, params = {}) {
    try {
      const response = await this.client.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * POST请求
   */
  async post(url, data = {}) {
    try {
      const response = await this.client.post(url, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * PUT请求
   */
  async put(url, data = {}) {
    try {
      const response = await this.client.put(url, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * DELETE请求
   */
  async delete(url) {
    try {
      const response = await this.client.delete(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * PATCH请求
   */
  async patch(url, data = {}) {
    try {
      const response = await this.client.patch(url, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 文件上传
   */
  async upload(url, formData, onProgress) {
    try {
      const response = await this.client.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 文件下载
   */
  async download(url, filename) {
    try {
      const response = await this.client.get(url, {
        responseType: 'blob',
      });

      // 创建下载链接
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 错误处理
   */
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      return {
        success: false,
        error: {
          code: status,
          message: data.message || '请求失败',
          details: data,
        },
      };
    } else if (error.request) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '网络连接失败',
          details: error.message,
        },
      };
    } else {
      return {
        success: false,
        error: {
          code: 'CLIENT_ERROR',
          message: '客户端错误',
          details: error.message,
        },
      };
    }
  }
}

/**
 * 文章API服务
 */
export class ArticleApiService extends BaseApiService {
  constructor() {
    super('/api/articles');
  }

  /**
   * 获取文章列表
   */
  async getArticles(params = {}) {
    return this.get('', params);
  }

  /**
   * 获取文章详情
   */
  async getArticle(id) {
    return this.get(`/${id}`);
  }

  /**
   * 创建文章
   */
  async createArticle(articleData) {
    return this.post('', articleData);
  }

  /**
   * 更新文章
   */
  async updateArticle(id, articleData) {
    return this.put(`/${id}`, articleData);
  }

  /**
   * 删除文章
   */
  async deleteArticle(id) {
    return this.delete(`/${id}`);
  }

  /**
   * 发布文章到平台
   */
  async publishArticle(id, platformIds) {
    return this.post(`/${id}/publish`, { platformIds });
  }

  /**
   * 获取发布状态
   */
  async getPublishStatus(id) {
    return this.get(`/${id}/publish-status`);
  }

  /**
   * 取消发布
   */
  async cancelPublish(id, platformId) {
    return this.delete(`/${id}/publish/${platformId}`);
  }
}

/**
 * 平台API服务
 */
export class PlatformApiService extends BaseApiService {
  constructor() {
    super('/api/platforms');
  }

  /**
   * 获取平台列表
   */
  async getPlatforms() {
    return this.get('');
  }

  /**
   * 获取可用平台
   */
  async getAvailablePlatforms() {
    return this.get('/available');
  }

  /**
   * 获取平台配置
   */
  async getPlatformConfig(platformId) {
    return this.get(`/${platformId}/config`);
  }

  /**
   * 更新平台配置
   */
  async updatePlatformConfig(platformId, config) {
    return this.put(`/${platformId}/config`, config);
  }

  /**
   * 测试平台连接
   */
  async testPlatformConnection(platformId) {
    return this.post(`/${platformId}/test`);
  }

  /**
   * 获取平台状态
   */
  async getPlatformStatus(platformId) {
    return this.get(`/${platformId}/status`);
  }
}

/**
 * 用户API服务
 */
export class UserApiService extends BaseApiService {
  constructor() {
    super('/api/user');
  }

  /**
   * 用户登录
   */
  async login(credentials) {
    const response = await this.post('/login', credentials);
    if (response.success && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response;
  }

  /**
   * 用户登出
   */
  async logout() {
    const response = await this.post('/logout');
    localStorage.removeItem('authToken');
    return response;
  }

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    return this.get('/info');
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userInfo) {
    return this.put('/info', userInfo);
  }

  /**
   * 修改密码
   */
  async changePassword(passwordData) {
    return this.put('/password', passwordData);
  }
}

/**
 * 文件API服务
 */
export class FileApiService extends BaseApiService {
  constructor() {
    super('/api/files');
  }

  /**
   * 上传文件
   */
  async uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    return this.upload('/upload', formData, onProgress);
  }

  /**
   * 上传图片
   */
  async uploadImage(file, onProgress) {
    const formData = new FormData();
    formData.append('image', file);

    return this.upload('/upload-image', formData, onProgress);
  }

  /**
   * 下载文件
   */
  async downloadFile(fileId, filename) {
    return this.download(`/download/${fileId}`, filename);
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId) {
    return this.delete(`/${fileId}`);
  }

  /**
   * 获取文件列表
   */
  async getFiles(params = {}) {
    return this.get('', params);
  }
}

/**
 * 系统API服务
 */
export class SystemApiService extends BaseApiService {
  constructor() {
    super('/api/system');
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo() {
    return this.get('/info');
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    return this.get('/status');
  }

  /**
   * 检查更新
   */
  async checkUpdate() {
    return this.get('/check-update');
  }

  /**
   * 下载更新
   */
  async downloadUpdate(onProgress) {
    return this.get('/download-update', {
      onDownloadProgress: onProgress,
    });
  }
}

// 创建API服务实例
export const articleApi = new ArticleApiService();
export const platformApi = new PlatformApiService();
export const userApi = new UserApiService();
export const fileApi = new FileApiService();
export const systemApi = new SystemApiService();

// 导出默认HTTP客户端
export default httpClient;

