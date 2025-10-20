# 稳定实现HTML到知乎专栏的一键发布（整合 blog-auto-publishing-tools 机制）

## Core Features

- 一键发布任务执行与进度日志

- 自动登录状态校验与会话复用

- 标题与HTML正文稳健填充（复制-粘贴）

- 发布/确认按钮鲁棒定位与点击（等待 enabled + 滚动防遮挡）

- 发布结果URL与文章ID解析（严格判定 /p/{id} 非 /edit）

- 失败诊断（截图、DOM快照、日志）

- 专栏收录显式勾选（对齐 blog-auto-publishing-tools）

- 自动获取Chrome版本并下载匹配chromedriver

- 自动检测并设置 Chrome 可执行文件(binary_location)

- 使用便携版 pandoc 并补 PATH

## Tech Stack

{
  "Web": {
    "arch": "html",
    "component": null
  }
}

## Design

优化知乎发布器：不再新开标签；在 write/edit 均填标题；滚动并等待发布按钮可点击后触发；保留专栏收录尝试。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[/] 发布验证（非交互脚本 run_zhihu_once.py)

[X] 安装 pandoc 并重试发布

[X] 脚本增强：标题必填 + 发布按钮 enabled 等待 + 防遮挡滚动
