# AGENTS.md — pi-daily

> 当前项目是 **pi-daily**：一个 Pi Coding Agent 扩展，从本地 Pi session 活动生成每日日报。

## 先读文档

做产品、架构或代码决策前，按顺序读：

1. `doc/README.md`（文档导航与职责边界）
2. `doc/00-产品与原则/00-顶层设计.md`（产品定位、边界与隐私原则）
3. `doc/10-架构与运行/10-系统架构.md`（目录、数据流、运行方式）
4. `doc/30-路线图/30-路线图.md`（MVP 与后续路线图）
5. 目标代码目录的 `README.md`

## 项目结构

```text
pi-daily/
├── index.ts          ← Pi extension 入口，注册 /daily 命令
├── src/              ← session 扫描、解析、聚合、日报渲染
├── tests/            ← Node.js 内置 test 测试
├── doc/              ← 产品、架构、路线图文档
├── package.json      ← pi package 清单
└── README.md         ← 使用说明
```

## 代码边界

- 只读取本地 `~/.pi/agent/sessions/**/*.jsonl`，不上传 session 原文。
- 默认优先使用 AI 基于脱敏后的结构化摘要生成日报；AI 不可用时回退到本地规则版 Markdown。
- 默认不写入用户工作目录；只有用户显式传保存参数时才写文件。
- 不硬编码 API Key、token、私有路径。
- 解析 session 时必须容忍坏行、旧版本字段和缺失字段。

## README 规则

- 含代码目录必须有 `README.md`。
- 改代码前读目标目录 README。
- 改代码后，如果职责、结构、入口、运行方式或约定变化，必须同步更新对应 README 和相关 `doc/*.md`。

## 验证

改动后至少执行：

```bash
npm run check
npm test
```

如无法执行，说明 blocker、影响范围和后续验证方式。

## Git 规范

- 每次 commit 只做一件事。
- 提交标题默认中文，格式：`分类：动作 + 对象`。
- 提交前检查变更范围，避免混入无关改动。
- 禁止 `git push --force` 到 `main`。
