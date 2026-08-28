#!/usr/bin/env bun
/**
 * 🐙 GITHUB-AGENT STUDIO SERVER (v1.0.0)
 * Universal A-to-Z GitHub Repository Intelligence, Version Tracker & Active Fork Hunter
 */

import { RepoIndexer } from "./src/repo_indexer";
import { WikiGenerator } from "./src/wiki_generator";
import { DailyCronScheduler } from "./src/daily_cron_scheduler";
import { ForkHunter } from "./src/fork_hunter";
import { SecurityShield } from "./src/security_shield";
import { SQLQueryEngine } from "./src/sql_query_engine";
import { GitHubInsightBenchmark } from "./src/competitor_benchmark";
import { DependencyAuditor } from "./src/dependency_auditor";
import { SimilarRepoFinder } from "./src/similar_repo_finder";
import { RepoDatabase } from "./src/repo_database";
import { DeepCrawler } from "./src/deep_crawler";
import { GitHubApiClient } from "./src/github_api_client";
import { CodeAnalyzer } from "./src/code_analyzer";
import { CodeEvaluator } from "./src/code_evaluator";
import { SecretScanner } from "./src/secret_scanner";
import { LicenseAuditor } from "./src/license_auditor";
import { detectCategory } from "./src/category_detector";
import { join } from "path";
import { existsSync } from "fs";

const PORT = Number(process.env.PORT) || 3011;

const indexer = new RepoIndexer();
const wikiGen = new WikiGenerator();
const scheduler = new DailyCronScheduler(indexer);
const forkHunter = new ForkHunter();
const securityShield = new SecurityShield();
const sqlEngine = new SQLQueryEngine();
const benchmark = new GitHubInsightBenchmark();
const depAuditor = new DependencyAuditor();
const similarFinder = new SimilarRepoFinder();
const repoDb = new RepoDatabase();
const deepCrawler = new DeepCrawler(repoDb);

// Real full rescore at boot: recomputes every row's score from its stored
// real signals (stars/forks/issues/pushedAt) using the CURRENT formula in
// code_evaluator.ts. Cheap synchronous math, no network — but importantly,
// this means a scoring-formula change (like the coarse-buckets fix below)
// actually reaches already-indexed repos, not just future crawls. Without
// this, the ~30k repos indexed under the old formula would keep their old
// scores forever and the "many exact 100/100 ties" problem would persist
// for everything already in the database.
(() => {
  const evaluator = new CodeEvaluator();
  let total = 0;
  let offset = 0;
  const BATCH = 5000;
  while (true) {
    const batch = repoDb.getAllReposForRescore(BATCH, offset);
    if (batch.length === 0) break;
    for (const r of batch) {
      const score = evaluator.evaluateRepo(r.name, r.stars, r.forks, r.language || "", r.description || "", "", false, r.openIssues, r.pushedAt);
      repoDb.backfillScore(r.fullName, detectCategory(r.description || "", []), score);
    }
    total += batch.length;
    offset += BATCH;
  }
  if (total > 0) console.log(`📐 Rescored ${total} repos with the current scoring formula.`);
})();
const apiClientForVersions = new GitHubApiClient();
const codeAnalyzer = new CodeAnalyzer();
const secretScanner = new SecretScanner();
const licenseAuditor = new LicenseAuditor();

console.log(`\n======================================================`);
console.log(`🐙 GITHUB-AGENT STUDIO running on http://localhost:${PORT}`);
console.log(`🔤 A-to-Z Universal Repository Catalog: Active (${indexer.getCatalog().length} curated + ${repoDb.count()} deep-crawled Repos)`);
console.log(`🌟 Active Fork Hunter Engine: Ready`);
console.log(`🛡️ OpenSSF Security & Supply-Chain Shield: Online`);
console.log(`🗄️ MergeStat-Style SQL Query Engine: Active`);
console.log(`⏰ Daily 24-Hour Automated Crawler Daemon: Running`);
console.log(`📖 Clean Textual Wiki Archive Generator: Online`);
console.log(`======================================================\n`);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (req.method === "OPTIONS") return new Response(null, { headers });

    // Serve Static UI Assets
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const p = join(__dirname, "public", "index.html");
      return new Response(Bun.file(p), { headers: { "Content-Type": "text/html" } });
    }
    if (url.pathname === "/app.js") {
      const p = join(__dirname, "public", "app.js");
      return new Response(Bun.file(p), { headers: { "Content-Type": "application/javascript" } });
    }
    if (url.pathname === "/style.css") {
      const p = join(__dirname, "public", "style.css");
      return new Response(Bun.file(p), { headers: { "Content-Type": "text/css" } });
    }
    if (url.pathname.startsWith("/public/")) {
      const p = join(__dirname, url.pathname);
      if (existsSync(p)) return new Response(Bun.file(p));
    }

    // 1. Status
    if (url.pathname === "/api/status" && req.method === "GET") {
      return new Response(JSON.stringify({
        status: "online",
        version: "1.0.0-githubagent",
        totalIndexed: indexer.getCatalog().length + repoDb.count(),
        daemon: "active-24h",
        features: ["A-Z Index", "Fork Hunter", "Security Shield", "SQL Engine", "Wiki Generator"]
      }), { headers });
    }

    // 2. List Repos (with A-Z letter, category, minScore, search query, sortBy)
    if (url.pathname === "/api/repos/list" && req.method === "GET") {
      const letter = url.searchParams.get("letter") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const minScore = url.searchParams.has("minScore") ? Number(url.searchParams.get("minScore")) : undefined;
      const q = url.searchParams.get("q") || undefined;
      const sortBy = url.searchParams.get("sortBy") || "score";
      const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 60;
      const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : 0;

      // Unify the ~20 hand-curated suite entries (indexer, with their real
      // roadmap/verdict) with the real, growing deep-crawler index
      // (repoDb) — previously these were two disconnected systems: the
      // crawler could index thousands of real repos but the main catalog
      // tab a user actually looks at never showed them or scored them.
      //
      // Both lists are pulled, converted to one common shape, and sorted
      // TOGETHER — an earlier version of this fetched each list pre-sorted
      // and concatenated curated-first, which meant the ~20 curated repos
      // always occupied the whole first page regardless of score, silently
      // hiding every one of the real 35,000+ crawled repos (found by
      // actually looking at the rendered page in a browser, not just
      // reading the code — the bug wasn't visible from the code alone).
      const curated = indexer.getCatalog(letter, category, minScore, q, sortBy);
      const dbSortBy = sortBy === "delta" ? "indexed" : (sortBy as any); // repoDb has no 24h-delta concept yet
      const dbResult = repoDb.browse({
        letter,
        category,
        minScore,
        query: q,
        sortBy: dbSortBy === "score" || dbSortBy === "stars" || dbSortBy === "forks" || dbSortBy === "name" || dbSortBy === "indexed" || dbSortBy === "pushed" ? dbSortBy : "score",
        sortDir: "desc",
        limit: limit + curated.length,
        offset
      });

      const curatedNames = new Set(curated.map((c) => c.fullName.toLowerCase()));
      const fromDb = dbResult.rows
        .filter((r) => !curatedNames.has(r.fullName.toLowerCase()))
        .map((r) => ({
          id: r.fullName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          name: r.name,
          fullName: r.fullName,
          url: r.url,
          owner: r.owner,
          stars: r.stars,
          forks: r.forks,
          openIssues: r.openIssues,
          language: r.language || "unknown",
          license: r.license || "none",
          category: r.category,
          description: r.description,
          scoreCard: {
            totalScore: r.totalScore ?? 0,
            recommendation: r.recommendation ?? "MONITOR 👁️",
            architectureScore: r.architectureScore ?? 0,
            codeCleanlinessScore: r.codeCleanlinessScore ?? 0,
            communityMomentumScore: r.communityMomentumScore ?? 0,
            selfHostabilityScore: r.selfHostabilityScore ?? 0,
            italianSummary: { whatItDoes: r.description || "", howItWorks: "", strategicVerdict: r.recommendation ?? "" },
            strategicRationale: r.recommendation ?? "",
            suggestedEnhancementRoadmap: []
          },
          currentVersion: null,
          starDelta24h: 0,
          hasRecentUpdate: false,
          updatedAt: (r.pushedAt || r.firstIndexedAt).slice(0, 10)
        }));

      const merged = [...curated, ...fromDb];
      const cmp: Record<string, (a: any, b: any) => number> = {
        score: (a, b) => (b.scoreCard?.totalScore ?? 0) - (a.scoreCard?.totalScore ?? 0),
        stars: (a, b) => b.stars - a.stars,
        forks: (a, b) => b.forks - a.forks,
        name: (a, b) => a.name.localeCompare(b.name),
        delta: (a, b) => (b.starDelta24h ?? 0) - (a.starDelta24h ?? 0)
      };
      merged.sort(cmp[sortBy] || cmp.score);

      // Real total matching the current filters (curated.length already counts
      // every curated match since indexer.getCatalog isn't paginated; dbResult.total
      // is the real SQL COUNT(*) for the filtered repos.db query) — the UI's
      // "N Repos Indexed" chip previously showed the page size (60), not this.
      const totalMatching = curated.length + dbResult.total;

      return new Response(JSON.stringify({ rows: merged.slice(0, limit), total: totalMatching }), { headers });
    }

    // 3. Scan & Evaluate Live GitHub URL
    if (url.pathname === "/api/repos/scan" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const repoUrlOrName = body.url || "https://github.com/vllm-project/vllm";

        const evaluated = await indexer.scanAndAddLiveRepo(repoUrlOrName);
        return new Response(JSON.stringify(evaluated), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // 4. Hunt Active Community Forks (real GitHub compare API; throws on
    // rate-limit/network failure instead of returning fabricated forks)
    if (url.pathname === "/api/forks/hunt" && req.method === "GET") {
      try {
        const repo = url.searchParams.get("repo") || "bytedance/ui-tars";
        const forks = await forkHunter.huntActiveForks(repo);
        return new Response(JSON.stringify(forks), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // 5. Scan Security Shield (Real OpenSSF Scorecard REST API)
    if (url.pathname === "/api/security/scan" && req.method === "GET") {
      const repo = url.searchParams.get("repo") || "expressjs/express";
      const report = await securityShield.scanSecurity(repo);
      return new Response(JSON.stringify(report), { headers });
    }

    // 5b. Dependency Freshness Audit (real npm/PyPI registry lookups)
    if (url.pathname === "/api/deps/audit" && req.method === "GET") {
      try {
        const repo = url.searchParams.get("repo") || "expressjs/express";
        const report = await depAuditor.auditDependencies(repo);
        return new Response(JSON.stringify(report), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // 5c. Similar Repository Finder (real GitHub Search API by topic/language)
    if (url.pathname === "/api/repos/similar" && req.method === "GET") {
      try {
        const repo = url.searchParams.get("repo") || "expressjs/express";
        const report = await similarFinder.findSimilar(repo);
        return new Response(JSON.stringify(report), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // 6. Execute SQL Query (Real bun:sqlite C-Engine)
    if (url.pathname === "/api/sql/query" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const query = body.query || "SELECT name, full_name, stars, total_score, language FROM repos WHERE total_score >= 80 ORDER BY stars DESC LIMIT 20";

        // Real bug found live-testing every button: this only ever queried
        // indexer.getCatalog() (the ~20-item curated seed), same
        // disconnected-systems problem already fixed for the main A-Z
        // Catalog tab but missed here — a "MergeStat-style SQL engine"
        // that can only see 20 rows isn't useful for the kind of
        // aggregate/filter queries it's meant to demonstrate. Merges in a
        // real slice of the deep-crawler's index (top 5000 by score, capped
        // for interactive query latency — bun:sqlite handles the insert
        // fine, but re-populating tens of thousands of rows on every
        // keystroke-triggered query isn't worth it for a demo SQL box).
        const dbSlice = repoDb.getTopByScore(5000);
        const curated = indexer.getCatalog();
        const curatedNames = new Set(curated.map((c) => c.fullName.toLowerCase()));
        const merged = [
          ...curated,
          ...dbSlice
            .filter((r) => !curatedNames.has(r.fullName.toLowerCase()))
            .map((r) => ({
              name: r.name,
              owner: r.owner,
              category: r.category || "General",
              language: r.language || "unknown",
              stars: r.stars,
              forks: r.forks,
              openIssues: r.openIssues,
              starDelta24h: 0,
              scoreCard: { totalScore: r.totalScore ?? 0, recommendation: r.recommendation ?? "MONITOR 👁️" },
              currentVersion: null,
              description: r.description
            }))
        ];

        const result = sqlEngine.executeQuery(query, merged as any);
        return new Response(JSON.stringify(result), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // 7. Daily Sync Telemetry & Manual Trigger
    if (url.pathname === "/api/sync/telemetry" && req.method === "GET") {
      return new Response(JSON.stringify(scheduler.getTelemetry()), { headers });
    }

    if (url.pathname === "/api/sync/run" && req.method === "POST") {
      const telemetry = await scheduler.runDailySync();
      return new Response(JSON.stringify(telemetry), { headers });
    }

    if (url.pathname === "/api/sync/deltas" && req.method === "GET") {
      return new Response(JSON.stringify(indexer.versionTracker.getAllDeltas()), { headers });
    }

    // 8. Generate Clean Textual Wiki Archive (.md)
    if (url.pathname === "/api/wiki/export" && req.method === "GET") {
      const catalog = indexer.getCatalog();
      const wikiMarkdown = wikiGen.generateWikiMarkdown(catalog);
      return new Response(JSON.stringify({
        markdown: wikiMarkdown,
        totalCount: catalog.length
      }), { headers });
    }

    // 9. 5-Competitor Matrix
    if (url.pathname === "/api/competitors" && req.method === "GET") {
      return new Response(JSON.stringify(benchmark.getComparison()), { headers });
    }

    // 7. Deep Crawler — a real, continuously-growing public-repo index.
    // See src/deep_crawler.ts for what this honestly is/isn't (not "all of
    // GitHub" — a broad, bounded, ever-growing partition set).
    if (url.pathname === "/api/crawl/start" && req.method === "POST") {
      deepCrawler.start();
      return new Response(JSON.stringify({ running: true }), { headers });
    }
    if (url.pathname === "/api/crawl/stop" && req.method === "POST") {
      deepCrawler.stop();
      return new Response(JSON.stringify({ running: false }), { headers });
    }
    if (url.pathname === "/api/crawl/tick" && req.method === "POST") {
      // Manual single real search request — useful to verify behavior
      // without waiting for the interval, or to advance the crawl by
      // exactly one step for testing.
      const result = await deepCrawler.tick();
      return new Response(JSON.stringify(result), { headers });
    }
    if (url.pathname === "/api/crawl/status" && req.method === "GET") {
      return new Response(JSON.stringify({
        running: deepCrawler.isRunning(),
        lastTick: deepCrawler.getLastTick(),
        rateLimit: deepCrawler.getRateLimitInfo(),
        partitions: repoDb.crawlStatus(),
        totalReposIndexed: repoDb.count()
      }), { headers });
    }

    // 7b. Browse the real persistent index (data/repos.db) — separate from
    // the small in-memory seed catalog used by /api/repos/list.
    if (url.pathname === "/api/db/browse" && req.method === "GET") {
      const letter = url.searchParams.get("letter") || undefined;
      const language = url.searchParams.get("language") || undefined;
      const minStars = url.searchParams.get("minStars") ? Number(url.searchParams.get("minStars")) : undefined;
      const query = url.searchParams.get("q") || undefined;
      const sortBy = (url.searchParams.get("sortBy") as any) || "stars";
      const sortDir = (url.searchParams.get("sortDir") as any) || "desc";
      const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
      const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;
      const result = repoDb.browse({ letter, language, minStars, query, sortBy, sortDir, limit, offset });
      return new Response(JSON.stringify(result), { headers });
    }
    if (url.pathname === "/api/db/languages" && req.method === "GET") {
      return new Response(JSON.stringify(repoDb.languageBreakdown()), { headers });
    }

    // 7c. Real version tree (tags + releases) for any public repo, fetched on demand.
    if (url.pathname === "/api/repos/versions" && req.method === "GET") {
      try {
        const repo = url.searchParams.get("repo") || "";
        const history = await apiClientForVersions.fetchVersionHistory(repo);
        return new Response(JSON.stringify(history), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // 7d. Real trend history for a repo — real snapshots recorded by the
    // deep crawler each time it observed a real change in stars/forks/issues,
    // not a synthetic/interpolated series. Sparse until the crawler has made
    // multiple passes; that's the honest current state, not hidden.
    if (url.pathname === "/api/repos/history" && req.method === "GET") {
      const repo = url.searchParams.get("repo") || "";
      const history = repoDb.getHistory(repo);
      return new Response(JSON.stringify({
        fullName: repo,
        points: history,
        note: history.length < 2
          ? "Fewer than 2 real data points yet — the crawler records a new snapshot only when it re-observes this repo with a changed star/fork/issue count. Check back after the crawler completes another full pass."
          : null
      }), { headers });
    }

    // 7e. Real source-code analysis — "analyze, don't download." Fetches the
    // real file tree + a real sample of file contents on demand, computes
    // real aggregate signals (LOC, test ratio, TODOs, CI presence), and
    // archives ONLY that aggregate + a summary — never the raw code itself.
    // POST because it does real work (multiple GitHub requests); results
    // are cached in repos.db and served by the GET route below without
    // re-analyzing every time.
    if (url.pathname === "/api/repos/analyze" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const repo = body.repo || "";
        const result = await codeAnalyzer.analyzeRepo(repo);
        repoDb.saveCodeAnalysis(result.repoFullName, result);
        return new Response(JSON.stringify(result), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // Cached analysis, if one was already run — no GitHub requests, no
    // re-analysis, just reading back the aggregate previously archived.
    if (url.pathname === "/api/repos/analysis" && req.method === "GET") {
      const repo = url.searchParams.get("repo") || "";
      const cached = repoDb.getCodeAnalysis(repo);
      return new Response(JSON.stringify({ repo, cached }), { headers });
    }

    // 10. Real secret scanning (gitleaks-style regex signatures over real repo
    // file contents fetched from GitHub). POST because it does real, bounded
    // work (file tree + per-file raw fetches). See src/secret_scanner.ts for
    // the exact signatures and their false-positive caveats.
    if (url.pathname === "/api/security/secrets-scan" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const repo = body.repo || url.searchParams.get("repo") || "";
        const report = await secretScanner.scanRepoForSecrets(repo);
        return new Response(JSON.stringify(report), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    // 11. Real license detection + dependency license compliance audit.
    // Reuses the Dependency Auditor's real npm/PyPI registry data and
    // GitHub's real license API — see src/license_auditor.ts.
    if (url.pathname === "/api/license/audit" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const repo = body.repo || url.searchParams.get("repo") || "";
        const report = await licenseAuditor.auditLicenses(repo);
        return new Response(JSON.stringify(report), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers });
      }
    }

    return new Response("Not Found", { status: 404, headers });
  }
});
