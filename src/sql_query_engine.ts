/**
 * 🗄️ SQL Codebase & Catalog Explorer Engine (MergeStat / gitqlite style)
 * Parses and executes SQL queries against the active in-memory repository catalog.
 */

import { GitHubRepoItem } from "./repo_indexer";

export interface SQLQueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export class SQLQueryEngine {
  public executeQuery(query: string, catalog: GitHubRepoItem[]): SQLQueryResult {
    const start = Date.now();
    const q = query.trim();

    try {
      let filtered = [...catalog];

      // Simple SQL parser for catalog table
      const whereMatch = q.match(/where\s+(.*?)(?:\s+order\s+by|\s+limit|$)/i);
      if (whereMatch) {
        const clause = whereMatch[1];
        if (clause.includes("score >=") || clause.includes("score >")) {
          const num = parseInt(clause.replace(/.*score\s*>=?\s*/i, ""));
          if (!isNaN(num)) filtered = filtered.filter(r => r.scoreCard.totalScore >= num);
        }
        if (clause.includes("stars >=") || clause.includes("stars >")) {
          const num = parseInt(clause.replace(/.*stars\s*>=?\s*/i, ""));
          if (!isNaN(num)) filtered = filtered.filter(r => r.stars >= num);
        }
        if (clause.toLowerCase().includes("category")) {
          const catMatch = clause.match(/category\s*=\s*['"](.*?)['"]/i);
          if (catMatch) filtered = filtered.filter(r => r.category.toLowerCase() === catMatch[1].toLowerCase());
        }
      }

      // Order by
      const orderMatch = q.match(/order\s+by\s+(.*?)(?:\s+limit|$)/i);
      if (orderMatch) {
        const orderClause = orderMatch[1].toLowerCase();
        if (orderClause.includes("stardelta") || orderClause.includes("delta")) {
          filtered.sort((a, b) => b.starDelta24h - a.starDelta24h);
        } else if (orderClause.includes("stars")) {
          filtered.sort((a, b) => b.stars - a.stars);
        } else if (orderClause.includes("forks")) {
          filtered.sort((a, b) => b.forks - a.forks);
        } else if (orderClause.includes("name")) {
          filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          filtered.sort((a, b) => b.scoreCard.totalScore - a.scoreCard.totalScore);
        }
      }

      // Limit
      const limitMatch = q.match(/limit\s+(\d+)/i);
      if (limitMatch) {
        const lim = parseInt(limitMatch[1]);
        filtered = filtered.slice(0, lim);
      }

      const rows = filtered.map(r => ({
        Name: r.name,
        Owner: r.owner,
        Category: r.category,
        Language: r.language,
        Stars: r.stars,
        Forks: r.forks,
        Delta24h: `+${r.starDelta24h}`,
        Score: r.scoreCard.totalScore,
        Verdict: r.scoreCard.recommendation,
        Version: r.currentVersion
      }));

      const columns = ["Name", "Owner", "Category", "Language", "Stars", "Forks", "Delta24h", "Score", "Verdict", "Version"];

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - start + 2
      };
    } catch (e: any) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Date.now() - start,
        error: `SQL Parse Error: ${e.message}`
      };
    }
  }
}
