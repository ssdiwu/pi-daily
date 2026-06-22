// Smoke test: 用 Node 原生 TS stripping 加载 index.ts（模拟 pi 的 jiti 加载），
// 调用 default(pi) 让 /daily 命令注册，再用 mock ctx 跑 handler，
// 验证 parseDailyArgsAsync → LLM(失败) → 正则回退 整条链路在真实加载后能跑通。
//
// 运行：node --experimental-strip-types --no-warnings tests/smoke-daily-handler.mts
//
// 这是对单元测试的补充：单测只验纯函数，这里验 extension 入口 → 命令注册 → handler 调用链。

import assert from "node:assert/strict";

const messages = [];

function createMockPi() {
	const commands = [];
	const api = {
		registerCommand(name, command) {
			commands.push({ name, handler: command.handler });
		},
		sendMessage(msg) {
			messages.push(msg);
		},
	};
	return { commands, api };
}

function createMockCtx(overrides = {}) {
	return {
		hasUI: false,
		cwd: process.cwd(),
		// 无 model/modelRegistry → parseDailyArgsAsync 立即回退正则路径，验证回退正确性
		model: undefined,
		modelRegistry: undefined,
		...overrides,
	};
}

const mod = await import("../index.ts");
const piMock = createMockPi();
mod.default(piMock.api);

assert.equal(piMock.commands.length, 1, "exactly one command should be registered");
assert.equal(piMock.commands[0].name, "daily", "command name should be 'daily'");

const daily = piMock.commands[0];

// Case 1: 507 报的那个 bug 输入，无 ctx → 走正则回退，窗口必须正确解析
await daily.handler("6月21号凌晨5点到6月22号凌晨5点", createMockCtx());
assert.equal(messages.length, 1, "handler should send exactly one report message");
const report = messages[0];
assert.equal(report.customType, "pi-daily-report");
assert.match(report.details.window, /2026-06-21 05:00 → 2026-06-22 05:00/, `window label wrong: ${report.details.window}`);
assert.equal(report.details.date, "2026-06-21", `date wrong: ${report.details.date}`);

messages.length = 0;

// Case 2: ctx 有 model 但鉴权失败 → parseDailyArgsAsync 走 LLM 报错 → 回退正则
await daily.handler("昨晚到今天凌晨", createMockCtx({
	model: { provider: "x", id: "y" },
	modelRegistry: {
		getApiKeyAndHeaders: async () => { throw new Error("offline"); },
	},
}));
assert.equal(messages.length, 1);
assert.match(messages[0].details.window, /18:00 → .* 05:00/);

messages.length = 0;

// Case 3: advanced flag 路径（不触发 LLM）
await daily.handler("2026-06-12 --day-start 05:00", createMockCtx({
	model: { provider: "x", id: "y" },
	modelRegistry: {
		getApiKeyAndHeaders: async () => { throw new Error("should not be called"); },
	},
}));
assert.equal(messages.length, 1);
assert.match(messages[0].details.window, /2026-06-12 05:00 → 2026-06-13 05:00/);

console.log("✓ smoke test passed: /daily command registered, handler runs, time parsing correct across regex-fallback + LLM-fallback + advanced-flag paths");
