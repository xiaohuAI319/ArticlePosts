/**
 * 数据库初始化脚本
 * 在应用启动时自动运行
 */

const { getDatabaseService } = require('./DatabaseService');

/**
 * 初始化数据库
 */
async function initializeDatabase() {
  try {
    console.log('开始初始化数据库...');

    const dbService = getDatabaseService();

    // 初始化数据库服务
    await dbService.initialize();

    // 获取初始化状态
    const status = dbService.getStatus();
    const stats = dbService.getStats();

    console.log('数据库初始化完成！');
    console.log('初始化状态:', status);
    console.log('数据库统计:', {
      表数量: stats.database.tables.length,
      数据库大小: `${(stats.database.size / 1024 / 1024).toFixed(2)} MB`,
      已应用迁移: stats.migrations.applied,
      待应用迁移: stats.migrations.pending
    });

    // 验证数据库完整性
    const validation = await dbService.validate();
    if (!validation.valid) {
      console.warn('数据库完整性检查发现问题:', validation.issues);
    }

    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 创建数据库备份
 */
async function createBackup() {
  try {
    const dbService = getDatabaseService();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./backups/backup-${timestamp}.db`;

    await dbService.backup(backupPath);
    console.log(`数据库备份已创建: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('创建数据库备份失败:', error);
    throw error;
  }
}

/**
 * 检查数据库状态
 */
async function checkDatabaseHealth() {
  try {
    const dbService = getDatabaseService();

    // 检查服务状态
    const status = dbService.getStatus();
    if (!status.initialized) {
      throw new Error('数据库服务未初始化');
    }

    // 检查数据库健康
    const healthCheck = dbService.getStats();

    return {
      status: 'healthy',
      service: status,
      database: healthCheck.database,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('数据库初始化失败:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  initializeDatabase,
  createBackup,
  checkDatabaseHealth
};