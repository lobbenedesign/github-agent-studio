import { describe, test, expect } from "bun:test";
import { SQLQueryEngine } from "../src/sql_query_engine";
import type { GitHubRepoItem } from "../src/repo_indexer";

function fixtureRepo(overrides: Partial<GitHubRepoItem>): GitHubRepoItem {
  return {
    id: "1",
    name: "sample",
    fullName: "acme/sample",
    url: "https://github.com/acme/sample",
    owner: "acme",
    stars: 100,
    forks: 10,
    openIssues: 2,
    language: "TypeScript",
    license: "MIT",
    category: "LLM & Inference",
    description: "a sample repo",
    scoreCard: {
      totalScore: 70,
      recommendation: "MONITOR 👁️",
      architectureScore: 20,
      codeCleanlinessScore: 20,
      communityMomentumScore: 20,
      selfHostabilityScore: 10,
      italianSummary: { whatItDoes: "", howItWorks: "", strategicVerdict: "" },
      strategicRationale: "",
      suggestedEnhancementRoadmap: []
    },
    currentVersion: "1.0.0",
    starDelta24h: 0,
    hasRecentUpdate: false,
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe("SQLQueryEngine.executeQuery", () => {
  test("runs a real SELECT against the real repos table over the given catalog", () => {
    const engine = new SQLQueryEngine();
    const catalog = [
      fixtureRepo({ name: "alpha", owner: "org", stars: 500, scoreCard: { ...fixtureRepo({}).scoreCard, totalScore: 90 } }),
      fixtureRepo({ name: "beta", owner: "org", stars: 50, scoreCard: { ...fixtureRepo({}).scoreCard, totalScore: 40 } })
    ];
    const result = engine.executeQuery("SELECT name, stars, total_score FROM repos ORDER BY stars DESC", catalog);
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(2);
    expect(result.rows[0].name).toBe("alpha");
    expect(result.rows[0].stars).toBe(500);
    expect(result.rows[1].name).toBe("beta");
  });

  test("WHERE filters real rows correctly", () => {
    const engine = new SQLQueryEngine();
    const catalog = [
      fixtureRepo({ name: "high", scoreCard: { ...fixtureRepo({}).scoreCard, totalScore: 95 } }),
      fixtureRepo({ name: "low", scoreCard: { ...fixtureRepo({}).scoreCard, totalScore: 10 } })
    ];
    const result = engine.executeQuery("SELECT name FROM repos WHERE total_score >= 80", catalog);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].name).toBe("high");
  });

  test("re-populating on each call reflects the latest catalog, not a stale one", () => {
    const engine = new SQLQueryEngine();
    const first = engine.executeQuery("SELECT COUNT(*) as c FROM repos", [fixtureRepo({})]);
    expect(first.rows[0].c).toBe(1);
    const second = engine.executeQuery("SELECT COUNT(*) as c FROM repos", [fixtureRepo({}), fixtureRepo({ name: "two" })]);
    expect(second.rows[0].c).toBe(2);
  });

  test("a genuinely invalid query returns a real SQLite error, not a silent empty result", () => {
    const engine = new SQLQueryEngine();
    const result = engine.executeQuery("SELECT * FROM this_table_does_not_exist", [fixtureRepo({})]);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("SQLite Error");
    expect(result.rowCount).toBe(0);
  });
});
