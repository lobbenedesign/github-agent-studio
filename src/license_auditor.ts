/**
 * ⚖️ Real License Detection & Compliance Auditor (FOSSA/Libraries.io-style)
 *
 * Per COMPETITOR_RESEARCH.md priority 2: github-agent-studio never reported a
 * repo's own license or its dependencies' licenses at all. This module closes
 * that gap using data the project already fetches for real elsewhere — no new
 * fabricated fields:
 *
 *  - The TARGET repo's own declared license comes from GitHub's real
 *    `GET /repos/{owner}/{repo}` response (`license.spdx_id`), the same field
 *    `GitHubApiClient.fetchLiveRepo` already parses — plus a real fetch of the
 *    root LICENSE/LICENSE.md file for a short excerpt, and a real read of the
 *    target repo's own package.json `license` field when present (Node repos
 *    sometimes declare it there even without a LICENSE file, or declare a
 *    different value than GitHub's own detector guessed).
 *  - Each DEPENDENCY's license comes from `DependencyAuditor.auditDependencies`,
 *    which already fetches the real npm packument / PyPI JSON for freshness —
 *    this module now also reads the real `license` field off that same
 *    response (see the `license` addition in dependency_auditor.ts) instead of
 *    making a second redundant network call per package.
 *
 * Compliance flags use a small, well-known license-family classification
 * (permissive vs weak-copyleft vs copyleft) to flag the real, well-documented
 * concern class FOSSA/Libraries.io both surface: a copyleft dependency (e.g.
 * GPL/AGPL) pulled into a project that declares a permissive license (MIT/BSD/
 * Apache) can create real license-compatibility obligations for anyone who
 * redistributes the combined work. This module flags the SHAPE of that
 * concern from real declared licenses — it is not a substitute for legal
 * review, and it never treats "unknown license" as "safe": unresolved
 * licenses are reported as their own category, not silently dropped.
 */

import { GitHubApiClient, parseOwnerRepo, GitHubApiFetchError } from "./github_api_client";
import { DependencyAuditor, DependencyAuditEntry } from "./dependency_auditor";

export type LicenseFamily = "permissive" | "weak-copyleft" | "copyleft" | "proprietary-or-none" | "unknown";

// Small, well-known SPDX-family classification. Not exhaustive — anything not
// listed here is reported as "unknown", never guessed into a family.
const PERMISSIVE = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "BSD-3-Clause-Clear", "Apache-2.0", "0BSD", "Unlicense", "CC0-1.0", "Python-2.0", "Zlib", "BlueOak-1.0.0"]);
const WEAK_COPYLEFT = new Set(["LGPL-2.1", "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0", "LGPL-3.0-only", "LGPL-3.0-or-later", "MPL-2.0", "EPL-1.0", "EPL-2.0", "CDDL-1.0", "CDDL-1.1"]);
const COPYLEFT = new Set(["GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later", "AGPL-1.0", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later"]);

function classify(spdxOrFreeText: string | null): LicenseFamily {
  if (!spdxOrFreeText) return "unknown";
  const norm = spdxOrFreeText.trim();
  if (norm.toLowerCase() === "none" || norm.toLowerCase() === "unlicensed" || norm.toLowerCase() === "proprietary") return "proprietary-or-none";
  // Try exact SPDX id first, then a loose contains-match for free-text values
  // like PyPI classifiers ("GNU General Public License v3 (GPLv3)").
  if (PERMISSIVE.has(norm)) return "permissive";
  if (WEAK_COPYLEFT.has(norm)) return "weak-copyleft";
  if (COPYLEFT.has(norm)) return "copyleft";
  const low = norm.toLowerCase();
  if (/\bagpl\b/.test(low)) return "copyleft";
  if (/\bgpl\b/.test(low) && !/lgpl/.test(low)) return "copyleft";
  if (/\blgpl\b/.test(low) || low.includes("mozilla public license")) return "weak-copyleft";
  if (/\bmit\b/.test(low) || low.includes("bsd") || low.includes("apache") || low.includes("isc")) return "permissive";
  return "unknown";
}

export interface DependencyLicenseEntry {
  name: string;
  ecosystem: DependencyAuditEntry["ecosystem"];
  currentVersion: string | null;
  license: string | null;
  family: LicenseFamily;
}

export interface LicenseComplianceFlag {
  dependency: string;
  dependencyLicense: string;
  dependencyFamily: LicenseFamily;
  repoLicense: string;
  repoFamily: LicenseFamily;
  concern: string;
}

export interface LicenseAuditReport {
  repoFullName: string;
  repoDeclaredLicenseSpdx: string | null; // from GitHub API license detector
  repoLicenseFamily: LicenseFamily;
  repoLicenseFileExcerpt: string | null; // real first ~500 chars of LICENSE/LICENSE.md if found
  repoLicenseFileUrl: string | null;
  repoPackageJsonLicense: string | null; // real package.json `license` field, if repo has one and it's present
  manifestFound: "package.json" | "requirements.txt" | null;
  totalDependenciesWithKnownLicense: number;
  totalDependenciesUnknownLicense: number;
  dependencyLicenses: DependencyLicenseEntry[];
  licenseFamilyBreakdown: Record<LicenseFamily, number>;
  complianceFlags: LicenseComplianceFlag[];
  checkedAt: string;
  methodologyNote: string;
}

export class LicenseAuditor {
  private client = new GitHubApiClient();
  private depAuditor = new DependencyAuditor();

  public async auditLicenses(ownerRepoOrUrl: string): Promise<LicenseAuditReport> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const fullName = `${owner}/${repo}`;

    const meta = await this.client.fetchLiveRepo(fullName); // real GitHub license.spdx_id
    const repoDeclaredLicenseSpdx = meta.license && meta.license !== "none" ? meta.license : null;
    const branch = meta.defaultBranch || "main";

    // Real LICENSE/LICENSE.md fetch for a human-readable excerpt — GitHub's
    // license API is a detector's best guess; the actual file is the ground truth.
    let repoLicenseFileExcerpt: string | null = null;
    let repoLicenseFileUrl: string | null = null;
    for (const candidate of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${candidate}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const text = await res.text();
          repoLicenseFileExcerpt = text.slice(0, 500);
          repoLicenseFileUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${candidate}`;
          break;
        }
      } catch {
        // best-effort; GitHub's own license.spdx_id (already fetched) stands on its own
      }
    }

    // Real package.json `license` field of the TARGET repo itself, when present.
    let repoPackageJsonLicense: string | null = null;
    try {
      const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`, { signal: AbortSignal.timeout(4000) });
      if (pkgRes.ok) {
        const pkgJson = await pkgRes.json().catch(() => null);
        if (pkgJson && typeof pkgJson.license === "string") repoPackageJsonLicense = pkgJson.license;
        else if (pkgJson && pkgJson.license && typeof pkgJson.license.type === "string") repoPackageJsonLicense = pkgJson.license.type;
      }
    } catch {}

    const effectiveRepoLicense = repoDeclaredLicenseSpdx || repoPackageJsonLicense;
    const repoLicenseFamily = classify(effectiveRepoLicense);

    // Real dependency list + real per-dependency license, reusing the existing
    // Dependency Auditor (same npm/PyPI registry calls it already makes for
    // freshness — no duplicate network traffic).
    const depReport = await this.depAuditor.auditDependencies(fullName);
    const dependencyLicenses: DependencyLicenseEntry[] = depReport.dependencies.map((d) => ({
      name: d.name,
      ecosystem: d.ecosystem,
      currentVersion: d.currentVersion,
      license: d.license,
      family: classify(d.license)
    }));

    const licenseFamilyBreakdown: Record<LicenseFamily, number> = {
      permissive: 0,
      "weak-copyleft": 0,
      copyleft: 0,
      "proprietary-or-none": 0,
      unknown: 0
    };
    for (const d of dependencyLicenses) licenseFamilyBreakdown[d.family]++;

    // Real, well-known compliance concern class: a copyleft/weak-copyleft
    // dependency inside a project that declares a permissive license. Only
    // raised when BOTH sides are actually known (never guessed).
    const complianceFlags: LicenseComplianceFlag[] = [];
    if (repoLicenseFamily === "permissive") {
      for (const d of dependencyLicenses) {
        if (d.family === "copyleft") {
          complianceFlags.push({
            dependency: d.name,
            dependencyLicense: d.license || "unknown",
            dependencyFamily: d.family,
            repoLicense: effectiveRepoLicense || "unknown",
            repoFamily: repoLicenseFamily,
            concern: `${d.name} is ${d.license} (strong copyleft). Combining/redistributing it inside a project declared as ${effectiveRepoLicense} (permissive) is a well-known license-compatibility concern class (GPL/AGPL obligations can extend to the combined work) — needs legal review before commercial redistribution.`
          });
        } else if (d.family === "weak-copyleft") {
          complianceFlags.push({
            dependency: d.name,
            dependencyLicense: d.license || "unknown",
            dependencyFamily: d.family,
            repoLicense: effectiveRepoLicense || "unknown",
            repoFamily: repoLicenseFamily,
            concern: `${d.name} is ${d.license} (weak copyleft, e.g. LGPL/MPL). Usually fine when used as an unmodified dynamically-linked dependency, but modifying it or statically linking/bundling it into a ${effectiveRepoLicense}-licensed distribution can trigger source-disclosure obligations — worth a specific check.`
          });
        }
      }
    }

    return {
      repoFullName: fullName,
      repoDeclaredLicenseSpdx,
      repoLicenseFamily,
      repoLicenseFileExcerpt,
      repoLicenseFileUrl,
      repoPackageJsonLicense,
      manifestFound: depReport.manifestFound,
      totalDependenciesWithKnownLicense: dependencyLicenses.filter((d) => d.license).length,
      totalDependenciesUnknownLicense: dependencyLicenses.filter((d) => !d.license).length,
      dependencyLicenses,
      licenseFamilyBreakdown,
      complianceFlags,
      checkedAt: new Date().toISOString(),
      methodologyNote:
        "Repo license: GitHub's own license detector (license.spdx_id) plus a real fetch of the root LICENSE file and, when present, the repo's own package.json `license` field. Dependency licenses: the real `license` field from the same npm packument / PyPI JSON response the Dependency Auditor already fetches for freshness — no invented data. License family classification (permissive/weak-copyleft/copyleft) is a small well-known SPDX grouping, not a substitute for legal advice; 'unknown' means the registry did not declare a license, which is reported honestly rather than assumed safe."
    };
  }
}
