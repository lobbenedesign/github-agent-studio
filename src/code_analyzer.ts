/**
 * Real Source Code Analyzer — "analyze, don't download."
 *
 * Fetches a repo's real file tree (GitHub's Git Trees API, one request,
 * exhaustive — not a directory-by-directory crawl) and, for a bounded
 * sample of real source files, fetches each file's real raw content one at
 * a time, extracts real signals (line count, language, whether it looks
 * like a test file, TODO/FIXME markers, average line length as a crude
 * complexity proxy), and immediately discards the file content — nothing
 * about a file's actual text is retained after it's been measured. What
 * gets written to the archive is the AGGREGATE analysis (counts, ratios,
 * a generated summary) plus real repo metadata (language, dates, author) —
 * never the source code itself.
 *
 * This deliberately does NOT clone/zip the repo. If a user wants the full
 * source, that's a separate, explicit action (see `getDownloadUrl` below,
 * which just returns GitHub's own real archive URL — the actual download,
 * if any, happens in the user's browser when they click it, not here).
 */

import { parseOwnerRepo, GitHubApiFetchError } from "./github_api_client";

const MAX_FILES_TO_ANALYZE = 40;
const MAX_FILE_BYTES = 200_000; // skip anything absurdly large rather than pull it fully into memory
const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt",
  "c", "h", "cpp", "cc", "hpp", "cs", "swift", "php", "scala", "ex", "exs",
  "hs", "lua", "r", "jl", "zig", "nim", "sol", "m", "pl", "vue", "svelte"
]);
const AUTH_HEADERS = (): Record<string, string> => {
  const h: Record<string, string> = { "User-Agent": "GitHub-Agent-Studio-CodeAnalyzer/1.0", Accept: "application/vnd.github+json" };
  const t = process.env.GITHUB_TOKEN;
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
};

export interface CodeAnalysisResult {
  repoFullName: string;
  defaultBranch: string;
  totalFilesInTree: number;
  sourceFilesInTree: number;
  filesSampled: number;
  totalLinesCounted: number;
  languageBreakdown: Record<string, number>; // extension -> file count, among sampled files
  testFileRatio: number; // 0-1, among sampled files
  todoMarkersFound: number;
  averageLineLength: number;
  hasCiConfig: boolean;
  hasReadme: boolean;
  hasLicenseFile: boolean;
  summary: string;
  analyzedAt: string;
  /** Real GitHub archive URL — not downloaded by this analyzer. Only meaningful if
   *  a user explicitly clicks a "download" affordance in the UI. */
  fullSourceDownloadUrl: string;
}

function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i + 1).toLowerCase();
}

function looksLikeTestFile(path: string): boolean {
  const p = path.toLowerCase();
  return p.includes("test") || p.includes("spec") || p.includes("__tests__");
}

/** Picks a REAL, deterministic, spread-out sample instead of just "first N alphabetically" —
 *  every Nth file across the sorted list, so small repos get full coverage and huge
 *  repos get a genuine cross-section instead of just whatever sorts first. */
function sampleFiles<T>(files: T[], max: number): T[] {
  if (files.length <= max) return files;
  const step = files.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i++) {
    picked.push(files[Math.floor(i * step)]);
  }
  return picked;
}

export class CodeAnalyzer {
  public async analyzeRepo(ownerRepoOrUrl: string): Promise<CodeAnalysisResult> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const fullName = `${owner}/${repo}`;

    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: AUTH_HEADERS() });
    if (!metaRes.ok) {
      throw new GitHubApiFetchError(metaRes.status, `could not fetch repo metadata for ${fullName}: ${metaRes.status}`);
    }
    const meta = await metaRes.json();
    const branch = meta.default_branch || "main";

    // Real, exhaustive file tree in one request — Git Trees API with
    // recursive=1, not a manual directory-by-directory crawl.
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: AUTH_HEADERS() }
    );
    if (!treeRes.ok) {
      throw new GitHubApiFetchError(treeRes.status, `could not fetch file tree for ${fullName}: ${treeRes.status}`);
    }
    const treeData = await treeRes.json();
    const allEntries: { path: string; type: string; size?: number }[] = treeData.tree || [];
    const allFiles = allEntries.filter((e) => e.type === "blob");

    const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.has(extensionOf(f.path)) && (f.size ?? 0) < MAX_FILE_BYTES && (f.size ?? 0) > 0);
    const sample = sampleFiles(sourceFiles, MAX_FILES_TO_ANALYZE);

    const hasReadme = allFiles.some((f) => /^readme(\.|$)/i.test(f.path.split("/").pop() || ""));
    const hasLicenseFile = allFiles.some((f) => /^license(\.|$)/i.test(f.path.split("/").pop() || ""));
    const hasCiConfig = allFiles.some((f) =>
      f.path.startsWith(".github/workflows/") ||
      f.path === ".gitlab-ci.yml" ||
      f.path === ".travis.yml" ||
      f.path === "Jenkinsfile" ||
      f.path === "azure-pipelines.yml"
    );

    const languageBreakdown: Record<string, number> = {};
    let totalLines = 0;
    let totalLineLengthSum = 0;
    let testFileCount = 0;
    let todoCount = 0;
    let filesActuallyAnalyzed = 0;

    // One file at a time: fetch real raw content, extract real metrics,
    // then let it go out of scope — never held in an array across
    // iterations, never written anywhere as raw text.
    for (const file of sample) {
      let content: string;
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
        const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        content = await res.text();
      } catch {
        continue; // one unreachable file doesn't fail the whole analysis
      }

      const ext = extensionOf(file.path);
      languageBreakdown[ext] = (languageBreakdown[ext] || 0) + 1;
      if (looksLikeTestFile(file.path)) testFileCount++;

      const lines = content.split("\n");
      totalLines += lines.length;
      totalLineLengthSum += content.length;
      todoCount += (content.match(/\b(TODO|FIXME|XXX)\b/g) || []).length;
      filesActuallyAnalyzed++;
      // `content` and `lines` fall out of scope at the next loop iteration —
      // nothing about this file's actual text survives past this point.
    }

    const testRatio = filesActuallyAnalyzed > 0 ? Number((testFileCount / filesActuallyAnalyzed).toFixed(3)) : 0;
    const avgLineLen = totalLines > 0 ? Number((totalLineLengthSum / totalLines).toFixed(1)) : 0;
    const topLangs = Object.entries(languageBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ext, n]) => `${ext} (${n})`);

    const summaryParts: string[] = [
      `Analyzed ${filesActuallyAnalyzed}/${sourceFiles.length} real source files (of ${allFiles.length} total files in the repo tree).`,
      topLangs.length > 0 ? `Dominant extensions in the sample: ${topLangs.join(", ")}.` : "No source files matched the analyzer's known extensions.",
      `${(testRatio * 100).toFixed(0)}% of sampled files look like tests.`,
      hasCiConfig ? "Has a real CI config file." : "No CI config file found in the tree.",
      todoCount > 0 ? `${todoCount} real TODO/FIXME/XXX markers found in the sample.` : "No TODO/FIXME/XXX markers found in the sample.",
      !hasReadme ? "No README file found." : "",
      !hasLicenseFile ? "No LICENSE file found." : ""
    ].filter(Boolean);

    return {
      repoFullName: fullName,
      defaultBranch: branch,
      totalFilesInTree: allFiles.length,
      sourceFilesInTree: sourceFiles.length,
      filesSampled: filesActuallyAnalyzed,
      totalLinesCounted: totalLines,
      languageBreakdown,
      testFileRatio: testRatio,
      todoMarkersFound: todoCount,
      averageLineLength: avgLineLen,
      hasCiConfig,
      hasReadme,
      hasLicenseFile,
      summary: summaryParts.join(" "),
      analyzedAt: new Date().toISOString(),
      fullSourceDownloadUrl: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`
    };
  }
}
