// 语言检测与映射，参考 pi-compaction-i18n 的 locale.ts 模式。
// 优先级：PI_LOCALE > LC_ALL > LANG，收敛成 SupportedLanguage 枚举。

export type SupportedLanguage =
	| "zh-Hans"
	| "zh-Hant"
	| "ja"
	| "ko"
	| "de"
	| "fr"
	| "es"
	| "pt"
	| "ru"
	| "ar"
	| "en";

/**
 * 从环境变量检测 locale。
 * 优先级：PI_LOCALE > LC_ALL > LANG
 */
export function detectLocale(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const candidates = [env.PI_LOCALE, env.LC_ALL, env.LANG].filter(Boolean) as string[];
	for (const raw of candidates) {
		const value = raw.trim();
		if (!value) continue;
		const base = value.split(".")[0]!.replace(/_/g, "-");
		if (base) return base;
	}
	return undefined;
}

export function languageForLocale(locale?: string): SupportedLanguage {
	if (!locale) return "en";
	const [rawLang, rawRegion] = locale.split("-");
	const lang = rawLang?.toLowerCase() ?? "en";
	const region = rawRegion?.toUpperCase() ?? "";
	switch (lang) {
		case "zh":
			return region === "TW" || region === "HK" || region === "MO" ? "zh-Hant" : "zh-Hans";
		case "ja":
			return "ja";
		case "ko":
			return "ko";
		case "de":
			return "de";
		case "fr":
			return "fr";
		case "es":
			return "es";
		case "pt":
			return "pt";
		case "ru":
			return "ru";
		case "ar":
			return "ar";
		default:
			return "en";
	}
}

/**
 * 给 AI 的语言指令，前置到 summary prompt 里，让 AI 用目标语言产出日报。
 */
export function languageInstructionForLocale(locale?: string): string {
	switch (languageForLocale(locale)) {
		case "zh-Hans":
			return "请用简体中文输出整份日报，所有标题和正文必须是简体中文。";
		case "zh-Hant":
			return "請用繁體中文輸出整份日報，所有標題和正文必須是繁體中文。";
		case "ja":
			return "Write the entire report in Japanese (日本語). All headings and body content must be in Japanese.";
		case "ko":
			return "Write the entire report in Korean (한국어). All headings and body content must be in Korean.";
		case "de":
			return "Write the entire report in German (Deutsch). All headings and body content must be in German.";
		case "fr":
			return "Write the entire report in French (Français). All headings and body content must be in French.";
		case "es":
			return "Write the entire report in Spanish (Español). All headings and body content must be in Spanish.";
		case "pt":
			return "Write the entire report in Portuguese (Português). All headings and body content must be in Portuguese.";
		case "ru":
			return "Write the entire report in Russian (Русский). All headings and body content must be in Russian.";
		case "ar":
			return "Write the entire report in Arabic (العربية). All headings and body content must be in Arabic.";
		case "en":
		default:
			return "Write the entire report in English. All headings and body content must be in English.";
	}
}
