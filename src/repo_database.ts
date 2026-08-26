/**
 * Persistent Repository Database
 *
 * Replaces the JSON-file catalog as the source of truth for the deep
 * crawler's output. A JS array + JSON file does not scale past a few
 * thousand rows (whole-file rewrite on every save, whole-array scan on
 * every filter); an on-disk SQLite database does, and gives us real
 * indexed queries (bun:sqlite, the same C engine sql_query_engine.ts uses
 * for the ad-hoc query tab).
 *
 * This is deliberately a different table from sql_query_engine.ts's
 * in-memory `repos` table (that one stays as the ad-hoc "run any SQL"
 * demo over whatever's currently loaded) — this one is the real,
 * continuously-growing, disk-persisted index the deep crawler writes to.
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

export interface StoredRepo {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string;
  language: string | null;
  license: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  createdAt: string | null;
  pushedAt: string | null;
  defaultBranch: string | null;
  archived: boolean;
  firstIndexedAt: string;
  lastCrawledAt: string;
  category: string | null;
  totalScore: number | null;
  recommendation: string | null;
  architectureScore: number | null;
  codeCleanlinessScore: number | null;
  communityMomentumScore: number | null;
  selfHostabilityScore: number | null;
}

export interface RepoBrowseFilters {
  letter?: string; // 'A'-'Z' or '#' for non-alphabetic
  language?: string;
  category?: string;
  minStars?: number;
  minScore?: number;
  query?: string; // substring match on name/description
  sortBy?: "stars" | "forks" | "name" | "pushed" | "indexed" | "score";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export class RepoDatabase {
  private db: Database;

  constructor(dbPath?: string) {
    const dir = dbPath ? join(dbPath, "..") : join(__dirname, "..", "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath || join(dir, "repos.db"));
    this.db.exec("PRAGMA journal_mode = WAL;"); // real concurrent-safe writes while the crawler and API reads overlap
    this.initSchema();
  }

  /**
   * `CREATE TABLE IF NOT EXISTS` doesn't add columns to a table that
   * already exists from an earlier version of this schema — a repos.db
   * created before scoring/category support would silently keep working
   * but every score column would be NULL forever. Real migration instead
   * of just documenting "delete the db and re-crawl."
   */
  private migrateAddColumnsIfMissing(): void {
    const existing = new Set((this.db.query("PRAGMA table_info(repos)").all() as any[]).map((c) => c.name));
    const wanted: [string, string][] = [
      ["category", "TEXT"],
      ["total_score", "REAL"],
      ["recommendation", "TEXT"],
      ["architecture_score", "REAL"],
      ["code_cleanliness_score", "REAL"],
      ["community_momentum_score", "REAL"],
      ["self_hostability_score", "REAL"]
    ];
    for (const [col, type] of wanted) {
      if (!existing.has(col)) {
        this.db.run(`ALTER TABLE repos ADD COLUMN ${col} ${type};`);
      }
    }
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS repos (
        full_name TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        language TEXT,
        license TEXT,
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        open_issues INTEGER DEFAULT 0,
        topics TEXT DEFAULT '[]',
        created_at TEXT,
        pushed_at TEXT,
        default_branch TEXT,
        archived INTEGER DEFAULT 0,
        first_indexed_at TEXT NOT NULL,
        last_crawled_at TEXT NOT NULL,
        category TEXT,
        total_score REAL,
        recommendation TEXT,
        architecture_score REAL,
        code_cleanliness_score REAL,
        community_momentum_score REAL,
        self_hostability_score REAL
      );
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repos(name COLLATE NOCASE);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stars DESC);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_pushed ON repos(pushed_at DESC);`);
    // Must run before the index below: an existing repos.db from before
    // scoring existed has no total_score column yet, so an index on it
    // would fail (this is exactly what happened on the first real run).
    this.migrateAddColumnsIfMissing();
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_score ON repos(total_score DESC);`);

    // Real, persistent crawl frontier — see deep_crawler.ts. Living here
    // (not a separate file) so the DB is the single source of truth for
    // "what has and hasn't been indexed yet" and survives process restarts.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS crawl_partitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        min_stars INTEGER NOT NULL,
        max_stars INTEGER,
        next_page INTEGER DEFAULT 1,
        total_count INTEGER,
        repos_ingested INTEGER DEFAULT 0,
        exhausted INTEGER DEFAULT 0,
        needs_split INTEGER DEFAULT 0,
        last_crawled_at TEXT
      );
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_partitions_pending ON crawl_partitions(exhausted, needs_split);`);

    // Real time-series: one row per (repo, time it was observed), appended
    // — never overwritten — every time the crawler upserts a repo. This is
    // what makes an actual trend view possible instead of the single
    // always-overwritten snapshot in `repos`.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS repo_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        stars INTEGER NOT NULL,
        forks INTEGER NOT NULL,
        open_issues INTEGER NOT NULL,
        captured_at TEXT NOT NULL
      );
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_repo ON repo_snapshots(full_name, captured_at);`);

    // Stores only the AGGREGATE result of a code analysis (counts, ratios,
    // a generated summary) — never raw file contents. See code_analyzer.ts.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_analysis (
        full_name TEXT PRIMARY KEY,
        analysis_json TEXT NOT NULL,
        analyzed_at TEXT NOT NULL
      );
    `);
  }

  public upsertRepo(r: Omit<StoredRepo, "firstIndexedAt" | "lastCrawledAt">): "inserted" | "updated" {
    const now = new Date().toISOString();
    const existing = this.db.query("SELECT full_name FROM repos WHERE full_name = ?").get(r.fullName);
    this.db.run(
      `INSERT INTO repos (full_name, name, owner, url, description, language, license, stars, forks, open_issues, topics, created_at, pushed_at, default_branch, archived, first_indexed_at, last_crawled_at, category, total_score, recommendation, architecture_score, code_cleanliness_score, community_momentum_score, self_hostability_score)
       VALUES ($fullName, $name, $owner, $url, $description, $language, $license, $stars, $forks, $openIssues, $topics, $createdAt, $pushedAt, $defaultBranch, $archived, $firstIndexedAt, $lastCrawledAt, $category, $totalScore, $recommendation, $architectureScore, $codeCleanlinessScore, $communityMomentumScore, $selfHostabilityScore)
       ON CONFLICT(full_name) DO UPDATE SET
         description=excluded.description, language=excluded.language, license=excluded.license,
         stars=excluded.stars, forks=excluded.forks, open_issues=excluded.open_issues,
         topics=excluded.topics, pushed_at=excluded.pushed_at, archived=excluded.archived,
         last_crawled_at=excluded.last_crawled_at, category=excluded.category,
         total_score=excluded.total_score, recommendation=excluded.recommendation,
         architecture_score=excluded.architecture_score, code_cleanliness_score=excluded.code_cleanliness_score,
         community_momentum_score=excluded.community_momentum_score, self_hostability_score=excluded.self_hostability_score`,
      {
        $fullName: r.fullName,
        $name: r.name,
        $owner: r.owner,
        $url: r.url,
        $description: r.description || "",
        $language: r.language,
        $license: r.license,
        $stars: r.stars,
        $forks: r.forks,
        $openIssues: r.openIssues,
        $topics: JSON.stringify(r.topics || []),
        $createdAt: r.createdAt,
        $pushedAt: r.pushedAt,
        $defaultBranch: r.defaultBranch,
        $archived: r.archived ? 1 : 0,
        $firstIndexedAt: now,
        $lastCrawledAt: now,
        $category: r.category,
        $totalScore: r.totalScore,
        $recommendation: r.recommendation,
        $architectureScore: r.architectureScore,
        $codeCleanlinessScore: r.codeCleanlinessScore,
        $communityMomentumScore: r.communityMomentumScore,
        $selfHostabilityScore: r.selfHostabilityScore
      }
    );
    this.recordSnapshotIfChanged(r.fullName, r.stars, r.forks, r.openIssues, now);

    return existing ? "updated" : "inserted";
  }

  /**
   * Appends a real trend data point — but only if it actually differs from
   * the most recent one for this repo (or none exists yet). Without this
   * dedup, every crawl pass over an unchanged repo would insert an
   * identical row forever, turning "real history" into noise that doesn't
   * actually show any trend.
   */
  private recordSnapshotIfChanged(fullName: string, stars: number, forks: number, openIssues: number, now: string): void {
    const last = this.db
      .query("SELECT stars, forks, open_issues as openIssues FROM repo_snapshots WHERE full_name = ? ORDER BY captured_at DESC LIMIT 1")
      .get(fullName) as { stars: number; forks: number; openIssues: number } | null;
    if (last && last.stars === stars && last.forks === forks && last.openIssues === openIssues) return;
    this.db.run(
      `INSERT INTO repo_snapshots (full_name, stars, forks, open_issues, captured_at) VALUES ($fullName, $stars, $forks, $openIssues, $capturedAt)`,
      { $fullName: fullName, $stars: stars, $forks: forks, $openIssues: openIssues, $capturedAt: now }
    );
  }

  public getHistory(fullName: string, limit: number = 500): { stars: number; forks: number; openIssues: number; capturedAt: string }[] {
    const rows = this.db
      .query("SELECT stars, forks, open_issues as openIssues, captured_at as capturedAt FROM repo_snapshots WHERE full_name = ? ORDER BY captured_at ASC LIMIT ?")
      .all(fullName, limit) as any[];
    return rows;
  }

  /** Persists only the aggregate analysis result (see code_analyzer.ts) — never raw file contents. */
  public saveCodeAnalysis(fullName: string, analysis: unknown): void {
    this.db.run(
      `INSERT INTO code_analysis (full_name, analysis_json, analyzed_at) VALUES ($fullName, $json, $now)
       ON CONFLICT(full_name) DO UPDATE SET analysis_json=excluded.analysis_json, analyzed_at=excluded.analyzed_at`,
      { $fullName: fullName, $json: JSON.stringify(analysis), $now: new Date().toISOString() }
    );
  }

  public getCodeAnalysis(fullName: string): unknown | null {
    const row = this.db.query("SELECT analysis_json FROM code_analysis WHERE full_name = ?").get(fullName) as { analysis_json: string } | null;
    return row ? JSON.parse(row.analysis_json) : null;
  }

  /**
   * Resets every exhausted partition back to page 1 so the crawler makes
   * another full pass instead of idling forever once the initial sweep
   * finishes. Each re-visit is what actually produces new points in
   * repo_snapshots over time — without this, "trending" would freeze at
   * whatever was captured during the first pass.
   */
  public resetExhaustedPartitionsForResweep(): number {
    const result = this.db.run("UPDATE crawl_partitions SET exhausted = 0, next_page = 1 WHERE exhausted = 1 AND needs_split = 0");
    return result.changes;
  }

  /** Real rows already in the DB from before scoring existed (total_score IS NULL). */
  public getUnscoredRepos(limit: number = 5000): { fullName: string; name: string; stars: number; forks: number; language: string | null; description: string | null; openIssues: number; pushedAt: string | null }[] {
    return this.db
      .query("SELECT full_name as fullName, name, stars, forks, language, description, open_issues as openIssues, pushed_at as pushedAt FROM repos WHERE total_score IS NULL LIMIT ?")
      .all(limit) as any[];
  }

  /** Re-scores every already-indexed repo — used after a scoring-formula change so existing rows reflect it instead of only new crawls. */
  public getAllReposForRescore(limit: number, offset: number): { fullName: string; name: string; stars: number; forks: number; language: string | null; description: string | null; openIssues: number; pushedAt: string | null }[] {
    return this.db
      .query("SELECT full_name as fullName, name, stars, forks, language, description, open_issues as openIssues, pushed_at as pushedAt FROM repos ORDER BY full_name LIMIT ? OFFSET ?")
      .all(limit, offset) as any[];
  }

  public backfillScore(fullName: string, category: string | null, score: { totalScore: number; recommendation: string; architectureScore: number; codeCleanlinessScore: number; communityMomentumScore: number; selfHostabilityScore: number }): void {
    this.db.run(
      `UPDATE repos SET category=$category, total_score=$totalScore, recommendation=$recommendation, architecture_score=$architectureScore, code_cleanliness_score=$codeCleanlinessScore, community_momentum_score=$communityMomentumScore, self_hostability_score=$selfHostabilityScore WHERE full_name=$fullName`,
      {
        $fullName: fullName,
        $category: category,
        $totalScore: score.totalScore,
        $recommendation: score.recommendation,
        $architectureScore: score.architectureScore,
        $codeCleanlinessScore: score.codeCleanlinessScore,
        $communityMomentumScore: score.communityMomentumScore,
        $selfHostabilityScore: score.selfHostabilityScore
      }
    );
  }

  public count(): number {
    const row = this.db.query("SELECT COUNT(*) as c FROM repos").get() as { c: number };
    return row.c;
  }

  public browse(filters: RepoBrowseFilters): { rows: StoredRepo[]; total: number } {
    const clauses: string[] = [];
    const params: Record<string, any> = {};

    if (filters.letter && filters.letter !== "ALL") {
      if (filters.letter === "#") {
        clauses.push("name NOT GLOB '[A-Za-z]*'");
      } else {
        clauses.push("name LIKE $letterPfx COLLATE NOCASE");
        params.$letterPfx = `${filters.letter}%`;
      }
    }
    if (filters.language) {
      clauses.push("language = $language COLLATE NOCASE");
      params.$language = filters.language;
    }
    if (typeof filters.minStars === "number") {
      clauses.push("stars >= $minStars");
      params.$minStars = filters.minStars;
    }
    if (filters.query) {
      clauses.push("(name LIKE $q COLLATE NOCASE OR description LIKE $q COLLATE NOCASE)");
      params.$q = `%${filters.query}%`;
    }
    if (typeof filters.minScore === "number") {
      clauses.push("total_score >= $minScore");
      params.$minScore = filters.minScore;
    }
    if (filters.category) {
      clauses.push("category = $category");
      params.$category = filters.category;
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sortCol = { stars: "stars", forks: "forks", name: "name COLLATE NOCASE", pushed: "pushed_at", indexed: "first_indexed_at", score: "total_score" }[filters.sortBy || "stars"] || "stars";
    const dir = filters.sortDir === "asc" ? "ASC" : "DESC";
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = Math.max(0, filters.offset ?? 0);

    const total = (this.db.query(`SELECT COUNT(*) as c FROM repos ${where}`).get(params) as { c: number }).c;
    const rows = this.db
      .query(`SELECT * FROM repos ${where} ORDER BY ${sortCol} ${dir} LIMIT $limit OFFSET $offset`)
      .all({ ...params, $limit: limit, $offset: offset }) as any[];

    return { rows: rows.map(this.rowToRepo), total };
  }

  public getByFullName(fullName: string): StoredRepo | null {
    const row = this.db.query("SELECT * FROM repos WHERE full_name = ?").get(fullName) as any;
    return row ? this.rowToRepo(row) : null;
  }

  public languageBreakdown(): { language: string; count: number }[] {
    return this.db
      .query("SELECT COALESCE(language,'(none)') as language, COUNT(*) as count FROM repos GROUP BY language ORDER BY count DESC LIMIT 40")
      .all() as any[];
  }

  private rowToRepo(row: any): StoredRepo {
    return {
      fullName: row.full_name,
      name: row.name,
      owner: row.owner,
      url: row.url,
      description: row.description,
      language: row.language,
      license: row.license,
      stars: row.stars,
      forks: row.forks,
      openIssues: row.open_issues,
      topics: JSON.parse(row.topics || "[]"),
      createdAt: row.created_at,
      pushedAt: row.pushed_at,
      defaultBranch: row.default_branch,
      archived: !!row.archived,
      firstIndexedAt: row.first_indexed_at,
      lastCrawledAt: row.last_crawled_at,
      category: row.category,
      totalScore: row.total_score,
      recommendation: row.recommendation,
      architectureScore: row.architecture_score,
      codeCleanlinessScore: row.code_cleanliness_score,
      communityMomentumScore: row.community_momentum_score,
      selfHostabilityScore: row.self_hostability_score
    };
  }

  // -- crawl partition access, used by deep_crawler.ts --

  public seedPartitionIfMissing(language: string, minStars: number, maxStars: number | null): void {
    const existing = this.db
      .query("SELECT id FROM crawl_partitions WHERE language = $l AND min_stars = $mn AND (max_stars IS $mx OR max_stars = $mx)")
      .get({ $l: language, $mn: minStars, $mx: maxStars });
    if (existing) return;
    this.db.run(
      `INSERT INTO crawl_partitions (language, min_stars, max_stars) VALUES ($l, $mn, $mx)`,
      { $l: language, $mn: minStars, $mx: maxStars }
    );
  }

  public getNextPendingPartition(): any {
    return this.db
      .query("SELECT * FROM crawl_partitions WHERE exhausted = 0 AND needs_split = 0 ORDER BY id ASC LIMIT 1")
      .get();
  }

  public updatePartitionProgress(id: number, nextPage: number, totalCount: number, ingestedDelta: number, exhausted: boolean, needsSplit: boolean): void {
    this.db.run(
      `UPDATE crawl_partitions SET next_page = $p, total_count = $t, repos_ingested = repos_ingested + $ing, exhausted = $ex, needs_split = $sp, last_crawled_at = $now WHERE id = $id`,
      { $p: nextPage, $t: totalCount, $ing: ingestedDelta, $ex: exhausted ? 1 : 0, $sp: needsSplit ? 1 : 0, $now: new Date().toISOString(), $id: id }
    );
  }

  public splitPartition(id: number, language: string, minStars: number, maxStars: number, midpoint: number): void {
    // Replace one too-large partition with two narrower star-range halves,
    // each independently under the ~1000-result search cap (hopefully).
    this.db.run("DELETE FROM crawl_partitions WHERE id = $id", { $id: id });
    this.seedPartitionIfMissing(language, midpoint + 1, maxStars);
    this.seedPartitionIfMissing(language, minStars, midpoint);
  }

  public crawlStatus(): { totalPartitions: number; exhausted: number; pendingSplit: number; totalReposIngestedByPartitions: number } {
    const row = this.db
      .query(
        `SELECT COUNT(*) as totalPartitions,
                SUM(CASE WHEN exhausted=1 THEN 1 ELSE 0 END) as exhausted,
                SUM(CASE WHEN needs_split=1 THEN 1 ELSE 0 END) as pendingSplit,
                SUM(repos_ingested) as totalReposIngestedByPartitions
         FROM crawl_partitions`
      )
      .get() as any;
    return {
      totalPartitions: row.totalPartitions || 0,
      exhausted: row.exhausted || 0,
      pendingSplit: row.pendingSplit || 0,
      totalReposIngestedByPartitions: row.totalReposIngestedByPartitions || 0
    };
  }
}
