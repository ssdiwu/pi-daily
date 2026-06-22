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

## 日报数据链路防护

- `~/Documents/pi-daily-reports/YYYY-MM-DD.md` 是后续自动化（如 cron 任务、梦境总结、跨日回看）的稳定输入，改保存路径、文件名格式或日期归属规则前必须同步更新 README / doc 并补迁移说明。
- 默认工作日边界是 `05:00 → 次日 05:00`；改 natural language（自然语言）时间解析、`--day-start` 或凌晨回溯逻辑时，必须用跨午夜样例验证连续日期序列不会断裂。
- 时间解析走“LLM 语义解析（`natural-time-ai.ts`）优先 + 正则离线版（`natural-time.ts`）兑底”：自然语言表达无穷尽，正则易把“6月”里的数字误读成小时；LLM 解析失败或无 ctx 时必须能完整回退到正则，两条路径都要有测试和 smoke test 覆盖。
- `--save` 必须保持幂等：同一天重跑可以覆盖同一路径，但不能产生随机文件名或多份同义报告，除非用户显式指定。
- 报告内容要保留足够结构化的“项目/事项、产出、阻塞/风险、待跟进、跨项目观察”，避免只生成散文式总结，保证后续 agent 能继续读取。

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
npm run check   # tsc 类型检查
npm test        # 单元测试（纯函数）
npm run smoke   # handler 调用链 smoke test（加载 index.ts，mock ctx 跑 /daily handler）
```

或一次跑全链路：`npm run verify`。

### 为什么三层都要跑

- **单元测试**只验纯函数（解析、渲染、脱敏），不覆盖 extension 入口。
- **smoke test** 用 Node 原生 TS stripping 加载 `index.ts`，调用 `default(pi)` 让命令注册，再用 mock ctx 跑 handler，覆盖「入口 → 命令注册 → 参数解析 → 回退」整条链路。时间解析、窗口计算这类 bug 常常只在真实调用链里暴露，单元测试抓不到。
- **`pi -ne -e index.ts`** 验证 extension 在 pi 的 jiti 加载器下能干净加载、命令注册不抛错。注意：`-p` 模式下 slash command 不会路由到 handler（pi 的输入解析层只在交互模式查命令），所以它只验证加载成功，不验证 handler 行为——handler 行为靠 smoke test。

### smoke test 约定

- 改 `index.ts`、`args.ts`、`natural-time.ts`、`natural-time-ai.ts`、`time-window.ts` 任一文件后，必须跑 `npm run smoke`。
- 新增时间解析路径或回退分支时，在 `tests/smoke-daily-handler.mts` 补一个对应 case（mock ctx + 断言 window label）。
- smoke test 不允许依赖网络或真实模型调用（用 mock ctx 触发回退路径）。

如无法执行，说明 blocker、影响范围和后续验证方式。

## 发版流程

发布 npm 版本前必须走同一条链路：

1. 同步版本号：`package.json` + `package-lock.json`。
2. 更新 `CHANGELOG.md`，把用户可见变更、文档变更和验证结果落到对应版本段。
3. 确认 `package.json` 版本、`CHANGELOG.md` 版本段、`git tag v<x.y.z>` 三者一致。
4. 运行验证：`npm run verify`（check + test + smoke）；发版前另跑一次 `pi -ne -e index.ts` 确认 pi 能干净加载，再手测 `/daily`。
5. 提交单一主题 commit，再 `git tag v<x.y.z>`。
6. 发布：`npm publish`；发布后 `git push && git push --tags`。

## Git 规范

- 每次 commit 只做一件事。
- 提交标题默认中文，格式：`分类：动作 + 对象`。
- 提交前检查变更范围，避免混入无关改动。
- 禁止 `git push --force` 到 `main`。

## 文档沉淀出口

三个沉淀出口按边界分工，不混用：

- **`doc/术语表.md`** — 回答"这个词指什么"，收项目特有概念；定义"是什么"，不沾实现细节。惰性创建，术语敲定时当场写。
- **`doc/决策档案/`** — 回答"为什么这么定"，只收"难逆转 + 无上下文会困惑 + 有真实权衡"的决策（刻碑，记了就不删）。一条一文件，顺序编号 `0001-xxx.md`。
- **`doc/经验笔记.md`** — 回答"这事儿怎么做"，收可改的做法与避坑经验（活页）。门槛：解决一个坑时，如果换一个无上下文的 agent 来会重走一遍，就值得记。格式：现象 + 做法 + 证据。重复发生时在原条目追加证据，不新建条目。

## 代码工程纪律

> 以下纪律适用于代码项目，由 `507-setup` 写入。源自全局 `~/.pi/agent/AGENTS.md` 的代码专属条款。

- **删除测试判断模块价值**：判断一个模块/抽象是否值得存在，想象删掉它——复杂度消失说明它只是透传（删）；复杂度在多个调用处重新出现，说明它在真正减负（留）。
- **接缝纪律**：只在真有变化的地方引入接口/抽象层。只有一个实现（adapter）的是"假设接缝"，两个以上不同实现才是真接缝；别为单一用法提前抽接口。
- **函数粒度**：函数控制在 100 行以内；超出则考虑拆分。
- **测试看行为**：测试优先通过公共接口验证行为，不测内部实现；mock 只放在系统边界。
- **先建反馈环再调 bug**：调 bug 先造一个快速、确定性、agent 能跑的 pass/fail（成败）信号（失败测试/curl/CLI 重放/headless 等）；没有反馈环就别盯着代码空猜，列已试方法后求助用户。信号是 90% 的调试，其余是机械操作。
- **插桩打 tag**：所有临时 debug 日志打唯一前缀 tag（如 `[DEBUG-a4f2]`），清理时一个 grep 全删；未打 tag 的临时日志会残留。
