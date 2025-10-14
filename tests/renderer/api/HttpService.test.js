/**
 * T005 HTTP API层测试
 * 测试HTTP服务、API配置和错误处理
 */

import axios from 'axios';
import { message } from 'antd';
import {
  httpClient,
  BaseApiService,
  ArticleApiService,
  PlatformApiService,
  UserApiService,
  FileApiService,
  SystemApiService,
  articleApi,
  platformApi,
  userApi,
  fileApi,
  systemApi,
} from '../../../src/renderer/services/httpService';

import {
  API_CONFIG,
  getCurrentApiConfig,
  API_ENDPOINTS,
  REQUEST_CONFIG,
  RESPONSE_FORMAT,
  ERROR_CODES,
  HTTP_STATUS_MAP,
  PLATFORM_API_CONFIG,
} from '../../../src/renderer/config/apiConfig';

// Mock axios
jest.mock('axios');
jest.mock('antd', () => ({
  message: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock navigator
global.navigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  platform: 'TestPlatform',
};

describe('T005 HTTP API层测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. HTTP客户端配置测试', () => {
    test('应该正确创建HTTP客户端', () => {
      expect(httpClient).toBeDefined();
      expect(httpClient.defaults.timeout).toBe(30000);
      expect(httpClient.defaults.headers['Content-Type']).toBe('application/json');
    });

    test('应该正确设置请求拦截器', () => {
      const mockConfig = {
        metadata: {},
        headers: {},
      };

      // 模拟请求拦截器
      const requestInterceptor = httpClient.interceptors.request.handlers[0];
      const result = requestInterceptor.fulfilled(mockConfig);

      expect(result.metadata.startTime).toBeDefined();
      expect(result.headers['X-Device-Info']).toBe('Mozilla/5.0 (Test Browser)');
      expect(result.headers['X-Platform']).toBe('TestPlatform');
    });

    test('应该在有token时添加Authorization头', () => {
      localStorageMock.getItem.mockReturnValue('test-token');

      const mockConfig = {
        metadata: {},
        headers: {},
      };

      const requestInterceptor = httpClient.interceptors.request.handlers[0];
      const result = requestInterceptor.fulfilled(mockConfig);

      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    test('应该正确处理响应拦截器', () => {
      const mockResponse = {
        config: { metadata: { startTime: new Date() } },
        status: 200,
        data: { success: true },
      };

      const responseInterceptor = httpClient.interceptors.response.handlers[0];
      const result = responseInterceptor.fulfilled(mockResponse);

      expect(result).toBe(mockResponse);
    });

    test('应该正确处理响应错误', () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Bad Request' },
        },
        config: { url: '/test' },
      };

      const responseInterceptor = httpClient.interceptors.response.handlers[0];
      responseInterceptor.rejected(mockError);

      expect(message.error).toHaveBeenCalledWith('请求参数错误');
    });
  });

  describe('2. API配置测试', () => {
    test('应该导出完整的API配置', () => {
      expect(API_CONFIG).toBeDefined();
      expect(API_CONFIG.development).toBeDefined();
      expect(API_CONFIG.production).toBeDefined();
      expect(API_CONFIG.test).toBeDefined();
    });

    test('应该正确获取当前环境配置', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      expect(getCurrentApiConfig()).toBe(API_CONFIG.development);

      process.env.NODE_ENV = 'production';
      expect(getCurrentApiConfig()).toBe(API_CONFIG.production);

      process.env.NODE_ENV = originalEnv;
    });

    test('应该导出完整的API端点', () => {
      expect(API_ENDPOINTS).toBeDefined();
      expect(API_ENDPOINTS.ARTICLES).toBeDefined();
      expect(API_ENDPOINTS.PLATFORMS).toBeDefined();
      expect(API_ENDPOINTS.USER).toBeDefined();
      expect(API_ENDPOINTS.FILES).toBeDefined();
      expect(API_ENDPOINTS.SYSTEM).toBeDefined();

      // 测试动态端点生成
      expect(API_ENDPOINTS.ARTICLES.DETAIL(123)).toBe('/articles/123');
      expect(API_ENDPOINTS.PLATFORMS.CONFIG('zhihu')).toBe('/platforms/zhihu/config');
    });

    test('应该导出请求配置', () => {
      expect(REQUEST_CONFIG).toBeDefined();
      expect(REQUEST_CONFIG.headers).toBeDefined();
      expect(REQUEST_CONFIG.timeout).toBe(30000);
      expect(REQUEST_CONFIG.retry).toBeDefined();
      expect(REQUEST_CONFIG.cache).toBeDefined();
      expect(REQUEST_CONFIG.rateLimit).toBeDefined();
    });

    test('应该导出响应格式定义', () => {
      expect(RESPONSE_FORMAT).toBeDefined();
      expect(RESPONSE_FORMAT.success).toBeDefined();
      expect(RESPONSE_FORMAT.error).toBeDefined();
      expect(RESPONSE_FORMAT.pagination).toBeDefined();
      expect(RESPONSE_FORMAT.upload).toBeDefined();

      expect(RESPONSE_FORMAT.success.success).toBe(true);
      expect(RESPONSE_FORMAT.error.success).toBe(false);
    });

    test('应该导出完整的错误码定义', () => {
      expect(ERROR_CODES).toBeDefined();
      expect(ERROR_CODES.SUCCESS).toBe(200);
      expect(ERROR_CODES.BAD_REQUEST).toBe(400);
      expect(ERROR_CODES.UNAUTHORIZED).toBe(401);
      expect(ERROR_CODES.NOT_FOUND).toBe(404);

      expect(ERROR_CODES.USER_NOT_FOUND).toBe(1001);
      expect(ERROR_CODES.ARTICLE_NOT_FOUND).toBe(2001);
      expect(ERROR_CODES.PLATFORM_NOT_FOUND).toBe(3001);
    });

    test('应该导出HTTP状态码映射', () => {
      expect(HTTP_STATUS_MAP).toBeDefined();
      expect(HTTP_STATUS_MAP[200]).toBe('请求成功');
      expect(HTTP_STATUS_MAP[404]).toBe('资源不存在');
      expect(HTTP_STATUS_MAP[500]).toBe('服务器内部错误');
    });

    test('应该导出平台API配置', () => {
      expect(PLATFORM_API_CONFIG).toBeDefined();
      expect(PLATFORM_API_CONFIG.zhihu).toBeDefined();
      expect(PLATFORM_API_CONFIG.xiaohongshu).toBeDefined();

      const zhihuConfig = PLATFORM_API_CONFIG.zhihu;
      expect(zhihuConfig.name).toBe('知乎');
      expect(zhihuConfig.baseUrl).toBeDefined();
      expect(zhihuConfig.endpoints).toBeDefined();
      expect(zhihuConfig.auth).toBeDefined();
      expect(zhihuConfig.limits).toBeDefined();
    });
  });

  describe('3. BaseApiService测试', () => {
    let baseApiService;
    let mockAxiosInstance;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      baseApiService = new BaseApiService('/test');
      baseApiService.client = mockAxiosInstance;
    });

    test('应该正确创建BaseApiService实例', () => {
      expect(baseApiService).toBeDefined();
      expect(baseApiService.client).toBeDefined();
    });

    test('应该正确处理GET请求', async () => {
      const mockResponse = { data: { success: true } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await baseApiService.get('/test-endpoint', { param: 'value' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', {
        params: { param: 'value' },
      });
      expect(result).toEqual({ success: true });
    });

    test('应该正确处理POST请求', async () => {
      const mockResponse = { data: { success: true } };
      const postData = { title: 'Test', content: 'Content' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await baseApiService.post('/test-endpoint', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-endpoint', postData);
      expect(result).toEqual({ success: true });
    });

    test('应该正确处理PUT请求', async () => {
      const mockResponse = { data: { success: true } };
      const putData = { title: 'Updated' };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await baseApiService.put('/test-endpoint/123', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test-endpoint/123', putData);
      expect(result).toEqual({ success: true });
    });

    test('应该正确处理DELETE请求', async () => {
      const mockResponse = { data: { success: true } };
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await baseApiService.delete('/test-endpoint/123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test-endpoint/123');
      expect(result).toEqual({ success: true });
    });

    test('应该正确处理文件上传', async () => {
      const mockResponse = { data: { fileId: '123', filename: 'test.jpg' } };
      const mockFormData = new FormData();
      const mockOnProgress = jest.fn();

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await baseApiService.upload('/upload', mockFormData, mockOnProgress);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/upload', mockFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: expect.any(Function),
      });
      expect(result).toEqual({ fileId: '123', filename: 'test.jpg' });
    });

    test('应该正确处理文件下载', async () => {
      const mockBlob = new Blob(['test content']);
      const mockResponse = { data: mockBlob };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Mock DOM methods
      const mockCreateObjectURL = jest.fn(() => 'blob:url');
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockCreateElement = jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn(),
      }));
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();
      global.document.createElement = mockCreateElement;
      global.document.body.appendChild = mockAppendChild;
      global.document.body.removeChild = mockRemoveChild;

      const result = await baseApiService.download('/download/123', 'test.txt');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/download/123', {
        responseType: 'blob',
      });
      expect(result).toEqual(mockBlob);
    });

    test('应该正确处理网络错误', async () => {
      const networkError = new Error('Network Error');
      mockAxiosInstance.get.mockRejectedValue(networkError);

      const result = await baseApiService.get('/test-endpoint');

      expect(result).toEqual({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '网络连接失败',
          details: 'Network Error',
        },
      });
    });

    test('应该正确处理HTTP错误响应', async () => {
      const httpError = {
        response: {
          status: 404,
          data: { message: 'Not Found' },
        },
      };
      mockAxiosInstance.get.mockRejectedValue(httpError);

      const result = await baseApiService.get('/test-endpoint');

      expect(result).toEqual({
        success: false,
        error: {
          code: 404,
          message: 'Not Found',
          details: { message: 'Not Found' },
        },
      });
    });
  });

  describe('4. ArticleApiService测试', () => {
    test('应该正确创建ArticleApiService实例', () => {
      expect(articleApi).toBeDefined();
      expect(articleApi instanceof ArticleApiService).toBe(true);
    });

    test('应该正确调用文章相关API', async () => {
      const mockResponse = { data: { success: true } };
      jest.spyOn(articleApi, 'get').mockResolvedValue(mockResponse);
      jest.spyOn(articleApi, 'post').mockResolvedValue(mockResponse);
      jest.spyOn(articleApi, 'put').mockResolvedValue(mockResponse);
      jest.spyOn(articleApi, 'delete').mockResolvedValue(mockResponse);

      await articleApi.getArticles();
      expect(articleApi.get).toHaveBeenCalledWith('', {});

      await articleApi.getArticle(123);
      expect(articleApi.get).toHaveBeenCalledWith('/123');

      await articleApi.createArticle({ title: 'Test' });
      expect(articleApi.post).toHaveBeenCalledWith('', { title: 'Test' });

      await articleApi.updateArticle(123, { title: 'Updated' });
      expect(articleApi.put).toHaveBeenCalledWith('/123', { title: 'Updated' });

      await articleApi.deleteArticle(123);
      expect(articleApi.delete).toHaveBeenCalledWith('/123');

      await articleApi.publishArticle(123, ['zhihu', 'xiaohongshu']);
      expect(articleApi.post).toHaveBeenCalledWith('/123/publish', {
        platformIds: ['zhihu', 'xiaohongshu'],
      });
    });
  });

  describe('5. PlatformApiService测试', () => {
    test('应该正确创建PlatformApiService实例', () => {
      expect(platformApi).toBeDefined();
      expect(platformApi instanceof PlatformApiService).toBe(true);
    });

    test('应该正确调用平台相关API', async () => {
      const mockResponse = { data: { success: true } };
      jest.spyOn(platformApi, 'get').mockResolvedValue(mockResponse);
      jest.spyOn(platformApi, 'post').mockResolvedValue(mockResponse);
      jest.spyOn(platformApi, 'put').mockResolvedValue(mockResponse);

      await platformApi.getPlatforms();
      expect(platformApi.get).toHaveBeenCalledWith('');

      await platformApi.getAvailablePlatforms();
      expect(platformApi.get).toHaveBeenCalledWith('/available');

      await platformApi.getPlatformConfig('zhihu');
      expect(platformApi.get).toHaveBeenCalledWith('/zhihu/config');

      await platformApi.updatePlatformConfig('zhihu', { enabled: true });
      expect(platformApi.put).toHaveBeenCalledWith('/zhihu/config', { enabled: true });

      await platformApi.testPlatformConnection('zhihu');
      expect(platformApi.post).toHaveBeenCalledWith('/zhihu/test');
    });
  });

  describe('6. UserApiService测试', () => {
    test('应该正确创建UserApiService实例', () => {
      expect(userApi).toBeDefined();
      expect(userApi instanceof UserApiService).toBe(true);
    });

    test('应该正确调用用户相关API', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { token: 'test-token' }
        }
      };
      jest.spyOn(userApi, 'post').mockResolvedValue(mockResponse);
      jest.spyOn(userApi, 'get').mockResolvedValue(mockResponse);
      jest.spyOn(userApi, 'put').mockResolvedValue(mockResponse);

      await userApi.login({ username: 'test', password: 'password' });
      expect(userApi.post).toHaveBeenCalledWith('/login', {
        username: 'test',
        password: 'password',
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'test-token');

      await userApi.logout();
      expect(userApi.post).toHaveBeenCalledWith('/logout');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');

      await userApi.getUserInfo();
      expect(userApi.get).toHaveBeenCalledWith('/info');

      await userApi.updateUserInfo({ name: 'Updated Name' });
      expect(userApi.put).toHaveBeenCalledWith('/info', { name: 'Updated Name' });
    });
  });

  describe('7. FileApiService测试', () => {
    test('应该正确创建FileApiService实例', () => {
      expect(fileApi).toBeDefined();
      expect(fileApi instanceof FileApiService).toBe(true);
    });

    test('应该正确调用文件相关API', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = { data: { fileId: '123', url: 'http://example.com/file' } };
      const mockOnProgress = jest.fn();

      jest.spyOn(fileApi, 'upload').mockResolvedValue(mockResponse);
      jest.spyOn(fileApi, 'download').mockResolvedValue(mockResponse);
      jest.spyOn(fileApi, 'get').mockResolvedValue(mockResponse);
      jest.spyOn(fileApi, 'delete').mockResolvedValue(mockResponse);

      await fileApi.uploadFile(mockFile, mockOnProgress);
      expect(fileApi.upload).toHaveBeenCalledWith('/upload', expect.any(FormData), mockOnProgress);

      await fileApi.uploadImage(mockFile, mockOnProgress);
      expect(fileApi.upload).toHaveBeenCalledWith('/upload-image', expect.any(FormData), mockOnProgress);

      await fileApi.downloadFile('123', 'download.txt');
      expect(fileApi.download).toHaveBeenCalledWith('/download/123', 'download.txt');

      await fileApi.getFiles();
      expect(fileApi.get).toHaveBeenCalledWith('', {});

      await fileApi.deleteFile('123');
      expect(fileApi.delete).toHaveBeenCalledWith('/123');
    });
  });

  describe('8. SystemApiService测试', () => {
    test('应该正确创建SystemApiService实例', () => {
      expect(systemApi).toBeDefined();
      expect(systemApi instanceof SystemApiService).toBe(true);
    });

    test('应该正确调用系统相关API', async () => {
      const mockResponse = { data: { success: true } };
      jest.spyOn(systemApi, 'get').mockResolvedValue(mockResponse);

      await systemApi.getSystemInfo();
      expect(systemApi.get).toHaveBeenCalledWith('/info');

      await systemApi.getSystemStatus();
      expect(systemApi.get).toHaveBeenCalledWith('/status');

      await systemApi.checkUpdate();
      expect(systemApi.get).toHaveBeenCalledWith('/check-update');
    });
  });

  describe('9. 错误处理测试', () => {
    test('应该正确处理401错误', () => {
      const error401 = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      const { handleHttpError } = require('../../../src/renderer/services/httpService');
      handleHttpError(error401);

      expect(message.error).toHaveBeenCalledWith('身份验证失败，请重新登录');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    test('应该正确处理403错误', () => {
      const error403 = {
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        },
      };

      const { handleHttpError } = require('../../../src/renderer/services/httpService');
      handleHttpError(error403);

      expect(message.error).toHaveBeenCalledWith('权限不足，无法执行此操作');
    });

    test('应该正确处理500错误', () => {
      const error500 = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      };

      const { handleHttpError } = require('../../../src/renderer/services/httpService');
      handleHttpError(error500);

      expect(message.error).toHaveBeenCalledWith('服务器内部错误，请稍后再试');
    });

    test('应该正确处理网络错误', () => {
      const networkError = {
        request: {}, // 有请求对象但没有响应对象
      };

      const { handleHttpError } = require('../../../src/renderer/services/httpService');
      handleHttpError(networkError);

      expect(message.error).toHaveBeenCalledWith('网络连接失败，请检查网络设置');
    });
  });

  describe('10. 限流和缓存测试', () => {
    test('应该正确应用请求限流', () => {
      const rateLimitConfig = REQUEST_CONFIG.rateLimit;
      expect(rateLimitConfig.enabled).toBe(true);
      expect(rateLimitConfig.maxRequests).toBe(100);
      expect(rateLimitConfig.windowMs).toBe(60000);
    });

    test('应该正确应用缓存配置', () => {
      const cacheConfig = REQUEST_CONFIG.cache;
      expect(cacheConfig.enabled).toBe(true);
      expect(cacheConfig.ttl).toBe(300000);
    });

    test('应该正确应用重试配置', () => {
      const retryConfig = REQUEST_CONFIG.retry;
      expect(retryConfig.times).toBe(3);
      expect(retryConfig.delay).toBe(1000);
      expect(retryConfig.delayFactor).toBe(2);
    });
  });
});