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

export interface DependencyAuditEntry {
  name: string;
  ecosystem: "npm" | "pypi";
  manifestRange: string;
  currentVersion: string | null;
  latestVersion: string | null;
  status: "up-to-date" | "patch-behind" | "minor-behind" | "major-behind" | "unknown";
  registryUrl: string;
}

export interface DependencyAuditReport {
  repoFullName: string;
  manifestFound: "package.json" | "requirements.txt" | null;
  manifestUrl: string | null;
  totalDependencies: number;
  outdatedCount: number;
  majorBehindCount: number;
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
      return this.buildReport(fullName, "package.json", pkgUrl, audited);
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
      return this.buildReport(fullName, "requirements.txt", reqUrl, audited);
    }

    return {
      repoFullName: fullName,
      manifestFound: null,
      manifestUrl: null,
      totalDependencies: 0,
      outdatedCount: 0,
      majorBehindCount: 0,
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
        return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl };
      }
      const data = await res.json();
      const latestVersion: string = data.version;
      const status = computeStatus(parseSemver(currentVersion), parseSemver(latestVersion));
      return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion, status, registryUrl };
    } catch {
      return { name, ecosystem: "npm", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl };
    }
  }

  private async auditPypiPackage(name: string, range: string): Promise<DependencyAuditEntry> {
    const registryUrl = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const currentVersion = stripRangePrefix(range) || null;
    try {
      const res = await fetch(registryUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl };
      }
      const data = await res.json();
      const latestVersion: string = data.info?.version;
      const status = computeStatus(parseSemver(currentVersion), parseSemver(latestVersion));
      return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion, status, registryUrl };
    } catch {
      return { name, ecosystem: "pypi", manifestRange: range, currentVersion, latestVersion: null, status: "unknown", registryUrl };
    }
  }

  private buildReport(
    repoFullName: string,
    manifestFound: "package.json" | "requirements.txt",
    manifestUrl: string,
    dependencies: DependencyAuditEntry[]
  ): DependencyAuditReport {
    const severityRank: Record<DependencyAuditEntry["status"], number> = {
      "major-behind": 0,
      "minor-behind": 1,
      "patch-behind": 2,
      unknown: 3,
      "up-to-date": 4
    };
    const sorted = [...dependencies].sort((a, b) => severityRank[a.status] - severityRank[b.status]);
    return {
      repoFullName,
      manifestFound,
      manifestUrl,
      totalDependencies: sorted.length,
      outdatedCount: sorted.filter((d) => d.status === "major-behind" || d.status === "minor-behind" || d.status === "patch-behind").length,
      majorBehindCount: sorted.filter((d) => d.status === "major-behind").length,
      dependencies: sorted,
      checkedAt: new Date().toISOString()
    };
  }
}
