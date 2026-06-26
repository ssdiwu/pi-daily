import { redactText, truncateText } from "./redact.ts";
import { languageForLocale, languageInstructionForLocale, type SupportedLanguage } from "./locale.ts";
import { loadPiAICompleteModule } from "./pi-ai-loader.ts";
import { reportLabelsFor, type ReportLabels } from "./report-labels.ts";
import type { AISummaryResult, ProjectSummary, ReportModel, TimedText } from "./types.ts";

const AI_TIMEOUT_MS = 90_000;
const MAX_ITEMS_PER_SECTION = 8;

type RuntimeModel = any;
type RuntimeContext = any;

interface SummarySignal {
	type: "completed" | "output" | "followUp" | "risk";
	time: string;
	text: string;
}

interface ProjectFacts {
	name: string;
	cwd: string;
	isDefaultWorkspace: boolean;
	sessionCount: number;
	entryCount: number;
	tasks: TimedText[];
	completed: TimedText[];
	outputs: TimedText[];
	risks: TimedText[];
	followUps: TimedText[];
	toolCounts: ProjectSummary["toolCounts"];
	files: string[];
}

interface SummaryFacts {
	date: string;
	generatedAt: string;
	window: string;
	stats: ReportModel["stats"];
	projects: ProjectFacts[];
	signals: SummarySignal[];
}

function limitItems(items: TimedText[] = [], maxItems: number, maxLength = 180): TimedText[] {
	return items.slice(0, maxItems).map((item) => ({
		time: item.time || "",
		text: truncateText(redactText(item.text || ""), maxLength),
	}));
}

function buildSignals(report: ReportModel, maxItems: number): SummarySignal[] {
	const toSignal = (type: SummarySignal["type"], item: TimedText): SummarySignal => ({ type, time: item.time || "", text: truncateText(redactText(item.text || ""), 220) });
	return [
		...report.completed.map((item) => toSignal("completed", item)),
		...report.assistantNotes.map((item) => toSignal("output", item)),
		...report.followUps.map((item) => toSignal("followUp", item)),
		...report.errors.map((item) => toSignal("risk", item)),
		...report.blockers.map((item) => toSignal("risk", item)),
	]
		.filter((item) => item.text)
		.slice(0, Math.max(maxItems * 4, 24));
}

function buildProjectFacts(project: ProjectSummary, maxItems: number): ProjectFacts {
	return {
		name: project.projectName,
		cwd: redactText(project.cwd || ""),
		isDefaultWorkspace: project.isDefaultWorkspace,
		sessionCount: project.sessionCount,
		entryCount: project.entryCount,
		tasks: limitItems(project.tasks, maxItems, 160),
		completed: limitItems(project.completed, maxItems, 160),
		outputs: limitItems(project.outputs, maxItems, 160),
		risks: limitItems(project.risks, maxItems, 160),
		followUps: limitItems(project.followUps, maxItems, 160),
		toolCounts: project.toolCounts.slice(0, 10),
		files: project.files.slice(0, 12).map((file) => redactText(file)),
	};
}

export function buildSummaryFacts(report: ReportModel, maxItems = MAX_ITEMS_PER_SECTION): SummaryFacts {
	return {
		date: report.date,
		generatedAt: report.generatedAt,
		window: report.window.label,
		stats: report.stats,
		projects: report.projects.map((project) => buildProjectFacts(project, maxItems)),
		signals: buildSignals(report, maxItems),
	};
}

interface SummaryPromptTemplate {
	assistantIntro: string;
	coreRequirement: string;
	defaultWorkspaceRule: string;
	sectionRequirement: (labels: ReportLabels) => string;
	noReplayRule: string;
	markdownStructureIntro: string;
	titleMetaInstruction: (labels: ReportLabels) => string;
	overviewInstruction: string;
	sampleProjectHeading1: string;
	sampleProjectHeading2: string;
	rulesTitle: string;
	emptyContentRule: (labels: ReportLabels) => string;
	realProjectNameRule: string;
	isolateProjectsRule: string;
	crossProjectRule: string;
	filesAndToolsRule: string;
	factsIntro: string;
}

const SUMMARY_PROMPT_TEMPLATES: Record<SupportedLanguage, SummaryPromptTemplate> = {
	"zh-Hans": {
		assistantIntro: "你是日报整理助手。请基于给定的结构化工作事实，生成一份按真实项目和工作事项分组的日报总结。",
		coreRequirement: "核心要求：不要按全局的完成事项/关键产出/阻塞/待跟进混排；真实项目目录必须逐一输出，每个真实项目都必须有自己的章节。",
		defaultWorkspaceRule: "如果 project.isDefaultWorkspace 为 true，说明它只是默认工作区/用户主目录，不是项目；必须把其中内容拆成实际工作事项。",
		sectionRequirement: (labels) => `每个项目或事项章节至少包含：${labels.progress}、${labels.outputs}、${labels.risks}、${labels.followUps}。`,
		noReplayRule: "不要回放用户原始提问，不要逐条复述聊天记录。要合并同一项目/事项里的多轮对话，提炼成可交付结果和下一步动作。",
		markdownStructureIntro: "严格输出 Markdown，并使用以下结构和本地化标题：",
		titleMetaInstruction: (labels) => `在标题下方依次写：${labels.generatedAt}（必须使用 facts.generatedAt）、${labels.window}（必须使用 facts.window）。`,
		overviewInstruction: "用 3-5 条 bullet 概括今天做了哪几类事情。",
		sampleProjectHeading1: "## <项目名或事项一>",
		sampleProjectHeading2: "## <项目名或事项二>",
		rulesTitle: "规则：",
		emptyContentRule: (labels) => `- 每个项目/事项都必须有上述 4 个三级标题；没有内容时写“${labels.emptyHint}”。`,
		realProjectNameRule: "- 对真实项目目录，项目名直接使用 cwd 对应项目名或目录名。",
		isolateProjectsRule: "- 不要让某个项目或事项的内容覆盖另一个项目；每个真实项目都要单独总结。",
		crossProjectRule: "- 跨项目观察只写共性问题、共性进展或共性风险。",
		filesAndToolsRule: "- 工具与文件活动只做简短归纳，不要列出大量伪路径或内部字段。",
		factsIntro: "下面是脱敏后的结构化事实 JSON：",
	},
	"zh-Hant": {
		assistantIntro: "你是日報整理助手。請基於給定的結構化工作事實，生成一份按真實專案和工作事項分組的日報總結。",
		coreRequirement: "核心要求：不要把完成事項 / 關鍵產出 / 阻塞 / 待跟進混成全域清單；真實專案目錄必須逐一輸出，每個真實專案都要有自己的章節。",
		defaultWorkspaceRule: "如果 project.isDefaultWorkspace 為 true，表示它只是預設工作區 / 使用者主目錄，不是專案；必須把其中內容拆成實際工作事項。",
		sectionRequirement: (labels) => `每個專案或事項章節至少包含：${labels.progress}、${labels.outputs}、${labels.risks}、${labels.followUps}。`,
		noReplayRule: "不要回放使用者原始提問，不要逐條複述聊天記錄。要合併同一專案 / 事項中的多輪對話，提煉成可交付結果和下一步動作。",
		markdownStructureIntro: "請嚴格輸出 Markdown，並使用以下結構與本地化標題：",
		titleMetaInstruction: (labels) => `在標題下方依序寫：${labels.generatedAt}（必須使用 facts.generatedAt）、${labels.window}（統計範圍必須使用 facts.window）。`,
		overviewInstruction: "用 3-5 條 bullet 概括今天完成了哪些類型的工作。",
		sampleProjectHeading1: "## <專案名或事項一>",
		sampleProjectHeading2: "## <專案名或事項二>",
		rulesTitle: "規則：",
		emptyContentRule: (labels) => `- 每個專案 / 事項都必須有上述 4 個三級標題；沒有內容時寫「${labels.emptyHint}」。`,
		realProjectNameRule: "- 對真實專案目錄，專案名直接使用 cwd 對應的專案名或目錄名。",
		isolateProjectsRule: "- 不要讓某個專案或事項的內容覆蓋另一個專案；每個真實專案都要單獨總結。",
		crossProjectRule: "- 跨專案觀察只寫共通問題、共通進展或共通風險。",
		filesAndToolsRule: "- 檔案與工具活動只做簡短歸納，不要列出大量偽路徑或內部欄位。",
		factsIntro: "以下是脫敏後的結構化事實 JSON：",
	},
	ja: {
		assistantIntro: "あなたは日報整理アシスタントです。与えられた構造化された作業事実に基づき、実際のプロジェクトと作業項目ごとに整理された日報を作成してください。",
		coreRequirement: "重要要件：完了事項 / 主要成果 / ブロック / フォローアップを全体の一覧として混在させないでください。実際のプロジェクトディレクトリごとに必ず章を作成してください。",
		defaultWorkspaceRule: "project.isDefaultWorkspace が true の場合、それはデフォルトのワークスペースまたはホームディレクトリであり、プロジェクトではありません。内容を実際の作業項目に分解してください。",
		sectionRequirement: (labels) => `各プロジェクトまたは項目の章には少なくとも ${labels.progress}、${labels.outputs}、${labels.risks}、${labels.followUps} を含めてください。`,
		noReplayRule: "ユーザーの元の質問を繰り返したり、会話履歴を逐語的に列挙したりしないでください。同一プロジェクト / 項目の複数ターンを統合し、成果と次のアクションに要約してください。",
		markdownStructureIntro: "Markdown を厳密に出力し、以下の構造とローカライズ済み見出しを使用してください：",
		titleMetaInstruction: (labels) => `タイトルの直下に ${labels.generatedAt} と ${labels.window} をこの順で書いてください（${labels.generatedAt} には facts.generatedAt、集計範囲には facts.window を必ず使用）。`,
		overviewInstruction: "今日行った作業カテゴリを 3〜5 個の bullet で要約してください。",
		sampleProjectHeading1: "## <プロジェクト名または作業項目1>",
		sampleProjectHeading2: "## <プロジェクト名または作業項目2>",
		rulesTitle: "ルール：",
		emptyContentRule: (labels) => `- 各プロジェクト / 項目には上記 4 つの三級見出しを必ず含め、内容がない場合は「${labels.emptyHint}」と書いてください。`,
		realProjectNameRule: "- 実際のプロジェクトディレクトリについては、cwd に対応するプロジェクト名またはディレクトリ名をそのまま使ってください。",
		isolateProjectsRule: "- あるプロジェクト / 項目の内容が別のプロジェクトを覆わないようにし、各実プロジェクトを個別に要約してください。",
		crossProjectRule: "- プロジェクト横断の所見には、共通の問題・進捗・リスクのみを書いてください。",
		filesAndToolsRule: "- ファイルとツールの活動は簡潔に要約し、大量の疑似パスや内部フィールドは列挙しないでください。",
		factsIntro: "以下は秘匿化済みの構造化事実 JSON です：",
	},
	ko: {
		assistantIntro: "당신은 일일보고 정리 도우미입니다. 주어진 구조화된 작업 사실을 바탕으로 실제 프로젝트와 작업 항목별로 정리된 일일보고를 작성하세요.",
		coreRequirement: "핵심 요구사항: 완료 사항 / 주요 산출물 / 차단 / 후속 조치를 전역 목록처럼 섞지 마세요. 실제 프로젝트 디렉터리마다 반드시 별도 섹션을 만들어야 합니다.",
		defaultWorkspaceRule: "project.isDefaultWorkspace 가 true 이면 기본 작업공간 또는 홈 디렉터리일 뿐 프로젝트가 아닙니다. 해당 내용을 실제 작업 항목으로 분해하세요.",
		sectionRequirement: (labels) => `각 프로젝트 또는 항목 섹션에는 최소한 ${labels.progress}, ${labels.outputs}, ${labels.risks}, ${labels.followUps} 가 포함되어야 합니다.`,
		noReplayRule: "사용자의 원문 질문을 반복하지 말고, 대화 기록을 줄줄이 재생하지 마세요. 같은 프로젝트 / 항목의 여러 턴을 합쳐 납품 가능한 결과와 다음 행동으로 정리하세요.",
		markdownStructureIntro: "반드시 Markdown 으로 출력하고, 아래의 구조와 현지화된 제목을 사용하세요:",
		titleMetaInstruction: (labels) => `제목 아래에 ${labels.generatedAt}, ${labels.window} 를 이 순서로 쓰세요(${labels.generatedAt} 은 facts.generatedAt, 집계 범위는 facts.window 사용).`,
		overviewInstruction: "오늘 한 작업 유형을 3~5개의 bullet 로 요약하세요.",
		sampleProjectHeading1: "## <프로젝트명 또는 작업 항목 1>",
		sampleProjectHeading2: "## <프로젝트명 또는 작업 항목 2>",
		rulesTitle: "규칙:",
		emptyContentRule: (labels) => `- 각 프로젝트 / 항목에는 위의 4개 3단계 제목이 모두 있어야 하며, 내용이 없으면 "${labels.emptyHint}" 를 쓰세요.`,
		realProjectNameRule: "- 실제 프로젝트 디렉터리는 cwd 에 해당하는 프로젝트명 또는 디렉터리명을 그대로 사용하세요.",
		isolateProjectsRule: "- 한 프로젝트 / 항목의 내용이 다른 프로젝트를 덮지 않게 하고, 각 실제 프로젝트를 따로 요약하세요.",
		crossProjectRule: "- 프로젝트 간 관찰에는 공통 문제, 공통 진행 상황, 공통 위험만 적으세요.",
		filesAndToolsRule: "- 파일 및 도구 활동은 짧게 요약하고, 가짜 경로나 내부 필드를 길게 나열하지 마세요.",
		factsIntro: "아래는 민감정보를 가린 구조화 사실 JSON 입니다:",
	},
	de: {
		assistantIntro: "Du bist ein Assistent zum Erstellen von Tagesberichten. Erzeuge auf Basis der gegebenen strukturierten Arbeitsfakten einen Bericht, der nach echten Projekten und Arbeitspunkten gegliedert ist.",
		coreRequirement: "Kernanforderung: Vermische Erledigtes / wichtige Ergebnisse / Blockaden / Follow-ups nicht zu einer globalen Liste. Für jedes echte Projektverzeichnis muss es einen eigenen Abschnitt geben.",
		defaultWorkspaceRule: "Wenn project.isDefaultWorkspace true ist, handelt es sich nur um den Standard-Arbeitsbereich bzw. das Home-Verzeichnis, nicht um ein Projekt. Zerlege den Inhalt in konkrete Arbeitspunkte.",
		sectionRequirement: (labels) => `Jeder Projekt- oder Arbeitspunkt-Abschnitt muss mindestens ${labels.progress}, ${labels.outputs}, ${labels.risks} und ${labels.followUps} enthalten.`,
		noReplayRule: "Wiederhole nicht die ursprüngliche Nutzerfrage und liste den Chatverlauf nicht Zeile für Zeile auf. Fasse mehrere Runden desselben Projekts / Punkts zu Ergebnissen und nächsten Schritten zusammen.",
		markdownStructureIntro: "Gib strikt Markdown aus und verwende die folgende Struktur mit lokalisierten Überschriften:",
		titleMetaInstruction: (labels) => `Schreibe direkt unter die Überschrift zuerst ${labels.generatedAt}, dann ${labels.window} (für ${labels.generatedAt} muss facts.generatedAt verwendet werden, für den Zeitraum facts.window).`,
		overviewInstruction: "Fasse die heutigen Arbeitskategorien in 3–5 Bullet Points zusammen.",
		sampleProjectHeading1: "## <Projektname oder Arbeitspunkt 1>",
		sampleProjectHeading2: "## <Projektname oder Arbeitspunkt 2>",
		rulesTitle: "Regeln:",
		emptyContentRule: (labels) => `- Jeder Projekt- / Punkt-Abschnitt muss die obigen vier Überschriften der dritten Ebene enthalten; wenn es keinen Inhalt gibt, schreibe „${labels.emptyHint}“.`,
		realProjectNameRule: "- Für echte Projektverzeichnisse verwende den Projektnamen bzw. Verzeichnisnamen aus cwd direkt als Abschnittstitel.",
		isolateProjectsRule: "- Der Inhalt eines Projekts / Punkts darf keinen anderen Projektabschnitt überdecken; jedes echte Projekt muss separat zusammengefasst werden.",
		crossProjectRule: "- In projektübergreifenden Beobachtungen nur gemeinsame Probleme, Fortschritte oder Risiken aufführen.",
		filesAndToolsRule: "- Datei- und Werkzeugaktivität nur kurz zusammenfassen; keine langen Listen mit Pseudopfaden oder internen Feldern.",
		factsIntro: "Unten folgt das bereinigte JSON mit den strukturierten Fakten:",
	},
	fr: {
		assistantIntro: "Tu es un assistant de synthèse quotidienne. À partir des faits de travail structurés fournis, génère un rapport regroupé par projets réels et éléments de travail concrets.",
		coreRequirement: "Exigence principale : ne mélange pas Terminé / Résultats clés / Blocages / À suivre dans une liste globale. Chaque vrai répertoire de projet doit avoir sa propre section.",
		defaultWorkspaceRule: "Si project.isDefaultWorkspace vaut true, cela représente seulement l'espace de travail par défaut ou le dossier personnel, pas un projet. Il faut découper ce contenu en éléments de travail réels.",
		sectionRequirement: (labels) => `Chaque section de projet ou d'élément doit au minimum contenir ${labels.progress}, ${labels.outputs}, ${labels.risks} et ${labels.followUps}.`,
		noReplayRule: "Ne rejoue pas la question originale de l'utilisateur et ne récite pas l'historique conversationnel ligne par ligne. Fusionne les tours d'un même projet / élément pour dégager les résultats livrables et les prochaines actions.",
		markdownStructureIntro: "Produis strictement du Markdown et utilise la structure suivante avec des titres localisés :",
		titleMetaInstruction: (labels) => `Sous le titre, écris dans l'ordre ${labels.generatedAt} puis ${labels.window} (${labels.generatedAt} doit utiliser facts.generatedAt et la période doit utiliser facts.window).`,
		overviewInstruction: "Résume les grands types de travail du jour en 3 à 5 puces.",
		sampleProjectHeading1: "## <Nom du projet ou élément de travail 1>",
		sampleProjectHeading2: "## <Nom du projet ou élément de travail 2>",
		rulesTitle: "Règles :",
		emptyContentRule: (labels) => `- Chaque projet / élément doit contenir les 4 sous-titres de niveau 3 ci-dessus ; s'il n'y a rien, écris « ${labels.emptyHint} ».`,
		realProjectNameRule: "- Pour un vrai répertoire de projet, utilise directement le nom du projet ou du dossier correspondant à cwd.",
		isolateProjectsRule: "- Le contenu d'un projet / élément ne doit pas écraser celui d'un autre ; chaque vrai projet doit être résumé séparément.",
		crossProjectRule: "- Les observations transverses ne doivent contenir que des problèmes, avancées ou risques communs.",
		filesAndToolsRule: "- L'activité fichiers & outils doit rester concise ; n'énumère pas une longue liste de faux chemins ou de champs internes.",
		factsIntro: "Voici le JSON des faits structurés après masquage des informations sensibles :",
	},
	es: {
		assistantIntro: "Eres un asistente para resumir informes diarios. A partir de los hechos de trabajo estructurados proporcionados, genera un informe agrupado por proyectos reales y elementos de trabajo concretos.",
		coreRequirement: "Requisito clave: no mezcles Completado / Resultados clave / Bloqueos / Seguimiento en una lista global. Cada directorio de proyecto real debe tener su propia sección.",
		defaultWorkspaceRule: "Si project.isDefaultWorkspace es true, solo representa el espacio de trabajo predeterminado o el directorio personal, no un proyecto. Debes dividir su contenido en elementos de trabajo reales.",
		sectionRequirement: (labels) => `Cada sección de proyecto o elemento debe incluir al menos ${labels.progress}, ${labels.outputs}, ${labels.risks} y ${labels.followUps}.`,
		noReplayRule: "No repitas la pregunta original del usuario ni recites el historial del chat línea por línea. Fusiona los turnos del mismo proyecto / elemento y destila resultados entregables y próximos pasos.",
		markdownStructureIntro: "Devuelve estrictamente Markdown y usa la siguiente estructura con encabezados localizados:",
		titleMetaInstruction: (labels) => `Debajo del título escribe, en este orden, ${labels.generatedAt} y ${labels.window} (${labels.generatedAt} debe usar facts.generatedAt y el período debe usar facts.window).`,
		overviewInstruction: "Resume los tipos de trabajo de hoy en 3 a 5 viñetas.",
		sampleProjectHeading1: "## <Nombre del proyecto o tarea 1>",
		sampleProjectHeading2: "## <Nombre del proyecto o tarea 2>",
		rulesTitle: "Reglas:",
		emptyContentRule: (labels) => `- Cada proyecto / elemento debe contener los 4 subtítulos de tercer nivel anteriores; si no hay contenido, escribe “${labels.emptyHint}”.`,
		realProjectNameRule: "- Para un directorio de proyecto real, usa directamente como título el nombre del proyecto o del directorio correspondiente al cwd.",
		isolateProjectsRule: "- El contenido de un proyecto / elemento no debe cubrir a otro; cada proyecto real debe resumirse por separado.",
		crossProjectRule: "- En las observaciones transversales, incluye solo problemas, avances o riesgos comunes.",
		filesAndToolsRule: "- La actividad de archivos y herramientas debe resumirse brevemente; no enumeres muchos pseudo-rutas ni campos internos.",
		factsIntro: "A continuación se muestra el JSON de hechos estructurados ya depurados:",
	},
	pt: {
		assistantIntro: "Você é um assistente de consolidação de relatório diário. Com base nos fatos estruturados de trabalho fornecidos, gere um relatório agrupado por projetos reais e itens concretos de trabalho.",
		coreRequirement: "Requisito principal: não misture Concluído / Resultados principais / Bloqueios / Acompanhamento em uma lista global. Cada diretório de projeto real deve ter sua própria seção.",
		defaultWorkspaceRule: "Se project.isDefaultWorkspace for true, isso representa apenas o workspace padrão ou o diretório pessoal, não um projeto. Divida esse conteúdo em itens reais de trabalho.",
		sectionRequirement: (labels) => `Cada seção de projeto ou item deve incluir pelo menos ${labels.progress}, ${labels.outputs}, ${labels.risks} e ${labels.followUps}.`,
		noReplayRule: "Não repita a pergunta original do usuário nem reencene o histórico do chat linha por linha. Una os turnos do mesmo projeto / item e resuma em entregas e próximos passos.",
		markdownStructureIntro: "Produza estritamente em Markdown e use a seguinte estrutura com títulos localizados:",
		titleMetaInstruction: (labels) => `Logo abaixo do título, escreva ${labels.generatedAt} e ${labels.window}, nessa ordem (${labels.generatedAt} deve usar facts.generatedAt e o período deve usar facts.window).`,
		overviewInstruction: "Resuma os tipos de trabalho de hoje em 3 a 5 bullets.",
		sampleProjectHeading1: "## <Nome do projeto ou item de trabalho 1>",
		sampleProjectHeading2: "## <Nome do projeto ou item de trabalho 2>",
		rulesTitle: "Regras:",
		emptyContentRule: (labels) => `- Cada projeto / item deve conter os 4 subtítulos de nível 3 acima; se não houver conteúdo, escreva “${labels.emptyHint}”.`,
		realProjectNameRule: "- Para diretórios de projeto reais, use diretamente o nome do projeto ou do diretório correspondente ao cwd.",
		isolateProjectsRule: "- O conteúdo de um projeto / item não deve encobrir outro; cada projeto real deve ser resumido separadamente.",
		crossProjectRule: "- Em observações entre projetos, registre apenas problemas, progressos ou riscos em comum.",
		filesAndToolsRule: "- A atividade de arquivos e ferramentas deve ser resumida brevemente; não liste muitos pseudo-caminhos ou campos internos.",
		factsIntro: "Abaixo está o JSON com os fatos estruturados já redigidos:",
	},
	ru: {
		assistantIntro: "Ты помощник по подготовке ежедневного отчёта. На основе переданных структурированных фактов о работе создай отчёт, сгруппированный по реальным проектам и рабочим пунктам.",
		coreRequirement: "Ключевое требование: не смешивай Завершено / Ключевые результаты / Блокировки / На контроле в один глобальный список. Для каждого реального проектного каталога должен быть отдельный раздел.",
		defaultWorkspaceRule: "Если project.isDefaultWorkspace = true, это означает лишь стандартное рабочее пространство или домашний каталог, а не проект. Разбей такое содержимое на реальные рабочие пункты.",
		sectionRequirement: (labels) => `Каждый раздел проекта или пункта должен как минимум содержать ${labels.progress}, ${labels.outputs}, ${labels.risks} и ${labels.followUps}.`,
		noReplayRule: "Не повторяй исходный вопрос пользователя и не пересказывай чат построчно. Объединяй несколько ходов по одному проекту / пункту и выделяй результаты и следующие шаги.",
		markdownStructureIntro: "Строго выдай Markdown и используй следующую структуру с локализованными заголовками:",
		titleMetaInstruction: (labels) => `Сразу под заголовком укажи ${labels.generatedAt}, затем ${labels.window} (${labels.generatedAt} обязательно бери из facts.generatedAt, для периода используй facts.window).`,
		overviewInstruction: "Кратко опиши основные типы работ за сегодня в 3–5 пунктах.",
		sampleProjectHeading1: "## <Название проекта или рабочего пункта 1>",
		sampleProjectHeading2: "## <Название проекта или рабочего пункта 2>",
		rulesTitle: "Правила:",
		emptyContentRule: (labels) => `- В каждом разделе проекта / пункта должны быть все 4 заголовка третьего уровня выше; если данных нет, напиши «${labels.emptyHint}».`,
		realProjectNameRule: "- Для реального проектного каталога используй в качестве заголовка имя проекта или каталога из cwd.",
		isolateProjectsRule: "- Содержимое одного проекта / пункта не должно перекрывать другой; каждый реальный проект нужно суммировать отдельно.",
		crossProjectRule: "- В межпроектных наблюдениях указывай только общие проблемы, прогресс или риски.",
		filesAndToolsRule: "- Активность файлов и инструментов описывай кратко; не перечисляй длинные псевдопути или внутренние поля.",
		factsIntro: "Ниже приведён обезличенный JSON со структурированными фактами:",
	},
	ar: {
		assistantIntro: "أنت مساعد لتنظيم التقرير اليومي. بالاعتماد على حقائق العمل المهيكلة المعطاة، أنشئ تقريراً منظماً حسب المشاريع الحقيقية وعناصر العمل الفعلية.",
		coreRequirement: "المتطلب الأساسي: لا تخلط مكتمل / المخرجات الرئيسية / العوائق / المتابعة في قائمة عامة واحدة. يجب أن يكون لكل مجلد مشروع حقيقي قسم مستقل.",
		defaultWorkspaceRule: "إذا كانت project.isDefaultWorkspace تساوي true فهذا يعني أنها مساحة العمل الافتراضية أو المجلد الرئيسي فقط وليست مشروعاً. يجب تفكيك محتواها إلى عناصر عمل فعلية.",
		sectionRequirement: (labels) => `يجب أن يحتوي كل قسم مشروع أو عنصر على الأقل على ${labels.progress} و${labels.outputs} و${labels.risks} و${labels.followUps}.`,
		noReplayRule: "لا تعِد سؤال المستخدم الأصلي ولا تسرد سجل المحادثة سطراً بسطر. ادمج الجولات الخاصة بالمشروع / العنصر نفسه واستخلص النتائج القابلة للتسليم والخطوات التالية.",
		markdownStructureIntro: "أخرج النتيجة بصيغة Markdown فقط، واستخدم البنية التالية مع العناوين المترجمة:",
		titleMetaInstruction: (labels) => `تحت العنوان مباشرة اكتب ${labels.generatedAt} ثم ${labels.window} بهذا الترتيب (يجب استخدام facts.generatedAt لـ ${labels.generatedAt} و facts.window للنطاق الزمني).`,
		overviewInstruction: "لخّص أنواع العمل التي أُنجزت اليوم في 3 إلى 5 نقاط تعداد.",
		sampleProjectHeading1: "## <اسم المشروع أو عنصر العمل 1>",
		sampleProjectHeading2: "## <اسم المشروع أو عنصر العمل 2>",
		rulesTitle: "القواعد:",
		emptyContentRule: (labels) => `- يجب أن يحتوي كل مشروع / عنصر على عناوين المستوى الثالث الأربعة أعلاه؛ وإذا لم يوجد محتوى فاكتب "${labels.emptyHint}".`,
		realProjectNameRule: "- بالنسبة إلى مجلدات المشاريع الحقيقية، استخدم اسم المشروع أو اسم المجلد المطابق لـ cwd مباشرة كعنوان.",
		isolateProjectsRule: "- يجب ألا يطغى محتوى مشروع / عنصر على مشروع آخر؛ يجب تلخيص كل مشروع حقيقي بشكل مستقل.",
		crossProjectRule: "- في الملاحظات العابرة للمشاريع اذكر فقط المشكلات أو التقدم أو المخاطر المشتركة.",
		filesAndToolsRule: "- لخّص نشاط الملفات والأدوات باقتضاب، ولا تسرد عدداً كبيراً من المسارات الوهمية أو الحقول الداخلية.",
		factsIntro: "فيما يلي JSON منقّح يحتوي على الحقائق المهيكلة:",
	},
	en: {
		assistantIntro: "You are a daily report assistant. Based on the provided structured work facts, generate a daily report grouped by real projects and concrete work items.",
		coreRequirement: "Core requirement: do not mix Completed / Key outputs / Blockers / Follow-ups into one global list. Every real project directory must have its own section.",
		defaultWorkspaceRule: "If project.isDefaultWorkspace is true, it is only the default workspace or home directory, not a real project. Split its content into actual work items.",
		sectionRequirement: (labels) => `Each project or work-item section must include at least ${labels.progress}, ${labels.outputs}, ${labels.risks}, and ${labels.followUps}.`,
		noReplayRule: "Do not replay the user's raw prompt or summarize the chat turn by turn. Merge multiple turns for the same project or item into deliverables and next actions.",
		markdownStructureIntro: "Output strict Markdown and use the following localized structure and headings:",
		titleMetaInstruction: (labels) => `Under the title, write ${labels.generatedAt} and ${labels.window} in that order (${labels.generatedAt} must use facts.generatedAt and the time window must use facts.window).`,
		overviewInstruction: "Use 3-5 bullets to summarize the main categories of work completed today.",
		sampleProjectHeading1: "## <Project or work item 1>",
		sampleProjectHeading2: "## <Project or work item 2>",
		rulesTitle: "Rules:",
		emptyContentRule: (labels) => `- Every project or item must contain the 4 level-3 headings above; if a section has no content, write \"${labels.emptyHint}\".`,
		realProjectNameRule: "- For a real project directory, use the project name or directory name from cwd directly as the section title.",
		isolateProjectsRule: "- Do not let the content of one project or item cover another; every real project must be summarized separately.",
		crossProjectRule: "- Cross-project observations should only contain shared issues, shared progress, or shared risks.",
		filesAndToolsRule: "- Files & tools should be summarized briefly; do not dump long pseudo-path or internal-field lists.",
		factsIntro: "Below is the redacted structured facts JSON:",
	},
};

function summaryPromptTemplateFor(lang: SupportedLanguage): SummaryPromptTemplate {
	return SUMMARY_PROMPT_TEMPLATES[lang] ?? SUMMARY_PROMPT_TEMPLATES.en;
}

export function buildSummaryPrompt(report: ReportModel, maxItems = MAX_ITEMS_PER_SECTION, locale?: string): string {
	const facts = buildSummaryFacts(report, maxItems);
	const lang = languageForLocale(locale);
	const labels = reportLabelsFor(lang);
	const langHint = languageInstructionForLocale(locale);
	const template = summaryPromptTemplateFor(lang);
	return [
		template.assistantIntro,
		langHint,
		template.coreRequirement,
		template.defaultWorkspaceRule,
		template.sectionRequirement(labels),
		template.noReplayRule,
		template.markdownStructureIntro,
		`# ${labels.reportTitle(report.date)}`,
		template.titleMetaInstruction(labels),
		`## ${labels.overview}`,
		template.overviewInstruction,
		template.sampleProjectHeading1,
		`### ${labels.progress}`,
		`### ${labels.outputs}`,
		`### ${labels.risks}`,
		`### ${labels.followUps}`,
		template.sampleProjectHeading2,
		`### ${labels.progress}`,
		`### ${labels.outputs}`,
		`### ${labels.risks}`,
		`### ${labels.followUps}`,
		`## ${labels.completed} / ${labels.keyOutputs} / ${labels.crossProjectObservations} / ${labels.filesAndTools}`,
		template.rulesTitle,
		template.emptyContentRule(labels),
		template.realProjectNameRule,
		template.isolateProjectsRule,
		template.crossProjectRule,
		template.filesAndToolsRule,
		template.factsIntro,
		JSON.stringify(facts, null, 2),
	].join("\n\n");
}

async function callCurrentModel(model: RuntimeModel, promptText: string, ctx: RuntimeContext): Promise<string> {
	if (!model) {
		throw new Error("current session model is not available");
	}
	let auth: any;
	try {
		auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	} catch (error) {
		throw new Error(`auth failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!auth?.ok) {
		throw new Error(`auth not ok: ${auth?.error || "unknown"}`);
	}
	if (!auth.apiKey) {
		throw new Error("auth missing apiKey");
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(new Error("pi-daily AI summary timed out")), AI_TIMEOUT_MS);
	try {
		const { complete } = await loadPiAICompleteModule();
		const response: any = await complete(
			model,
			{
				messages: [{ role: "user", content: [{ type: "text", text: promptText }], timestamp: Date.now() }],
			},
			{ apiKey: auth.apiKey, headers: auth.headers, maxTokens: 1800, signal: controller.signal },
		);
		if (response.errorMessage) {
			throw new Error(response.errorMessage);
		}
		return response.content.filter((item: any) => item.type === "text").map((item: any) => item.text).join("\n").trim();
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function summarizeReportWithAI(report: ReportModel, ctx: RuntimeContext, locale?: string): Promise<AISummaryResult> {
	const prompt = buildSummaryPrompt(report, MAX_ITEMS_PER_SECTION, locale);
	const model = ctx.model;
	const modelId = model ? `${model.provider}/${model.id}` : "";
	try {
		const markdown = await callCurrentModel(model, prompt, ctx);
		if (markdown) {
			return { markdown, source: "ai", model: modelId, errors: [] };
		}
		return { markdown: "", source: "fallback", errors: [`${modelId || "current model"}: empty response`] };
	} catch (error) {
		return { markdown: "", source: "fallback", errors: [`${modelId || "current model"}: ${error instanceof Error ? error.message : String(error)}`] };
	}
}
