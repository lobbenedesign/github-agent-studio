import { describe, test, expect } from "bun:test";
import { CodeEvaluator } from "../src/code_evaluator";

describe("CodeEvaluator.evaluateRepo", () => {
  const evaluator = new CodeEvaluator();

  test("total score is always within 0-100 and matches its own component sum", () => {
    const card = evaluator.evaluateRepo("some-repo", 15000, 3000, "TypeScript", "A streaming inference engine with speculative decoding", "", false, 40, new Date().toISOString());
    expect(card.totalScore).toBeGreaterThanOrEqual(0);
    expect(card.totalScore).toBeLessThanOrEqual(100);
    const sum = card.architectureScore + card.codeCleanlinessScore + card.communityMomentumScore + card.selfHostabilityScore;
    expect(Math.round(card.totalScore * 10)).toBe(Math.round(sum * 10));
  });

  test("a repo matching more real architecture keywords scores higher on architecture than one matching none", () => {
    const rich = evaluator.evaluateRepo("a", 100, 10, "Rust", "distributed streaming quantization compiler with speculative decoding and mcts", "", false, 5, null);
    const plain = evaluator.evaluateRepo("b", 100, 10, "Rust", "a small utility library", "", false, 5, null);
    expect(rich.architectureScore).toBeGreaterThan(plain.architectureScore);
  });

  test("more stars produces a higher community momentum score than fewer stars, all else equal", () => {
    const popular = evaluator.evaluateRepo("popular", 50000, 5000, "Go", "generic description", "", false, 10, null);
    const obscure = evaluator.evaluateRepo("obscure", 5, 0, "Go", "generic description", "", false, 10, null);
    expect(popular.communityMomentumScore).toBeGreaterThan(obscure.communityMomentumScore);
  });

  test("a repo not pushed in years scores lower momentum than an identical repo pushed recently", () => {
    const stale = evaluator.evaluateRepo("stale", 5000, 500, "Python", "x", "", false, 20, "2019-01-01T00:00:00Z");
    const fresh = evaluator.evaluateRepo("fresh", 5000, 500, "Python", "x", "", false, 20, new Date().toISOString());
    expect(fresh.communityMomentumScore).toBeGreaterThan(stale.communityMomentumScore);
  });

  test("isOwnSuite=false never produces suite-specific roadmap text for an arbitrary external repo", () => {
    const card = evaluator.evaluateRepo("facebook/react", 200000, 40000, "JavaScript", "A JS library for building UIs", "", false, 900, new Date().toISOString());
    const roadmapText = card.suggestedEnhancementRoadmap.join(" ").toLowerCase();
    expect(roadmapText).not.toContain("nexus local engine");
    expect(roadmapText).not.toContain("start-macos.command");
  });

  test("two repos with different real signal counts do not collapse to the same total score (continuous scoring, not fixed buckets)", () => {
    const scores = new Set<number>();
    const samples: [string, number, number, string, string, number][] = [
      ["a", 100, 5, "Python", "x", 2],
      ["b", 2500, 200, "TypeScript", "streaming quantization", 15],
      ["c", 45000, 9000, "Rust", "distributed mcts compiler speculative", 400],
      ["d", 800000, 150000, "Go", "vlm turboquant grpo ast full-duplex", 1200]
    ];
    for (const [name, stars, forks, lang, desc, issues] of samples) {
      const card = evaluator.evaluateRepo(name, stars, forks, lang, desc, "", false, issues, new Date().toISOString());
      scores.add(Math.round(card.totalScore * 10));
    }
    expect(scores.size).toBe(samples.length);
  });
});
