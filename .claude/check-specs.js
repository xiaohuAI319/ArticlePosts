/**
 * 项目规范自动检查脚本
 * 每次会话开始时自动读取项目核心规范文档
 * 确保遵循guifan.md中的中文沟通要求
 */

const fs = require('fs');
const path = require('path');

// 核心规范文件路径
const PROJECT_FILES = {
  guifan: path.join(__dirname, '..', 'guifan.md'),
  jindu: path.join(__dirname, '..', 'jindu.md'),
  constitution: path.join(__dirname, '..', '.specify', 'memory', 'constitution.md'),
  spec: path.join(__dirname, '..', 'specs', 'feature-article-multi-publisher', 'spec.md'),
  tasks: path.join(__dirname, '..', 'specs', 'feature-article-multi-publisher', 'tasks.md'),
  plan: path.join(__dirname, '..', 'specs', 'feature-article-multi-publisher', 'plan.md')
};

function checkProjectSpecs() {
  console.log('🔍 自动检查项目规范文档...');
  console.log('=====================================');

  // 检查guifan.md - 项目规范
  if (fs.existsSync(PROJECT_FILES.guifan)) {
    const guifan = fs.readFileSync(PROJECT_FILES.guifan, 'utf8');
    console.log('✅ 已读取 guifan.md - 项目规范文档');

    // 检查中文沟通要求
    if (guifan.includes('项目所有沟通和文档必须使用中文')) {
      console.log('🚨 重要提醒：必须使用中文沟通！');
      console.log('📝 guifan.md明确规定：项目所有沟通和文档必须使用中文');
      console.log('⚠️  违反此规定属于严重问题，必须严格遵守');
    }
  } else {
    console.log('❌ guifan.md 不存在');
  }

  // 检查jindu.md - 进度记录
  if (fs.existsSync(PROJECT_FILES.jindu)) {
    console.log('✅ 已读取 jindu.md - 项目进度记录');
  } else {
    console.log('❌ jindu.md 不存在');
  }

  // 检查constitution.md - 项目宪法
  if (fs.existsSync(PROJECT_FILES.constitution)) {
    console.log('✅ 已读取 constitution.md - 项目宪法文档');
  } else {
    console.log('❌ constitution.md 不存在');
  }

  // 检查spec.md - 功能规范
  if (fs.existsSync(PROJECT_FILES.spec)) {
    console.log('✅ 已读取 spec.md - 功能规范文档');
  } else {
    console.log('❌ spec.md 不存在');
  }

  // 检查tasks.md - 任务列表
  if (fs.existsSync(PROJECT_FILES.tasks)) {
    console.log('✅ 已读取 tasks.md - 实现任务列表');
  } else {
    console.log('❌ tasks.md 不存在');
  }

  // 检查plan.md - 实施计划
  if (fs.existsSync(PROJECT_FILES.plan)) {
    console.log('✅ 已读取 plan.md - 实施计划文档');
  } else {
    console.log('❌ plan.md 不存在');
  }

  console.log('🎯 项目当前阶段：功能规划完成，等待开发实施');
  console.log('📋 下一步：按照tasks.md开始T001项目初始化');
  console.log('🔗 核心文档：guifan.md(规范) + jindu.md(进度) + constitution.md(宪法) + specs/*(技术文档)');
  console.log('=====================================');
  console.log('🚨 最终提醒：本次会话必须全程使用中文！');
  console.log('📝 所有回复、文档、代码注释都必须使用中文');
  console.log('⚠️  如发现使用英文，立即停止并纠正');
  console.log('=====================================');
}

module.exports = { checkProjectSpecs };