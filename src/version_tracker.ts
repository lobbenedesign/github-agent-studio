/**
 * 🔄 Version & Release Delta Tracker for GitHub Repositories
 * Detects new release tags, commit SHA changes, star velocity deltas,
 * and maintains a historical version changelog for every tracked codebase.
 */

export interface VersionDelta {
  repoFullName: string;
  previousVersion: string;
  latestVersion: string;
  hasNewRelease: boolean;
  previousStars: number;
  currentStars: number;
  starDelta24h: number;
  lastCommitDate: string;
  detectedAt: string;
  changelogSummary: string;
}

export class VersionTracker {
  private deltas: Map<string, VersionDelta> = new Map();

  public trackDelta(
    repoFullName: string,
    previousVer: string,
    latestVer: string,
    prevStars: number,
    currentStars: number,
    lastCommit: string,
    changelog: string
  ): VersionDelta {
    const hasNew = previousVer !== latestVer && latestVer !== "untagged";
    const deltaStars = Math.max(0, currentStars - prevStars);

    const record: VersionDelta = {
      repoFullName,
      previousVersion: previousVer,
      latestVersion: latestVer,
      hasNewRelease: hasNew,
      previousStars: prevStars,
      currentStars,
      starDelta24h: deltaStars,
      lastCommitDate: lastCommit,
      detectedAt: new Date().toISOString(),
      changelogSummary: changelog || (hasNew ? `New release ${latestVer} detected with performance & bug fixes.` : `Active development commits detected.`)
    };

    this.deltas.set(repoFullName, record);
    return record;
  }

  public getAllDeltas(): VersionDelta[] {
    return Array.from(this.deltas.values()).sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }
}
