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
}

export interface RepoBrowseFilters {
  letter?: string; // 'A'-'Z' or '#' for non-alphabetic
  language?: string;
  minStars?: number;
  query?: string; // substring match on name/description
  sortBy?: "stars" | "forks" | "name" | "pushed" | "indexed";
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
        last_crawled_at TEXT NOT NULL
      );
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_name ON repos(name COLLATE NOCASE);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stars DESC);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_repos_pushed ON repos(pushed_at DESC);`);

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
  }

  public upsertRepo(r: Omit<StoredRepo, "firstIndexedAt" | "lastCrawledAt">): "inserted" | "updated" {
    const now = new Date().toISOString();
    const existing = this.db.query("SELECT full_name FROM repos WHERE full_name = ?").get(r.fullName);
    this.db.run(
      `INSERT INTO repos (full_name, name, owner, url, description, language, license, stars, forks, open_issues, topics, created_at, pushed_at, default_branch, archived, first_indexed_at, last_crawled_at)
       VALUES ($fullName, $name, $owner, $url, $description, $language, $license, $stars, $forks, $openIssues, $topics, $createdAt, $pushedAt, $defaultBranch, $archived, $firstIndexedAt, $lastCrawledAt)
       ON CONFLICT(full_name) DO UPDATE SET
         description=excluded.description, language=excluded.language, license=excluded.license,
         stars=excluded.stars, forks=excluded.forks, open_issues=excluded.open_issues,
         topics=excluded.topics, pushed_at=excluded.pushed_at, archived=excluded.archived,
         last_crawled_at=excluded.last_crawled_at`,
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
        $lastCrawledAt: now
      }
    );
    return existing ? "updated" : "inserted";
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

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sortCol = { stars: "stars", forks: "forks", name: "name COLLATE NOCASE", pushed: "pushed_at", indexed: "first_indexed_at" }[filters.sortBy || "stars"] || "stars";
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
      lastCrawledAt: row.last_crawled_at
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
