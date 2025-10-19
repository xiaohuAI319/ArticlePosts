/**
 * 更新知乎平台配置脚本
 */

const { getDatabaseService } = require('./src/main/database/DatabaseService');

async function updateZhihuConfig() {
  try {
    console.log('开始更新知乎平台配置...');

    const dbService = getDatabaseService();
    await dbService.initialize();
    const db = dbService.db;

    const zhihuConfig = {
      auth_method: 'qr_code',
      auth_config: {
        qr_selector: 'canvas, .sign-in-qrcode img, .QRCode img, img[alt*="二维码"], .qrcode img, img[src*="qr"], canvas[id*="qr"], .yidun_smsbox-qrcode--img, [class*="qr"] canvas, [class*="QR"] canvas',
        max_attempts: 120,
        refresh_interval: 5000,
        login_success_indicators: [
          '.AppHeader-profile',
          '.ProfileHeader-name',
          '[data-za-detail-view-element_name="User"]',
          '.ContentItem-title'
        ]
      }
    };

    const result = db.run(
      `UPDATE platforms SET config_schema = ? WHERE name = 'zhihu'`,
      [JSON.stringify(zhihuConfig)]
    );

    console.log('知乎平台配置更新完成');
    console.log(`更新行数: ${result.changes}`);

    // 验证更新
    const platform = db.get(
      `SELECT name, config_schema FROM platforms WHERE name = 'zhihu'`
    );

    if (platform) {
      console.log('验证更新结果:');
      console.log('平台名称:', platform.name);
      console.log('配置:', JSON.stringify(JSON.parse(platform.config_schema), null, 2));
    }

    await dbService.close();

  } catch (error) {
    console.error('更新知乎配置失败:', error);
  }
}

updateZhihuConfig();