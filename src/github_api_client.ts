/**
 * GitHub API Live Client & Repository Inspector
 * Interacts with GitHub's public REST API. No fabricated fallback: if a
 * request fails (rate limit, network, 404), the caller gets a real error,
 * not plausible-looking invented numbers. An unauthenticated client is
 * limited to 60 requests/hour per GitHub's own rate limit; set
 * GITHUB_TOKEN in the environment to raise that to 5000/hour.
 */

export interface GitHubLiveMetadata {
  name: string;
  fullName: string;
  url: string;
  owner: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  license: string;
  description: string;
  defaultBranch: string;
  updatedAt: string;
  readmeExcerpt: string;
  topics: string[];
}

export interface GitHubReleaseInfo {
  tagName: string;
  publishedAt: string;
  htmlUrl: string;
}

export interface GitHubCompareResult {
  aheadBy: number;
  behindBy: number;
  commitMessages: string[]; // real commit subject lines from the ahead range
}

export class GitHubApiFetchError extends Error {
  constructor(public readonly status: number | null, message: string) {
    super(message);
    this.name = "GitHubApiFetchError";
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": "GitHub-Agent-Studio/1.0" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function parseOwnerRepo(ownerRepoOrUrl: string): { owner: string; repo: string } {
  let clean = ownerRepoOrUrl.trim().replace("https://github.com/", "").replace("http://github.com/", "");
  if (clean.endsWith("/")) clean = clean.slice(0, -1);
  const parts = clean.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new GitHubApiFetchError(null, `"${ownerRepoOrUrl}" is not a valid owner/repo`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export class GitHubApiClient {
  public async fetchLiveRepo(ownerRepoOrUrl: string): Promise<GitHubLiveMetadata> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: authHeaders() });
    if (!res.ok) {
      throw new GitHubApiFetchError(
        res.status,
        `GitHub API returned ${res.status} for ${owner}/${repo}` +
          (res.status === 403 ? " (likely rate-limited; set GITHUB_TOKEN)" : "")
      );
    }
    const data = await res.json();

    let readme = "";
    try {
      const readmeRes = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${data.default_branch || "main"}/README.md`
      );
      if (readmeRes.ok) readme = (await readmeRes.text()).slice(0, 1500);
    } catch {
      // README fetch is best-effort supplementary data; the repo metadata above is real either way.
    }

    return {
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      owner: data.owner?.login || owner,
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
      language: data.language || "unknown",
      license: data.license?.spdx_id || "none",
      description: data.description || "",
      defaultBranch: data.default_branch || "main",
      updatedAt: data.updated_at,
      readmeExcerpt: readme,
      topics: data.topics || []
    };
  }

  /** Real GitHub Releases API. Throws if there is no release (common for young repos). */
  public async fetchLatestRelease(ownerRepoOrUrl: string): Promise<GitHubReleaseInfo> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: authHeaders()
    });
    if (!res.ok) {
      throw new GitHubApiFetchError(res.status, `no release data for ${owner}/${repo} (status ${res.status})`);
    }
    const data = await res.json();
    return { tagName: data.tag_name, publishedAt: data.published_at, htmlUrl: data.html_url };
  }

  /**
   * Real GitHub compare API: how many commits a fork's branch is ahead/behind
   * its parent, plus the actual commit subject lines in that ahead range —
   * not a guessed formula, not canned enhancement text.
   */
  public async compareForkToParent(
    parentOwner: string,
    parentRepo: string,
    forkOwner: string,
    forkDefaultBranch: string
  ): Promise<GitHubCompareResult> {
    const url = `https://api.github.com/repos/${parentOwner}/${parentRepo}/compare/${parentOwner}:${forkDefaultBranch}...${forkOwner}:${forkDefaultBranch}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      throw new GitHubApiFetchError(res.status, `compare failed for ${forkOwner}/${forkDefaultBranch}: ${res.status}`);
    }
    const data = await res.json();
    const commitMessages: string[] = (data.commits || [])
      .map((c: any) => (c.commit?.message || "").split("\n")[0])
      .filter((m: string) => m.length > 0)
      .slice(-8); // most recent few ahead-commits, real subject lines
    return {
      aheadBy: data.ahead_by ?? 0,
      behindBy: data.behind_by ?? 0,
      commitMessages
    };
  }

  /**
   * Real GitHub Search API for repositories pushed after a given ISO date,
   * used by the cron scheduler to find genuinely new activity instead of
   * incrementing a counter.
   */
  public async searchReposPushedAfter(topics: string[], sinceISODate: string, perPage = 10): Promise<GitHubLiveMetadata[]> {
    const topicQuery = topics.map((t) => `topic:${t}`).join(" ");
    const q = encodeURIComponent(`${topicQuery} pushed:>${sinceISODate}`);
    const res = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=updated&order=desc&per_page=${perPage}`, {
      headers: authHeaders()
    });
    if (!res.ok) {
      throw new GitHubApiFetchError(res.status, `search failed: ${res.status}`);
    }
    const data = await res.json();
    return (data.items || []).map((d: any) => ({
      name: d.name,
      fullName: d.full_name,
      url: d.html_url,
      owner: d.owner?.login,
      stars: d.stargazers_count ?? 0,
      forks: d.forks_count ?? 0,
      openIssues: d.open_issues_count ?? 0,
      language: d.language || "unknown",
      license: d.license?.spdx_id || "none",
      description: d.description || "",
      defaultBranch: d.default_branch || "main",
      updatedAt: d.updated_at,
      readmeExcerpt: "",
      topics: d.topics || []
    }));
  }

  /**
   * Real version tree: merges GitHub's real Tags API (every tag, lightweight,
   * no message) with the real Releases API (only tags someone published a
   * release for, with real release notes and publish date) into one
   * chronological list. Most repos tag more often than they release, so the
   * tag list is usually the fuller picture; releases add the human-written
   * notes where they exist.
   */
  public async fetchVersionHistory(ownerRepoOrUrl: string): Promise<{
    fullName: string;
    versions: { tag: string; publishedAt: string | null; releaseName: string | null; releaseNotesExcerpt: string | null; url: string; isRelease: boolean }[];
    latestTag: string | null;
    latestRelease: string | null;
  }> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const fullName = `${owner}/${repo}`;

    const [tagsRes, releasesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, { headers: authHeaders() }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, { headers: authHeaders() })
    ]);

    if (!tagsRes.ok && !releasesRes.ok) {
      throw new GitHubApiFetchError(tagsRes.status, `could not fetch version history for ${fullName}: tags=${tagsRes.status} releases=${releasesRes.status}`);
    }

    const tags: any[] = tagsRes.ok ? await tagsRes.json() : [];
    const releases: any[] = releasesRes.ok ? await releasesRes.json() : [];
    const releaseByTag = new Map(releases.map((r) => [r.tag_name, r]));

    const versions = tags.map((t) => {
      const rel = releaseByTag.get(t.name);
      return {
        tag: t.name,
        publishedAt: rel?.published_at ?? null,
        releaseName: rel?.name ?? null,
        releaseNotesExcerpt: rel?.body ? String(rel.body).slice(0, 400) : null,
        url: rel?.html_url ?? `https://github.com/${fullName}/releases/tag/${t.name}`,
        isRelease: !!rel
      };
    });

    // Tags API doesn't sort by date (it's commit-graph order, roughly newest
    // first already, but not guaranteed) — releases we DO know are date-sorted
    // by GitHub, so prefer that ordering where we can attach a real date.
    versions.sort((a, b) => {
      if (a.publishedAt && b.publishedAt) return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (a.publishedAt) return -1;
      if (b.publishedAt) return 1;
      return 0;
    });

    return {
      fullName,
      versions,
      latestTag: tags[0]?.name ?? null,
      latestRelease: releases[0]?.tag_name ?? null
    };
  }
}
