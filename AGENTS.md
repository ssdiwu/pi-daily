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
- 新增用户可见标题、统计文案或 AI prompt 骨架时，必须同步 `src/report-labels.ts` 与 `src/ai-summary.ts` 的多语言文案，并补对应测试。

## Pi 包加载约束

- `@earendil-works/pi-ai`、`@earendil-works/pi-coding-agent` 等 Pi 包可能是 ESM-only（仅支持 ESM 导入）并通过 `exports.import` 暴露入口，禁止用 `require()` 或 `createRequire()` 加载。
- 为了绕开 `tsc` 类型检查变慢，也不能把 ESM-only 包改成 `require()`；这会在运行时报 `No "exports" main defined`，导致 AI 总结 fallback。
- 如需避免 TypeScript 静态展开大依赖，优先用本地最小类型接口或动态 `import()`，并必须用 `node -e 'import("包名")'` 或相关测试验证运行时加载。
- 动态加载 pi-ai 的正确姿势：用 `import.meta.resolve` 定位包根，拼出窄入口（如 `dist/stream.js`）的 file URL，再用**变量 specifier 的标准动态 `import(url)`**。不要用 `new Function("return import(...)")`——jiti 运行时会报 `A dynamic import callback was not specified`。变量 specifier 能让 tsc 返回 `any` 不展开类型树，同时运行时 jiti 原生支持。

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
