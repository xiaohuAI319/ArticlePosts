/**
 * 测试执行脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 开始执行TDD测试...\n');

// 颜色输出函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`
};

function runCommand(command, description) {
  try {
    console.log(`${colors.blue('▶')} ${description}...`);
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`${colors.green('✅')} ${description} 完成`);
    return result;
  } catch (error) {
    console.error(`${colors.red('❌')} ${description} 失败:`);
    console.error(error.stdout || error.stderr);
    throw error;
  }
}

function checkTestEnvironment() {
  console.log(`${colors.cyan('🔍 检查测试环境...')}`);

  // 检查必要文件
  const requiredFiles = [
    'jest.config.json',
    'tests/setup.js',
    'tests/main/database/Database.test.js',
    'tests/main/database/models/Article.test.js',
    'tests/main/database/models/Platform.test.js',
    'tests/main/database/DatabaseService.test.js',
    'tests/main/index.test.js',
    'tests/renderer/store/store.test.js'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`缺少测试文件: ${file}`);
    }
  }

  console.log(`${colors.green('✅')} 测试环境检查通过\n`);
}

async function runTests() {
  try {
    // 检查测试环境
    checkTestEnvironment();

    console.log(`${colors.yellow('🧪 开始T001和T002测试套件...\n')}`);

    // 运行数据库相关测试
    console.log(`${colors.cyan('📊 数据库功能测试')}`);
    runCommand('npm test -- tests/main/database/Database.test.js', '数据库连接管理测试');

    runCommand('npm test -- tests/main/database/models/Article.test.js', '文章模型测试');

    runCommand('npm test -- tests/main/database/models/Platform.test.js', '平台模型测试');

    runCommand('npm test -- tests/main/database/DatabaseService.test.js', '数据库服务管理测试');

    // 运行主进程测试
    console.log(`\n${colors.cyan('⚙️  主进程功能测试')}`);
    runCommand('npm test -- tests/main/index.test.js', '主进程IPC通信测试');

    // 运行渲染进程测试
    console.log(`\n${colors.cyan('🎨 渲染进程状态管理测试')}`);
    runCommand('npm test -- tests/renderer/store/store.test.js', 'Redux Store测试');

    // 运行所有测试并生成覆盖率报告
    console.log(`\n${colors.cyan('📈 生成测试覆盖率报告')}`);
    runCommand('npm test -- --coverage --coverageReporters=text-lcov', '测试覆盖率分析');

    console.log(`\n${colors.green('🎉 所有TDD测试通过！')}`);
    console.log(`${colors.blue('📊 测试统计:')}`);
    console.log(`   - 数据库测试: 4个测试文件`);
    console.log(`   - 主进程测试: 1个测试文件`);
    console.log(`   - 渲染进程测试: 1个测试文件`);
    console.log(`   - 总计: 6个测试文件，涵盖T001和T002所有核心功能`);

    console.log(`\n${colors.yellow('💡 TDD测试总结:')}`);
    console.log(`   ✅ 数据库架构完整性和正确性`);
    console.log(`   ✅ 数据模型CRUD操作`);
    console.log(`   ✅ IPC通信机制`);
    console.log(`   ✅ Redux状态管理`);
    console.log(`   ✅ 错误处理和边界情况`);
    console.log(`   ✅ 性能和并发测试`);

    console.log(`\n${colors.cyan('📝 测试报告位置:')}`);
    console.log(`   - 详细报告: coverage/lcov-report/index.html`);
    console.log(`   - 覆盖率数据: coverage/lcov.info`);

    return true;

  } catch (error) {
    console.error(`\n${colors.red('💥 TDD测试失败:')} ${error.message}`);
    console.error(`${colors.yellow('🔧 请检查错误信息并修复后重新运行测试')}`);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行异常:', error);
      process.exit(1);
    });
}

module.exports = { runTests, checkTestEnvironment };