#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { exec } = require('child_process');

// 强制清理占用3000端口的进程
function killPortProcesses(port) {
  return new Promise((resolve) => {
    console.log(`🔧 检测到端口${port}被占用，按照规范清理进程...`);

    if (process.platform === 'win32') {
      exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`, (error, stdout, stderr) => {
        setTimeout(() => {
          exec(`netstat -ano | findstr :${port}`, (verifyError, verifyStdout) => {
            if (verifyStdout && verifyStdout.trim().length > 0) {
              console.log(`⚠️  端口${port}可能仍有进程占用，但继续尝试启动...`);
            } else {
              console.log(`✅ 端口${port}已成功释放`);
            }
            resolve();
          });
        }, 1000);
      });
    } else {
      exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || echo "无进程需要清理"`, (error, stdout, stderr) => {
        setTimeout(() => {
          exec(`lsof -i:${port}`, (verifyError, verifyStdout) => {
            if (verifyStdout && verifyStdout.trim().length > 0) {
              console.log(`⚠️  端口${port}可能仍有进程占用，但继续尝试启动...`);
            } else {
              console.log(`✅ 端口${port}已成功释放`);
            }
            resolve();
          });
        }, 1000);
      });
    }
  });
}

async function main() {
  try {
    console.log('网页版启动器');
    console.log('============');

    const PORT = 3000;

    // 清理端口
    await killPortProcesses(PORT);

    // 创建Express应用
    const app = express();

    // 处理favicon.ico请求
    app.get('/favicon.ico', (req, res) => {
      res.status(204).end(); // 返回空内容，避免404
    });

    // 默认路由返回editor.html（在静态文件中间件之前）
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../web/editor.html'));
    });

    // 静态文件服务
    app.use(express.static(path.join(__dirname, '../public')));
    app.use('/tinymce', express.static(path.join(__dirname, '../node_modules/tinymce')));

    // 启动服务器
    const server = app.listen(PORT, () => {
      console.log(`✅ 网页版服务器启动成功！`);
      console.log(`📝 访问地址: http://localhost:${PORT}`);
      console.log(`🎯 简单的标题+内容+一键发布到知乎页面已就绪`);
    });

    // 优雅关闭
    process.on('SIGINT', () => {
      console.log('\n正在关闭服务器...');
      server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main();