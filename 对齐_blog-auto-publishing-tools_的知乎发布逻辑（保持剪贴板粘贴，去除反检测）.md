# 对齐 blog-auto-publishing-tools 的知乎发布逻辑（保持剪贴板粘贴，去除反检测）

## Core Features

- 剪贴板粘贴注入正文（保留现实现）

- 发布按钮可用态检测与滚动点击

- 编辑态就地补救并发布

- 发布前二次标题校验

- 移除反检测 flags 与脚本

- 修复 createTempImageFile 的 process.cwd() 用法

## Tech Stack

{
  "Web": {
    "arch": "html",
    "component": null
  }
}

## Design

在 ZhihuPublisher.js 内做最小增强：保存 articleData 供补标题；发布前校验标题；等待发布按钮可用；/edit 就地补救；去除反检测参数与脚本；修复 process.cwd()。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 阅读并梳理 ZhihuPublisher.js 发布逻辑

[X] 对齐 blog-auto-publishing-tools 的发布规则

[X] 实现：发布按钮可用态等待 + 滚动点击

[X] 实现：编辑态就地补救并发布

[X] 实现：发布前二次标题校验

[X] 移除反检测 flags 与脚本
