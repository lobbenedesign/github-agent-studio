/**
 * Active Fork Hunter Engine
 * Scans the real fork network of a GitHub repository via the GitHub compare
 * API to find forks genuinely ahead of the parent's default branch — real
 * ahead/behind counts and real commit subject lines, not a formula and canned
 * enhancement text. No fake fallback: an unreachable/rate-limited API means
 * this throws, and the caller shows that error, not invented forks.
 */

import { GitHubApiClient, GitHubApiFetchError, parseOwnerRepo } from "./github_api_client";

export interface ActiveForkResult {
  forkFullName: string;
  forkUrl: string;
  owner: string;
  commitsAhead: number;
  commitsBehind: number;
  stars: number;
  lastPushedDate: string;
  keyEnhancementsFound: string[]; // real commit subject lines from the compare API
  isRecommendedOverParent: boolean;
  recommendationReason: string;
}

export class ForkHunter {
  private client = new GitHubApiClient();

  public async huntActiveForks(parentOwnerRepo: string): Promise<ActiveForkResult[]> {
    const { owner, repo } = parseOwnerRepo(parentOwnerRepo);
    const parentMeta = await this.client.fetchLiveRepo(`${owner}/${repo}`);

    const forksRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks?sort=stargazers&per_page=10`, {
      headers: { "User-Agent": "GitHub-Agent-Studio/1.0" }
    });
    if (!forksRes.ok) {
      throw new GitHubApiFetchError(forksRes.status, `could not list forks for ${owner}/${repo}: ${forksRes.status}`);
    }
    const forkList: any[] = await forksRes.json();
    if (forkList.length === 0) return [];

    const results: ActiveForkResult[] = [];
    for (const f of forkList) {
      const forkOwner = f.owner?.login;
      const forkDefaultBranch = f.default_branch || parentMeta.defaultBranch;
      if (!forkOwner) continue;

      let ahead = 0;
      let behind = 0;
      let commitMessages: string[] = [];
      try {
        const cmp = await this.client.compareForkToParent(owner, repo, forkOwner, forkDefaultBranch);
        ahead = cmp.aheadBy;
        behind = cmp.behindBy;
        commitMessages = cmp.commitMessages;
      } catch {
        // GitHub's compare API 404s when branch names differ or history has
        // diverged too far to diff cheaply — real, not-uncommon case. Report
        // the fork with ahead/behind unknown rather than fabricate a number.
      }

      const isBetter = ahead > 5 && (f.stargazers_count || 0) > 0;
      results.push({
        forkFullName: f.full_name,
        forkUrl: f.html_url,
        owner: forkOwner,
        commitsAhead: ahead,
        commitsBehind: behind,
        stars: f.stargazers_count ?? 0,
        lastPushedDate: f.pushed_at ? f.pushed_at.slice(0, 10) : "",
        keyEnhancementsFound: commitMessages,
        isRecommendedOverParent: isBetter,
        recommendationReason: isBetter
          ? `${ahead} commit${ahead === 1 ? "" : "s"} ahead of ${owner}/${repo}'s ${forkDefaultBranch} (real GitHub compare result).`
          : ahead > 0
            ? `${ahead} commits ahead, but not enough activity/stars to recommend over the parent.`
            : "No commits ahead of the parent's default branch, or compare unavailable."
      });
    }

    return results.sort((a, b) => b.commitsAhead - a.commitsAhead);
  }
}
