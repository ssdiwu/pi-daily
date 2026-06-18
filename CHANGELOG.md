# Changelog

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
