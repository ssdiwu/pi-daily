# pi-daily

> Daily work reports for Pi, generated from local session activity.

`pi-daily` is a Pi Coding Agent extension that turns your local Pi session history into a concise Markdown daily report.

<p align="center">
  <code>pi install npm:pi-daily</code>
</p>

## ✨ What it does

| Scenario | Behavior |
|---|---|
| Run `/daily` | Generates today's work report from local Pi sessions |
| Run `/daily YYYY-MM-DD` | Generates a report for a specific date |
| Run `/daily --project current` | Restricts the report to the current working directory |
| Run `/daily --save` | Saves the generated report to `~/Documents/pi-daily-reports/` |
| AI summary fails | Falls back to a local rule-based Markdown report |

## 🚀 Install

```bash
pi install npm:pi-daily
```

Then run in Pi:

```text
/daily
```

## Why this exists

Pi already stores session activity locally. `pi-daily` reads those session files and turns them into a lightweight daily worklog:

- what you worked on;
- which projects or concrete work items were active;
- what files and tools were involved;
- what got done;
- what is blocked or worth following up;
- per-project or per-item progress, outputs, risks, and follow-ups.

## Privacy model

- Reads local `~/.pi/agent/sessions/**/*.jsonl`.
- Does not modify original session files.
- Does not upload raw session text.
- Sends only redacted structured facts to the current conversation model.
- Redacts common secrets before rendering output.
- Saves reports only when explicitly requested with `--save`.

## AI summary model

`pi-daily` directly uses the current conversation model. There is no separate model configuration file and no package-level fallback model chain.

If the current conversation model call fails, `pi-daily` falls back to the local rule-based Markdown report.

## Output shape

AI reports are grouped by real project directories and concrete work items. Default workspace folders such as `/Users/diwu` are not treated as projects; their content is split into actual work items.

```md
# YYYY-MM-DD 工作日报

## 今日概览

## 项目/事项一：<项目名或事项名>
### 进展
### 产出
### 阻塞 / 风险
### 待跟进

## 项目/事项二：<项目名或事项名>
### 进展
### 产出
### 阻塞 / 风险
### 待跟进

## 跨项目观察

## 工具与文件活动
```

## Current implementation

- `index.ts` registers `/daily`.
- `src/session-scan.ts` scans and parses local session JSONL files.
- `src/session-extract.ts` extracts tasks, files, tools, errors, and blockers.
- `src/report-model.ts` aggregates a report model by project/workspace.
- `src/ai-summary.ts` summarizes structured facts with the current conversation model.
- `src/markdown-render.ts` renders the local fallback Markdown report.
- `src/redact.ts` redacts obvious secrets.
- Runtime logic uses direct TypeScript modules throughout the source tree.

## Development

```bash
npm install
npm run check
npm test
```

## Local testing with Pi

From this repository:

```bash
pi -e ./index.ts
```

Then run:

```text
/daily
```

If you want to save the report:

```text
/daily --save
```

## Project structure

```text
pi-daily/
├── index.ts
├── src/
├── tests/
├── doc/
├── package.json
└── README.md
```

## License

MIT
