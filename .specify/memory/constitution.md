<!--
Sync Impact Report:
Version change: 0.0.0 → 1.0.0 (Initial constitution creation)
Modified principles: N/A (initial creation)
Added sections: Core Principles, Platform Security, Development Workflow, Governance
Removed sections: N/A
Templates requiring updates: ⚠ plan-template.md, ⚠ spec-template.md, ⚠ tasks-template.md (pending review)
Follow-up TODOs: None
-->

# Article Multi-Publisher Constitution

## Core Principles

### I. Visual Browser Automation
All publishing operations MUST be performed through Chrome-based automation with full user visibility. Users must see all actions being performed in real-time through browser automation, with clear status indicators for each step of the publishing process.

### II. Content Integrity
Content from Feishu/Lark documents MUST be preserved with full fidelity during transfer. Rich text formatting, images, embedded media, and structural elements must be maintained and adapted appropriately for each target platform's capabilities while preserving the original intent and readability.

### III. Platform Abstraction
Each publishing platform (Zhihu, Xiaohongshu, Baijiahao, Toutiao, Knowledge Planet, Juejin, CSDN) MUST be abstracted through a consistent interface. Platform-specific logic MUST be isolated in dedicated modules with clear contracts for authentication, content formatting, and publishing operations.

### IV. Authentication Management
User authentication MUST be handled securely with persistent session management. QR code login MUST be supported for platforms that require it. Login state MUST be maintained across sessions with secure token storage and automatic session refresh capabilities.

### V. Configuration Transparency
All platform-specific publishing parameters MUST be configurable and visible to users. Required fields that cannot be auto-detected MUST be explicitly presented for user input. Optional parameters MUST have a clear "不需要" (Not Required) option to ensure user control over all publishing decisions.

## Platform Security

### VI. Data Privacy
User credentials and content MUST be handled with enterprise-grade security. All sensitive data MUST be encrypted at rest and in transit. Browser automation MUST NOT expose user credentials or access tokens in logs or error messages.

### VII. Permission Boundaries
Platform automation MUST operate within explicit user-granted permissions only. Actions MUST be limited to content publishing functions without accessing unrelated user data or performing unauthorized operations on target platforms.

## Development Workflow

### VIII. Test-Driven Development
All platform integrations MUST be developed with comprehensive test coverage. Unit tests MUST cover content transformation logic, integration tests MUST validate end-to-end publishing flows, and visual regression tests MUST ensure UI consistency across platforms.

### IX. Error Recovery
Publishing failures MUST provide clear, actionable error messages with suggested remediation steps. Failed operations MUST support retry mechanisms with exponential backoff. Partial failures MUST be clearly communicated with options to retry only failed platforms.

### X. Observability
All publishing operations MUST emit structured logs with sufficient detail for debugging and monitoring. Performance metrics for each platform MUST be tracked and reported. User-facing status updates MUST reflect real-time operation progress.

### XI. 中文沟通优先
项目所有沟通和文档必须使用中文。所有用户界面、错误信息、日志输出和文档都应该以中文为主，确保用户能够清晰理解系统状态和操作指导。

### XII. 进度追踪管理
项目进度必须实时记录到 `jindu.md` 文件中。jindu.md 是流水账式记录，只增不改，每次项目有新进展都必须及时追加。格式包括时间戳、进展内容、责任人等信息。

### XIII. 规范集中管理
项目所有规范都必须记录到 `guifan.md` 文件中。guifan.md 是唯一最新规范源，任何新规范或规范更新都必须及时更新到此文件。此文件具有最高权威性，所有开发活动必须遵循其中的规范。

### XIV. 持久化记忆管理
所有重要的管理规则、项目配置、用户偏好等都必须写入 `.specify/memory/` 目录，确保项目重启或环境压缩后能够第一时间读取并恢复上下文。

## Governance

This constitution supersedes all other project documentation and practices. Amendments require formal documentation, team approval, and a migration plan for affected code. All pull requests and code reviews MUST verify compliance with these principles. Platform-specific complexity MUST be justified with clear user value propositions. Implementation guidance should reference this constitution as the ultimate authority for architectural decisions.

**Version**: 1.0.0 | **Ratified**: 2025-10-14 | **Last Amended**: 2025-10-14