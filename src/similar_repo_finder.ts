/**
 * 🧭 Similar Repository Finder (OSS Insight / GitHub Explore-style discovery)
 *
 * Given a repo, reads its REAL topics and primary language from the GitHub
 * REST API, builds a real GitHub Search API query from them, and returns
 * genuine search results ranked by topic overlap and star count. This is
 * not a curated/static "competitors" list — every result is a live query
 * against api.github.com/search/repositories, so it reflects whatever is
 * actually on GitHub right now for that repo's topics/language.
 */

import { GitHubApiClient, parseOwnerRepo } from "./github_api_client";

export interface SimilarRepoResult {
  fullName: string;
  url: string;
  description: string;
  stars: number;
  language: string;
  topics: string[];
  matchedOnTopics: string[];
  matchScore: number;
}

export interface SimilarRepoReport {
  sourceRepo: string;
  sourceLanguage: string;
  sourceTopics: string[];
  queryUsed: string;
  results: SimilarRepoResult[];
  checkedAt: string;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": "GitHub-Agent-Studio/1.0" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export class SimilarRepoFinder {
  private client = new GitHubApiClient();

  public async findSimilar(ownerRepoOrUrl: string): Promise<SimilarRepoReport> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const meta = await this.client.fetchLiveRepo(`${owner}/${repo}`);
    const fullName = `${owner}/${repo}`;

    const topics = (meta.topics || []).slice(0, 5);

    // GitHub's search ANDs every `topic:`/`language:` qualifier together, so
    // stacking 3 topics + language (as an earlier version of this did) is
    // almost always over-constrained — real-world test against fastify/fastify
    // returned 0 results with 3 topics ANDed. Run one query per topic (each
    // broad enough to have real matches) plus a language-only query, then
    // merge and rank by how many of those independent queries a repo matched.
    const queries: string[] = [];
    for (const t of topics.slice(0, 3)) queries.push(`topic:${t} -repo:${fullName}`);
    if (meta.language && meta.language !== "unknown") {
      queries.push(`language:${meta.language} stars:>500 -repo:${fullName}`);
    }
    if (queries.length === 0) queries.push(`stars:>5000 -repo:${fullName}`);

    const byRepo = new Map<string, { item: any; hitCount: number }>();
    for (const q of queries) {
      try {
        const res = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`,
          { headers: authHeaders() }
        );
        if (!res.ok) continue; // one failed sub-query shouldn't sink the whole result
        const data = await res.json();
        for (const it of data.items || []) {
          if (it.full_name.toLowerCase() === fullName.toLowerCase()) continue;
          const existing = byRepo.get(it.full_name);
          if (existing) existing.hitCount++;
          else byRepo.set(it.full_name, { item: it, hitCount: 1 });
        }
      } catch {
        // network error on one sub-query — continue with the others
      }
    }

    const results: SimilarRepoResult[] = Array.from(byRepo.values())
      .map(({ item: it, hitCount }) => {
        const itTopics: string[] = it.topics || [];
        const matched = itTopics.filter((t) => topics.includes(t));
        const langMatch = it.language && meta.language && it.language.toLowerCase() === meta.language.toLowerCase() ? 1 : 0;
        return {
          fullName: it.full_name,
          url: it.html_url,
          description: it.description || "",
          stars: it.stargazers_count ?? 0,
          language: it.language || "unknown",
          topics: itTopics,
          matchedOnTopics: matched,
          matchScore: hitCount * 3 + matched.length * 2 + langMatch
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.stars - a.stars)
      .slice(0, 12);

    return {
      sourceRepo: fullName,
      sourceLanguage: meta.language,
      sourceTopics: topics,
      queryUsed: queries.join(" | "),
      results,
      checkedAt: new Date().toISOString()
    };
  }
}
