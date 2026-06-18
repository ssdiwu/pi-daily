# pi-daily

> Daily work reports for Pi, generated from local session activity.

`pi-daily` is a Pi Coding Agent extension that turns your local Pi session history into a concise Markdown daily report.

<p align="center">
  <code>pi install npm:pi-daily</code>
</p>

## ✨ What it does

| Scenario | Behavior |
|---|---|
| Run `/daily` | Generates today's work report from local Pi sessions. Run between 00:00-05:00 and it auto-traces the previous workday (`yesterday 05:00 → today 05:00`) so overnight work is included |
| Run `/daily YYYY-MM-DD` | Generates a report for a specific date |
| Run `/daily --project current` | Restricts the report to the current working directory |
| Run `/daily 昨晚到今天凌晨` | Uses natural language to pick an overnight work window |
| Run `/daily 最近 8 小时` | Generates a report for a relative time window |
| Run `/daily --day-start 05:00` | Advanced form: treats the workday as `05:00 → next day 05:00`; before 05:00 it belongs to the previous workday |
| Run `/daily --since 18:00 --until 02:00` | Advanced form: generates a custom time window that can cross midnight |
| Run `/daily --from 2026-06-12T20:00 --to 2026-06-13T03:00` | Advanced form: uses an absolute time range |
| Language | Auto-detected from `PI_LOCALE` > `LC_ALL` > `LANG`; 11 languages supported (zh-Hans/zh-Hant/ja/ko/de/fr/es/pt/ru/ar/en) |
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

## Internationalization

Headings, stat lines, AI language instructions, and AI prompt scaffolding are localized, following the `pi-compaction-i18n` pattern. Language is auto-detected from `PI_LOCALE` > `LC_ALL` > `LANG` and supports 11 languages: Simplified Chinese, Traditional Chinese, Japanese, Korean, German, French, Spanish, Portuguese, Russian, Arabic, and English (default).

That includes project placeholder headings and section scaffolding inside the AI summary prompt, so non-Chinese locales no longer inherit Chinese-only prompt structure.

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

If you work past midnight, you can use natural language first. Pi will confirm the interpreted time window before generating:

```text
/daily 昨晚到今天凌晨
/daily 昨晚加班
/daily 最近 8 小时
```

Advanced deterministic forms are still available:

```text
/daily --day-start 05:00
/daily 2026-06-12 --since 18:00 --until 02:00
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
