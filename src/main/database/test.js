/**
 * 数据库功能测试脚本
 */

const { getDatabaseService } = require('./DatabaseService');

async function testDatabase() {
  console.log('开始数据库功能测试...\n');

  const dbService = getDatabaseService();

  try {
    // 1. 初始化数据库
    console.log('1. 初始化数据库...');
    await dbService.initialize();
    console.log('✅ 数据库初始化成功\n');

    // 2. 测试文章模型
    console.log('2. 测试文章模型...');
    const articleModel = dbService.getModel('article');

    // 创建测试文章
    const testArticle = await articleModel.create({
      title: '测试文章',
      content: '{"ops":[{"insert":"这是一个测试文章\\n"}]}',
      html_content: '<p>这是一个测试文章</p>',
      tags: ['测试', '数据库'],
      category: '技术',
      status: 0
    });
    console.log(`✅ 创建文章成功，ID: ${testArticle.id}`);

    // 获取文章
    const foundArticle = await articleModel.findById(testArticle.id);
    console.log(`✅ 获取文章成功，标题: ${foundArticle.title}`);

    // 更新文章
    await articleModel.update(testArticle.id, {
      title: '更新后的测试文章'
    });
    console.log('✅ 更新文章成功');

    // 删除文章
    await articleModel.delete(testArticle.id);
    console.log('✅ 删除文章成功\n');

    // 3. 测试平台模型
    console.log('3. 测试平台模型...');
    const platformModel = dbService.getModel('platform');

    // 获取所有平台
    const platforms = await platformModel.findAll();
    console.log(`✅ 获取平台列表成功，共 ${platforms.length} 个平台`);

    // 获取可用平台
    const availablePlatforms = await platformModel.getAvailable();
    console.log(`✅ 获取可用平台成功，共 ${availablePlatforms.length} 个可用平台\n`);

    // 4. 测试数据库统计
    console.log('4. 测试数据库统计...');
    const stats = dbService.getStats();
    console.log('✅ 数据库统计:');
    console.log(`   - 表数量: ${stats.database.tables.length}`);
    console.log(`   - 数据库大小: ${(stats.database.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - 文章总数: ${stats.articles.total}`);
    console.log(`   - 平台总数: ${stats.platforms.length}\n`);

    // 5. 测试数据验证
    console.log('5. 测试数据验证...');
    const validation = await dbService.validate();
    if (validation.valid) {
      console.log('✅ 数据库完整性验证通过');
    } else {
      console.log('⚠️  数据库完整性验证发现问题:', validation.issues);
    }

    console.log('\n🎉 所有数据库功能测试通过！');

    return true;
  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    return false;
  } finally {
    await dbService.close();
  }
}

// 性能测试
async function performanceTest() {
  console.log('\n开始数据库性能测试...\n');

  const dbService = getDatabaseService();

  try {
    await dbService.initialize();
    const articleModel = dbService.getModel('article');

    // 批量创建文章测试
    console.log('批量创建1000篇文章...');
    const startTime = Date.now();

    const articles = [];
    for (let i = 0; i < 1000; i++) {
      articles.push({
        title: `性能测试文章 ${i + 1}`,
        content: `{"ops":[{"insert":"这是第 ${i + 1} 篇性能测试文章的内容\\n"}]}`,
        html_content: `<p>这是第 ${i + 1} 篇性能测试文章的内容</p>`,
        tags: [`测试${i % 10}`],
        category: '性能测试',
        status: 0
      });
    }

    await articleModel.batch(articles.map(article => ({ type: 'create', data: article })));
    const createTime = Date.now() - startTime;
    console.log(`✅ 批量创建完成，耗时: ${createTime}ms`);

    // 查询性能测试
    console.log('查询性能测试...');
    const queryStart = Date.now();
    const allArticles = await articleModel.findAll({ limit: 100 });
    const queryTime = Date.now() - queryStart;
    console.log(`✅ 查询100篇文章，耗时: ${queryTime}ms`);

    // 删除测试数据
    console.log('清理测试数据...');
    const deleteStart = Date.now();
    await dbService.cleanup({ articleRetentionDays: 0 });
    const deleteTime = Date.now() - deleteStart;
    console.log(`✅ 清理完成，耗时: ${deleteTime}ms`);

    console.log('\n🎉 性能测试完成！');

  } catch (error) {
    console.error('❌ 性能测试失败:', error);
  } finally {
    await dbService.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    const testResult = await testDatabase();
    if (testResult) {
      await performanceTest();
    }
    process.exit(0);
  })();
}

module.exports = {
  testDatabase,
  performanceTest
};