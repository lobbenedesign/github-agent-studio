# Changelog

## 2026-08-25 — real Fork Hunter, real Crawler Daemon, fixed 2 crash bugs

**What was fake and is now real:**

- `src/fork_hunter.ts`: `commitsAhead` was `12 + (data.length - i) * 6` — a formula, not a diff. `keyEnhancementsFound` was 3 hardcoded strings ("Added Apple Silicon MPS...") attached to every fork regardless of content. If the GitHub API call failed, it returned two fully invented forks (`dev-labs/${repo}-fast`, "2.4x speedup via SIMD intrinsics") with no indication they weren't real.
  Now: calls GitHub's real `compare` API (`/repos/{owner}/{repo}/compare/{base}...{fork}:{branch}`) for real `ahead_by`/`behind_by`, and uses the real commit subject lines from that comparison as `keyEnhancementsFound`. No fallback — a failed API call now throws `GitHubApiFetchError`, surfaced to the caller as a real HTTP error, not fabricated forks. Verified against `ast-grep/ast-grep`: most real forks are behind, not ahead — the opposite of what the old fake formula always showed.
- `src/daily_cron_scheduler.ts`: `newDiscoveredCount += 2` every run regardless of any actual check; the "version update" loop did nothing but `setTimeout(r, 120)` and increment a counter.
  Now: re-polls each catalog repo against the live GitHub API for a real star delta (`RepoIndexer.refreshRepo`), and searches GitHub's real Search API for repos genuinely pushed since the last sync. Verified end-to-end: a real run pulled real current star counts (e.g. real `+46254` for `unslothai/unsloth` since the seed snapshot) and a direct test of the search query itself returned 12,307 real matching repos for a realistic date window.
- `src/github_api_client.ts`: the "offline/rate-limited" fallback returned invented metadata (1200 stars, "Cutting edge open source AI repository") indistinguishable from a real repo. Removed — failures now throw `GitHubApiFetchError` with the real HTTP status.
- `src/repo_indexer.ts`: two real bugs, not fakery — `starDelta24h: Math.max(2, Math.round(Number(item.stars...` referenced an undefined `item` variable (should have been `r`), and a second spot referenced an undefined `repoData`. Both would throw `ReferenceError` at runtime. Fixed by using the real delta already computed by `VersionTracker.trackDelta` instead of a second, broken ad-hoc formula.
- `src/repo_indexer.ts`: the seed catalog's description for `lobbenedesign/hyperrag-studio` asserted "EAGLE 3.5x" as fact. That figure was confirmed fabricated in hyperrag-studio's own source (a hardcoded `console.log("Ready (3.5x)")`, unrelated to any computation) — this repo was unknowingly repeating another project's false claim. Softened to not assert it.

**Not changed:** `competitor_benchmark.ts` (a boolean feature-comparison table against GitHub Trending/OSS Insight/GitHunt/etc.) — this is an unverified opinion about competitors' feature sets, not a fabricated performance metric about this software's own behavior, and wasn't part of what the audit flagged as fake.

**New operational requirement:** the real GitHub API calls this introduces are subject to GitHub's 60 requests/hour unauthenticated rate limit. Set `GITHUB_TOKEN` for the 5000/hour authenticated limit — `src/github_api_client.ts` picks it up automatically from the environment if present.

## 2026-08-25 (part 2) — verification pass: 2 more honesty bugs found and fixed, all endpoints tested live

Audited the remaining modules not covered above (`security_shield.ts`, `sql_query_engine.ts`, `code_evaluator.ts`, `llm_evaluator.ts`, `wiki_generator.ts`, `version_tracker.ts`, `competitor_benchmark.ts`, `public/app.js`, `public/index.html`) and ran the server for real (`bun server.ts`, port 3011) with a live `GITHUB_TOKEN` from `gh auth token`, hitting every API route with real `curl` requests instead of just reading code.

**Confirmed genuinely real (no changes needed):** `security_shield.ts` calls the real `api.securityscorecards.dev` OpenSSF endpoint first, falling back to real GitHub metadata checks (LICENSE file, Actions workflows) only when OpenSSF hasn't indexed the repo yet — verified live against `expressjs/express` (returned a real Scorecard checklist with 18 real checks). `sql_query_engine.ts` runs actual `bun:sqlite` — verified with a live `SELECT ... ORDER BY stars DESC` returning real catalog rows. `fork_hunter.ts` / `github_api_client.ts` verified live against `ast-grep/ast-grep`: real forks came back mostly *behind*, not ahead, matching the earlier finding that the old fake formula always showed forks as ahead. `/api/sync/run` verified live: real star deltas (e.g. `unslothai/unsloth: +3 stars`) from actual re-polling. `code_evaluator.ts`'s heuristic scoring is a real deterministic formula over real inputs (stars/forks/language), not canned output — acceptable as a heuristic, not a fabricated claim.

**Found and fixed (UI honesty bugs, not present in the audited backend):**
- `public/app.js` (Security Shield tab): the vulnerability count, "Dangerous Binaries" status, and "License" status were rendered with **hardcoded colors/text regardless of the real API response** — license always showed "COMPLIANT ✓" in blue even when `licenseCompliance: false`, vulnerabilities/binaries were always green even when the count was >0 or binaries were detected. The underlying data was real; only the display ignored it. Now the color and license label are driven by the actual field values.
- `public/app.js` (Security Shield checklist): every checklist item showed a green ✓ regardless of `c.passed`. Now shows ✗ in red for failed checks.
- `README.md`: the `OpenSSF Security` badge read "Grade A+", implying this project itself was audited and scored A+ — never measured. Changed to "Live Scorecard API" to describe the real, dynamic feature instead of an unverified self-grade.

**Not changed:** `competitor_benchmark.ts` (same reasoning as before — an opinion table about competitors, not a fabricated metric about this software).
