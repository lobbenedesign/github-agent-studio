/**
 * 📚 A-to-Z GitHub Repository Catalog & Indexer with Version Tracking & Disk Persistence
 * Organizes, parses, and provides search, sorting & filtering across open-source AI projects.
 */

import { CodeEvaluator, RepoScoreCard } from "./code_evaluator";
import { GitHubApiClient, GitHubLiveMetadata } from "./github_api_client";
import { VersionTracker, VersionDelta } from "./version_tracker";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface GitHubRepoItem {
  id: string;
  name: string;
  fullName: string;
  url: string;
  owner: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string;
  license: string;
  category: "LLM & Inference" | "Agents & Automation" | "Vision & Multimodal" | "Voice & Audio" | "Reasoning & MCTS" | "Fine-Tuning & RL" | "Code & SWE" | "RAG & Knowledge";
  description: string;
  scoreCard: RepoScoreCard;
  currentVersion: string;
  starDelta24h: number;
  hasRecentUpdate: boolean;
  updatedAt: string;
}

export class RepoIndexer {
  private evaluator = new CodeEvaluator();
  private apiClient = new GitHubApiClient();
  public versionTracker = new VersionTracker();
  private catalog: GitHubRepoItem[] = [];
  private dbPath = join(__dirname, "..", "data", "catalog.json");

  constructor() {
    this.loadCatalog();
  }

  private loadCatalog() {
    const dataDir = join(__dirname, "..", "data");
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    if (existsSync(this.dbPath)) {
      try {
        const raw = readFileSync(this.dbPath, "utf-8");
        this.catalog = JSON.parse(raw);
        if (this.catalog.length > 0) return;
      } catch {}
    }

    this.seedCatalog();
    this.saveCatalog();
  }

  private saveCatalog() {
    try {
      writeFileSync(this.dbPath, JSON.stringify(this.catalog, null, 2), "utf-8");
    } catch {}
  }

  private seedCatalog() {
    const rawData = [
      {
        name: "Aether-Voice",
        fullName: "lobbenedesign/aether-voice",
        url: "https://github.com/lobbenedesign/aether-voice",
        owner: "lobbenedesign",
        stars: 320,
        forks: 48,
        openIssues: 2,
        language: "TypeScript",
        license: "MIT",
        category: "Voice & Audio" as const,
        version: "v1.0.0",
        description: "Full-Duplex Real-Time Neural Voice Engine with Sub-150ms Turn-Taking, Natural Barge-In, and Voice Tools Dispatcher."
      },
      {
        name: "AirLLM",
        fullName: "lyogavin/Anima/tree/main/air_llm",
        url: "https://github.com/lyogavin/Anima",
        owner: "lyogavin",
        stars: 12400,
        forks: 1100,
        openIssues: 45,
        language: "Python",
        license: "Apache-2.0",
        category: "LLM & Inference" as const,
        version: "v2.8.4",
        description: "Run 70B and 405B large language models on consumer 4GB-8GB VRAM GPUs via layer-wise SSD streaming."
      },
      {
        name: "Browser-Use",
        fullName: "browser-use/browser-use",
        url: "https://github.com/browser-use/browser-use",
        owner: "browser-use",
        stars: 28500,
        forks: 3100,
        openIssues: 120,
        language: "Python",
        license: "MIT",
        category: "Agents & Automation" as const,
        version: "v0.1.38",
        description: "Make websites accessible for AI agents with vision and autonomous click/type navigation."
      },
      {
        name: "CodeDoctor-SWE",
        fullName: "lobbenedesign/codedoctor-swe",
        url: "https://github.com/lobbenedesign/codedoctor-swe",
        owner: "lobbenedesign",
        stars: 410,
        forks: 62,
        openIssues: 1,
        language: "TypeScript",
        license: "MIT",
        category: "Code & SWE" as const,
        version: "v1.0.0",
        description: "Autonomous Codebase Diagnostic & Healing Studio with AST error tracing and sandboxed regression test verification."
      },
      {
        name: "DeepSeek-R1",
        fullName: "deepseek-ai/DeepSeek-R1",
        url: "https://github.com/deepseek-ai/DeepSeek-R1",
        owner: "deepseek-ai",
        stars: 76000,
        forks: 8900,
        openIssues: 380,
        language: "Python",
        license: "MIT",
        category: "Reasoning & MCTS" as const,
        version: "v1.0.0-r1",
        description: "Incentivizing Reasoning Capability in LLMs via Reinforcement Learning without Supervised Fine-Tuning."
      },
      {
        name: "Exo",
        fullName: "exo-explore/exo",
        url: "https://github.com/exo-explore/exo",
        owner: "exo-explore",
        stars: 19800,
        forks: 1450,
        openIssues: 85,
        language: "Python",
        license: "GPL-3.0",
        category: "LLM & Inference" as const,
        version: "v0.0.12",
        description: "Run decentralized AI clusters on everyday consumer devices (Macs, iPhones, Androids) via peer-to-peer mesh."
      },
      {
        name: "GenUI-Canvas-Studio",
        fullName: "lobbenedesign/genui-canvas-studio",
        url: "https://github.com/lobbenedesign/genui-canvas-studio",
        owner: "lobbenedesign",
        stars: 380,
        forks: 55,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        category: "Code & SWE" as const,
        version: "v1.0.0",
        description: "Infinite Generative UI Canvas & Real-Time Streaming Component Studio with Sandboxed Interactive Iframe Previews."
      },
      {
        name: "GitHub-Agent-Studio",
        fullName: "lobbenedesign/github-agent-studio",
        url: "https://github.com/lobbenedesign/github-agent-studio",
        owner: "lobbenedesign",
        stars: 510,
        forks: 74,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        category: "Agents & Automation" as const,
        version: "v1.0.0",
        description: "Universal A-to-Z GitHub Repository Intelligence, Deep Code Quality Evaluator & Clean Textual Wiki Archive Generator."
      },
      {
        name: "GLM-5-PostTrain",
        fullName: "THUDM/GLM-5",
        url: "https://github.com/THUDM/GLM-5",
        owner: "THUDM",
        stars: 14500,
        forks: 1650,
        openIssues: 42,
        language: "Python",
        license: "Apache-2.0",
        category: "Fine-Tuning & RL" as const,
        version: "v5.3.0",
        description: "Scaled Continual Post-Training and On-Policy Distillation (OPD) for 50% coding capability gain without base retraining."
      },
      {
        name: "HyperRAG-Studio",
        fullName: "lobbenedesign/hyperrag-studio",
        url: "https://github.com/lobbenedesign/hyperrag-studio",
        owner: "lobbenedesign",
        stars: 540,
        forks: 82,
        openIssues: 3,
        language: "TypeScript",
        license: "MIT",
        category: "RAG & Knowledge" as const,
        version: "v1.1.0",
        description: "Knowledge Graph RAG (LightRAG-style) & speculative decoding studio; see the repo's own README for what's implemented vs. unverified."
      },
      {
        name: "KTransformers",
        fullName: "kvcache-ai/ktransformers",
        url: "https://github.com/kvcache-ai/ktransformers",
        owner: "kvcache-ai",
        stars: 8200,
        forks: 670,
        openIssues: 32,
        language: "C++",
        license: "Apache-2.0",
        category: "LLM & Inference" as const,
        version: "v0.2.2",
        description: "Flexible, ultra-fast Python/C++ library to run DeepSeek-V3 and 671B MoE models on a single GPU + CPU RAM."
      },
      {
        name: "Nexus-Local-Engine",
        fullName: "lobbenedesign/nexus-local-engine",
        url: "https://github.com/lobbenedesign/nexus-local-engine",
        owner: "lobbenedesign",
        stars: 620,
        forks: 94,
        openIssues: 1,
        language: "TypeScript",
        license: "MIT",
        category: "LLM & Inference" as const,
        version: "v1.2.0",
        description: "Universal Local LLM Orchestrator unifying Apple MLX, llama.cpp, AirLLM, KTransformers, Exo, and Google TurboQuant 4-bit KV."
      },
      {
        name: "OmniOS-Pilot",
        fullName: "lobbenedesign/omnios-pilot",
        url: "https://github.com/lobbenedesign/omnios-pilot",
        owner: "lobbenedesign",
        stars: 450,
        forks: 70,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        category: "Vision & Multimodal" as const,
        version: "v1.0.0",
        description: "Multimodal Vision-Language Desktop Automation Agent with Pixel-Coordinate Visual Grounding and Emergency Panic Switch."
      },
      {
        name: "OpenHands",
        fullName: "All-Hands-AI/OpenHands",
        url: "https://github.com/All-Hands-AI/OpenHands",
        owner: "All-Hands-AI",
        stars: 44200,
        forks: 5600,
        openIssues: 240,
        language: "Python",
        license: "MIT",
        category: "Code & SWE" as const,
        version: "v0.18.2",
        description: "Open-source software development agent that can write code, fix bugs, and execute shell commands."
      },
      {
        name: "OpenUI",
        fullName: "thesysdev/openui",
        url: "https://github.com/thesysdev/openui",
        owner: "thesysdev",
        stars: 18900,
        forks: 1950,
        openIssues: 64,
        language: "TypeScript",
        license: "Apache-2.0",
        category: "Code & SWE" as const,
        version: "v0.8.0",
        description: "OpenUI lets you describe UI components and streams them directly into live interactive web elements."
      },
      {
        name: "Reasoning-Tree-MCTS",
        fullName: "lobbenedesign/reasoning-tree-mcts",
        url: "https://github.com/lobbenedesign/reasoning-tree-mcts",
        owner: "lobbenedesign",
        stars: 490,
        forks: 76,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        category: "Reasoning & MCTS" as const,
        version: "v1.0.0",
        description: "Monte Carlo Tree Search (MCTS) Test-Time Compute Reasoning Studio with Sandbox Invariant Verification."
      },
      {
        name: "RL-Reasoning-Gym",
        fullName: "lobbenedesign/rl-reasoning-gym",
        url: "https://github.com/lobbenedesign/rl-reasoning-gym",
        owner: "lobbenedesign",
        stars: 390,
        forks: 58,
        openIssues: 0,
        language: "TypeScript",
        license: "MIT",
        category: "Fine-Tuning & RL" as const,
        version: "v1.1.0",
        description: "Local Group Relative Policy Optimization (GRPO) Reinforcement Learning Studio with Scaled Post-Training (GLM-5.3 Style)."
      },
      {
        name: "SWE-agent",
        fullName: "SWE-agent/SWE-agent",
        url: "https://github.com/SWE-agent/SWE-agent",
        owner: "SWE-agent",
        stars: 16800,
        forks: 1720,
        openIssues: 92,
        language: "Python",
        license: "MIT",
        category: "Code & SWE" as const,
        version: "v0.9.1",
        description: "SWE-agent turns LM into software engineering agents capable of solving real bugs in GitHub repositories."
      },
      {
        name: "Unsloth",
        fullName: "unslothai/unsloth",
        url: "https://github.com/unslothai/unsloth",
        owner: "unslothai",
        stars: 28400,
        forks: 2100,
        openIssues: 110,
        language: "Python",
        license: "Apache-2.0",
        category: "Fine-Tuning & RL" as const,
        version: "v2026.8",
        description: "Finetune Llama 3.3, Mistral, Qwen 2.5 & DeepSeek-R1 2x-5x faster with 70% less memory using hand-written Triton kernels."
      },
      {
        name: "UI-TARS",
        fullName: "bytedance/ui-tars",
        url: "https://github.com/bytedance/ui-tars",
        owner: "bytedance",
        stars: 8700,
        forks: 890,
        openIssues: 38,
        language: "Python",
        license: "Apache-2.0",
        category: "Vision & Multimodal" as const,
        version: "v1.2.0",
        description: "End-to-end multimodal GUI agent model for operating computers and mobile phones via visual grounding."
      }
    ];

    this.catalog = rawData.map(r => {
      const score = this.evaluator.evaluateRepo(r.name, r.stars, r.forks, r.language, r.description);
      // seed baseline: no real "yesterday" snapshot exists yet for a freshly-booted
      // catalog, so previousStars starts equal to stars (delta 0) until the cron
      // scheduler's real GitHub polling establishes an actual history.
      const delta = this.versionTracker.trackDelta(r.fullName, r.version, r.version, r.stars, r.stars, "2026-08-24", "Latest stable release");
      return {
        id: r.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        name: r.name,
        fullName: r.fullName,
        url: r.url,
        owner: r.owner,
        stars: r.stars,
        forks: r.forks,
        openIssues: r.openIssues,
        language: r.language,
        license: r.license,
        category: r.category,
        description: r.description,
        scoreCard: score,
        currentVersion: r.version,
        starDelta24h: delta.starDelta24h,
        hasRecentUpdate: true,
        updatedAt: "2026-08-24"
      };
    });
  }

  public getCatalog(filterLetter?: string, category?: string, minScore?: number, query?: string, sortBy: string = "score"): GitHubRepoItem[] {
    let list = [...this.catalog];

    if (filterLetter && filterLetter !== "ALL") {
      list = list.filter(r => r.name.toUpperCase().startsWith(filterLetter.toUpperCase()));
    }

    if (category && category !== "ALL") {
      list = list.filter(r => r.category === category);
    }

    if (minScore) {
      list = list.filter(r => r.scoreCard.totalScore >= minScore);
    }

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q));
    }

    // Dynamic Sorting
    if (sortBy === "stars") {
      list.sort((a, b) => b.stars - a.stars);
    } else if (sortBy === "forks") {
      list.sort((a, b) => b.forks - a.forks);
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "delta") {
      list.sort((a, b) => b.starDelta24h - a.starDelta24h);
    } else {
      // Default: Highest Strategic Score first
      list.sort((a, b) => b.scoreCard.totalScore - a.scoreCard.totalScore);
    }

    return list;
  }

  public async scanAndAddLiveRepo(urlOrName: string): Promise<GitHubRepoItem> {
    const meta = await this.apiClient.fetchLiveRepo(urlOrName);

    // Auto-detect category
    let cat: GitHubRepoItem["category"] = "LLM & Inference";
    const desc = (meta.description + " " + meta.topics.join(" ")).toLowerCase();
    if (desc.includes("agent") || desc.includes("browser")) cat = "Agents & Automation";
    else if (desc.includes("voice") || desc.includes("audio") || desc.includes("speech")) cat = "Voice & Audio";
    else if (desc.includes("vision") || desc.includes("vlm") || desc.includes("gui")) cat = "Vision & Multimodal";
    else if (desc.includes("reasoning") || desc.includes("mcts") || desc.includes("math")) cat = "Reasoning & MCTS";
    else if (desc.includes("fine-tuning") || desc.includes("rl") || desc.includes("grpo")) cat = "Fine-Tuning & RL";
    else if (desc.includes("code") || desc.includes("swe") || desc.includes("ui") || desc.includes("canvas")) cat = "Code & SWE";
    else if (desc.includes("rag") || desc.includes("graph") || desc.includes("retrieval")) cat = "RAG & Knowledge";

    const scoreCard = this.evaluator.evaluateRepo(meta.name, meta.stars, meta.forks, meta.language, meta.description, meta.readmeExcerpt);

    const versionTag = "v1.0.0";
    // Same reasoning as the seed catalog: no prior snapshot exists for a repo
    // being added for the first time, so the honest starting delta is 0, not
    // a guessed formula. Real deltas accrue once the cron scheduler re-polls it.
    const delta = this.versionTracker.trackDelta(meta.fullName, "none", versionTag, meta.stars, meta.stars, meta.updatedAt, "Live crawled repository");

    const item: GitHubRepoItem = {
      id: meta.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      name: meta.name,
      fullName: meta.fullName,
      url: meta.url,
      owner: meta.owner,
      stars: meta.stars,
      forks: meta.forks,
      openIssues: meta.openIssues,
      language: meta.language,
      license: meta.license,
      category: cat,
      description: meta.description,
      scoreCard,
      currentVersion: versionTag,
      starDelta24h: delta.starDelta24h,
      hasRecentUpdate: true,
      updatedAt: meta.updatedAt.slice(0, 10)
    };

    // Remove existing if duplicate, and add new
    this.catalog = this.catalog.filter(c => c.fullName.toLowerCase() !== item.fullName.toLowerCase());
    this.catalog.push(item);
    this.saveCatalog();

    return item;
  }

  /**
   * Re-fetches a catalog entry's live stats from the real GitHub API and
   * records a real star delta against whatever was previously stored (used
   * by DailyCronScheduler instead of a fake sleep-and-increment loop).
   * Returns null if the repo isn't in the catalog or the API call fails —
   * callers should treat null as "skip this one," not retry with fake data.
   */
  public async refreshRepo(fullName: string): Promise<GitHubRepoItem | null> {
    const idx = this.catalog.findIndex(c => c.fullName.toLowerCase() === fullName.toLowerCase());
    if (idx === -1) return null;

    const existing = this.catalog[idx];
    let meta: GitHubLiveMetadata;
    try {
      meta = await this.apiClient.fetchLiveRepo(fullName);
    } catch {
      return null;
    }

    const delta = this.versionTracker.trackDelta(
      fullName,
      existing.currentVersion,
      existing.currentVersion,
      existing.stars,
      meta.stars,
      meta.updatedAt,
      meta.stars !== existing.stars ? `Star count changed ${existing.stars} -> ${meta.stars}` : "No change since last poll"
    );

    const updated: GitHubRepoItem = {
      ...existing,
      stars: meta.stars,
      forks: meta.forks,
      openIssues: meta.openIssues,
      starDelta24h: delta.starDelta24h,
      hasRecentUpdate: delta.starDelta24h > 0,
      updatedAt: meta.updatedAt.slice(0, 10)
    };
    this.catalog[idx] = updated;
    this.saveCatalog();
    return updated;
  }

  /** fullNames already present, for the cron scheduler to dedupe search results against. */
  public getKnownFullNames(): Set<string> {
    return new Set(this.catalog.map(c => c.fullName.toLowerCase()));
  }
}
