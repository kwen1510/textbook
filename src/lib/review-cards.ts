import { getAllSections, getChapter, getSectionLocation, type CourseSection } from "./course";

export type ReviewRating = "again" | "hard" | "good" | "easy";
export type ReviewMode = "mcq" | "open";

export type ReviewChoice = {
  id: string;
  text: string;
};

export type ReviewCardData = {
  id: string;
  sectionId: string;
  chapterTitle: string;
  sectionTitle: string;
  mode: ReviewMode;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  scenario?: string;
  choices?: ReviewChoice[];
  correctChoiceId?: string;
  suggestedAnswer: string;
  keyPoints: string[];
  sourceHint: string;
  href: string;
};

const reasoningKeywords = [
  "architecture",
  "availability",
  "compare",
  "cache",
  "cdn",
  "consistency",
  "database",
  "design",
  "example",
  "failover",
  "framework",
  "impact",
  "latency",
  "load balancer",
  "pattern",
  "partition",
  "performance",
  "principle",
  "process",
  "queue",
  "replication",
  "risk",
  "scalability",
  "shard",
  "strategy",
  "throughput",
  "trade",
  "traffic",
];

function cleanMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyPoints(section: CourseSection) {
  const lines = section.markdown
    .split("\n")
    .map((line) => cleanMarkdown(line))
    .filter((line) => line.length > 36 && !/^source:/i.test(line) && !/^table of contents/i.test(line));
  const unique = Array.from(new Set(lines));
  const points = unique.slice(0, 4).map((line) => line.slice(0, 220));
  if (points.length) return points;
  const text = cleanMarkdown(section.markdown);
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 36).slice(0, 4).map((sentence) => sentence.slice(0, 220));
}

function difficultyFor(section: CourseSection, text: string): ReviewCardData["difficulty"] {
  const haystack = `${section.title} ${text}`.toLowerCase();
  if (section.sourcePath.includes("solutions/") || reasoningKeywords.filter((keyword) => haystack.includes(keyword)).length >= 3) return "hard";
  if (text.length > 900 || reasoningKeywords.some((keyword) => haystack.includes(keyword))) return "medium";
  return "easy";
}

function modeFor(section: CourseSection, difficulty: ReviewCardData["difficulty"], text: string): ReviewMode {
  if (difficulty === "hard") return "open";
  if (section.sourcePath.includes("solutions/") || /step \d|design|approach|architecture|trade/i.test(section.title)) return "open";
  if (text.length < 650) return "mcq";
  return difficulty === "easy" ? "mcq" : "open";
}

function makeSuggestedAnswer(section: CourseSection, keyPoints: string[]) {
  if (keyPoints.length) return keyPoints.join("\n\n");
  return `A strong answer should explain the main idea of ${section.title}, why it matters in the course, and one concrete trade-off or example from the source section.`;
}

function makeScenario(section: CourseSection, chapterTitle: string, difficulty: ReviewCardData["difficulty"]) {
  if (section.sourcePath.includes("solutions/")) {
    return `You are being asked to reason through ${chapterTitle} and explain the approach out loud.`;
  }
  if (difficulty === "hard") return `You need to apply ${section.title} in a realistic situation and explain the constraints, trade-offs, and risks.`;
  return `You are reviewing a scenario and need to decide whether ${section.title} applies.`;
}

function makeMcqChoices(section: CourseSection, allSections: CourseSection[]) {
  const distractors = allSections
    .filter((candidate) => candidate.id !== section.id && candidate.title.toLowerCase() !== section.title.toLowerCase())
    .filter((candidate) => Math.abs(candidate.title.length - section.title.length) < 35)
    .slice(0, 12);
  const fallback = allSections.filter((candidate) => candidate.id !== section.id).slice(0, 12);
  const pool = distractors.length >= 3 ? distractors : fallback;
  const correctIndex = section.id.length % 4;
  const choices = pool.slice(0, 3).map((candidate) => candidate.title);
  const genericDistractors = [
    `A related but less specific idea than ${section.title}`,
    `A separate concept from another part of the course`,
    `A detail that does not answer the question directly`,
  ];
  for (const distractor of genericDistractors) {
    if (choices.length >= 3) break;
    choices.push(distractor);
  }
  choices.splice(correctIndex, 0, section.title);
  return choices.slice(0, 4).map((text, index) => ({ id: String.fromCharCode(65 + index), text }));
}

function makeQuestion(section: CourseSection, mode: ReviewMode, chapterTitle: string) {
  if (mode === "mcq") return `Which concept best fits the situation described in this section of ${chapterTitle}?`;
  if (section.sourcePath.includes("solutions/")) return `Describe the core design you would propose and the main trade-offs you would call out.`;
  return `Explain how ${section.title} would affect a real decision. Include the main idea, a trade-off, and one concrete example.`;
}

export function getReviewCards(): ReviewCardData[] {
  const sections = getAllSections();
  return sections.map((section) => {
    const chapter = getChapter(section.chapterSlug);
    const chapterTitle = chapter?.title ?? section.chapterSlug;
    const text = cleanMarkdown(section.markdown);
    const keyPoints = extractKeyPoints(section);
    const difficulty = difficultyFor(section, text);
    const mode = modeFor(section, difficulty, text);
    const href = getSectionLocation(section.id)?.href ?? `/course/${section.chapterSlug}#${section.slug}`;
    const card: ReviewCardData = {
      id: `${section.id}:${mode}`,
      sectionId: section.id,
      chapterTitle,
      sectionTitle: section.title,
      mode,
      difficulty,
      question: makeQuestion(section, mode, chapterTitle),
      scenario: makeScenario(section, chapterTitle, difficulty),
      suggestedAnswer: makeSuggestedAnswer(section, keyPoints),
      keyPoints,
      sourceHint: `Review "${section.title}" in "${chapterTitle}".`,
      href,
    };
    if (mode === "mcq") {
      card.choices = makeMcqChoices(section, sections);
      card.correctChoiceId = card.choices.find((choice) => choice.text === section.title)?.id ?? "A";
    }
    return card;
  });
}
