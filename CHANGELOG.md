# Changelog

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
