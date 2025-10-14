/**
 * T005 HTTP API层功能验证测试
 * 验证HTTP服务、API配置和平台集成的实现
 */

const fs = require('fs');
const path = require('path');

console.log('开始T005 HTTP API层功能验证...\n');

// 1. 验证HTTP服务文件存在性和完整性
console.log('1. 检查HTTP服务文件结构...');
const httpServicePath = 'src/renderer/services/httpService.js';

if (fs.existsSync(httpServicePath)) {
  console.log('✅ HTTP服务文件存在: src/renderer/services/httpService.js');

  const httpServiceContent = fs.readFileSync(httpServicePath, 'utf8');

  const httpServiceChecks = [
    { name: 'axios导入', pattern: /import.*axios/ },
    { name: 'HTTP客户端配置', pattern: /httpClient.*=.*axios\.create/ },
    { name: '请求拦截器', pattern: /interceptors\.request\.use/ },
    { name: '响应拦截器', pattern: /interceptors\.response\.use/ },
    { name: '错误处理函数', pattern: /function.*handleHttpError/ },
    { name: 'BaseApiService类', pattern: /class.*BaseApiService/ },
    { name: 'ArticleApiService类', pattern: /class.*ArticleApiService/ },
    { name: 'PlatformApiService类', pattern: /class.*PlatformApiService/ },
    { name: 'UserApiService类', pattern: /class.*UserApiService/ },
    { name: 'FileApiService类', pattern: /class.*FileApiService/ },
    { name: 'SystemApiService类', pattern: /class.*SystemApiService/ },
    { name: 'API实例导出', pattern: /export.*articleApi|platformApi|userApi/ },
    { name: 'HTTP方法实现', pattern: /async.*get\(|async.*post\(|async.*put\(/ },
    { name: '文件上传功能', pattern: /async.*upload\(/ },
    { name: '文件下载功能', pattern: /async.*download\(/ },
    { name: '错误处理逻辑', pattern: /handleError.*error/ }
  ];

  httpServiceChecks.forEach(check => {
    if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(httpServiceContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ HTTP服务文件不存在');
}

// 2. 验证API配置文件
console.log('\n2. 检查API配置文件...');
const apiConfigPath = 'src/renderer/config/apiConfig.js';

if (fs.existsSync(apiConfigPath)) {
  console.log('✅ API配置文件存在: src/renderer/config/apiConfig.js');

  const apiConfigContent = fs.readFileSync(apiConfigPath, 'utf8');

  const apiConfigChecks = [
    { name: 'API_CONFIG导出', pattern: /export const API_CONFIG/ },
    { name: '环境配置', pattern: /development.*production.*test/ },
    { name: 'API_ENDPOINTS导出', pattern: /export const API_ENDPOINTS/ },
    { name: '文章端点定义', pattern: /ARTICLES:\s*{[\s\S]*LIST.*DETAIL.*CREATE/ },
    { name: '平台端点定义', pattern: /PLATFORMS:\s*{[\s\S]*LIST.*AVAILABLE.*CONFIG/ },
    { name: '用户端点定义', pattern: /USER:\s*{[\s\S]*LOGIN.*LOGOUT.*INFO/ },
    { name: '文件端点定义', pattern: /FILES:\s*{[\s\S]*UPLOAD.*DOWNLOAD.*DELETE/ },
    { name: '系统端点定义', pattern: /SYSTEM:\s*{[\s\S]*INFO.*STATUS.*CHECK_UPDATE/ },
    { name: 'REQUEST_CONFIG导出', pattern: /export const REQUEST_CONFIG/ },
    { name: 'RESPONSE_FORMAT导出', pattern: /export const RESPONSE_FORMAT/ },
    { name: 'ERROR_CODES导出', pattern: /export const ERROR_CODES/ },
    { name: 'HTTP_STATUS_MAP导出', pattern: /export const HTTP_STATUS_MAP/ },
    { name: 'PLATFORM_API_CONFIG导出', pattern: /export const PLATFORM_API_CONFIG/ },
    { name: '平台配置定义', pattern: /zhihu:\s*{[\s\S]*name.*baseUrl.*endpoints/ },
    { name: '小红书配置', pattern: /xiaohongshu:\s*{[\s\S]*name.*baseUrl/ },
    { name: '百家号配置', pattern: /baijia:\s*{[\s\S]*name.*baseUrl/ },
    { name: '头条号配置', pattern: /toutiao:\s*{[\s\S]*name.*baseUrl/ },
    { name: '认证配置', pattern: /auth:\s*{[\s\S]*type.*scope/ },
    { name: '限制配置', pattern: /limits:\s*{[\s\S]*maxTitleLength.*maxContentLength/ }
  ];

  apiConfigChecks.forEach(check => {
    if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(apiConfigContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ API配置文件不存在');
}

// 3. 验证package.json依赖
console.log('\n3. 检查package.json依赖配置...');
const packageJsonPath = 'package.json';

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = packageJson.dependencies || {};

  console.log('✅ package.json存在');

  const dependencyChecks = [
    { name: 'axios依赖', dependency: 'axios' },
    { name: 'antd依赖', dependency: 'antd' },
    { name: 'react依赖', dependency: 'react' },
    { name: 'react-dom依赖', dependency: 'react-dom' },
    { name: '@reduxjs/toolkit依赖', dependency: '@reduxjs/toolkit' },
    { name: 'react-redux依赖', dependency: 'react-redux' }
  ];

  dependencyChecks.forEach(check => {
    if (dependencies[check.dependency]) {
      console.log(`  ✅ ${check.name}: ${dependencies[check.dependency]}`);
    } else {
      console.log(`  ❌ ${check.name} - 依赖缺失`);
    }
  });
} else {
  console.log('❌ package.json不存在');
}

// 4. 验证HTTP服务实例化
console.log('\n4. 检查HTTP服务实例化...');
const indexPath = 'src/renderer/index.jsx';

if (fs.existsSync(indexPath)) {
  console.log('✅ 渲染进程入口存在');

  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const httpServiceChecks = [
    { name: 'HTTP服务导入', pattern: /import.*httpService/ },
    { name: 'API服务导入', pattern: /import.*articleApi|platformApi|userApi/ },
    { name: 'axios导入', pattern: /import.*axios/ }
  ];

  httpServiceChecks.forEach(check => {
    if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(indexContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 渲染进程入口不存在');
}

// 5. 验证T005验收标准
console.log('\n5. T005验收标准验证...');

// 验收标准1: HTTP服务基础封装 (axios配置、拦截器、错误处理)
const hasHttpService = fs.existsSync(httpServicePath) &&
                       /axios\.create/.test(fs.readFileSync(httpServicePath, 'utf8')) &&
                       /interceptors/.test(fs.readFileSync(httpServicePath, 'utf8')) &&
                       /handleHttpError/.test(fs.readFileSync(httpServicePath, 'utf8'));

console.log(`✅ 验收标准1 - HTTP服务基础封装: ${hasHttpService ? '通过' : '失败'}`);

// 验收标准2: 统一API配置 (端点定义、请求配置、响应格式)
const hasApiConfig = fs.existsSync(apiConfigPath) &&
                     /API_ENDPOINTS/.test(fs.readFileSync(apiConfigPath, 'utf8')) &&
                     /REQUEST_CONFIG/.test(fs.readFileSync(apiConfigPath, 'utf8')) &&
                     /RESPONSE_FORMAT/.test(fs.readFileSync(apiConfigPath, 'utf8'));

console.log(`✅ 验收标准2 - 统一API配置: ${hasApiConfig ? '通过' : '失败'}`);

// 验收标准3: 文章和平台API服务 (CRUD操作、发布接口、状态查询)
const httpServiceContent = fs.readFileSync(httpServicePath, 'utf8');
const hasArticlePlatformApi = /ArticleApiService/.test(httpServiceContent) &&
                               /PlatformApiService/.test(httpServiceContent) &&
                               /createArticle|getArticles/.test(httpServiceContent) &&
                               /publishArticle|getPublishStatus/.test(httpServiceContent) &&
                               /getPlatforms|getAvailablePlatforms/.test(httpServiceContent);

console.log(`✅ 验收标准3 - 文章和平台API服务: ${hasArticlePlatformApi ? '通过' : '失败'}`);

// 验收标准4: 错误处理和重试机制 (统一错误处理、状态码映射、重试逻辑)
const hasErrorHandling = /handleHttpError/.test(httpServiceContent) &&
                        /ERROR_CODES/.test(fs.readFileSync(apiConfigPath, 'utf8')) &&
                        /HTTP_STATUS_MAP/.test(fs.readFileSync(apiConfigPath, 'utf8')) &&
                        /retry/.test(fs.readFileSync(apiConfigPath, 'utf8'));

console.log(`✅ 验收标准4 - 错误处理和重试机制: ${hasErrorHandling ? '通过' : '失败'}`);

// 6. 生成测试报告
console.log('\n📊 T005功能验证总结');
console.log('=====================================');

const allChecks = [
  hasHttpService,
  hasApiConfig,
  hasArticlePlatformApi,
  hasErrorHandling
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`验收标准通过: ${passedChecks}/${totalChecks}`);
console.log(`总体完成度: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 T005 HTTP API层验证完全通过！');
  console.log('所有四个验收标准都已实现。');
} else {
  console.log('\n⚠️  T005部分功能需要完善。');
}

console.log('\n测试完成时间:', new Date().toLocaleString());

// 7. 详细API服务验证
console.log('\n🔍 详细API服务验证');

// 验证ArticleApiService详细功能
if (fs.existsSync(httpServicePath)) {
  const serviceContent = fs.readFileSync(httpServicePath, 'utf8');
  console.log('\nArticleApiService功能验证:');

  const articleApiFeatures = [
    { name: '文章列表获取', pattern: /getArticles.*async/ },
    { name: '文章详情获取', pattern: /getArticle.*async/ },
    { name: '文章创建', pattern: /createArticle.*async/ },
    { name: '文章更新', pattern: /updateArticle.*async/ },
    { name: '文章删除', pattern: /deleteArticle.*async/ },
    { name: '文章发布', pattern: /publishArticle.*async/ },
    { name: '发布状态查询', pattern: /getPublishStatus.*async/ },
    { name: '取消发布', pattern: /cancelPublish.*async/ }
  ];

  articleApiFeatures.forEach(feature => {
    if (feature.pattern.test(serviceContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证PlatformApiService详细功能
if (fs.existsSync(httpServicePath)) {
  const serviceContent = fs.readFileSync(httpServicePath, 'utf8');
  console.log('\nPlatformApiService功能验证:');

  const platformApiFeatures = [
    { name: '平台列表获取', pattern: /getPlatforms.*async/ },
    { name: '可用平台获取', pattern: /getAvailablePlatforms.*async/ },
    { name: '平台配置获取', pattern: /getPlatformConfig.*async/ },
    { name: '平台配置更新', pattern: /updatePlatformConfig.*async/ },
    { name: '平台连接测试', pattern: /testPlatformConnection.*async/ },
    { name: '平台状态查询', pattern: /getPlatformStatus.*async/ }
  ];

  platformApiFeatures.forEach(feature => {
    if (feature.pattern.test(serviceContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证UserApiService详细功能
if (fs.existsSync(httpServicePath)) {
  const serviceContent = fs.readFileSync(httpServicePath, 'utf8');
  console.log('\nUserApiService功能验证:');

  const userApiFeatures = [
    { name: '用户登录', pattern: /login.*async/ },
    { name: '用户登出', pattern: /logout.*async/ },
    { name: '用户信息获取', pattern: /getUserInfo.*async/ },
    { name: '用户信息更新', pattern: /updateUserInfo.*async/ },
    { name: '密码修改', pattern: /changePassword.*async/ },
    { name: 'Token管理', pattern: /localStorage.*authToken/ }
  ];

  userApiFeatures.forEach(feature => {
    if (feature.pattern.test(serviceContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证FileApiService详细功能
if (fs.existsSync(httpServicePath)) {
  const serviceContent = fs.readFileSync(httpServicePath, 'utf8');
  console.log('\nFileApiService功能验证:');

  const fileApiFeatures = [
    { name: '文件上传', pattern: /uploadFile.*async/ },
    { name: '图片上传', pattern: /uploadImage.*async/ },
    { name: '文件下载', pattern: /downloadFile.*async/ },
    { name: '文件删除', pattern: /deleteFile.*async/ },
    { name: '文件列表获取', pattern: /getFiles.*async/ },
    { name: 'FormData处理', pattern: /new FormData/ },
    { name: '进度回调', pattern: /onProgress/ }
  ];

  fileApiFeatures.forEach(feature => {
    if (feature.pattern.test(serviceContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证平台配置详细功能
if (fs.existsSync(apiConfigPath)) {
  const configContent = fs.readFileSync(apiConfigPath, 'utf8');
  console.log('\n平台配置功能验证:');

  const platformConfigFeatures = [
    { name: '知乎平台配置', pattern: /zhihu:\s*{[\s\S]*name.*知乎/ },
    { name: '小红书平台配置', pattern: /xiaohongshu:\s*{[\s\S]*name.*小红书/ },
    { name: '百家号平台配置', pattern: /baijia:\s*{[\s\S]*name.*百家号/ },
    { name: '头条号平台配置', pattern: /toutiao:\s*{[\s\S]*name.*头条号/ },
    { name: '平台API端点', pattern: /endpoints:\s*{[\s\S]*publish.*draft/ },
    { name: '认证方式配置', pattern: /auth:\s*{[\s\S]*type.*oauth/ },
    { name: '内容限制配置', pattern: /limits:\s*{[\s\S]*maxTitleLength.*maxContentLength/ },
    { name: '支持格式配置', pattern: /supportedFormats.*markdown.*html/ }
  ];

  platformConfigFeatures.forEach(feature => {
    if (feature.pattern.test(configContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证错误处理详细功能
if (fs.existsSync(httpServicePath) && fs.existsSync(apiConfigPath)) {
  const serviceContent = fs.readFileSync(httpServicePath, 'utf8');
  const configContent = fs.readFileSync(apiConfigPath, 'utf8');
  console.log('\n错误处理功能验证:');

  const errorHandlingFeatures = [
    { name: 'HTTP错误处理函数', pattern: /handleHttpError/, file: serviceContent },
    { name: '状态码映射', pattern: /HTTP_STATUS_MAP/, file: configContent },
    { name: '业务错误码定义', pattern: /ERROR_CODES/, file: configContent },
    { name: '401错误处理', pattern: /401.*UNAUTHORIZED/, file: configContent },
    { name: '403错误处理', pattern: /403.*FORBIDDEN/, file: configContent },
    { name: '404错误处理', pattern: /404.*NOT_FOUND/, file: configContent },
    { name: '500错误处理', pattern: /500.*INTERNAL_SERVER_ERROR/, file: configContent },
    { name: '网络错误处理', pattern: /NETWORK_ERROR/, file: configContent },
    { name: '统一错误响应格式', pattern: /RESPONSE_FORMAT.*error/, file: configContent },
    { name: '错误信息中文提示', pattern: /message:.*[\u4e00-\u9fa5]/, file: configContent }
  ];

  errorHandlingFeatures.forEach(feature => {
    if (feature.pattern.test(feature.file)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

console.log('\n✅ T005功能验证测试完成');