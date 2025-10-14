/**
 * T006 状态管理设置功能验证测试
 * 验证Redux store配置、slice功能和状态持久化的实现
 */

const fs = require('fs');
const path = require('path');

console.log('开始T006状态管理设置功能验证...\n');

// 1. 验证Redux store配置文件
console.log('1. 检查Redux store配置文件...');
const storeIndexPath = 'src/renderer/store/index.js';

if (fs.existsSync(storeIndexPath)) {
  console.log('✅ Redux store配置文件存在: src/renderer/store/index.js');

  const storeContent = fs.readFileSync(storeIndexPath, 'utf8');

  const storeChecks = [
    { name: 'Redux Toolkit导入', pattern: /import.*configureStore.*from.*@reduxjs\/toolkit/ },
    { name: 'redux-persist导入', pattern: /import.*persistStore.*persistReducer/ },
    { name: 'storage导入', pattern: /import.*storage.*from.*redux-persist/ },
    { name: 'combineReducers导入', pattern: /import.*combineReducers/ },
    { name: 'appSlice导入', pattern: /import.*appSlice/ },
    { name: 'articleSlice导入', pattern: /import.*articleSlice/ },
    { name: 'platformSlice导入', pattern: /import.*platformSlice/ },
    { name: '持久化配置', pattern: /persistConfig.*=/ },
    { name: 'rootReducer配置', pattern: /rootReducer.*combineReducers/ },
    { name: 'store配置', pattern: /configureStore.*{/ },
    { name: 'persistor创建', pattern: /persistStore.*store/ },
    { name: '序列化检查配置', pattern: /serializableCheck/ },
    { name: 'DevTools配置', pattern: /devTools/ }
  ];

  storeChecks.forEach(check => {
    if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(storeContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ Redux store配置文件不存在');
}

// 2. 验证slice文件
console.log('\n2. 检查slice文件结构...');
const sliceFiles = [
  {
    path: 'src/renderer/store/slices/appSlice.js',
    name: 'appSlice',
    checks: [
      { name: 'createSlice导入', pattern: /import.*createSlice/ },
      { name: 'createAsyncThunk导入', pattern: /import.*createAsyncThunk/ },
      { name: '异步thunk定义', pattern: /export.*createAsyncThunk/ },
      { name: 'initialState定义', pattern: /const initialState/ },
      { name: 'createSlice创建', pattern: /const.*Slice.*createSlice/ },
      { name: 'reducers定义', pattern: /reducers:\s*{/ },
      { name: 'extraReducers定义', pattern: /extraReducers:\s*{[\s\S]*builder/ },
      { name: 'actions导出', pattern: /export.*{[\s\S]*}/ },
      { name: 'reducer默认导出', pattern: /export default.*Slice\.reducer/ }
    ]
  },
  {
    path: 'src/renderer/store/slices/articleSlice.js',
    name: 'articleSlice',
    checks: [
      { name: 'createSlice导入', pattern: /import.*createSlice/ },
      { name: 'createAsyncThunk导入', pattern: /import.*createAsyncThunk/ },
      { name: 'HTTP服务导入', pattern: /import.*articleApi/ },
      { name: '文章相关异步thunk', pattern: /fetchArticles|createArticle|updateArticle|deleteArticle/ },
      { name: '发布相关异步thunk', pattern: /publishArticle|fetchPublishStatus|cancelPublish/ },
      { name: '文章状态管理', pattern: /currentArticle|draftArticle|editorState/ },
      { name: '分页和筛选', pattern: /filters|pagination|sorting/ },
      { name: '历史记录功能', pattern: /history|undo|redo/ },
      { name: '标签和分类', pattern: /tags|categories/ },
      { name: '发布状态管理', pattern: /publishStatus/ }
    ]
  },
  {
    path: 'src/renderer/store/slices/platformSlice.js',
    name: 'platformSlice',
    checks: [
      { name: 'createSlice导入', pattern: /import.*createSlice/ },
      { name: 'createAsyncThunk导入', pattern: /import.*createAsyncThunk/ },
      { name: '平台API导入', pattern: /import.*platformApi/ },
      { name: '平台异步thunk', pattern: /fetchPlatforms|fetchPlatformConfig|testPlatformConnection/ },
      { name: '平台配置管理', pattern: /userConfigs|platformConfigs/ },
      { name: '认证状态管理', pattern: /authStatus/ },
      { name: '平台规则定义', pattern: /platformRules/ },
      { name: '快速发布设置', pattern: /quickPublish/ },
      { name: '发布统计', pattern: /publishStats/ },
      { name: '平台验证功能', pattern: /validatePlatformConfig/ }
    ]
  }
];

sliceFiles.forEach(sliceFile => {
  if (fs.existsSync(sliceFile.path)) {
    console.log(`✅ ${sliceFile.name}文件存在: ${sliceFile.path}`);

    const sliceContent = fs.readFileSync(sliceFile.path, 'utf8');

    sliceFile.checks.forEach(check => {
      if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(sliceContent)) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ❌ ${check.name} - 未找到`);
      }
    });
  } else {
    console.log(`❌ ${sliceFile.name}文件不存在: ${sliceFile.path}`);
  }
});

// 3. 验证package.json依赖
console.log('\n3. 检查状态管理相关依赖...');
const packageJsonPath = 'package.json';

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

  console.log('✅ package.json存在');

  const stateManagementDeps = [
    { name: '@reduxjs/toolkit', dependency: '@reduxjs/toolkit' },
    { name: 'react-redux', dependency: 'react-redux' },
    { name: 'redux-persist', dependency: 'redux-persist' }
  ];

  stateManagementDeps.forEach(dep => {
    if (dependencies[dep.dependency]) {
      console.log(`  ✅ ${dep.name}: ${dependencies[dep.dependency]}`);
    } else {
      console.log(`  ❌ ${dep.name} - 依赖缺失`);
    }
  });
} else {
  console.log('❌ package.json不存在');
}

// 4. 验证组件中的状态管理使用
console.log('\n4. 检查组件中的状态管理使用...');
const appComponentPath = 'src/renderer/App.jsx';

if (fs.existsSync(appComponentPath)) {
  console.log('✅ App.jsx存在');

  const appContent = fs.readFileSync(appComponentPath, 'utf8');

  const stateManagementChecks = [
    { name: 'Redux hooks导入', pattern: /import.*useDispatch|useSelector/ },
    { name: 'store导入', pattern: /import.*store/ },
    { name: 'useDispatch使用', pattern: /useDispatch/ },
    { name: 'useSelector使用', pattern: /useSelector/ },
    { name: 'Provider使用', pattern: /Provider.*store/ }
  ];

  stateManagementChecks.forEach(check => {
    if (check.pattern && typeof check.pattern.test === 'function' && check.pattern.test(appContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ App.jsx不存在');
}

// 5. 验证T006验收标准
console.log('\n5. T006验收标准验证...');

// 验收标准1: Redux store配置 (configureStore, persist配置, middleware)
const hasReduxStore = fs.existsSync(storeIndexPath) &&
                     /configureStore/.test(fs.readFileSync(storeIndexPath, 'utf8')) &&
                     /persistStore/.test(fs.readFileSync(storeIndexPath, 'utf8')) &&
                     /middleware/.test(fs.readFileSync(storeIndexPath, 'utf8'));

console.log(`✅ 验收标准1 - Redux store配置: ${hasReduxStore ? '通过' : '失败'}`);

// 验收标准2: App状态管理 (应用状态、设置、主题、界面状态)
const appSliceContent = fs.readFileSync('src/renderer/store/slices/appSlice.js', 'utf8');
const hasAppStateManagement = /loading|initialized|error/.test(appSliceContent) &&
                            /settings|theme|language/.test(appSliceContent) &&
                            /sidebarCollapsed|currentPage|modals/.test(appSliceContent) &&
                            /createAsyncThunk.*initializeApp/.test(appSliceContent);

console.log(`✅ 验收标准2 - App状态管理: ${hasAppStateManagement ? '通过' : '失败'}`);

// 验收标准3: 文章状态管理 (文章列表、编辑状态、发布状态)
const articleSliceContent = fs.readFileSync('src/renderer/store/slices/articleSlice.js', 'utf8');
const hasArticleStateManagement = /currentArticle|draftArticle/.test(articleSliceContent) &&
                                /editorState.*content|wordCount|charCount/.test(articleSliceContent) &&
                                /fetchArticles|createArticle|updateArticle|deleteArticle/.test(articleSliceContent) &&
                                /publishArticle|fetchPublishStatus/.test(articleSliceContent) &&
                                /filters|pagination|sorting/.test(articleSliceContent);

console.log(`✅ 验收标准3 - 文章状态管理: ${hasArticleStateManagement ? '通过' : '失败'}`);

// 验收标准4: 平台状态管理 (平台配置、认证状态、发布统计)
const platformSliceContent = fs.readFileSync('src/renderer/store/slices/platformSlice.js', 'utf8');
const hasPlatformStateManagement = /userConfigs|platformConfigs/.test(platformSliceContent) &&
                                 /authStatus|platformStatus/.test(platformSliceContent) &&
                                 /fetchPlatforms|fetchPlatformConfig/.test(platformSliceContent) &&
                                 /testPlatformConnection|updatePlatformConfig/.test(platformSliceContent) &&
                                 /publishStats|platformRules/.test(platformSliceContent);

console.log(`✅ 验收标准4 - 平台状态管理: ${hasPlatformStateManagement ? '通过' : '失败'}`);

// 6. 生成测试报告
console.log('\n📊 T006功能验证总结');
console.log('=====================================');

const allChecks = [
  hasReduxStore,
  hasAppStateManagement,
  hasArticleStateManagement,
  hasPlatformStateManagement
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`验收标准通过: ${passedChecks}/${totalChecks}`);
console.log(`总体完成度: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 T006状态管理设置验证完全通过！');
  console.log('所有四个验收标准都已实现。');
} else {
  console.log('\n⚠️  T006部分功能需要完善。');
}

console.log('\n测试完成时间:', new Date().toLocaleString());

// 7. 详细功能验证
console.log('\n🔍 详细功能验证');

// 验证AppSlice详细功能
if (fs.existsSync('src/renderer/store/slices/appSlice.js')) {
  const appContent = fs.readFileSync('src/renderer/store/slices/appSlice.js', 'utf8');
  console.log('\nAppSlice功能验证:');

  const appSliceFeatures = [
    { name: '应用初始化异步thunk', pattern: /initializeApp.*createAsyncThunk/ },
    { name: '加载状态管理', pattern: /setLoading.*loading/ },
    { name: '错误状态管理', pattern: /setError.*error|clearError/ },
    { name: '设置管理', pattern: /updateSettings.*settings/ },
    { name: '主题切换', pattern: /toggleTheme.*theme/ },
    { name: '侧边栏状态', pattern: /toggleSidebar.*sidebarCollapsed/ },
    { name: '页面导航', pattern: /setCurrentPage.*currentPage/ },
    { name: '模态框管理', pattern: /openModal|closeModal.*modals/ },
    { name: '应用信息管理', pattern: /version|platform|language/ },
    { name: '持久化配置', pattern: /whitelist.*app.*platforms/ }
  ];

  appSliceFeatures.forEach(feature => {
    if (feature.pattern.test(appContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证ArticleSlice详细功能
if (fs.existsSync('src/renderer/store/slices/articleSlice.js')) {
  const articleContent = fs.readFileSync('src/renderer/store/slices/articleSlice.js', 'utf8');
  console.log('\nArticleSlice功能验证:');

  const articleSliceFeatures = [
    { name: '文章列表获取', pattern: /fetchArticles.*createAsyncThunk/ },
    { name: '文章详情获取', pattern: /fetchArticleById.*createAsyncThunk/ },
    { name: '文章创建', pattern: /createArticle.*createAsyncThunk/ },
    { name: '文章更新', pattern: /updateArticle.*createAsyncThunk/ },
    { name: '文章删除', pattern: /deleteArticle.*createAsyncThunk/ },
    { name: '文章发布', pattern: /publishArticle.*createAsyncThunk/ },
    { name: '发布状态查询', pattern: /fetchPublishStatus.*createAsyncThunk/ },
    { name: '当前文章管理', pattern: /setCurrentArticle.*currentArticle/ },
    { name: '草稿文章管理', pattern: /updateDraftArticle.*draftArticle/ },
    { name: '编辑器状态', pattern: /updateEditorContent.*editorState/ },
    { name: '字数统计', pattern: /wordCount|charCount/ },
    { name: '自动保存', pattern: /setSaved|setSaving.*autoSave/ },
    { name: '历史记录', pattern: /saveToHistory|undo|redo.*history/ },
    { name: '分页管理', pattern: /setPagination.*currentPage|pageSize/ },
    { name: '筛选功能', pattern: /setFilters.*filters.*status.*platform/ },
    { name: '排序功能', pattern: /setSorting.*sortBy|sortOrder/ },
    { name: '标签管理', pattern: /addTag|removeTag.*tags/ },
    { name: '发布状态', pattern: /updatePublishStatus.*publishStatus/ }
  ];

  articleSliceFeatures.forEach(feature => {
    if (feature.pattern.test(articleContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证PlatformSlice详细功能
if (fs.existsSync('src/renderer/store/slices/platformSlice.js')) {
  const platformContent = fs.readFileSync('src/renderer/store/slices/platformSlice.js', 'utf8');
  console.log('\nPlatformSlice功能验证:');

  const platformSliceFeatures = [
    { name: '平台列表获取', pattern: /fetchPlatforms.*createAsyncThunk/ },
    { name: '可用平台获取', pattern: /fetchAvailablePlatforms.*createAsyncThunk/ },
    { name: '平台配置获取', pattern: /fetchPlatformConfig.*createAsyncThunk/ },
    { name: '平台配置更新', pattern: /updatePlatformConfig.*createAsyncThunk/ },
    { name: '平台连接测试', pattern: /testPlatformConnection.*createAsyncThunk/ },
    { name: '用户配置管理', pattern: /updateUserConfig.*userConfigs/ },
    { name: '平台启用切换', pattern: /togglePlatform|setPlatformEnabled.*enabled/ },
    { name: '自动发布设置', pattern: /setAutoPublish.*autoPublish.*publishTime/ },
    { name: '认证状态管理', pattern: /updateAuthStatus.*authStatus/ },
    { name: '平台状态监控', pattern: /platformStatus.*connection|status/ },
    { name: '平台规则验证', pattern: /validatePlatformConfig.*platformRules/ },
    { name: '快速发布设置', pattern: /selectQuickPublishPlatform.*quickPublish/ },
    { name: '发布统计', pattern: /updatePublishStats.*publishStats/ },
    { name: '平台配置持久化', pattern: /userConfigs.*zhihu|xiaohongshu|baijia/ },
    { name: '错误处理', pattern: /clearConfigError|clearConnectionError/ }
  ];

  platformSliceFeatures.forEach(feature => {
    if (feature.pattern.test(platformContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证状态持久化详细功能
if (fs.existsSync(storeIndexPath)) {
  const storeContent = fs.readFileSync(storeIndexPath, 'utf8');
  console.log('\n状态持久化功能验证:');

  const persistFeatures = [
    { name: 'persistConfig配置', pattern: /persistConfig.*=/ },
    { name: '持久化key配置', pattern: /key:.*'root'/ },
    { name: 'storage配置', pattern: /storage.*storage/ },
    { name: 'whitelist配置', pattern: /whitelist.*\['app',\s*'platforms'\]/ },
    { name: 'persistReducer创建', pattern: /persistReducer.*persistConfig.*rootReducer/ },
    { name: 'persistor创建', pattern: /persistStore.*store/ },
    { name: '序列化检查忽略', pattern: /serializableCheck.*ignoredActions/ },
    { name: '持久化中间件集成', pattern: /reducer.*persistedReducer/ }
  ];

  persistFeatures.forEach(feature => {
    if (feature.pattern.test(storeContent)) {
      console.log(`  ✅ ${feature.name}`);
    } else {
      console.log(`  ❌ ${feature.name} - 未找到`);
    }
  });
}

// 验证异步状态管理详细功能
console.log('\n异步状态管理功能验证:');

const asyncFeatures = [
  { name: 'App Slice异步thunk', file: appSliceContent, pattern: /initializeApp.*pending|fulfilled|rejected/ },
  { name: 'Article Slice异步thunk', file: articleSliceContent, pattern: /fetchArticles.*pending|fulfilled|rejected/ },
  { name: 'Platform Slice异步thunk', file: platformSliceContent, pattern: /fetchPlatforms.*pending|fulfilled|rejected/ },
  { name: '加载状态管理', file: appSliceContent, pattern: /loading.*true.*false/ },
  { name: '错误状态管理', file: articleSliceContent, pattern: /error.*null.*message/ },
  { name: '成功状态处理', file: platformSliceContent, pattern: /fulfilled.*data.*status/ }
];

asyncFeatures.forEach(feature => {
  if (feature.pattern.test(feature.file)) {
    console.log(`  ✅ ${feature.name}`);
  } else {
    console.log(`  ❌ ${feature.name} - 未找到`);
  }
});

console.log('\n✅ T006功能验证测试完成');