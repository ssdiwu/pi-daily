// 日报 UI 文案字典，参考 pi-compaction-i18n 的 SECTION_LABELS 模式。
// 所有面向用户的标题、统计行、占位文本都从这里取，不硬编码。

import type { SupportedLanguage } from "./locale.ts";

export interface ReportLabels {
	reportTitle: (date: string) => string;
	generatedAt: string;
	window: string;
	sep: string;
	overview: string;
	activeProjects: string;
	completed: string;
	keyOutputs: string;
	filesAndTools: string;
	progress: string;
	outputs: string;
	risks: string;
	followUps: string;
	crossProjectObservations: string;
	scanWarnings: string;
	emptyHint: string;
	stats: {
		projects: (n: number) => string;
		sessions: (n: number) => string;
		entries: (n: number) => string;
		files: (n: number) => string;
		scanWarnings: (n: number) => string;
	};
	projectLine: (name: string, cwd: string, sessions: number, entries: number) => string;
	moreFiles: (n: number) => string;
	toolCount: (name: string, count: number) => string;
}

const L: Record<SupportedLanguage, Omit<ReportLabels, "stats" | "projectLine" | "moreFiles" | "toolCount">> = {
	"zh-Hans": {
		reportTitle: (d) => `${d} 工作日报`,
		generatedAt: "生成时间",
		sep: "：",
		window: "统计范围",
		overview: "今日概览",
		activeProjects: "活跃项目",
		completed: "完成事项",
		keyOutputs: "关键产出",
		filesAndTools: "文件与工具活动",
		progress: "进展",
		outputs: "产出",
		risks: "阻塞 / 风险",
		followUps: "待跟进",
		crossProjectObservations: "跨项目观察",
		scanWarnings: "解析警告",
		emptyHint: "暂无记录",
	},
	"zh-Hant": {
		reportTitle: (d) => `${d} 工作日報`,
		generatedAt: "產生時間",
		sep: "：",
		window: "統計範圍",
		overview: "今日概覽",
		activeProjects: "活躍項目",
		completed: "完成事項",
		keyOutputs: "關鍵產出",
		filesAndTools: "檔案與工具活動",
		progress: "進展",
		outputs: "產出",
		risks: "阻塞 / 風險",
		followUps: "待跟進",
		crossProjectObservations: "跨專案觀察",
		scanWarnings: "解析警告",
		emptyHint: "暫無記錄",
	},
	ja: {
		reportTitle: (d) => `${d} 日報`,
		generatedAt: "生成時間",
		sep: "：",
		window: "集計範囲",
		overview: "本日の概要",
		activeProjects: "アクティブプロジェクト",
		completed: "完了事項",
		keyOutputs: "主要な成果",
		filesAndTools: "ファイルとツールの活動",
		progress: "進捗",
		outputs: "成果",
		risks: "ブロック / リスク",
		followUps: "フォローアップ",
		crossProjectObservations: "プロジェクト横断の所見",
		scanWarnings: "解析の警告",
		emptyHint: "記録なし",
	},
	ko: {
		reportTitle: (d) => `${d} 업무 일일보고`,
		generatedAt: "생성 시간",
		sep: ": ",
		window: "집계 범위",
		overview: "오늘 개요",
		activeProjects: "활성 프로젝트",
		completed: "완료 사항",
		keyOutputs: "주요 산출물",
		filesAndTools: "파일 및 도구 활동",
		progress: "진행 상황",
		outputs: "산출물",
		risks: "차단 / 위험",
		followUps: "후속 조치",
		crossProjectObservations: "프로젝트 간 관찰",
		scanWarnings: "파싱 경고",
		emptyHint: "기록 없음",
	},
	de: {
		reportTitle: (d) => `${d} Arbeitsbericht`,
		generatedAt: "Erstellt am",
		sep: ": ",
		window: "Zeitraum",
		overview: "Überblick",
		activeProjects: "Aktive Projekte",
		completed: "Erledigt",
		keyOutputs: "Wichtige Ergebnisse",
		filesAndTools: "Datei- & Werkzeugaktivität",
		progress: "Fortschritt",
		outputs: "Ergebnisse",
		risks: "Blockaden / Risiken",
		followUps: "Offene Punkte",
		crossProjectObservations: "Projektübergreifende Beobachtungen",
		scanWarnings: "Analysewarnungen",
		emptyHint: "Keine Einträge",
	},
	fr: {
		reportTitle: (d) => `Rapport de travail du ${d}`,
		generatedAt: "Généré le",
		sep: " : ",
		window: "Période",
		overview: "Aperçu",
		activeProjects: "Projets actifs",
		completed: "Terminé",
		keyOutputs: "Résultats clés",
		filesAndTools: "Activité fichiers & outils",
		progress: "Progression",
		outputs: "Livrables",
		risks: "Blocages / Risques",
		followUps: "À suivre",
		crossProjectObservations: "Observations transverses",
		scanWarnings: "Avertissements d'analyse",
		emptyHint: "Aucun enregistrement",
	},
	es: {
		reportTitle: (d) => `Informe de trabajo del ${d}`,
		generatedAt: "Generado el",
		sep: ": ",
		window: "Período",
		overview: "Resumen",
		activeProjects: "Proyectos activos",
		completed: "Completado",
		keyOutputs: "Resultados clave",
		filesAndTools: "Actividad de archivos y herramientas",
		progress: "Progreso",
		outputs: "Resultados",
		risks: "Bloqueos / Riesgos",
		followUps: "Seguimiento",
		crossProjectObservations: "Observaciones transversales",
		scanWarnings: "Advertencias de análisis",
		emptyHint: "Sin registros",
	},
	pt: {
		reportTitle: (d) => `Relatório de trabalho de ${d}`,
		generatedAt: "Gerado em",
		sep: ": ",
		window: "Período",
		overview: "Visão geral",
		activeProjects: "Projetos ativos",
		completed: "Concluído",
		keyOutputs: "Resultados principais",
		filesAndTools: "Atividade de arquivos e ferramentas",
		progress: "Progresso",
		outputs: "Entregas",
		risks: "Bloqueios / Riscos",
		followUps: "Acompanhamento",
		crossProjectObservations: "Observações entre projetos",
		scanWarnings: "Avisos de análise",
		emptyHint: "Sem registros",
	},
	ru: {
		reportTitle: (d) => `Отчёт о работе за ${d}`,
		generatedAt: "Создано",
		sep: ": ",
		window: "Период",
		overview: "Обзор",
		activeProjects: "Активные проекты",
		completed: "Завершено",
		keyOutputs: "Ключевые результаты",
		filesAndTools: "Активность файлов и инструментов",
		progress: "Прогресс",
		outputs: "Результаты",
		risks: "Блокировки / Риски",
		followUps: "На контроле",
		crossProjectObservations: "Межпроектные наблюдения",
		scanWarnings: "Предупреждения анализа",
		emptyHint: "Нет записей",
	},
	ar: {
		reportTitle: (d) => `تقرير العمل ${d}`,
		generatedAt: "تاريخ الإنشاء",
		sep: ": ",
		window: "النطاق الزمني",
		overview: "نظرة عامة",
		activeProjects: "المشاريع النشطة",
		completed: "مكتمل",
		keyOutputs: "المخرجات الرئيسية",
		filesAndTools: "نشاط الملفات والأدوات",
		progress: "التقدم",
		outputs: "المخرجات",
		risks: "العوائق / المخاطر",
		followUps: "متابعة",
		crossProjectObservations: "ملاحظات عابرة للمشاريع",
		scanWarnings: "تحذيرات التحليل",
		emptyHint: "لا سجلات",
	},
	en: {
		reportTitle: (d) => `Work report for ${d}`,
		generatedAt: "Generated at",
		sep: ": ",
		window: "Window",
		overview: "Overview",
		activeProjects: "Active projects",
		completed: "Completed",
		keyOutputs: "Key outputs",
		filesAndTools: "Files & tools",
		progress: "Progress",
		outputs: "Outputs",
		risks: "Blockers / Risks",
		followUps: "Follow-ups",
		crossProjectObservations: "Cross-project observations",
		scanWarnings: "Parse warnings",
		emptyHint: "No records",
	},
};

function statsFor(lang: SupportedLanguage): ReportLabels["stats"] {
	switch (lang) {
		case "zh-Hans":
			return {
				projects: (n) => `活跃项目：${n} 个`,
				sessions: (n) => `活跃会话：${n} 个`,
				entries: (n) => `活动条目：${n} 条`,
				files: (n) => `涉及文件：${n} 个`,
				scanWarnings: (n) => `解析警告：${n} 条`,
			};
		case "zh-Hant":
			return {
				projects: (n) => `活躍項目：${n} 個`,
				sessions: (n) => `活躍工作階段：${n} 個`,
				entries: (n) => `活動條目：${n} 條`,
				files: (n) => `涉及檔案：${n} 個`,
				scanWarnings: (n) => `解析警告：${n} 條`,
			};
		default:
			return {
				projects: (n) => `Active projects: ${n}`,
				sessions: (n) => `Active sessions: ${n}`,
				entries: (n) => `Activity entries: ${n}`,
				files: (n) => `Files touched: ${n}`,
				scanWarnings: (n) => `Parse warnings: ${n}`,
			};
	}
}

export function reportLabelsFor(lang: SupportedLanguage): ReportLabels {
	const base = L[lang];
	const stats = statsFor(lang);
	const projectLine: ReportLabels["projectLine"] =
		lang === "zh-Hans"
			? (name, cwd, sessions, entries) => {
					const cwdPart = cwd ? `（${cwd}）` : "";
					return `${name}${cwdPart}：${sessions} 个 session，${entries} 条活动`;
				}
			: lang === "zh-Hant"
				? (name, cwd, sessions, entries) => {
						const cwdPart = cwd ? `（${cwd}）` : "";
						return `${name}${cwdPart}：${sessions} 個 session，${entries} 條活動`;
					}
				: (name, cwd, sessions, entries) => {
						const cwdPart = cwd ? ` (${cwd})` : "";
						return `${name}${cwdPart}: ${sessions} sessions, ${entries} entries`;
					};
	const moreFiles: ReportLabels["moreFiles"] =
		lang === "zh-Hans"
			? (n) => `另有 ${n} 个文件未展示`
			: lang === "zh-Hant"
				? (n) => `另有 ${n} 個檔案未展示`
				: (n) => `${n} more files not shown`;
	const toolCount: ReportLabels["toolCount"] =
		lang === "zh-Hans" || lang === "zh-Hant"
			? (name, count) => `${name}：${count} 次`
			: (name, count) => `${name}: ${count} times`;
	return { ...base, stats, projectLine, moreFiles, toolCount };
}
