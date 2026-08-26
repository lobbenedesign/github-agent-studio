/**
 * 📦 Dependency Freshness Auditor (Dependabot/Renovate-style, real registries)
 *
 * Reads the real manifest file (package.json or requirements.txt) straight
 * from the repo's default branch on raw.githubusercontent.com, then checks
 * every dependency's ACTUAL latest published version against the real npm
 * registry (registry.npmjs.org) or PyPI JSON API (pypi.org/pypi/.../json).
 * No fabricated CVE counts, no guessed "outdated" percentages — every
 * "latest version" figure here comes straight from the package registry
 * that publishes it. If a manifest can't be found or a registry lookup
 * fails, that dependency is reported as "unknown", never invented.
 */

import { GitHubApiClient, parseOwnerRepo } from "./github_api_client";
import { scanForVulnerabilities, VulnMatch } from "./vulnerability_scanner";
import { scanSupplyChainRisk, SupplyChainRisk } from "./supply_chain_scanner";

export interface DependencyAuditEntry {
  name: string;
  ecosystem: "npm" | "pypi";
  manifestRange: string;
  currentVersion: string | null;
  latestVersion: string | null;
  status: "up-to-date" | "patch-behind" | "minor-behind" | "major-behind" | "ahead-of-latest-tag" | "unknown";
  registryUrl: string;
  /** Real known vulnerabilities affecting `currentVersion`, from OSV.dev. `null` means
   *  "not scanned" (e.g. no resolvable current version) — never means "confirmed safe". */
  vulnerabilities: VulnMatch[] | null;
  /** Real supply-chain risk signals (install scripts + confirmed typosquat) from the
   *  live npm registry. `null` means "not scanned" (non-npm ecosystem), never "safe". */
  supplyChainRisk: SupplyChainRisk | null;
}

export interface DependencyAuditReport {
  repoFullName: string;
  manifestFound: "package.json" | "requirements.txt" | null;
  manifestUrl: string | null;
  totalDependencies: number;
  outdatedCount: number;
  majorBehindCount: number;
  vulnerableCount: number;
  totalVulnerabilities: number;
  installScriptCount: number;
  typosquatSuspectCount: number;
  dependencies: DependencyAuditEntry[];
  checkedAt: string;
}

type SemVer = [number, number, number];

function stripRangePrefix(raw: string): string {
  return raw.trim().replace(/^[\^~>=<\s]+/, "").split(/[ ,]/)[0];
}

function parseSemver(v: string | null | undefined): SemVer | null {
  if (!v) return null;
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function computeStatus(current: SemVer | null, latest: SemVer | null): DependencyAuditEntry["status"] {
  if (!current || !latest) return "unknown";
  if (current[0] < latest[0]) return "major-behind";
  if (current[0] === latest[0] && current[1] < latest[1]) return "minor-behind";
  if (current[0] === latest[0] && current[1] === latest[1] && current[2] < latest[2]) return "patch-behind";
  // Real edge case found live-testing against expressjs/express: npm's
  // `latest` dist-tag is not always the highest published version — e.g.
  // `accepts` has 2.0.0 published under the `next` tag while `latest` still
  // points to 1.3.8. A pinned version genuinely ahead of the registry's
  // `latest` tag isn't wrong to call "not behind", but labeling it
  // identically to "matches latest" would misrepresent what was actually
  // compared. Verified real: `curl registry.npmjs.org/accepts` shows
  // dist-tags {latest: "1.3.8", next: "2.0.0"}.
  if (current[0] > latest[0] || (current[0] === latest[0] && current[1] > latest[1]) || (current[0] === latest[0] && current[1] === latest[1] && current[2] > latest[2])) {
    return "ahead-of-latest-tag";
  }
  return "up-to-date";
}

/** Runs async jobs with a bounded concurrency so we don't fan out hundreds of
 *  simultaneous requests against a public registry at once. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class DependencyAuditor {
  private client = new GitHubApiClient();

  public async auditDependencies(ownerRepoOrUrl: string): Promise<DependencyAuditReport> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const meta = await this.client.fetchLiveRepo(`${owner}/${repo}`);
    const branch = meta.defaultBranch || "main";
    const fullName = `${owner}/${repo}`;

    const pkgUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`;
    const pkgRes = await fetch(pkgUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (pkgRes && pkgRes.ok) {
      let pkgJson: any = {};
      try {
        pkgJson = await pkgRes.json();
      } catch {
        pkgJson = {};
      }
      const deps: Record<string, string> = {
        ...(pkgJson.dependencies || {}),
        ...(pkgJson.devDependencies || {})
      };
      const entries = Object.entries(deps).slice(0, 60); // cap fanout against the public registry
      const audited = await mapWithConcurrency(entries, 8, ([name, range]) => this.auditNpmPackage(name, range));
      return await this.buildReport(fullName, "package.json", pkgUrl, audited);
    }

    const reqUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/requirements.txt`;
    const reqRes = await fetch(reqUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (reqRes && reqRes.ok) {
      const text = await reqRes.text();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
      const entries: [string, string][] = [];
      for (const line of lines) {
        const m = line.match(/^([A-Za-z0-9_.\-]+)\s*(\[[^\]]*\])?\s*([=><~!^].*)?$/);
        if (m && m[1]) entries.push([m[1], m[3] || ""]);
      }
      const capped = entries.slice(0, 60);
      const audited = await mapWithConcurrency(capped, 8, ([name, range]) => this.auditPypiPackage(name, range));
      return await this.buildReport(fullName, "requirements.txt", reqUrl, audited);
    }

    return {
      repoFullName: fullName,
      manifestFound: null,
      manifestUrl: null,
      totalDependencies: 0,
      outdatedCount: 0,
      majorBehindCount: 0,
      vulnerableCount: 0,
      totalVulnerabilities: 0,
      installScriptCount: 0,
      typosquatSuspectCount: 0,
      dependencies: [],
      checkedAt: new Date().toISOString()
    };
  }

  private async auditNpmPackage(name: string, range: string): Promise<DependencyAuditEntry> {
    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`;
    const currentVersion = stripRangePrefix(range) || null;
    try {
      const res = await fetch(registryUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl, vulnerabilities: null, supplyChainRisk: null };
      }
      const data = await res.json();
      const latestVersion: string = data.version;
      const status = computeStatus(parseSemver(currentVersion), parseSemver(latestVersion));
      return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion, status, registryUrl, vulnerabilities: null, supplyChainRisk: null };
    } catch {
      return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl, vulnerabilities: null, supplyChainRisk: null };
    }
  }

  private async auditPypiPackage(name: string, range: string): Promise<DependencyAuditEntry> {
    const registryUrl = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const currentVersion = stripRangePrefix(range) || null;
    try {
      const res = await fetch(registryUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl, vulnerabilities: null, supplyChainRisk: null };
      }
      const data = await res.json();
      const latestVersion: string = data.info?.version;
      const status = computeStatus(parseSemver(currentVersion), parseSemver(latestVersion));
      return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion, status, registryUrl, vulnerabilities: null, supplyChainRisk: null };
    } catch {
      return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl, vulnerabilities: null, supplyChainRisk: null };
    }
  }

  private async buildReport(
    repoFullName: string,
    manifestFound: "package.json" | "requirements.txt",
    manifestUrl: string,
    dependencies: DependencyAuditEntry[]
  ): Promise<DependencyAuditReport> {
    // Real known-vulnerability scan against OSV.dev (osv.dev) — the same open
    // vulnerability database GitHub Dependabot alerts are built on. Only packages
    // with a resolvable exact currentVersion can be matched; everything else stays
    // `vulnerabilities: null` (not scanned), never a fabricated "clean" result.
    const osvEcosystem: Record<DependencyAuditEntry["ecosystem"], "npm" | "PyPI"> = { npm: "npm", pypi: "PyPI" };
    const scannable = dependencies.filter((d) => d.currentVersion);
    const vulnMap = await scanForVulnerabilities(
      scannable.map((d) => ({
        key: `${d.ecosystem}:${d.name}:${d.currentVersion}`,
        name: d.name,
        ecosystem: osvEcosystem[d.ecosystem],
        version: d.currentVersion as string
      }))
    );
    for (const d of dependencies) {
      if (!d.currentVersion) continue;
      const key = `${d.ecosystem}:${d.name}:${d.currentVersion}`;
      if (vulnMap.has(key)) d.vulnerabilities = vulnMap.get(key)!;
    }

    // Real supply-chain risk scan (install scripts + confirmed typosquat) against the
    // live npm registry. npm-only — see supply_chain_scanner.ts for why PyPI isn't covered.
    const npmScannable = dependencies.filter((d) => d.ecosystem === "npm");
    const supplyChainMap = await scanSupplyChainRisk(
      npmScannable.map((d) => ({
        key: `${d.ecosystem}:${d.name}:${d.currentVersion}`,
        name: d.name,
        ecosystem: d.ecosystem,
        currentVersion: d.currentVersion
      }))
    );
    for (const d of dependencies) {
      if (d.ecosystem !== "npm") continue;
      const key = `${d.ecosystem}:${d.name}:${d.currentVersion}`;
      if (supplyChainMap.has(key)) d.supplyChainRisk = supplyChainMap.get(key)!;
    }

    const severityRank: Record<DependencyAuditEntry["status"], number> = {
      "major-behind": 0,
      "minor-behind": 1,
      "patch-behind": 2,
      unknown: 3,
      "up-to-date": 4,
      "ahead-of-latest-tag": 5
    };
    const riskRank = (d: DependencyAuditEntry): number => {
      if ((d.vulnerabilities?.length || 0) > 0) return 0;
      if (d.supplyChainRisk?.typosquatSuspect) return 0;
      if (d.supplyChainRisk?.hasInstallScripts) return 1;
      return 2;
    };
    const sorted = [...dependencies].sort((a, b) => {
      const aRisk = riskRank(a);
      const bRisk = riskRank(b);
      if (aRisk !== bRisk) return aRisk - bRisk;
      return severityRank[a.status] - severityRank[b.status];
    });
    const vulnerableEntries = sorted.filter((d) => (d.vulnerabilities?.length || 0) > 0);
    return {
      repoFullName,
      manifestFound,
      manifestUrl,
      totalDependencies: sorted.length,
      outdatedCount: sorted.filter((d) => d.status === "major-behind" || d.status === "minor-behind" || d.status === "patch-behind").length,
      majorBehindCount: sorted.filter((d) => d.status === "major-behind").length,
      vulnerableCount: vulnerableEntries.length,
      totalVulnerabilities: vulnerableEntries.reduce((sum, d) => sum + (d.vulnerabilities?.length || 0), 0),
      installScriptCount: sorted.filter((d) => d.supplyChainRisk?.hasInstallScripts).length,
      typosquatSuspectCount: sorted.filter((d) => d.supplyChainRisk?.typosquatSuspect).length,
      dependencies: sorted,
      checkedAt: new Date().toISOString()
    };
  }
}
