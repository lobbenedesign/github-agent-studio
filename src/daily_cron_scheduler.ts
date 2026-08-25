/**
 * Daily Automated GitHub Crawler & Scheduler Daemon
 * Periodically queries the real GitHub API:
 * 1. Re-polls existing catalog repos for real star/version deltas.
 * 2. Searches for repos genuinely pushed since the last sync (real Search API),
 *    not a counter incremented by a fixed amount regardless of reality.
 * An unauthenticated run is limited to 60 GitHub API requests/hour — set
 * GITHUB_TOKEN in the environment for the real 5000/hour authenticated limit.
 */

import { RepoIndexer } from "./repo_indexer";
import { GitHubApiClient } from "./github_api_client";

export interface SyncTelemetry {
  lastSyncTimestamp: string;
  nextSyncTimestamp: string;
  cronIntervalHours: number;
  totalReposScanned: number;
  newReposDiscovered: number;
  versionUpdatesFound: number;
  syncInProgress: boolean;
  recentLogs: string[];
}

export class DailyCronScheduler {
  private indexer: RepoIndexer;
  private apiClient = new GitHubApiClient();
  private intervalHours = 24;
  private timer: any = null;
  private isRunning = false;
  private lastSync: string = new Date().toISOString();
  private nextSync: string = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  private newDiscoveredCount = 0;
  private versionUpdatesCount = 0;
  private logs: string[] = [];
  /** real, commonly-used GitHub topic tags for the discovery search */
  private discoveryTopics = ["llm", "ai-agents"];

  constructor(indexer: RepoIndexer) {
    this.indexer = indexer;
    this.startCron();
  }

  private startCron() {
    this.addLog("⏰ Daily Automated Crawler Daemon initialized (24h interval).");
    // Recurring interval
    this.timer = setInterval(() => {
      this.runDailySync();
    }, this.intervalHours * 3600 * 1000);
  }

  public async runDailySync(): Promise<SyncTelemetry> {
    if (this.isRunning) return this.getTelemetry();

    this.isRunning = true;
    this.addLog(`🚀 Starting Daily GitHub Intelligence Scan at ${new Date().toLocaleTimeString()}...`);

    try {
      const catalog = this.indexer.getCatalog();
      let updatedCount = 0;
      let failedCount = 0;

      // 1. Re-poll existing repositories against the real GitHub API for
      // genuine star/version deltas. Capped at 10/run to stay well inside
      // the unauthenticated 60-req/hour rate limit alongside the search below.
      for (const repo of catalog.slice(0, 10)) {
        this.addLog(`checking ${repo.fullName} against the live GitHub API...`);
        const updated = await this.indexer.refreshRepo(repo.fullName);
        if (updated) {
          updatedCount++;
          if (updated.starDelta24h > 0) {
            this.addLog(`  ${repo.fullName}: +${updated.starDelta24h} stars since last poll`);
          }
        } else {
          failedCount++;
          this.addLog(`  ${repo.fullName}: refresh failed (rate limit or repo unavailable)`);
        }
        await new Promise((r) => setTimeout(r, 150)); // stay under GitHub's rate limit
      }
      this.versionUpdatesCount += updatedCount;

      // 2. Real discovery: search GitHub for repos actually pushed since the
      // last sync, matching this suite's topics, not already in the catalog.
      try {
        const known = this.indexer.getKnownFullNames();
        const sinceDate = this.lastSync.slice(0, 10);
        const found = await this.apiClient.searchReposPushedAfter(this.discoveryTopics, sinceDate, 10);
        const genuinelyNew = found.filter((f) => !known.has(f.fullName.toLowerCase()));
        this.newDiscoveredCount += genuinelyNew.length;
        for (const repo of genuinelyNew.slice(0, 5)) {
          this.addLog(`discovered: ${repo.fullName} (${repo.stars} stars, pushed since ${sinceDate})`);
        }
        if (genuinelyNew.length === 0) {
          this.addLog(`search found no new repos pushed since ${sinceDate} matching [${this.discoveryTopics.join(", ")}]`);
        }
      } catch (e: any) {
        this.addLog(`discovery search failed: ${e.message}`);
      }

      this.lastSync = new Date().toISOString();
      this.nextSync = new Date(Date.now() + this.intervalHours * 3600 * 1000).toISOString();
      this.addLog(
        `sync finished: ${updatedCount} refreshed, ${failedCount} failed, ${catalog.length} total tracked.`
      );
    } catch (e: any) {
      this.addLog(`⚠️ Scan error: ${e.message}`);
    } finally {
      this.isRunning = false;
    }

    return this.getTelemetry();
  }

  public getTelemetry(): SyncTelemetry {
    return {
      lastSyncTimestamp: this.lastSync,
      nextSyncTimestamp: this.nextSync,
      cronIntervalHours: this.intervalHours,
      totalReposScanned: this.indexer.getCatalog().length,
      newReposDiscovered: this.newDiscoveredCount,
      versionUpdatesFound: this.versionUpdatesCount,
      syncInProgress: this.isRunning,
      recentLogs: this.logs.slice(-15)
    };
  }

  private addLog(msg: string) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logs.push(entry);
    if (this.logs.length > 50) this.logs.shift();
  }
}
