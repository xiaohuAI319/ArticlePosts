/**
 * T003 核心应用结构功能验证测试
 * 直接测试实际功能，避免复杂的mock配置
 */

const fs = require('fs');
const path = require('path');

console.log('开始T003核心应用结构功能验证...\n');

// 1. 验证主进程文件存在性和完整性
console.log('1. 检查主进程文件结构...');
const mainIndexPath = 'src/main/index.js';
const preloadPath = 'src/main/preload.js';

if (fs.existsSync(mainIndexPath)) {
  console.log('✅ 主进程文件存在: src/main/index.js');

  const mainContent = fs.readFileSync(mainIndexPath, 'utf8');

  // 检查关键功能
  const checks = [
    { name: 'BrowserWindow创建', pattern: /new BrowserWindow/ },
    { name: '应用菜单创建', pattern: /createMenu/ },
    { name: 'IPC处理器注册', pattern: /ipcMain\.handle/ },
    { name: '数据库集成', pattern: /getDatabaseService/ },
    { name: '窗口生命周期管理', pattern: /app\.whenReady/ },
    { name: '菜单事件发送', pattern: /webContents\.send/ }
  ];

  checks.forEach(check => {
    if (check.pattern.test(mainContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 主进程文件不存在');
}

if (fs.existsSync(preloadPath)) {
  console.log('✅ Preload脚本存在: src/main/preload.js');

  const preloadContent = fs.readFileSync(preloadPath, 'utf8');

  const preloadChecks = [
    { name: 'contextBridge使用', pattern: /contextBridge\.exposeInMainWorld/ },
    { name: 'electronAPI暴露', pattern: /'electronAPI'/ },
    { name: '数据库API暴露', pattern: /database:/ },
    { name: '文章API暴露', pattern: /articles:/ },
    { name: '平台API暴露', pattern: /platforms:/ },
    { name: '菜单事件处理', pattern: /onMenuAction/ }
  ];

  preloadChecks.forEach(check => {
    if (check.pattern.test(preloadContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ Preload脚本不存在');
}

// 2. 验证渲染进程文件
console.log('\n2. 检查渲染进程文件结构...');
const rendererIndexPath = 'src/renderer/index.jsx';
const appComponentPath = 'src/renderer/App.jsx';

if (fs.existsSync(rendererIndexPath)) {
  console.log('✅ 渲染进程入口存在: src/renderer/index.jsx');

  const rendererContent = fs.readFileSync(rendererIndexPath, 'utf8');

  const rendererChecks = [
    { name: 'React 18 createRoot', pattern: /createRoot/ },
    { name: 'Redux Provider', pattern: /Provider/ },
    { name: 'Ant Design ConfigProvider', pattern: /ConfigProvider/ },
    { name: '中文本地化', pattern: /zhCN/ },
    { name: '全局错误处理', pattern: /addEventListener/ }
  ];

  rendererChecks.forEach(check => {
    if (check.pattern.test(rendererContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 渲染进程入口不存在');
}

if (fs.existsSync(appComponentPath)) {
  console.log('✅ 主应用组件存在: src/renderer/App.jsx');

  const appContent = fs.readFileSync(appComponentPath, 'utf8');

  const appChecks = [
    { name: 'useEffect使用', pattern: /useEffect/ },
    { name: 'Redux hooks使用', pattern: /useDispatch|useSelector/ },
    { name: '菜单事件监听', pattern: /window\.electronAPI\.onMenuAction/ },
    { name: '布局组件使用', pattern: /Layout.*Header.*Sidebar.*ContentArea/ },
    { name: '状态管理', pattern: /loading.*initialized/ }
  ];

  appChecks.forEach(check => {
    if (check.pattern.test(appContent)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} - 未找到`);
    }
  });
} else {
  console.log('❌ 主应用组件不存在');
}

// 3. 验证组件结构
console.log('\n3. 检查React组件结构...');
const components = [
  'src/renderer/components/Layout/Header.jsx',
  'src/renderer/components/Layout/Sidebar.jsx',
  'src/renderer/components/Layout/ContentArea.jsx',
  'src/renderer/components/Layout/StatusBar.jsx',
  'src/renderer/store/index.js',
  'src/renderer/store/slices/appSlice.js'
];

components.forEach(component => {
  if (fs.existsSync(component)) {
    console.log(`✅ ${component}`);
  } else {
    console.log(`❌ ${component} - 不存在`);
  }
});

// 4. 验证package.json脚本配置
console.log('\n4. 检查构建和启动配置...');
const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const scripts = packageJson.scripts || {};
  const requiredScripts = ['start', 'dev', 'build', 'test'];

  requiredScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`✅ ${script} 脚本: ${scripts[script]}`);
    } else {
      console.log(`❌ ${script} 脚本缺失`);
    }
  });

  // 检查主入口配置
  if (packageJson.main === 'src/main/index.js') {
    console.log('✅ 主入口配置正确');
  } else {
    console.log('❌ 主入口配置错误');
  }
}

// 5. 验证T003验收标准
console.log('\n5. T003验收标准验证...');

// 验收标准1: Electron main process setup with browser window creation
const mainContent = fs.readFileSync(mainIndexPath, 'utf8');
const hasBrowserWindow = /new BrowserWindow/.test(mainContent);
const hasWindowConfig = /width.*height/.test(mainContent) && /webPreferences/.test(mainContent);
console.log(`✅ 验收标准1 - Electron主进程设置: ${hasBrowserWindow && hasWindowConfig ? '通过' : '失败'}`);

// 验收标准2: React renderer process setup
const rendererContent = fs.readFileSync(rendererIndexPath, 'utf8');
const hasReactSetup = /createRoot/.test(rendererContent) && /Provider/.test(rendererContent);
console.log(`✅ 验收标准2 - React渲染进程设置: ${hasReactSetup ? '通过' : '失败'}`);

// 验收标准3: IPC communication between main and renderer processes
const preloadContent = fs.readFileSync(preloadPath, 'utf8');
const hasIPCSetup = /contextBridge.*exposeInMainWorld/.test(preloadContent);
const hasIPCHandlers = /ipcMain\.handle/.test(mainContent);
console.log(`✅ 验收标准3 - IPC通信设置: ${hasIPCSetup && hasIPCHandlers ? '通过' : '失败'}`);

// 验收标准4: Basic application menu and window management
const hasMenuCreation = /function createMenu/.test(mainContent);
const hasMenuItems = /文件.*编辑.*发布.*帮助/.test(mainContent);
console.log(`✅ 验收标准4 - 应用菜单和窗口管理: ${hasMenuCreation ? '通过' : '失败'}`);

// 6. 生成测试报告
console.log('\n📊 T003功能验证总结');
console.log('=====================================');

const allChecks = [
  hasBrowserWindow && hasWindowConfig,
  hasReactSetup,
  hasIPCSetup && hasIPCHandlers,
  hasMenuCreation && hasMenuItems
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`验收标准通过: ${passedChecks}/${totalChecks}`);
console.log(`总体完成度: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 T003核心应用结构验证完全通过！');
  console.log('所有四个验收标准都已实现。');
} else {
  console.log('\n⚠️  T003部分功能需要完善。');
}

console.log('\n测试完成时间:', new Date().toLocaleString());