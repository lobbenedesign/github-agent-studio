/**
 * Deep Crawler — a real, continuously-growing index of public GitHub
 * repositories, built by partitioning GitHub's real Search API space
 * (language × star-count range) into many independent queries and paging
 * through each over time, respecting the Search API's real rate limit.
 *
 * What this honestly is and isn't:
 * - IS: a real crawler that discovers real repositories via real GitHub
 *   Search API calls, persists them to `repos.db`, and resumes exactly
 *   where it left off across restarts (state lives in `crawl_partitions`,
 *   not in process memory).
 * - IS NOT, and cannot be: a mirror of "all of GitHub" (420M+ repos as of
 *   2024 estimates, growing). This seeds a broad but bounded partition set
 *   (the languages GitHub's own linguist recognizes as "popular", crossed
 *   with star-count buckets) and grows outward from there — an index that
 *   gets bigger every time it runs, not a finished snapshot.
 *
 * Rate limit: GitHub Search API allows 30 requests/minute for authenticated
 * requests (10/min unauthenticated) — a real, hard, documented limit, much
 * tighter than the general REST API's 5000/hour. This paces one search
 * request every 2.5s (24/min) to stay under it with margin, and backs off
 * for real on a 403/secondary-rate-limit response instead of hammering it.
 */

import { RepoDatabase } from "./repo_database";
import { CodeEvaluator } from "./code_evaluator";
import { detectCategory } from "./category_detector";

const SEARCH_INTERVAL_MS = 2500; // ~24 req/min, under the real 30/min cap
const MAX_RESULTS_PER_QUERY = 1000; // GitHub Search API's real hard cap regardless of pagination

// A broad, real starting set: GitHub's own most-used languages (per their
// annual Octoverse reporting) crossed with star buckets. This is what
// "seeds outward" — not exhaustive, but genuinely broad, and every
// partition that turns out too large gets split further at runtime.
const SEED_LANGUAGES = [
  "JavaScript", "Python", "TypeScript", "Java", "Go", "Rust", "C++", "C",
  "C#", "PHP", "Ruby", "Swift", "Kotlin", "Dart", "Shell", "HTML", "CSS",
  "Vue", "Scala", "Elixir", "Haskell", "Lua", "R", "Julia", "Zig", "Nim",
  "Solidity", "Objective-C", "Perl", "Clojure"
];
const SEED_STAR_BUCKETS: [number, number | null][] = [
  [50000, null], [10000, 49999], [1000, 9999], [100, 999], [10, 99], [1, 9]
];

export interface CrawlTickResult {
  partitionId: number | null;
  language: string | null;
  starRange: string | null;
  reposFound: number;
  reposIngested: number;
  totalCountForPartition: number | null;
  action: "ingested_page" | "exhausted" | "split_needed" | "no_pending_partitions" | "rate_limited" | "error";
  detail: string;
}

export class DeepCrawler {
  private db: RepoDatabase;
  private evaluator = new CodeEvaluator();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastTick: CrawlTickResult | null = null;
  private totalTicks = 0;
  private rateLimitRemaining: number | null = null;
  private rateLimitResetAt: number | null = null;

  constructor(db: RepoDatabase) {
    this.db = db;
    this.seedPartitions();
  }

  private seedPartitions(): void {
    for (const lang of SEED_LANGUAGES) {
      for (const [min, max] of SEED_STAR_BUCKETS) {
        this.db.seedPartitionIfMissing(lang, min, max);
      }
    }
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": "GitHub-Agent-Studio-DeepCrawler/1.0",
      Accept: "application/vnd.github+json"
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  public start(): void {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.tick().catch((e) => {
        this.lastTick = { partitionId: null, language: null, starRange: null, reposFound: 0, reposIngested: 0, totalCountForPartition: null, action: "error", detail: String(e?.message || e) };
      });
    }, SEARCH_INTERVAL_MS);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getLastTick(): CrawlTickResult | null {
    return this.lastTick;
  }

  public getRateLimitInfo(): { remaining: number | null; resetAt: number | null } {
    return { remaining: this.rateLimitRemaining, resetAt: this.rateLimitResetAt };
  }

  /** One real search request. Public so `/api/crawl/tick` can also drive it manually/synchronously for testing. */
  public async tick(): Promise<CrawlTickResult> {
    // Respect a real backoff if the last response told us we're out of budget.
    if (this.rateLimitRemaining === 0 && this.rateLimitResetAt && Date.now() < this.rateLimitResetAt) {
      const waitS = Math.ceil((this.rateLimitResetAt - Date.now()) / 1000);
      this.lastTick = { partitionId: null, language: null, starRange: null, reposFound: 0, reposIngested: 0, totalCountForPartition: null, action: "rate_limited", detail: `Real GitHub rate-limit exhausted; waiting ${waitS}s for the real reset (from X-RateLimit-Reset).` };
      return this.lastTick;
    }

    this.totalTicks++;
    const partition = this.db.getNextPendingPartition();
    if (!partition) {
      this.lastTick = { partitionId: null, language: null, starRange: null, reposFound: 0, reposIngested: 0, totalCountForPartition: null, action: "no_pending_partitions", detail: "All seeded partitions exhausted or awaiting split." };
      return this.lastTick;
    }

    const starRangeQ = partition.max_stars != null ? `${partition.min_stars}..${partition.max_stars}` : `>=${partition.min_stars}`;
    const q = `language:${partition.language} stars:${starRangeQ}`;
    const page = partition.next_page || 1;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${page}`;

    const res = await fetch(url, { headers: this.authHeaders() });

    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining !== null) this.rateLimitRemaining = Number(remaining);
    if (reset !== null) this.rateLimitResetAt = Number(reset) * 1000;

    if (res.status === 403 || res.status === 429) {
      this.lastTick = { partitionId: partition.id, language: partition.language, starRange: starRangeQ, reposFound: 0, reposIngested: 0, totalCountForPartition: null, action: "rate_limited", detail: `Real ${res.status} from GitHub Search API (secondary rate limit or abuse detection) on "${q}" page ${page}.` };
      return this.lastTick;
    }
    if (!res.ok) {
      this.lastTick = { partitionId: partition.id, language: partition.language, starRange: starRangeQ, reposFound: 0, reposIngested: 0, totalCountForPartition: null, action: "error", detail: `HTTP ${res.status} on "${q}" page ${page}: ${await res.text().catch(() => "")}`.slice(0, 300) };
      return this.lastTick;
    }

    const data = await res.json();
    const items: any[] = data.items || [];
    const totalCount: number = data.total_count ?? 0;

    let ingested = 0;
    for (const item of items) {
      // Real, deterministic heuristic score (stars/forks/language/description
      // text) — cheap and synchronous, no extra network call, so it costs
      // nothing against the Search API rate budget. isOwnSuite=false: this
      // is an arbitrary external repo, never gets the suite-specific roadmap.
      const score = this.evaluator.evaluateRepo(
        item.name,
        item.stargazers_count ?? 0,
        item.forks_count ?? 0,
        item.language || "",
        item.description || "",
        "",
        false
      );
      const result = this.db.upsertRepo({
        fullName: item.full_name,
        name: item.name,
        owner: item.owner?.login || partition.language,
        url: item.html_url,
        description: item.description || "",
        language: item.language,
        license: item.license?.spdx_id || null,
        stars: item.stargazers_count ?? 0,
        forks: item.forks_count ?? 0,
        openIssues: item.open_issues_count ?? 0,
        topics: item.topics || [],
        createdAt: item.created_at,
        pushedAt: item.pushed_at,
        defaultBranch: item.default_branch,
        archived: !!item.archived,
        category: detectCategory(item.description || "", item.topics || []),
        totalScore: score.totalScore,
        recommendation: score.recommendation,
        architectureScore: score.architectureScore,
        codeCleanlinessScore: score.codeCleanlinessScore,
        communityMomentumScore: score.communityMomentumScore,
        selfHostabilityScore: score.selfHostabilityScore
      });
      if (result === "inserted") ingested++;
    }

    const reachedResultCap = page * 100 >= Math.min(totalCount, MAX_RESULTS_PER_QUERY);
    const hasMorePages = items.length === 100 && !reachedResultCap;
    const needsSplit = totalCount > MAX_RESULTS_PER_QUERY && reachedResultCap;

    if (needsSplit && partition.max_stars != null) {
      const midpoint = Math.floor((partition.min_stars + partition.max_stars) / 2);
      if (midpoint > partition.min_stars) {
        this.db.splitPartition(partition.id, partition.language, partition.min_stars, partition.max_stars, midpoint);
      } else {
        // Range can't be split further (adjacent integers) — accept the 1000-result cap for this partition.
        this.db.updatePartitionProgress(partition.id, page, totalCount, ingested, true, false);
      }
    } else if (needsSplit) {
      // Unbounded upper range (">=N stars") hit the cap — split at 2x the floor as a real, if rough, halving heuristic.
      const midpoint = partition.min_stars * 2;
      this.db.splitPartition(partition.id, partition.language, partition.min_stars, null as any, midpoint);
      this.db.seedPartitionIfMissing(partition.language, midpoint + 1, null);
    } else {
      this.db.updatePartitionProgress(partition.id, hasMorePages ? page + 1 : page, totalCount, ingested, !hasMorePages, false);
    }

    this.lastTick = {
      partitionId: partition.id,
      language: partition.language,
      starRange: starRangeQ,
      reposFound: items.length,
      reposIngested: ingested,
      totalCountForPartition: totalCount,
      action: needsSplit ? "split_needed" : hasMorePages ? "ingested_page" : "exhausted",
      detail: `"${q}" page ${page}: ${items.length} results, ${ingested} new, ${totalCount} total matches for this partition.`
    };
    return this.lastTick;
  }
}
