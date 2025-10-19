/**
 * 简单的配置更新脚本 - 直接操作数据库文件
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function updateConfig() {
  try {
    // 查找数据库文件
    const dbPath = path.join(__dirname, 'src', 'data', 'app.db');

    if (!fs.existsSync(dbPath)) {
      console.error('数据库文件不存在:', dbPath);
      return;
    }

    console.log('找到数据库文件:', dbPath);

    // 直接使用better-sqlite3
    const db = new Database(dbPath);

    // 新的知乎配置 - 优化Canvas元素检测和增加刷新间隔
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

    // 更新配置
    const stmt = db.prepare(`
      UPDATE platforms
      SET config_schema = ?
      WHERE name = 'zhihu'
    `);

    const result = stmt.run(JSON.stringify(zhihuConfig));

    console.log(`更新完成，影响行数: ${result.changes}`);

    // 验证更新
    const verify = db.prepare(`
      SELECT name, config_schema
      FROM platforms
      WHERE name = 'zhihu'
    `).get();

    if (verify) {
      console.log('验证更新结果:');
      const config = JSON.parse(verify.config_schema);
      console.log('二维码选择器:', config.auth_config.qr_selector);
      console.log('最大尝试次数:', config.auth_config.max_attempts);
    }

    db.close();
    console.log('配置更新成功！');

  } catch (error) {
    console.error('更新配置失败:', error);
  }
}

updateConfig();