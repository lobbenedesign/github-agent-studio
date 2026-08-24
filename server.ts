#!/usr/bin/env bun
/**
 * 🐙 GITHUB-AGENT STUDIO SERVER (v1.0.0)
 * Universal A-to-Z GitHub Repository Intelligence & Forkability Studio
 */

import { RepoIndexer } from "./src/repo_indexer";
import { WikiGenerator } from "./src/wiki_generator";
import { GitHubInsightBenchmark } from "./src/competitor_benchmark";
import { join } from "path";
import { existsSync } from "fs";

const PORT = Number(process.env.PORT) || 3011;

const indexer = new RepoIndexer();
const wikiGen = new WikiGenerator();
const benchmark = new GitHubInsightBenchmark();

console.log(`\n======================================================`);
console.log(`🐙 GITHUB-AGENT STUDIO running on http://localhost:${PORT}`);
console.log(`🔤 A-to-Z Repository Catalog & Crawler: Active`);
console.log(`🔬 Deep Code & Forkability Evaluation Engine: Ready`);
console.log(`📖 Clean Textual Wiki Archive Generator: Online`);
console.log(`======================================================\n`);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (req.method === "OPTIONS") return new Response(null, { headers });

    // Serve Static UI Assets
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const p = join(__dirname, "public", "index.html");
      return new Response(Bun.file(p), { headers: { "Content-Type": "text/html" } });
    }
    if (url.pathname === "/app.js") {
      const p = join(__dirname, "public", "app.js");
      return new Response(Bun.file(p), { headers: { "Content-Type": "application/javascript" } });
    }
    if (url.pathname === "/style.css") {
      const p = join(__dirname, "public", "style.css");
      return new Response(Bun.file(p), { headers: { "Content-Type": "text/css" } });
    }
    if (url.pathname.startsWith("/public/")) {
      const p = join(__dirname, url.pathname);
      if (existsSync(p)) return new Response(Bun.file(p));
    }

    // 1. Status
    if (url.pathname === "/api/status" && req.method === "GET") {
      return new Response(JSON.stringify({
        status: "online",
        version: "1.0.0-githubagent",
        totalIndexed: indexer.getCatalog().length,
        wikiGenerator: "active"
      }), { headers });
    }

    // 2. List Repos (with A-Z letter, category, minScore, search query)
    if (url.pathname === "/api/repos/list" && req.method === "GET") {
      const letter = url.searchParams.get("letter") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const minScore = url.searchParams.has("minScore") ? Number(url.searchParams.get("minScore")) : undefined;
      const q = url.searchParams.get("q") || undefined;

      const repos = indexer.getCatalog(letter, category, minScore, q);
      return new Response(JSON.stringify(repos), { headers });
    }

    // 3. Scan & Evaluate Custom GitHub URL
    if (url.pathname === "/api/repos/scan" && req.method === "POST") {
      try {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const repoUrl = body.url || "https://github.com/vllm-project/vllm";
        const stars = Number(body.stars) || 34000;
        const forks = Number(body.forks) || 4500;
        const language = body.language || "Python";
        const description = body.description || "A high-throughput and memory-efficient inference and serving engine for LLMs with PagedAttention.";

        const evaluated = indexer.evaluateCustomRepo(repoUrl, stars, forks, language, description);
        return new Response(JSON.stringify(evaluated), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // 4. Generate Textual Wiki Archive (.md)
    if (url.pathname === "/api/wiki/export" && req.method === "GET") {
      const catalog = indexer.getCatalog();
      const wikiMarkdown = wikiGen.generateWikiMarkdown(catalog);
      return new Response(JSON.stringify({
        markdown: wikiMarkdown,
        totalCount: catalog.length
      }), { headers });
    }

    // 5. 5-Competitor Matrix
    if (url.pathname === "/api/competitors" && req.method === "GET") {
      return new Response(JSON.stringify(benchmark.getComparison()), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  }
});
