# tests — pi-daily 测试

本目录存放 pi-daily 的自动测试，使用 Node.js 内置 `node:test`。

## 测试范围

- session JSONL 解析和坏行容错。
- 日期过滤和 session 聚合。
- 工具调用、文件活动、错误信息提取。
- Markdown 日报结构。
- 敏感信息脱敏。

## 运行

```bash
npm test
```

语法检查：

```bash
npm run check
```
