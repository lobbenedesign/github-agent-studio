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

## 2026-08-25 (part 3) — two new real features, finished and wired

Found two new source files (`src/dependency_auditor.ts`, `src/similar_repo_finder.ts`) already written and imported in `server.ts` but never instantiated or routed — dangling, unreachable code. Both are genuinely real (no fabrication): the dependency auditor reads a repo's actual `package.json`/`requirements.txt` from `raw.githubusercontent.com` and checks each dependency's real latest version against `registry.npmjs.org`/`pypi.org`; the similar-repo finder runs real GitHub Search API queries built from the repo's actual topics/language.

- Wired both into `server.ts`: `GET /api/deps/audit?repo=owner/name`, `GET /api/repos/similar?repo=owner/name`.
- Verified live: `expressjs/express` dependency audit correctly found 44 real dependencies, 22 outdated, with real registry version numbers (e.g. `cookie ^0.7.1 -> 2.0.1`, major-behind).
- Found and fixed a real usefulness bug in `similar_repo_finder.ts` before shipping it: the original query ANDed 3 topics + language together, which GitHub's search treats as a strict AND — tested live against `fastify/fastify` and got **zero results**, because almost nothing has all three topics simultaneously. Rewrote it to run one broader query per topic (plus a language-only query), merge results, and rank by how many independent queries matched — re-tested against the same repo and got 12 real, relevant results (`mercurius-js/mercurius`, `platformatic/platformatic`, `fastify/avvio`, etc.).

## 2026-08-25 (part 4) — real known-vulnerability scan (OSV.dev), closing a named competitive gap

The project's own README names OpenSSF Scorecard, MergeStat, and Useful Forks as competitors, and the task brief additionally called out Dependabot/GitHub Explore and Socket.dev for the supply-chain angle. The existing `DependencyAuditor` (added in part 3) already did real freshness checks against npm/PyPI, but freshness alone isn't what Dependabot/Socket.dev actually alert on — they flag a **known, published vulnerability on the exact version you have pinned**, which is a materially different (and more actionable) signal than "there's a newer version".

**What was built:**
- `src/vulnerability_scanner.ts`: queries the real, free, unauthenticated [OSV.dev](https://osv.dev) API — the same open vulnerability database GitHub's own Dependabot alerts are built on — via its batch endpoint (`POST /v1/querybatch`) for every dependency with a resolvable exact version, then resolves full advisory details (summary, CVSS severity string, aliases) for each unique vulnerability id found via `GET /v1/vulns/{id}`, bounded to 10 concurrent detail fetches and capped at 60 unique ids per audit run. A batch or detail-fetch failure leaves those packages unscanned (`vulnerabilities: null`) rather than reporting a fabricated "no vulnerabilities found".
- `src/dependency_auditor.ts`: each `DependencyAuditEntry` now carries a real `vulnerabilities` field (`VulnMatch[] | null`); the report adds `vulnerableCount` / `totalVulnerabilities`, and the dependency list is now sorted vulnerable-first.
- `public/app.js` (Dependency Freshness Audit panel): added a "Vulnerabilità note (OSV.dev)" column with clickable links to each real GHSA/PYSEC advisory, and a vulnerable-package count in the summary line.

**How it was verified — not just asserted:**
- `src/verify_vuln_scanner.ts` (`bun src/verify_vuln_scanner.ts`) hits the live OSV.dev API against known-vulnerable fixture versions (`lodash@4.17.11`, `express@4.18.0`, `pyyaml@5.3.1`) and asserts real advisories come back — it does (7, 2, and 2 real advisories respectively, with real CVSS vectors and summaries, e.g. `GHSA-29mw-wpgm-hmr9` "Regular Expression Denial of Service (ReDoS) in lodash"). A patched version (`express@4.19.2`) correctly comes back with fewer vulnerabilities (1 instead of 2) than the older pin.
- Ran the real server (`bun server.ts`, port 3011, `GITHUB_TOKEN` set from `gh auth token`) and hit `/api/deps/audit?repo=request/request` (the long-deprecated `request` HTTP library, chosen because its old, unmaintained pinned dependency tree was likely to have real advisories) with a live `curl`: got back 40 real dependencies, 6 with real known vulnerabilities (11 total), e.g. `form-data@2.3.2 -> GHSA-fjxv-7rqg-78g4, GHSA-hmw2-7cc7-3qxx`, `tough-cookie@2.5.0 -> GHSA-72xf-g2v4-qvf3`, `qs@6.5.2 -> GHSA-6rw7-vpxm-498p, GHSA-hrpp-h998-j3pp`. `expressjs/express` (actively maintained) came back with `vulnerableCount: 0` for its 44 current dependencies — a real negative result, not a fabricated one.
- Confirmed the same output renders correctly in the actual browser UI (Security Shield tab → Dependency Freshness Audit panel) against `request/request`, showing "6 pacchetti con CVE/advisory note (OSV.dev)" with clickable per-CVE links.
- `bun build server.ts --target=bun --outfile=/dev/null` passes with no type/syntax errors after wiring the new async scan step through `DependencyAuditor.buildReport`.

No percentage, score, or performance multiplier is claimed anywhere in this change — vulnerability counts are exactly what OSV.dev returned for the exact versions queried, not an estimate.

## 2026-08-25 (part 5) — real supply-chain risk scan (install scripts + confirmed typosquat)

The known-vulnerability scan (part 4) closes the "known CVE on the exact pinned version" gap. It doesn't close a second, distinct gap Socket.dev specifically targets: packages that are risky *before* any CVE is ever filed — because most supply-chain attacks (compromised maintainer accounts, malicious new packages published with obfuscated install-time payloads) get caught by OSV/npm advisories after the fact, if at all. Verified via [Socket's own blog post](https://socket.dev/blog/how-socket-combats-insidious-typosquatting-supply-chain-attacks) on how it detects typosquats: it defines a typosquat as a name 1-2 edits from a popular package where the legitimate package has ≥1000x the monthly downloads, and separately flags install-time lifecycle scripts as a distinct risk category.

**What was built:**
- `src/supply_chain_scanner.ts` (new): for npm dependencies only —
  1. **Install-script detection**: fetches the real npm packument (`registry.npmjs.org/{name}`) and reads the exact `scripts` object for the pinned version (falling back to `dist-tags.latest` if the exact version isn't in the packument), flagging real `preinstall`/`install`/`postinstall` entries verbatim — not a guess, the literal script string npm itself would run.
  2. **Typosquat detection**: computes a real Levenshtein edit distance between the dependency name and a static, hand-curated reference corpus of ~300 well-known popular npm package names (there is no public npm "top-N by downloads" endpoint, so — like real detectors — this uses a fixed corpus, documented as such in the source). A distance-1/2 candidate is only flagged if the real npm downloads API (`api.npmjs.org/downloads/point/last-month`) confirms the popular package has ≥1000x the candidate's actual monthly downloads — matching Socket's own published ratio. Name similarity alone never triggers a flag.
- `src/dependency_auditor.ts`: each entry now carries `supplyChainRisk: SupplyChainRisk | null`; the report adds `installScriptCount` / `typosquatSuspectCount`, and sorting now puts vulnerable/typosquat-suspect packages first, then install-script packages.
- `public/app.js` (Dependency Freshness Audit panel): new "Supply-chain risk" column showing the exact install script(s) and/or the typosquat target with real download numbers and ratio, plus summary counts in the header line.

**How it was verified — not just asserted:**
- `src/verify_supply_chain_scanner.ts` (`bun src/verify_supply_chain_scanner.ts`) hits the live npm registry + downloads API against real fixtures: `crossenv` (a real, still-live historical typosquat of `cross-env`) is correctly flagged — edit distance 1, `cross-env` has 94,756,077 monthly downloads vs `crossenv`'s 9,252 (10,242x, real live numbers on 2026-08-25) — while `cross-env` itself is correctly *not* flagged as its own typosquat. `node-sass@9.0.0` is correctly flagged with its real `install`/`postinstall` scripts (`node scripts/install.js` / `node scripts/build.js`, read live from the registry). `chalk@5.3.0` correctly comes back clean on both signals. All 6 assertions pass against live data.
- Ran the real server (`bun server.ts`, port 3011, `GITHUB_TOKEN` from `gh auth token`) and hit `GET /api/deps/audit?repo=request/request` live: of 40 real dependencies, `installScriptCount: 1` (`phantomjs-prebuilt@2.1.3` → real `install: "node install.js"`, which is the well-known script that downloads a PhantomJS binary at install time) and `typosquatSuspectCount: 1` (`taper@0.5.0`, edit distance 2 from `tar`, real ratio 288,044x — `tar` at 345,941,299 monthly downloads vs `taper`'s 1,201).
- `bun build server.ts --target=bun --outfile=/dev/null` passes with no type/syntax errors.

No score, percentage, or "risk level" label is invented — every flag is either a literal script string from the live registry or a literal download-count ratio from the live npm downloads API, both shown to the user with their real source numbers.

## 2026-08-25 (part 5) — found the catalog was hiding round 1/2's own fixes

Live-verified this app in a browser (per user request) instead of trusting the audit reports. `data/catalog.json` — a **committed, tracked-in-git** on-disk cache — was masking multiple already-fixed honesty issues from other sibling projects, because `RepoIndexer.loadCatalog()` prefers the persisted file over the in-code seed data and nothing ever invalidated it:

- The HyperRAG-Studio card still showed the fabricated "EAGLE 3.5x" claim — fixed in `src/repo_indexer.ts` back in part 1 of this same day's work, but that fix never took effect because the stale committed `catalog.json` (written before the fix) was loaded instead.
- The Aether-Voice card still described the old fake TypeScript "Sub-150ms Turn-Taking... Voice Tools Dispatcher" engine, even though that project was completely rewritten to a real Python LiveKit/Moshi plugin earlier today. `language` field was also still "TypeScript".
- The GenUI-Canvas-Studio card still said "Infinite Generative UI Canvas" — a claim that project's own README explicitly found false and removed.
- The RL-Reasoning-Gym card called itself a "GRPO Reinforcement Learning Studio" with no caveat, while that project's own README is explicit there is no gradient/optimizer/checkpoint — it's a prompt-space loop, not weight-space training.
- Nexus-Local-Engine and OmniOS-Pilot cards similarly overstated unification/grounding claims that the sibling projects' own READMEs have since qualified or partially walked back.

**Root cause fixed, not just the symptom:** `data/catalog.json` was tracked in git (`git rm --cached`, added to `.gitignore`) so a fresh checkout always regenerates from the current source seed instead of resurrecting whatever was committed at some point in the past. The seed descriptions themselves were rewritten in `src/repo_indexer.ts` to match each sibling project's actual current README, not their original launch-day marketing copy.

**Verified:** killed the running server, deleted the stale `catalog.json`, restarted, confirmed via `bun build` (clean) and a live browser check (screenshot + `get_page_text`) that the regenerated catalog contains zero occurrences of any of the retired claims.

## 2026-08-26 — real continuously-growing GitHub index + real version trees

User request: make the app able to genuinely index public GitHub repositories broadly (not just the ~20-item hand-seeded catalog) with a real version/release history per repo, alphabetically browsable, scored. Scoped honestly before building: NOT a mirror of all 420M+ GitHub repos (not feasible, GitHub itself doesn't offer that), and explicitly public-only — no attempt to access private repositories without authorization, confirmed with the user.

**Built:**
- `src/repo_database.ts`: a persistent on-disk SQLite database (`data/repos.db`, WAL mode) as the real source of truth for the growing index — replaces holding the whole catalog in a JS array/JSON file, which doesn't scale past a few thousand rows. Real indexed queries (by letter, language, star count, substring), a real `crawl_partitions` table that IS the crawler's persistent state (survives restarts).
- `src/deep_crawler.ts`: partitions GitHub's Search API space by language × star-range (30 languages × 6 star buckets = 180 seed partitions) and pages through each via real requests, one every 2.5s (~24/min, under the real 30/min Search API limit). Tracks the real `X-RateLimit-Remaining`/`X-RateLimit-Reset` response headers and backs off for real on 403/429. When a partition's `total_count` exceeds the Search API's real 1000-result cap, splits it into two narrower star-range partitions instead of silently truncating.
- `GitHubApiClient.fetchVersionHistory()`: real version tree per repo, merging the real Tags API (every tag) with the real Releases API (release notes/dates where they exist) — on-demand (`GET /api/repos/versions?repo=owner/name`), not part of the mass crawl (would blow the rate limit budget on hundreds of thousands of repos).
- New routes: `/api/crawl/start`, `/api/crawl/stop`, `/api/crawl/tick` (manual single step), `/api/crawl/status`, `/api/db/browse` (paginated/filterable over the real persisted index), `/api/db/languages`.
- New UI tab "🌍 Deep Crawler" — real live status (running/stopped, real repo count, real partition progress, real rate-limit-remaining, the actual last search query string and its real result), plus a searchable browse panel over the real persisted index.

**Verified live** (not just unit-level): started the crawler in a real browser session against this machine's `bun server.ts`, watched it run unattended — 54 real JavaScript repos ≥50k stars ingested in the first tick (real `react/react`, `trekhleb/javascript-algorithms`, etc. with real star counts/topics/licenses), a 623-result partition paginated correctly across 7 real requests (6×100 + 23, matching GitHub's own reported `total_count` exactly), and after ~2 minutes unattended the index reached **3,277 real repos**, with a partition correctly reporting 289,339 total matches for `language:JavaScript stars:10..99` (far past the 1000-result cap, confirming split logic will trigger).

**Honest limits, stated in the UI itself, not hidden in a README no one reads:** this is a bounded, ever-growing partition set seeded from popular languages — not literally every repository on GitHub. Public repositories only.

## 2026-08-26 (part 2) — unified the main catalog with the deep crawler's real index

User asked what other real limits this app has. Found the most significant one immediately: the Deep Crawler (built earlier today) was indexing thousands of real repos into `repos.db`, but the main "A-Z Catalog" tab — the screen a user actually looks at — still queried only the old ~20-item hand-curated seed list. Two completely disconnected systems; the crawler's output was invisible on the main dashboard and never scored.

**Fixed for real, not just patched:**
- `CodeEvaluator.evaluateRepo()` had a hardcoded roadmap/verdict ("integrate into Nexus Local Engine, HyperRAG Studio, OmniClaw...") applied to *every* repo regardless of what it was — nonsensical advice when applied to `react/react` or any of the thousands of external repos the crawler indexes. Added an `isOwnSuite` flag; only this suite's own ~9 sibling projects get that roadmap now, everything else gets a generic, honest, deterministic score with an empty roadmap (we haven't read the actual code, so we don't pretend to have specific advice).
- The AI-specific category taxonomy (LLM & Inference / Agents & Automation / etc.) previously defaulted every unmatched repo to "LLM & Inference" — wrong for a CSS framework or a game engine. Extracted a shared `category_detector.ts`; unmatched repos now return `null`, shown honestly as "General" instead of a wrong forced label.
- Added real `total_score`/`recommendation`/category columns to `repos.db`, computed inline during crawl ingestion (the heuristic is synchronous — stars/forks/language/description — so it costs zero extra Search API requests).
- Migration: an already-running `repos.db` predates these columns. Added a real `ALTER TABLE` migration (not "delete and re-crawl") plus a startup backfill pass that scored all 30,070 already-indexed repos that existed before this change, verified live in the server log (`📐 Backfilled real scores for 30070 repos`).
- Rewired `GET /api/repos/list` to merge the curated list with a real query against `repos.db` — **and found a second bug while testing this fix in the browser, not just by reading code**: the first version concatenated curated-first then db-results, so the ~20 curated repos always filled the entire first page regardless of score, silently hiding all 35,000+ real crawled repos from the default view. Fixed to genuinely merge-then-sort both sources together before paginating.

**Verified live:** `curl /api/repos/list?sortBy=score` and a real browser screenshot both show real crawled repos (`cypress-io/cypress`, 51,000 real stars, 100/100) ranking above/alongside the curated set based on actual score — not the old fixed order.

## 2026-08-26 (part 3) — the same caching bug recurred, real trending, finer scoring, one-click launchers

### The stale-catalog.json bug came back — root cause fixed this time, not patched again
While improving the scoring formula below, live testing kept showing impossible values (`architectureScore: 30` when the new formula's real maximum is 28) no matter how many times the server was restarted. Root cause, found by direct isolated testing (`bun -e` importing `RepoIndexer` directly, bypassing HTTP and the preview infra entirely to rule out process/caching ambiguity): `data/catalog.json` — deleted and gitignored in part 1 of this same day's work — had been silently **recreated** by an earlier debugging script that instantiated `RepoIndexer`, and `loadCatalog()` still had the old behavior of loading the *entire* catalog from that file when present, skipping `seedCatalog()` (and therefore every score/description fix in this file) entirely if the file existed for ANY reason.

Fixed properly this time: `loadCatalog()` now **always** runs `seedCatalog()` fresh (cheap — 21 items, pure sync computation), and only merges in genuinely user-added repos (via `POST /api/repos/scan`) from the JSON file, filtered against the seed set. The seed catalog can no longer be silently shadowed by a stale cache, regardless of how or why the cache file exists.

### Scoring formula: continuous instead of coarse buckets, using real signals we already had but weren't using
The old formula had ~5 possible values per sub-score (fixed step bonuses at hard thresholds), so unrelated repos routinely landed on the exact same total — verified before this fix: 200 top-scored repos had only a handful of distinct scores, with dozens tied at exactly 100/100. Rewrote `CodeEvaluator.evaluateRepo()`:
- Architecture: sums partial credit per matched real keyword instead of one all-or-nothing +8 bump.
- Code Cleanliness: continuous fork-to-star ratio (real engagement — forks are people modifying the code, not just bookmarking it) damped by a sample-size confidence term, plus a real open-issues-to-stars ratio signal.
- Community Momentum: continuous log10(stars) curve instead of 4 fixed thresholds, plus a genuinely new signal — real recency from the repo's actual `pushed_at` date (a repo untouched 2+ years gets zero recency credit; one pushed in the last 30 days gets full credit).
- Added a boot-time full rescore pass (not just backfill-the-nulls) so a formula change actually reaches all 36,477 already-indexed repos, not only future crawls.
- Verified: distinct-score count in the top 200 went from a handful to 46; live output now shows repos like `ChatGPTNextWeb/NextChat` (86.1), `Activiti/Activiti` (84.8), `github/docs` (83.8) — all different, not clustered at a ceiling.

### Real trending/history (closing the "no OSS-Insight-style trend view" gap)
Added `repo_snapshots`, a real append-only time-series table: every time the crawler observes a repo with a changed star/fork/issue count, a new real row is recorded (deduped — no identical-value spam). Once all seeded partitions are exhausted, the crawler now **reopens them for another real pass** instead of idling forever — this is what actually produces new snapshot rows over time instead of freezing at the first crawl. `GET /api/repos/history?repo=owner/name` returns the real series; the repo detail modal now renders it as a real inline SVG sparkline. Honestly labeled as sparse until the crawler completes multiple passes — no interpolated/fake data points.

### Fixed the "60 Repos Indexed" chip
It was literally the page-size limit, not a real total. `/api/repos/list` now returns `{rows, total}` with a real `COUNT(*)`-derived total across the curated + deep-crawled sources; the header chip shows that.

### Second real merge bug found while testing the above
Verifying the trending feature surfaced that the catalog merge (fixed in part 2) still needed the total count to come from the real filtered counts, not the returned page — fixed in the same pass as the chip fix above.

### One-click launchers (macOS + Windows), verified not just written
`start-macos.command` (rewritten) and `start-windows.bat` (new): check Bun is actually installed with a real, actionable error if not; pick up a `gh` CLI token automatically for the real 5000/hour API limit instead of 60/hour; start the server; open the browser. The macOS script was actually run on this machine (not just written and assumed correct) — confirmed a real server boot and a real `200` response from `curl localhost:3011/`. The Windows script could not be tested on real Windows in this environment; written carefully against documented `cmd.exe` syntax but flagged here as unverified, not claimed as tested.

## 2026-08-26 (part 4) — real source-code analysis ("analyze, don't download")

Closes the last named gap: the app previously only had a 1500-character README excerpt, never actually looked at source code. Per explicit user direction: analyze, don't mass-download — fetch what's needed to judge the project, archive only the resulting judgment (description, score, language, dates, author), not the code itself. A separate explicit "download the full source" affordance is fine, but must be a distinct user action, never automatic.

**Built:** `src/code_analyzer.ts` — `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` for the real, complete file tree in one request (not a manual directory crawl), then a real deterministic spread-sample of up to 40 real source files (every Nth file across the sorted tree, not just the first 40 alphabetically, so small repos get full coverage and huge repos get a genuine cross-section). Each sampled file's real raw content is fetched one at a time from `raw.githubusercontent.com`, measured (line count, extension, test-file heuristic, TODO/FIXME count), and immediately discarded — nothing about a file's actual text is retained past that loop iteration. Only the aggregate (counts, ratios, a generated summary) is archived, in a new `code_analysis` table (`repos.db`).

- `POST /api/repos/analyze` (runs the real analysis, archives the aggregate), `GET /api/repos/analysis` (reads back a cached aggregate, no new GitHub requests).
- Repo detail modal: new "🔬 Analisi Codice Reale" panel with an "Analizza ora" button, plus a separate, clearly-labeled "📥 Scarica l'intero sorgente (.zip)" link to GitHub's own real archive URL (verified: `github.com/{repo}/archive/HEAD.zip` real-redirects to `codeload.github.com` with a real commit hash) — a distinct, explicit action, never triggered automatically.

**Verified live** in an actual browser (not just curl): analyzed `ChatGPTNextWeb/NextChat` — real results shown in the UI: 425 files in the tree, 192 real source files, 40 sampled, 11,610 real lines counted, 18% test-file ratio, 4 real TODO/FIXME markers, real per-extension breakdown (ts: 31, tsx: 7, js: 2). Also verified via curl against `expressjs/express` (213 files, 141 source, 62.5% test ratio, real CI config detected) and confirmed the cached-read endpoint returns the archived aggregate without re-analyzing.

Note: found the shared dev server on port 3011 had live connections from another active session (Chrome + another Claude session) while working on this — did not touch it; verified everything against a separate instance on port 3099 instead, to avoid disrupting whoever was using it.

## 2026-08-27/28 — systematic per-page, per-button live audit: 6 real bugs found and fixed

User challenge: "cosa manca a questo software? sei sicuro funzionino correttamente tutte le funzionalità e pulsante presenti in ogni pagina?" — answered by clicking through every tab (Deep Crawler, Fork Hunter, Security Shield, SQL Studio, Version Radar, Wiki Archive, Live Scanner, Matrix/Competitors) and every control in the repo detail modal, live in a real browser, checking console errors and real API responses at each step rather than reading code and assuming it worked.

**Found and fixed:**
- `public/app.js`: `escapeHtml()` was called in 5 places (Deep Crawler browse cards, trend chart note) but never defined anywhere in the file — a real `ReferenceError`, silently swallowed by empty `catch {}` blocks. This is why the Deep Crawler's "Browse Full Persisted Index" panel rendered a correct count but zero actual cards. Defined it for real.
- `public/app.js`: 7 occurrences of silent `catch {}` around fetch calls were hiding errors like the one above. Changed all to `catch (e) { console.error(e); }` so future breakage surfaces instead of failing invisibly.
- `public/app.js`: `navigator.clipboard.writeText()` was called with no error handling in 4 places (fork command copy, git clone copy, wiki export). In this browser and any real browser without clipboard permission (or non-HTTPS/non-localhost context) it rejects with `NotAllowedError` — unhandled promise rejection, silent no-op for the user. Centralized into `copyToClipboard()` with a `prompt()`-based manual-copy fallback.
- `public/app.js`: that same fallback had a second, subtler bug — in this sandboxed test browser, `window.prompt()` doesn't throw synchronously, it returns a Promise that rejects, which a plain `try/catch` around the call does not catch at all. Found by live-testing the copy buttons and checking console for unhandled rejections, not by reading the code. Fixed by also handling the case where `prompt()`'s return value is itself a rejecting promise.
- `public/app.js`: introduced and caught my own regression while writing the fix above — a bad escape (`npm\'s`) in a template literal broke the entire classic script's parsing (one syntax error anywhere kills the whole file), meaning zero JS executed anywhere on the page until fixed. Caught via a console-marker test showing no button produced any log output.
- `server.ts` + `src/repo_database.ts`: SQL Studio only ever queried the 21-item curated catalog, never the 100,000+ deep-crawled index — same disconnected-data-source pattern already fixed elsewhere in the app but missed here. Fixed by merging `indexer.getCatalog()` with a new `repoDb.getTopByScore(5000)` (a server-side-only method that bypasses the public `browse()` endpoint's intentional 200-row UI-safety cap, which is left in place for that endpoint).
- `public/index.html`: the SQL Studio's own default example query referenced a nonexistent table (`catalog`) and wrong-case columns — it had never actually run successfully since it was written. Replaced with a real, verified query against the real `repos` table/columns, with a realistic score threshold given the new continuous scoring formula's real distribution (verified max ~86.1).
- `src/dependency_auditor.ts`: found a real npm registry edge case live-testing Version Radar — a package (`accepts`) had a higher version published under the `next` dist-tag (2.0.0) than under `latest` (1.3.8), which the old up-to-date/outdated binary comparison mislabeled as "up-to-date" by only comparing against `latest`. Added an honest third status, `"ahead-of-latest-tag"`, rather than reporting a wrong verdict.

**Confirmed genuinely working, no changes needed:** Live Scanner, Matrix/Competitors comparison table, repo detail modal's close button and real code-analysis panel (`src/code_analyzer.ts`, verified working from a parallel session's changes — real file counts, real sampled line counts, honest "analyze, don't download" framing with a separate explicit full-source download link), trend sparkline (correctly shows an honest "fewer than 2 data points yet" message rather than fabricating a chart from insufficient data).

## 2026-08-28 — real automated test suite, CI wired to run it, and one more README honesty fix

User request: "implementa tutto quello che manca e che ti sembra necessario" (implement everything that's missing and seems necessary) after the previous round's honest gap list. Closed the two concrete, feasible gaps from that list.

**Added: `tests/` — 33 real, network-free unit tests (`bun:sqlite`-backed, no mocks) covering the deterministic logic that's actually feasible to unit-test:**
- `tests/dependency_auditor.test.ts`: exported `computeStatus`/`parseSemver`/`stripRangePrefix` for direct testing; covers the major/minor/patch-behind classification and the real `ahead-of-latest-tag` edge case added in the previous round.
- `tests/supply_chain_scanner.test.ts`: exported `levenshtein`/`findClosestPopularName`; verifies the real historical `crossenv`→`cross-env` typosquat pair is flagged and that a popular package is never flagged against itself.
- `tests/code_evaluator.test.ts`: verifies the continuous scoring formula (added two rounds ago to replace fixed-threshold buckets) actually produces distinct scores for repos with different real signal counts, that more real architecture keywords/stars/recency produce strictly higher sub-scores, and that `isOwnSuite=false` never leaks suite-specific roadmap text onto an arbitrary external repo.
- `tests/sql_query_engine.test.ts`: runs real `SELECT`/`WHERE`/`ORDER BY` queries through the actual `bun:sqlite` engine against a fixture catalog; confirms re-population reflects the latest catalog and that a genuinely invalid query returns a real SQLite error, not a silently empty result.
- `tests/repo_database.test.ts`: exercises the real persistent SQLite-backed repo store against a temp on-disk file (not a mock) — upsert insert-vs-update semantics, `browse()`'s 200-row public-safety cap vs `getTopByScore()`'s uncapped server-side bypass (both added in the prior round), snapshot dedup (`recordSnapshotIfChanged`), and the code-analysis archive round-trip.
- Sanity-checked the suite actually catches regressions (not just tautologically green): temporarily broke `computeStatus`'s `ahead-of-latest-tag` branch, confirmed the corresponding test failed with a clear diff, then restored the source.
- Wired into `package.json` (`bun run test`) and `.github/workflows/ci.yml` (runs after build + typecheck on every push/PR).

**Fixed a real README honesty bug found while documenting the above:** both the English and Italian Quick Start sections claimed "Both [launchers] verified working ... before being committed" — but `start-windows.bat` was never run on real Windows (this was already honestly disclosed inside `CHANGELOG.md` itself from an earlier round, just not reflected in the README's own claim). Corrected both language sections to state precisely what was and wasn't verified. Also found and fixed a second, smaller instance of the same stale-example-query bug fixed in `public/index.html` two rounds ago — the English feature list's SQL Studio bullet still showed the old broken `SELECT Name, Stars, Score FROM catalog ...` example referencing a nonexistent table.

**Confirmed already real, no action needed:** `.github/workflows/ci.yml` (build + typecheck) already existed from a parallel session's work; `supply_chain_scanner.ts` and `license_auditor.ts` were already fully wired into `dependency_auditor.ts`/`server.ts`, not dangling as initially suspected — only the three `verify_*.ts` scripts remain standalone (by design: they hit live external APIs and are meant to be run manually, not as part of the deterministic CI suite).

## 2026-08-29 — Deep Crawler auto-resumes after a crash/reboot/redeploy, verified live end-to-end

Found while answering a follow-up "cosa manca ancora" (what's still missing) after the test-suite round: `DeepCrawler.start()` was only ever called from the `/api/crawl/start` UI button, never at server boot. A crash, machine reboot, or redeploy silently left the "continuously-growing index" paused until a human noticed and clicked Start again — it never lied about its state (`/api/crawl/status` correctly reported `running: false`), but the marketed "continuously growing" behavior quietly stopped growing.

**Fixed:**
- `src/repo_database.ts`: added a small generic `settings` key-value table (`getSetting`/`setSetting`) — the natural place for process-restart-durable flags that don't need their own table.
- `src/deep_crawler.ts`: `start()`/`stop()` now persist a `deep_crawler_running` flag; new `wasRunningBeforeShutdown()` reads it back.
- `server.ts`: at boot, calls `deepCrawler.start()` automatically **only if** the flag says it was genuinely running last time — an explicit Stop click persists `"0"` and correctly stays paused across a restart, it doesn't just resume unconditionally.

**Verified live, twice, against the real production `data/repos.db` (not a mock, not just the unit tests):**
1. Started the crawler via the real API, then `kill -9`'d the server process (simulating an actual crash, not a graceful shutdown) — on restart, the log printed `Deep Crawler auto-resumed: was running when the process last stopped.` and `/api/crawl/status` showed `running: true` with a real fresh tick already executed (`Objective-C stars:10..99` page 8, 100 real results).
2. Explicitly stopped the crawler via the real API, then killed and restarted the server again — this time no auto-resume log line appeared and `/api/crawl/status` correctly showed `running: false`, confirming a human's explicit Stop is respected across a restart rather than being silently overridden.

Also added `tests/deep_crawler.test.ts` (3 tests) and a settings round-trip test in `tests/repo_database.test.ts`, both network-free — full suite now 37 tests across 6 files, still green in CI.

## 2026-08-26 (part 5) — side-by-side repo comparison, reusing existing computed data only

Directly serves the original stated goal for the Deep Crawler: "so I know what's worth working on, which repo to take code from rather than another" — real score/category/trend/analysis existed per-repo, but nothing let you put 2-4 repos side by side to decide between them.

**Built:** `GET /api/repos/compare?repos=a/b,c/d` (2-4 repos, comma-separated) — pure composition of data already computed elsewhere: `storedRepoToItem()` was extracted from `/api/repos/list`'s inline mapping so both routes build the identical shape from the same source instead of two copies drifting apart (the exact bug class fixed twice already this session); the compare endpoint adds each repo's real `repoDb.getHistory()` and cached `repoDb.getCodeAnalysis()` alongside it. No new signal is computed, no new GitHub requests are made by this endpoint.

UI: a checkbox on every catalog card (max 4 selected), a floating bar that appears once 2+ are selected, and a comparison modal rendering a real table — score, recommendation, the four real breakdown components, a proportional bar chart of real star counts, forks, language, license, trend point count (honestly "dati insufficienti" if the crawler hasn't observed a change yet), and code-analysis summary if one was archived ("non ancora analizzata" if not).

**Verified live in an actual browser**, not just curl: selected `ChatGPTNextWeb/NextChat` and `Activiti/Activiti`, opened the compare modal, confirmed the real proportional star bar (88,652 vs 10,541), real per-component score breakdown, and — importantly — that NextChat's previously-archived code analysis (11,610 real lines, 18% test ratio, 4 TODOs, from part 4's testing) was correctly read back and displayed, while Activiti honestly showed "not yet analyzed" rather than a fabricated result.
