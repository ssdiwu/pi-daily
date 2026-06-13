# src — pi-daily 源码

本目录存放 pi-daily 的核心逻辑。`index.ts` 只负责注册 Pi extension 命令，具体扫描、解析、聚合和渲染逻辑放在本目录。

## 模块规划

| 文件 | 职责 |
|---|---|
| `args.ts` | 解析 `/daily` 命令参数 |
| `ai-summary.ts` | 将脱敏后的结构化摘要交给 AI 生成按项目分组的日报，失败则回退 |
| `daily.ts` | 汇总生成、AI 总结、渲染和保存日报 |
| `session-scan.ts` | 递归扫描 Pi session JSONL 文件，读取 header 和条目 |
| `session-extract.ts` | 从 session entry 提取用户任务、工具调用、文件活动、错误 |
| `report-model.ts` | 将多 session 活动聚合为日报模型 |
| `markdown-render.ts` | 将日报模型渲染为 Markdown |
| `redact.ts` | 对 token、私钥、环境变量等敏感信息脱敏 |

## 约定

- 函数尽量保持纯函数，方便测试。
- 解析器必须容忍坏行、缺失字段和未知 entry type。
- 默认只输出摘要和短片段，不输出完整 session 原文。
- 不在本目录内直接注册 Pi 命令。
