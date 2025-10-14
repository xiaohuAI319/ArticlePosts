# 文章一键多发平台

> 一个支持多平台发布的桌面应用程序，使用Electron + React构建

## 功能特性

- 🖊️ **富文本编辑**: 支持飞书文档格式粘贴，保持格式完整性
- 🔐 **平台登录**: 支持扫码登录各大平台，自动保存登录状态
- 📱 **一键发布**: 点击按钮即可同时发布到多个平台
- 🎯 **MVP设计**: 从知乎开始，逐步扩展到其他平台
- 🌏 **中文优先**: 完整的中文界面和中文文档

## 支持平台

- ✅ **知乎** (MVP - 已完成基础架构)
- 🚧 **小红书** (计划中)
- 🚧 **百家号** (计划中)
- 🚧 **头条号** (计划中)
- 🚧 **知识星球** (计划中)
- 🚧 **掘金** (计划中)
- 🚧 **CSDN** (计划中)

## 技术栈

- **桌面框架**: Electron 28+
- **前端框架**: React 18 + Ant Design
- **状态管理**: Redux Toolkit
- **富文本编辑**: TinyMCE
- **浏览器自动化**: Puppeteer
- **数据库**: SQLite (better-sqlite3)
- **加密**: crypto-js

## 开发环境

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### 快速开始

```bash
# 克隆项目
git clone https://github.com/xiaohuAI319/ArticlePosts.git
cd ArticlePosts

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建应用
npm run build

# 打包应用
npm run package
```

### 项目结构

```
src/
├── main/                 # Electron主进程
│   ├── index.js         # 应用入口
│   ├── preload.js       # 预加载脚本
│   ├── database/        # 数据库相关
│   ├── services/        # 业务服务
│   └── automation/      # 自动化脚本
├── renderer/            # 渲染进程(React)
│   ├── components/      # React组件
│   ├── pages/          # 页面组件
│   ├── store/          # Redux状态管理
│   └── styles/         # 样式文件
└── shared/             # 共享代码
```

## 开发进度

### ✅ 已完成

- [x] 项目架构设计
- [x] 技术选型确认
- [x] 基础项目结构搭建
- [x] Electron主进程框架
- [x] React渲染进程框架
- [x] Redux状态管理配置
- [x] 基础UI布局组件

### 🚧 开发中

- [ ] TinyMCE富文本编辑器集成
- [ ] 数据库模型实现
- [ ] 平台登录自动化
- [ ] 一键发布功能

### 📋 计划中

- [ ] 多平台支持扩展
- [ ] 智能配置管理
- [ ] 性能优化
- [ ] 安全加固

## 开发规范

### 代码规范

- 使用ESLint + Prettier进行代码格式化
- 所有函数必须用中文注释
- 变量命名使用英文，注释使用中文
- 遵循React Hooks规范

### Git规范

- 使用中文提交信息
- 提交格式：`类型: 简短描述`
- 类型包括：feat(新功能)、fix(修复)、docs(文档)、style(格式)、refactor(重构)、test(测试)、chore(构建)

### 分支管理

- `main`: 主分支，稳定版本
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 热修复分支

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目地址: https://github.com/xiaohuAI319/ArticlePosts
- 问题反馈: [Issues](https://github.com/xiaohuAI319/ArticlePosts/issues)

## 更新日志

### v1.0.0 (开发中)

- ✅ 基础项目架构搭建
- ✅ Electron + React框架集成
- ✅ Redux状态管理配置
- ✅ 基础UI组件实现
- 🚧 富文本编辑器开发中
- 🚧 平台集成开发中

---

**注意**: 当前版本为开发版本，部分功能尚未完成。请关注项目进展或参与开发。