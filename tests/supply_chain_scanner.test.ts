import { describe, test, expect } from "bun:test";
import { levenshtein, findClosestPopularName } from "../src/supply_chain_scanner";

describe("levenshtein", () => {
  test("distance 0 for identical strings", () => {
    expect(levenshtein("react", "react")).toBe(0);
  });
  test("distance 1 for a single substitution", () => {
    expect(levenshtein("react", "reacf")).toBe(1);
  });
  test("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });
  test("real typosquat pair: crossenv vs cross-env is 1 edit away", () => {
    expect(levenshtein("crossenv", "cross-env")).toBe(1);
  });
});

describe("findClosestPopularName", () => {
  test("flags a known real historical typosquat (crossenv -> cross-env)", () => {
    const result = findClosestPopularName("crossenv");
    expect(result).not.toBeNull();
    expect(result?.candidate).toBe("cross-env");
    expect(result?.distance).toBeLessThanOrEqual(2);
  });
  test("does not flag a popular package as its own typosquat", () => {
    expect(findClosestPopularName("cross-env")).toBeNull();
    expect(findClosestPopularName("react")).toBeNull();
  });
  test("does not flag an ordinary unrelated package name", () => {
    // Not within edit distance 2 of anything in the reference corpus.
    expect(findClosestPopularName("my-totally-unrelated-internal-tool")).toBeNull();
  });
});
