# 将 blog-auto-publishing-tools 的知乎发布机制集成到现有应用

## Core Features

- 一键准备环境（Chrome调试端口、chromedriver、pandoc便携版）

- 参数化配置（title/content/auto_publish/debugger_address）

- 子进程调用 run_zhihu_once.py 并收集日志

- 结果URL解析与回显

- 容错回退（端口回退、驱动自动下载、登录与发布按钮等待）

## Tech Stack

{
  "Web": {
    "arch": "html",
    "component": null
  }
}

## Design

保持 blog-auto-publishing-tools 作为子目录，应用仅负责：准备依赖、写配置、触发脚本、读结果。通过便携式依赖避免系统安装。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[ ] 环境准备脚本（Chrome/Driver/Pandoc）

[ ] 应用配置对接（写 common.yaml 与内容）

[ ] 应用触发执行与日志回显

[ ] 发布结果URL获取与展示
