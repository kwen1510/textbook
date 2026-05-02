import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import type { Root, Image, Link } from "mdast";
import { visit } from "unist-util-visit";
import { slugify } from "../src/lib/slug";

type Section = {
  id: string;
  chapterSlug: string;
  title: string;
  slug: string;
  level: number;
  order: number;
  sourcePath: string;
  markdown: string;
  html: string;
  recallPrompt: string;
};

type Chapter = {
  id: string;
  title: string;
  slug: string;
  order: number;
  sourcePath: string;
  description: string;
  sections: Section[];
};

type SourceInfo = {
  repository: string;
  commit: string;
  license: string;
  generatedAt: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "content/source");
const publicAssetDir = path.join(rootDir, "public/course-assets");
const generatedDir = path.join(rootDir, "src/generated");
const acknowledgementPath = path.join(rootDir, "ACKNOWLEDGEMENTS.md");
const textbookConfigPath = path.join(rootDir, "textbook.config.json");
const cliSourceRepoUrl = process.argv[2];
const configuredSourceRepoUrl = readConfiguredSourceRepoUrl();
const sourceRepoUrl = cliSourceRepoUrl ?? process.env.SOURCE_REPO_URL ?? configuredSourceRepoUrl;
const sourcePathToChapterSlug = new Map<string, string>();
let activeSourceRepository = sourceRepoUrl ? normalizeRepoUrl(sourceRepoUrl) : "local content";
let activeSourceCommit = "local-content";

function normalizeRepoUrl(url: string) {
  return url.replace(/\.git$/, "");
}

function readConfiguredSourceRepoUrl() {
  if (!existsSync(textbookConfigPath)) return undefined;
  try {
    const config = JSON.parse(readFileSync(textbookConfigPath, "utf8")) as { sourceRepoUrl?: string };
    return config.sourceRepoUrl;
  } catch {
    return undefined;
  }
}

function writeTextbookConfig(repoUrl: string) {
  const existing = existsSync(textbookConfigPath) ? readFileSync(textbookConfigPath, "utf8") : "";
  const next = `${JSON.stringify({ sourceRepoUrl: normalizeRepoUrl(repoUrl) }, null, 2)}\n`;
  if (existing !== next) writeFileSync(textbookConfigPath, next);
}

function runGit(args: string[], cwd = rootDir) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function cloneSourceIfRequested() {
  if (!sourceRepoUrl) return;
  rmSync(sourceDir, { recursive: true, force: true });
  mkdirSync(path.dirname(sourceDir), { recursive: true });
  execFileSync("git", ["clone", "--depth", "1", sourceRepoUrl, sourceDir], { stdio: "inherit" });
  activeSourceCommit = runGit(["rev-parse", "HEAD"], sourceDir);
  writeTextbookConfig(sourceRepoUrl);
  rmSync(path.join(sourceDir, ".git"), { recursive: true, force: true });
}

function getSourceCommit() {
  if (activeSourceCommit !== "local-content") return activeSourceCommit;
  if (existsSync(path.join(sourceDir, ".git"))) {
    try {
      return runGit(["rev-parse", "HEAD"], sourceDir);
    } catch {
      return "local-content";
    }
  }
  return "local-content";
}

function hasSourceContent() {
  return existsSync(sourceDir) && readdirSync(sourceDir).some((entry) => !entry.startsWith("."));
}

function makePlaceholderCourse(): { source: SourceInfo; chapters: Chapter[] } {
  const html = '<h1 id="welcome-to-textbook">Welcome to Textbook</h1>\n<p>Add a public GitHub repository with Markdown content, then run <code>npm run ingest -- &lt;repo-url&gt;</code>.</p>\n<p><a href="https://github.com/kwen1510/textbook" target="_blank" rel="noopener noreferrer">Textbook template</a></p>';
  return {
    source: {
      repository: "No source repository ingested yet",
      commit: "placeholder",
      license: "Source license not detected yet",
      generatedAt: "deterministic-build-artifact",
    },
    chapters: [
      {
        id: "welcome",
        title: "Welcome to Textbook",
        slug: "welcome",
        order: 0,
        sourcePath: "placeholder",
        description: "A placeholder course that is replaced after ingestion.",
        sections: [
          {
            id: "welcome:welcome-to-textbook",
            chapterSlug: "welcome",
            title: "Welcome to Textbook",
            slug: "welcome-to-textbook",
            level: 1,
            order: 0,
            sourcePath: "placeholder",
            markdown: "# Welcome to Textbook\n\nAdd a public GitHub repository with Markdown content, then run `npm run ingest -- <repo-url>`.\n",
            html,
            recallPrompt: "Explain what this course will help you learn once content is ingested.",
          },
        ],
      },
    ],
  };
}

function normalizeImageUrl(url: string): string {
  if (url.startsWith("http://i.imgur.com/")) return url.replace("http://", "https://");
  return url;
}

function copyAsset(relativeFromSource: string): string {
  const normalized = relativeFromSource.split(path.sep).join("/").replace(/^\.\//, "");
  const source = path.join(sourceDir, normalized);
  if (!existsSync(source)) return relativeFromSource;
  const target = path.join(publicAssetDir, normalized);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  return `/course-assets/${normalized}`;
}

function isMarkdownFile(filePath: string) {
  return /\.(md|mdx)$/i.test(filePath);
}

function shouldSkipDir(name: string) {
  return [".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo", ".vercel"].includes(name);
}

function walkFiles(relativeDir = ""): string[] {
  const absoluteDir = path.join(sourceDir, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(absoluteDir)) {
    if (entry.startsWith(".") || shouldSkipDir(entry)) continue;
    const relativePath = path.posix.join(relativeDir, entry);
    const absolutePath = path.join(sourceDir, relativePath);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) files.push(...walkFiles(relativePath));
    else files.push(relativePath);
  }
  return files;
}

function discoverMarkdownFiles() {
  const allMarkdown = walkFiles().filter(isMarkdownFile);
  const preferredRoots = ["README.md", "readme.md"];
  const preferredDirs = ["docs/", "book/", "content/"];
  const selected = new Set<string>();
  for (const file of preferredRoots) if (allMarkdown.includes(file)) selected.add(file);
  for (const file of allMarkdown) if (preferredDirs.some((dir) => file.startsWith(dir))) selected.add(file);
  if (!selected.size) for (const file of allMarkdown) selected.add(file);
  return [...selected].sort((a, b) => {
    const aRoot = /^readme\.md$/i.test(a) ? 0 : 1;
    const bRoot = /^readme\.md$/i.test(b) ? 0 : 1;
    return aRoot - bRoot || a.localeCompare(b);
  });
}

function findLicenseFile() {
  return walkFiles().find((file) => /^(license|licence|copying)(\.|$)/i.test(path.basename(file)));
}

function classifyLicense(licenseFile: string) {
  const text = readFileSync(path.join(sourceDir, licenseFile), "utf8").toLowerCase();
  if (text.includes("creative commons attribution 4.0") || text.includes("cc by 4.0")) return "CC BY 4.0 attribution license";
  if (text.includes("creative commons attribution-noncommercial") || text.includes("cc by-nc")) return "Creative Commons noncommercial license";
  if (text.includes("mit license")) return "MIT license";
  if (text.includes("apache license") && text.includes("version 2.0")) return "Apache-2.0 license";
  if (text.includes("bsd")) return "BSD-style license";
  if (text.includes("gnu general public license") || text.includes("gpl")) return "GPL-family copyleft license";
  return "license file detected; review terms manually";
}

function detectLicense() {
  const licenseFile = findLicenseFile();
  if (!licenseFile) return "Source license not detected. Check the upstream repository before publishing transformed content.";
  return `${licenseFile} (${classifyLicense(licenseFile)})`;
}

function enforceSourceLicenseGate(license: string) {
  if (!sourceRepoUrl || !license.toLowerCase().includes("not detected")) return;
  if (process.env.TEXTBOOK_ALLOW_UNLICENSED_SOURCE === "true") {
    console.warn("Warning: TEXTBOOK_ALLOW_UNLICENSED_SOURCE=true bypassed the no-license safety gate. Keep the generated course private unless you have permission.");
    return;
  }
  throw new Error([
    "No source license was detected.",
    "Textbook does not ingest unlicensed public repositories by default because public GitHub access is not the same as permission to copy, adapt, or deploy content.",
    "Use content you own, choose a source with a clear license, get written permission, or set TEXTBOOK_ALLOW_UNLICENSED_SOURCE=true only for private content you are authorized to use.",
  ].join("\n"));
}

function blobUrl(relativePath: string) {
  if (!activeSourceRepository.startsWith("http")) return relativePath;
  const ref = activeSourceCommit === "local-content" ? "HEAD" : activeSourceCommit;
  return `${activeSourceRepository}/blob/${ref}/${relativePath}`;
}

function normalizeRawHtmlAttributes(markdown: string, sourcePath?: string): string {
  const sourceFolder = path.dirname(sourcePath ?? "README.md");
  return markdown
    .replace(/(<a\b[^>]*?\shref=)([^"'\s>]+)([^>]*>)/gi, (_match, prefix: string, url: string, suffix: string) => `${prefix}"${url}"${suffix}`)
    .replace(/(<img\b[^>]*?\ssrc=)(["']?)([^"'\s>]+)(["']?)([^>]*>)/gi, (match, prefix: string, openQuote: string, rawUrl: string, closeQuote: string, suffix: string) => {
      if (openQuote && closeQuote && openQuote !== closeQuote) return match;
      let url = normalizeImageUrl(rawUrl);
      if (!/^(https?:)?\/\//.test(url) && !url.startsWith("/")) {
        const relative = path.posix.normalize(path.posix.join(sourceFolder, url));
        url = copyAsset(relative);
      }
      return `${prefix}"${url}"${suffix}`;
    });
}

function addExternalLinkTargets(html: string): string {
  return html.replace(/<a\b([^>]*\shref="https?:\/\/[^\"]+"[^>]*)>/gi, (_match, attrs: string) => {
    let updatedAttrs = attrs;
    if (!/\starget=/i.test(updatedAttrs)) updatedAttrs += ' target="_blank"';
    if (!/\srel=/i.test(updatedAttrs)) updatedAttrs += ' rel="noopener noreferrer"';
    return `<a${updatedAttrs}>`;
  });
}

function rewriteRelativeLinks(tree: Root, sourcePath: string) {
  const sourceFolder = path.dirname(sourcePath);
  visit(tree, "link", (node: Link) => {
    if (!node.url || /^(https?:)?\/\//.test(node.url) || node.url.startsWith("#") || node.url.startsWith("mailto:")) return;
    const [urlPath, hash = ""] = node.url.split("#");
    const normalized = path.posix.normalize(path.posix.join(sourceFolder, urlPath));
    const chapterSlug = sourcePathToChapterSlug.get(normalized) ?? sourcePathToChapterSlug.get(path.posix.join(normalized, "README.md"));
    if (chapterSlug) {
      node.url = `/course/${chapterSlug}${hash ? `#${hash}` : ""}`;
      return;
    }
    node.url = blobUrl(normalized) + (hash ? `#${hash}` : "");
  });
}

async function renderMarkdown(markdown: string, sourcePath: string): Promise<string> {
  const normalizedMarkdown = normalizeRawHtmlAttributes(markdown, sourcePath);
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(() => (tree: Root) => {
      rewriteRelativeLinks(tree, sourcePath);
      visit(tree, "image", (node: Image) => {
        if (!node.url) return;
        node.url = normalizeImageUrl(node.url);
        if (!/^(https?:)?\/\//.test(node.url) && !node.url.startsWith("/")) {
          const relative = path.posix.normalize(path.posix.join(path.dirname(sourcePath), node.url));
          node.url = copyAsset(relative);
        }
      });
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeStringify, { allowDangerousHtml: true });
  return addExternalLinkTargets(String(await processor.process(normalizedMarkdown)));
}

function headingText(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").replace(/\s+#+$/, "").trim();
}

function titleFromMarkdown(markdown: string, sourcePath: string) {
  const heading = markdown.split("\n").find((line) => /^#{1,3}\s+/.test(line));
  if (heading) return headingText(heading);
  const name = path.basename(sourcePath).replace(/\.(md|mdx)$/i, "");
  return name.toLowerCase() === "readme" ? "Course" : name.replace(/[-_]/g, " ");
}

function descriptionFromMarkdown(markdown: string): string {
  const withoutHeading = markdown.replace(/^#{1,3}\s+.*\n?/, "");
  for (const line of withoutHeading.split("\n")) {
    const text = normalizeRawHtmlAttributes(line)
      .replace(/^>\s*/, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (text.length > 30 && !/^source:/i.test(text)) return text.slice(0, 180);
  }
  return "Course study material.";
}

function splitByHeadings(markdown: string, chapterSlug: string, sourcePath: string): Omit<Section, "html">[] {
  const lines = markdown.split("\n");
  const headingRegex = /^(#{1,3})\s+(.+)$/;
  const chunks: Omit<Section, "html">[] = [];
  let current: { title: string; slug: string; level: number; lines: string[]; order: number } | null = null;
  const slugCounts = new Map<string, number>();

  function uniqueSlug(title: string): string {
    const baseSlug = slugify(title) || "section";
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
  }

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      if (current) chunks.push(makeSectionInput(chapterSlug, sourcePath, current));
      const title = headingText(line);
      current = { title, slug: uniqueSlug(title), level: match[1].length, lines: [line], order: chunks.length };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) chunks.push(makeSectionInput(chapterSlug, sourcePath, current));
  if (chunks.length) return chunks;

  const fallbackTitle = titleFromMarkdown(markdown, sourcePath);
  return [makeSectionInput(chapterSlug, sourcePath, {
    title: fallbackTitle,
    slug: uniqueSlug(fallbackTitle),
    level: 1,
    lines: [`# ${fallbackTitle}`, markdown],
    order: 0,
  })];
}

function makeSectionInput(chapterSlug: string, sourcePath: string, current: { title: string; slug: string; level: number; lines: string[]; order: number }): Omit<Section, "html"> {
  return {
    id: `${chapterSlug}:${current.slug}`,
    chapterSlug,
    title: current.title,
    slug: current.slug,
    level: current.level,
    order: current.order,
    sourcePath,
    markdown: current.lines.join("\n"),
    recallPrompt: `Explain ${current.title} from memory, including the main ideas, trade-offs, and one concrete example.`,
  };
}

async function makeChapter(sourcePath: string, order: number): Promise<Chapter> {
  const raw = matter(readFileSync(path.join(sourceDir, sourcePath), "utf8")).content.trim();
  const title = titleFromMarkdown(raw, sourcePath);
  const slug = sourcePathToChapterSlug.get(sourcePath) ?? (slugify(title) || slugify(sourcePath.replace(/\.(md|mdx)$/i, "")));
  const sectionInputs = splitByHeadings(raw, slug, sourcePath);
  const sections = await Promise.all(sectionInputs.map(async (section) => ({ ...section, html: await renderMarkdown(section.markdown, sourcePath) })));
  return {
    id: slug,
    title,
    slug,
    order,
    sourcePath,
    description: descriptionFromMarkdown(sections[0]?.markdown ?? raw),
    sections,
  };
}

function uniqueSlugFromCounts(baseSlug: string, counts: Map<string, number>) {
  const safeBaseSlug = baseSlug || "chapter";
  const count = counts.get(safeBaseSlug) ?? 0;
  counts.set(safeBaseSlug, count + 1);
  return count === 0 ? safeBaseSlug : `${safeBaseSlug}-${count + 1}`;
}

function rewriteInternalCourseLinks(chapters: Chapter[]) {
  const hrefBySlug = new Map<string, string>();
  const hrefsByHtmlId = new Map<string, string[]>();
  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      hrefBySlug.set(section.slug, `/course/${chapter.slug}#${section.slug}`);
      for (const match of section.html.matchAll(/\sid="([^"]+)"/g)) {
        const id = match[1];
        const href = `/course/${chapter.slug}#${id}`;
        hrefsByHtmlId.set(id, [...(hrefsByHtmlId.get(id) ?? []), href]);
      }
    }
  }
  const hrefByUniqueHtmlId = new Map(
    [...hrefsByHtmlId.entries()]
      .filter(([, hrefs]) => new Set(hrefs).size === 1)
      .map(([id, hrefs]) => [id, hrefs[0]]),
  );

  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      section.html = section.html.replace(/href="#([^"]+)"/g, (match, slug: string) => {
        const href = hrefBySlug.get(slug) ?? hrefByUniqueHtmlId.get(slug);
        return href ? `href="${href}"` : match;
      });
    }
  }
}

function writeAcknowledgements(source: SourceInfo) {
  const licenseLine = source.license.toLowerCase().includes("not detected") ? source.license : `Detected license file: \`${source.license}\`.`;
  writeFileSync(acknowledgementPath, `# Acknowledgements\n\nThis Textbook app transforms content from:\n\n- ${source.repository}\n\nSource commit: \`${source.commit}\`\n\n${licenseLine}\n\nAll credit for the source educational material belongs to the upstream authors and contributors. This repository adds the Textbook study interface, notes, progress tracking, recall prompts, PWA shell, and optional AI transcription/study assistant features.\n\nImportant: The Textbook template license does not grant rights to the upstream content. Only publish or share a generated course if the source license or written permission allows copying, transformation, and redistribution.\n`);
}

function writeGenerated(course: { source: SourceInfo; chapters: Chapter[] }) {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(path.join(generatedDir, "course.json"), `${JSON.stringify(course, null, 2)}\n`);
  writeFileSync(path.join(generatedDir, "course.ts"), `import course from "./course.json";\n\nexport default course;\n`);
  writeAcknowledgements(course.source);
}

async function main() {
  cloneSourceIfRequested();
  rmSync(publicAssetDir, { recursive: true, force: true });
  mkdirSync(publicAssetDir, { recursive: true });

  if (!hasSourceContent()) {
    const course = makePlaceholderCourse();
    writeGenerated(course);
    console.log("Generated placeholder Textbook course. Run `npm run ingest -- <public-github-repo-url>` to import content.");
    return;
  }

  activeSourceCommit = getSourceCommit();
  if (!sourceRepoUrl && existsSync(path.join(sourceDir, ".git"))) {
    try {
      activeSourceRepository = normalizeRepoUrl(runGit(["remote", "get-url", "origin"], sourceDir));
    } catch {
      activeSourceRepository = "local content";
    }
  }

  const markdownFiles = discoverMarkdownFiles();
  if (!markdownFiles.length) throw new Error("No Markdown files found in content/source. Textbook v1 expects Markdown-heavy repositories.");

  const chapterSlugCounts = new Map<string, number>();
  for (const sourcePath of markdownFiles) {
    const raw = matter(readFileSync(path.join(sourceDir, sourcePath), "utf8")).content.trim();
    const title = titleFromMarkdown(raw, sourcePath);
    const baseSlug = slugify(title) || slugify(sourcePath.replace(/\.(md|mdx)$/i, ""));
    sourcePathToChapterSlug.set(sourcePath, uniqueSlugFromCounts(baseSlug, chapterSlugCounts));
  }

  const chapters: Chapter[] = [];
  for (const sourcePath of markdownFiles) chapters.push(await makeChapter(sourcePath, chapters.length));
  rewriteInternalCourseLinks(chapters);

  const source = {
    repository: activeSourceRepository,
    commit: activeSourceCommit,
    license: detectLicense(),
    generatedAt: "deterministic-build-artifact",
  };
  enforceSourceLicenseGate(source.license);
  if (source.license.toLowerCase().includes("not detected")) {
    console.warn("Warning: no source license was detected. Keep the generated course private unless you have permission to use and redistribute the content.");
  }
  writeGenerated({ source, chapters });
  console.log(`Generated ${chapters.length} chapters and ${chapters.reduce((count, chapter) => count + chapter.sections.length, 0)} sections from ${source.repository} at ${source.commit}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
