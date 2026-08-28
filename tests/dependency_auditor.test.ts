import { describe, test, expect } from "bun:test";
import { computeStatus, parseSemver, stripRangePrefix } from "../src/dependency_auditor";

describe("parseSemver", () => {
  test("parses a plain semver string", () => {
    expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
  });
  test("parses a semver embedded in a longer string (npm packument version)", () => {
    expect(parseSemver("4.18.2")).toEqual([4, 18, 2]);
  });
  test("returns null for null/undefined/unparseable input", () => {
    expect(parseSemver(null)).toBeNull();
    expect(parseSemver(undefined)).toBeNull();
    expect(parseSemver("not-a-version")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("stripRangePrefix", () => {
  test("strips caret/tilde/comparator prefixes", () => {
    expect(stripRangePrefix("^1.2.3")).toBe("1.2.3");
    expect(stripRangePrefix("~1.2.3")).toBe("1.2.3");
    expect(stripRangePrefix(">=1.2.3")).toBe("1.2.3");
  });
  test("takes the first bound of a range/list", () => {
    expect(stripRangePrefix("1.2.3, <2.0.0")).toBe("1.2.3");
  });
});

describe("computeStatus", () => {
  test("unknown when either side is unparseable", () => {
    expect(computeStatus(null, [1, 0, 0])).toBe("unknown");
    expect(computeStatus([1, 0, 0], null)).toBe("unknown");
  });
  test("major/minor/patch behind classify correctly", () => {
    expect(computeStatus([1, 0, 0], [2, 0, 0])).toBe("major-behind");
    expect(computeStatus([1, 1, 0], [1, 2, 0])).toBe("minor-behind");
    expect(computeStatus([1, 1, 1], [1, 1, 2])).toBe("patch-behind");
  });
  test("up-to-date when versions match exactly", () => {
    expect(computeStatus([2, 3, 4], [2, 3, 4])).toBe("up-to-date");
  });
  test("ahead-of-latest-tag when current exceeds the registry's `latest` dist-tag", () => {
    // Real case verified live: npm `accepts` has 2.0.0 published under the
    // `next` dist-tag while `latest` still points to 1.3.8.
    expect(computeStatus([2, 0, 0], [1, 3, 8])).toBe("ahead-of-latest-tag");
    expect(computeStatus([1, 4, 0], [1, 3, 8])).toBe("ahead-of-latest-tag");
    expect(computeStatus([1, 3, 9], [1, 3, 8])).toBe("ahead-of-latest-tag");
  });
});
