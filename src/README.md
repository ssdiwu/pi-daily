# src — pi-daily 源码

本目录存放 pi-daily 的核心逻辑。`index.ts` 只负责注册 Pi extension 命令，具体扫描、解析、聚合和渲染逻辑放在本目录。

## 模块规划

| 文件 | 职责 |
|---|---|
| `args.ts` | 解析 `/daily` 命令参数，优先接入自然语言时间窗口，兼容确定性参数 |
| `natural-time.ts` | 将“昨晚到今天凌晨”“最近 8 小时”等自然语言转成时间窗口 |
| `time-window.ts` | 时间窗口、日期和本地时间格式化工具 |
| `locale.ts` | 语言检测与映射（PI_LOCALE > LC_ALL > LANG），收敛成 SupportedLanguage 枚举 |
| `report-labels.ts` | 日报 UI 文案多语言字典，参考 pi-compaction-i18n 的 SECTION_LABELS 模式 |
| `ai-summary.ts` | 将脱敏后的结构化摘要交给 AI 生成按项目分组的日报，失败则回退 |
| `daily.ts` | 汇总生成、AI 总结、渲染和保存日报 |
| `session-scan.ts` | 递归扫描 Pi session JSONL 文件，读取 header 和条目 |
| `session-extract.ts` | 按时间窗口从 session entry 提取用户任务、工具调用、文件活动、错误 |
| `report-model.ts` | 将多 session 活动聚合为日报模型 |
| `markdown-render.ts` | 将日报模型渲染为 Markdown |
| `redact.ts` | 对 token、私钥、环境变量等敏感信息脱敏 |

## 约定

- 函数尽量保持纯函数，方便测试。
- 解析器必须容忍坏行、缺失字段和未知 entry type。
- 默认只输出摘要和短片段，不输出完整 session 原文。
- 默认时间窗口是自然日 `00:00 → 次日 00:00`；但凌晨 0-5 点跑默认 `/daily` 会自动追溯为“昨天 05:00 → 今天 05:00”工作日窗口，覆盖跨夜加班。
- `--day-start`、`--since/--until` 和 `--from/--to` 可显式覆盖窗口。
- 所有面向用户的标题和统计行走 `report-labels.ts` 字典，不硬编码中文；语言由 `locale.ts` 检测，支持 11 种语言。
- 不在本目录内直接注册 Pi 命令。
