# 用 Puppeteer 重写知乎发布逻辑并接入现有应用（无 remote-debugging）

## Core Features

- Puppeteer 启动与登录态复用（userDataDir 或会话服务）

- 标题必填与 DraftJS HTML 插入（优先 insertHTML，剪贴板兜底）

- 发布按钮可用态检测与点击

- 专栏收录勾选与发布确认处理

- 发布结果URL解析（严格 /p/{id} 非 /edit）

- 可选图片上传（base64/URL/本地）

## Tech Stack

{
  "Web": {
    "arch": "html",
    "component": null
  }
}

## Design

保持现有会话/服务架构不变；在当前 ZhihuPublisher.js 内做最小增强：正文注入改为 insertHTML 优先、发布按钮可用态等待、/edit 就地补救、保留现有反检测逻辑与诊断流程。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 阅读并梳理 ZhihuPublisher.js 发布逻辑

[X] 输出可运行 Puppeteer 发布脚本

[ ] 精修：正文注入 insertHTML 优先（不改架构）

[ ] 精修：发布按钮可用态等待

[ ] 精修：/edit 场景就地补救并再发

[ ] 写入项目与 npm script 集成

[ ] 应用侧子进程调用与结果回传
