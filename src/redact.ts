const SECRET_PATTERNS: RegExp[] = [
	/AKIA[0-9A-Z]{16}/g,
	/sk-[A-Za-z0-9_-]{20,}/g,
	/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi,
	/(api[_-]?key\s*[=:]\s*)["']?[^\s"']+/gi,
	/([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)[^\s]+/gi,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function redactText(value = ""): string {
	let text = String(value);
	for (const pattern of SECRET_PATTERNS) {
		text = text.replace(pattern, (match: string, prefix?: string) => `${prefix || ""}[REDACTED]`);
	}
	return text;
}

export function truncateText(value = "", maxLength = 180): string {
	const text = redactText(String(value)).replace(/\s+/g, " ").trim();
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
