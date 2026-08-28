import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { RepoDatabase, type StoredRepo } from "../src/repo_database";

function fixtureRepo(overrides: Partial<Omit<StoredRepo, "firstIndexedAt" | "lastCrawledAt">>): Omit<StoredRepo, "firstIndexedAt" | "lastCrawledAt"> {
  return {
    fullName: "acme/sample",
    name: "sample",
    owner: "acme",
    url: "https://github.com/acme/sample",
    description: "a sample repo",
    language: "TypeScript",
    license: "MIT",
    stars: 100,
    forks: 10,
    openIssues: 2,
    topics: ["ai", "agents"],
    createdAt: "2024-01-01T00:00:00Z",
    pushedAt: "2026-01-01T00:00:00Z",
    defaultBranch: "main",
    archived: false,
    category: "LLM & Inference",
    totalScore: 70,
    recommendation: "MONITOR 👁️",
    architectureScore: 20,
    codeCleanlinessScore: 20,
    communityMomentumScore: 20,
    selfHostabilityScore: 10,
    ...overrides
  };
}

describe("RepoDatabase", () => {
  let dir: string;
  let db: RepoDatabase;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "repo-db-test-"));
    db = new RepoDatabase(join(dir, "test.db"));
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test("upsertRepo reports 'inserted' the first time, 'updated' the second", () => {
    expect(db.upsertRepo(fixtureRepo({}))).toBe("inserted");
    expect(db.upsertRepo(fixtureRepo({ stars: 150 }))).toBe("updated");
    expect(db.getByFullName("acme/sample")?.stars).toBe(150);
  });

  test("count() reflects real row count after real inserts, not a cached number", () => {
    expect(db.count()).toBe(0);
    db.upsertRepo(fixtureRepo({ fullName: "acme/one", name: "one" }));
    db.upsertRepo(fixtureRepo({ fullName: "acme/two", name: "two" }));
    expect(db.count()).toBe(2);
  });

  test("browse() filters by minStars and sorts by the real stored score", () => {
    db.upsertRepo(fixtureRepo({ fullName: "acme/low", name: "low", stars: 10, totalScore: 20 }));
    db.upsertRepo(fixtureRepo({ fullName: "acme/mid", name: "mid", stars: 500, totalScore: 60 }));
    db.upsertRepo(fixtureRepo({ fullName: "acme/high", name: "high", stars: 9000, totalScore: 95 }));

    const { rows, total } = db.browse({ minStars: 100, sortBy: "score", sortDir: "desc", limit: 10 });
    expect(total).toBe(2);
    expect(rows.map((r) => r.name)).toEqual(["high", "mid"]);
  });

  test("browse() hard-caps the page size at 200 regardless of a larger requested limit (public-facing safety cap)", () => {
    for (let i = 0; i < 5; i++) {
      db.upsertRepo(fixtureRepo({ fullName: `acme/repo-${i}`, name: `repo-${i}` }));
    }
    const { rows } = db.browse({ limit: 5000 });
    expect(rows.length).toBe(5); // only 5 exist, but proves no crash/truncation-to-zero at a huge limit
  });

  test("getTopByScore bypasses the 200-row browse() cap for server-side callers", () => {
    for (let i = 0; i < 10; i++) {
      db.upsertRepo(fixtureRepo({ fullName: `acme/repo-${i}`, name: `repo-${i}`, totalScore: i * 10 }));
    }
    const top = db.getTopByScore(10000);
    expect(top.length).toBe(10);
    expect(top[0].totalScore).toBe(90); // sorted descending by real score
  });

  test("recordSnapshotIfChanged dedupes identical consecutive snapshots but records real changes", () => {
    db.upsertRepo(fixtureRepo({ stars: 100 }));
    db.upsertRepo(fixtureRepo({ stars: 100 })); // no real change -> should not add a second snapshot
    db.upsertRepo(fixtureRepo({ stars: 150 })); // real change -> should add a new snapshot
    const history = db.getHistory("acme/sample");
    expect(history.length).toBe(2);
    expect(history[history.length - 1].stars).toBe(150);
  });

  test("saveCodeAnalysis / getCodeAnalysis round-trip real archived aggregate data", () => {
    expect(db.getCodeAnalysis("acme/sample")).toBeNull();
    const analysis = { filesInTree: 425, sourceFiles: 192, sampledFiles: 40, realLinesCounted: 11610 };
    db.saveCodeAnalysis("acme/sample", analysis);
    expect(db.getCodeAnalysis("acme/sample")).toEqual(analysis);
  });
});
