# Changelog

## 0.1.3 - 2026-06-26

Focus: restore AI summary compatibility after upstream pi-ai export changes.

### Fixed

- AI summary and LLM-based time parsing no longer hard-code the private `@earendil-works/pi-ai/dist/stream.js` entry. `pi-daily` now prefers the supported `@earendil-works/pi-ai/compat` export and only falls back to the legacy `stream.js` path for older environments, fixing fallback errors like `Cannot find module .../dist/stream.js` after upstream `pi-ai` export changes.
- `生成时间` / `Generated at` now uses the real local report-generation timestamp instead of letting the AI infer it from the reporting window. The structured facts sent to AI now include `generatedAt`, and local fallback rendering formats it as `YYYY-MM-DD HH:mm:ss`, preventing next-day timestamps such as `2026-06-24` from being shown for a `2026-06-23` report window.
- Added regression tests for both the `pi-ai` loader compatibility path and the real generated-time path so future upstream export or rendering changes fail in test instead of at runtime.

## 0.1.2 - 2026-06-22

Focus: LLM-first natural-language time parsing with regex fallback.

### Fixed

- Absolute-date natural-language ranges like `6月21号凌晨5点到6月22号凌晨5点` were mis-parsed as `2026-06-22 06:00 → 2026-06-23 06:00`. Two compounding bugs: the regex clock parser matched the `6` in `6月` as the hour, and `dateByKeyword` ignored absolute dates (only relative words like 昨天/明天). Fixed by stripping absolute dates out of the clock-parsing segment and returning them explicitly, plus a regression test.

### New

- LLM-first time parsing: non-advanced-flag inputs now go through the current conversation model for semantic time-range understanding (`natural-time-ai.ts`), handling arbitrary phrasing (absolute dates, relative terms, embedded-in-sentence). Falls back to the regex parser when the model is unavailable, auth fails, or the model returns a malformed/low-confidence result. The confirmation prompt is retained on both paths.
- Smoke test for the extension handler call chain (`tests/smoke-daily-handler.mts`): loads `index.ts`, registers the `/daily` command via a mock pi, and runs the handler with mock ctx across regex-fallback, LLM-fallback, and advanced-flag paths. Added `npm run smoke` and `npm run verify` (check + test + smoke).

### Docs

- AGENTS.md now documents the three-layer verification discipline (unit test → smoke test → `pi -ne -e` load check) and the LLM-first + regex-fallback time-parsing rule, to prevent recurrence of the mis-parse bug.

## 0.1.1 - 2026-06-19

Focus: fully localize AI daily-report scaffolding across supported locales.

### Fixed

- AI summary prompt scaffolding is now localized across all 11 supported languages, including project placeholders, section headings, cross-project observation labels, and facts-intro instructions.
- Added prompt-localization tests across all supported locales to prevent Chinese-only scaffolding from leaking into non-Chinese reports.

### Docs

- README.md and AGENTS.md now document the localized AI prompt scaffolding rule and version bump.

## 0.1.0 - 2026-06-17

Focus: make overnight work and multilingual output first-class.

### New

- Auto-trace previous workday: running `/daily` between 00:00-05:00 uses `yesterday 05:00 → today 05:00` so overnight work is never lost.
- Natural-language time windows: `昨晚到今天凌晨`, `最近 8 小时`, `昨天晚上 8 点到凌晨 2 点`, etc.
- Deterministic time windows for advanced users: `--day-start`, `--since/--until`, `--from/--to`.
- Internationalization: 11 languages (Simplified/Traditional Chinese, Japanese, Korean, German, French, Spanish, Portuguese, Russian, Arabic, English), auto-detected from `PI_LOCALE` > `LC_ALL` > `LANG`.
- Confirmation prompt before generating when a natural-language window is interpreted, to avoid wrong time ranges.

### Fixed

- AI summary no longer falls back due to package loading: `@earendil-works/pi-ai` is now loaded via `import.meta.resolve` + a variable-specifier dynamic `import()` of its narrow `stream.js` entry. Eliminates both `No "exports" main defined` (require) and `A dynamic import callback was not specified` (new Function) errors.

### Docs

- AGENTS.md now documents the Pi ESM package loading constraint to prevent recurrence.

## 0.0.1 - 2026-06-13

Initial public release.

- Add `/daily` command for local Pi session daily reports.
- Scan local `~/.pi/agent/sessions/**/*.jsonl` files without modifying originals.
- Generate reports for today or a specific date.
- Support `--project current` and `--save`.
- Use the current conversation model for AI summary.
- Send only redacted structured facts to the model, not full raw session text.
- Group AI output by real projects and concrete work items.
- Fall back to local rule-based Markdown if AI summary fails.
- Add TypeScript source, tests, docs, and package metadata.
