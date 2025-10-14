# 快速开始指南

**项目**: 文章一键多发平台
**框架**: Electron + React + TinyMCE
**数据库**: SQLite + SQLCipher
**自动化**: Puppeteer

---

## 环境要求

### 开发环境
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0 或 **yarn**: >= 1.22.0
- **Git**: 最新版本
- **Python**: >= 3.8 (用于node-gyp)

### 推荐开发工具
- **IDE**: VS Code + 相关插件
- **调试**: Chrome DevTools
- **数据库工具**: DB Browser for SQLite

---

## 项目初始化

### 1. 克隆项目
```bash
git clone https://github.com/xiaohuAI319/ArticlePosts.git
cd ArticlePosts
```

### 2. 安装依赖
```bash
npm install
# 或
yarn install
```

### 3. 环境配置
```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
npm run config
# 或手动编辑 .env 文件
```

### 4. 数据库初始化
```bash
# 创建数据库
npm run db:create

# 运行迁移
npm run db:migrate

# 插入初始数据
npm run db:seed
```

---

## 开发指南

### 启动开发服务器
```bash
# 启动前端开发服务器
npm run dev

# 启动Electron应用
npm run electron:dev
```

### 项目结构
```
ArticlePosts/
├── src/                    # 源代码
│   ├── main/              # Electron主进程
│   │   ├── index.js       # 主进程入口
│   │   ├── database/      # 数据库操作
│   │   ├── automation/    # 自动化脚本
│   │   └── services/      # 业务逻辑
│   ├── renderer/          # 渲染进程(React)
│   │   ├── components/    # React组件
│   │   ├── pages/         # 页面组件
│   │   ├── store/         # Redux状态管理
│   │   └── utils/         # 工具函数
│   └── shared/            # 共享代码
├── public/                # 静态资源
├── build/                 # 构建输出
├── scripts/               # 构建脚本
├── specs/                 # 规范文档
└── tests/                 # 测试文件
```

### 开发流程

#### 1. 创建功能分支
```bash
git checkout -b feature/your-feature-name
```

#### 2. 开发功能
- 遵循代码规范 (ESLint + Prettier)
- 编写单元测试
- 更新相关文档

#### 3. 测试
```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e
```

#### 4. 提交代码
```bash
git add .
git commit -m "feat: 添加新功能描述"
git push origin feature/your-feature-name
```

---

## 核心功能开发

### 富文本编辑器
```javascript
// src/renderer/components/Editor/QuillEditor.jsx
import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const QuillEditor = ({ value, onChange }) => {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['image', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      placeholder="开始编写文章..."
    />
  );
};

export default QuillEditor;
```

### 平台自动化
```javascript
// src/main/automation/zhihu.js
const puppeteer = require('puppeteer');

class ZhihuAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });
    this.page = await this.browser.newPage();
  }

  async login(cookies) {
    await this.page.goto('https://www.zhihu.com/signin');

    if (cookies) {
      await this.page.setCookie(...cookies);
      await this.page.goto('https://www.zhihu.com');
      return await this.isLoggedIn();
    }

    // 扫码登录逻辑
    return await this.performQRLogin();
  }

  async publishArticle(article, config) {
    await this.page.goto('https://zhuanlan.zhihu.com/write');

    // 填写标题
    await this.page.type('[data-placeholder="输入文章标题"]', article.title);

    // 填写内容
    await this.page.evaluate((content) => {
      const editor = document.querySelector('.public-DraftEditor-content');
      editor.innerHTML = content;
    }, article.html_content);

    // 点击发布
    await this.page.click('[data-za-detail-view-element_name="发布文章按钮"]');

    // 等待发布完成
    await this.page.waitForSelector('[data-za-detail-view-element_name="发布成功"]');

    return await this.page.url();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = ZhihuAutomation;
```

### 数据库操作
```javascript
// src/main/database/models/Article.js
const Database = require('../database');

class Article {
  static async create(articleData) {
    const db = Database.getInstance();
    const stmt = db.prepare(`
      INSERT INTO articles (uuid, title, content, html_content, tags, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      articleData.uuid,
      articleData.title,
      articleData.content,
      articleData.html_content,
      JSON.stringify(articleData.tags),
      articleData.category
    );

    return result.lastInsertRowid;
  }

  static async findById(id) {
    const db = Database.getInstance();
    const stmt = db.prepare('SELECT * FROM articles WHERE id = ?');
    return stmt.get(id);
  }

  static async update(id, updateData) {
    const db = Database.getInstance();
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
      if (key === 'tags') {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(updateData[key]));
      } else {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    values.push(id);

    const stmt = db.prepare(`
      UPDATE articles
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(...values);
  }
}

module.exports = Article;
```

---

## 构建和打包

### 开发构建
```bash
# 构建渲染进程
npm run build:renderer

# 构建主进程
npm run build:main

# 开发模式打包
npm run build:dev
```

### 生产构建
```bash
# 完整构建
npm run build

# 打包应用
npm run package

# 打包为安装程序
npm run dist
```

### 代码签名 (Windows)
```bash
# 配置证书环境变量
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"

# 签名构建
npm run dist:signed
```

---

## 测试指南

### 单元测试
```javascript
// tests/unit/models/Article.test.js
const Article = require('../../../src/main/database/models/Article');

describe('Article Model', () => {
  test('should create a new article', async () => {
    const articleData = {
      uuid: 'test-uuid',
      title: 'Test Article',
      content: '{"ops":[{"insert":"Test content\n"}]}',
      html_content: '<p>Test content</p>',
      tags: ['test'],
      category: 'test'
    };

    const id = await Article.create(articleData);
    expect(id).toBeDefined();

    const article = await Article.findById(id);
    expect(article.title).toBe('Test Article');
  });
});
```

### 集成测试
```javascript
// tests/integration/publish.test.js
const ZhihuAutomation = require('../../src/main/automation/zhihu');

describe('Publish Integration', () => {
  let automation;

  beforeAll(async () => {
    automation = new ZhihuAutomation();
    await automation.initialize();
  });

  afterAll(async () => {
    await automation.close();
  });

  test('should publish article to Zhihu', async () => {
    const article = {
      title: 'Test Article',
      html_content: '<p>Test content</p>'
    };

    const url = await automation.publishArticle(article);
    expect(url).toContain('zhihu.com');
  }, 30000);
});
```

---

## 调试指南

### 主进程调试
```bash
# 启动调试模式
npm run debug:main

# 或在代码中添加断点
debugger;
```

### 渲染进程调试
- 使用Chrome DevTools
- 在渲染进程中按 F12
- 或在代码中使用 `console.log`

### 数据库调试
```bash
# 查看数据库
npm run db:open

# 运行查询
npm run db:query "SELECT * FROM articles"
```

---

## 部署指南

### Windows部署
```bash
# 构建Windows安装包
npm run build:win

# 构建Windows便携版
npm run build:win-portable
```

### macOS部署
```bash
# 构建macOS应用
npm run build:mac

# 构建macOS安装包
npm run build:mac-dmg
```

### Linux部署
```bash
# 构建Linux应用
npm run build:linux

# 构建AppImage
npm run build:appimage
```

---

## 常见问题

### Q: 构建失败怎么办？
A: 检查Node.js版本，清理缓存重新安装依赖
```bash
rm -rf node_modules package-lock.json
npm install
```

### Q: Puppeteer无法启动？
A: 安装Chromium依赖
```bash
npm run puppeteer:install
```

### Q: 数据库连接失败？
A: 检查数据库文件权限和路径
```bash
npm run db:check
```

### Q: 应用启动慢？
A: 启用开发模式优化
```bash
npm run dev:optimized
```

---

## 开发工具推荐

### VS Code插件
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens

### Chrome扩展
- React Developer Tools
- Redux DevTools
- Puppeteer Recorder

### 数据库工具
- DB Browser for SQLite
- DBeaver

---

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request
5. 等待代码审查

### 代码规范
- 使用ESLint + Prettier
- 遵循React Hooks规范
- 编写单元测试
- 添加必要的注释

### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-14
**维护者**: 开发团队