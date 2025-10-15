#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 检查端口是否有服务在运行
function checkPortExists(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      // 只要能连接就认为服务存在，不管状态码
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// 检查是否有webpack-dev-server进程在运行
function checkWebpackProcess() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows系统检查
      const { exec } = require('child_process');
      exec('tasklist /fi "imagename eq node.exe" /fo csv | findstr webpack-dev-server', (error, stdout) => {
        resolve(!error && stdout.includes('webpack-dev-server'));
      });
    } else {
      // Linux/Mac系统检查
      const { exec } = require('child_process');
      exec('ps aux | grep webpack-dev-server | grep -v grep', (error, stdout) => {
        resolve(!error && stdout.length > 0);
      });
    }
  });
}

// 强制清理占用3000端口的进程（遵循guifan.md规范）
function killPortProcesses(port) {
  return new Promise((resolve) => {
    console.log(`🔧 检测到端口${port}被占用，按照规范清理进程...`);

    if (process.platform === 'win32') {
      // Windows系统：使用guifan.md中规范的PowerShell命令
      const { exec } = require('child_process');
      console.log(`📝 执行PowerShell命令: Get-NetTCPConnection -LocalPort ${port} | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`);

      exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`, (error, stdout, stderr) => {
        // 验证端口是否已释放
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
      // Linux/Mac系统
      const { exec } = require('child_process');
      console.log(`📝 执行Linux/Mac命令: lsof -ti:${port} | xargs kill -9`);

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

// 启动webpack-dev-server
function startWebpackServer() {
  console.log('[1] 启动webpack-dev-server...');

  const webpackProcess = spawn('npm', ['run', 'dev:renderer'], {
    stdio: 'inherit',
    shell: true
  });

  webpackProcess.on('error', (error) => {
    console.error('[1] webpack-dev-server启动失败:', error);
    process.exit(1);
  });

  webpackProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`[1] webpack-dev-server进程退出，代码: ${code}`);
      process.exit(1);
    }
  });

  return webpackProcess;
}

// 启动Electron主进程
function startElectron() {
  console.log('[2] 启动Electron主进程...');

  const electronProcess = spawn('npm', ['run', 'dev:main'], {
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('error', (error) => {
    console.error('[2] Electron启动失败:', error);
    process.exit(1);
  });

  electronProcess.on('close', (code) => {
    console.log(`[2] Electron进程退出，代码: ${code}`);
    process.exit(code);
  });

  return electronProcess;
}

// 主函数
async function main() {
  try {
    console.log('智能开发环境启动器');
    console.log('==================');

    const PORT = 3000;

    // 检查3000端口是否已有服务
    console.log(`检查端口${PORT}是否已有服务...`);
    const portExists = await checkPortExists(PORT);
    const webpackRunning = await checkWebpackProcess();

    if (portExists && webpackRunning) {
      console.log(`✅ 端口${PORT}已有服务运行，直接连接使用`);
      console.log('[1] webpack-dev-server: 已运行');
    } else {
      // 端口被占用但服务异常，需要清理
      if (portExists && !webpackRunning) {
        console.log(`⚠️  端口${PORT}被占用但服务异常，按照规范清理进程...`);
        await killPortProcesses(PORT);
      }

      console.log(`🚀 启动新的webpack-dev-server...`);
      const webpackProcess = startWebpackServer();

      // 等待webpack-dev-server启动
      console.log('等待webpack-dev-server启动...');
      let retries = 0;
      const maxRetries = 30;

      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const isReady = await checkPortExists(PORT);
        if (isReady) {
          console.log('✅ webpack-dev-server启动成功');
          break;
        }
        retries++;
        if (retries === maxRetries) {
          console.error('❌ webpack-dev-server启动超时');
          process.exit(1);
        }
      }
    }

    // 启动Electron主进程
    const electronProcess = startElectron();

    // 处理进程退出
    process.on('SIGINT', () => {
      console.log('\n正在关闭开发服务器...');
      electronProcess.kill('SIGINT');
      process.exit(0);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main();