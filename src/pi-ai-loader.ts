export interface PiAICompleteModule {
	complete: (...args: any[]) => Promise<any>;
}

type ResolveSpecifier = (specifier: string) => string;
type ImportModule = (specifier: string) => Promise<any>;

const COMPAT_SPECIFIER = "@earendil-works/pi-ai/compat";
const ROOT_SPECIFIER = "@earendil-works/pi-ai";

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function hasComplete(value: any): value is PiAICompleteModule {
	return typeof value?.complete === "function";
}

async function loadPiAICompleteModuleWith(resolveSpecifier: ResolveSpecifier, importModule: ImportModule): Promise<PiAICompleteModule> {
	const attempts: string[] = [];

	try {
		const compatUrl = resolveSpecifier(COMPAT_SPECIFIER);
		const compatModule = await importModule(compatUrl);
		if (hasComplete(compatModule)) {
			return compatModule;
		}
		attempts.push(`${COMPAT_SPECIFIER} missing complete()`);
	} catch (error) {
		attempts.push(`${COMPAT_SPECIFIER}: ${formatError(error)}`);
	}

	try {
		const rootUrl = resolveSpecifier(ROOT_SPECIFIER);
		const legacyStreamUrl = new URL("./stream.js", rootUrl).href;
		const legacyModule = await importModule(legacyStreamUrl);
		if (hasComplete(legacyModule)) {
			return legacyModule;
		}
		attempts.push(`${legacyStreamUrl} missing complete()`);
	} catch (error) {
		attempts.push(`${ROOT_SPECIFIER} legacy stream.js: ${formatError(error)}`);
	}

	throw new Error(`Cannot load pi-ai complete(): ${attempts.join("; ")}`);
}

export async function loadPiAICompleteModule(): Promise<PiAICompleteModule> {
	return loadPiAICompleteModuleWith(
		(specifier) => import.meta.resolve(specifier),
		async (specifier) => import(specifier),
	);
}

export const __test__ = {
	formatError,
	loadPiAICompleteModuleWith,
};
