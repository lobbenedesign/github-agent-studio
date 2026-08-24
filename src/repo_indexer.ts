/**
 * 📚 A-to-Z GitHub Repository Catalog & Indexer
 * Organizes, parses, and provides search & filtering across open-source AI projects.
 */

import { CodeEvaluator, RepoScoreCard } from "./code_evaluator";

export interface GitHubRepoItem {
  id: string;
  name: string;
  fullName: string;
  url: string;
  owner: string;
  stars: number;
  forks: number;
  language: string;
  category: "LLM & Inference" | "Agents & Automation" | "Vision & Multimodal" | "Voice & Audio" | "Reasoning & MCTS" | "Fine-Tuning & RL" | "Code & SWE" | "RAG & Knowledge";
  description: string;
  scoreCard: RepoScoreCard;
}

export class RepoIndexer {
  private evaluator = new CodeEvaluator();
  private catalog: GitHubRepoItem[] = [];

  constructor() {
    this.seedCatalog();
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
        language: "TypeScript",
        category: "Voice & Audio" as const,
        description: "Full-Duplex Real-Time Neural Voice Engine with Sub-150ms Turn-Taking, Natural Barge-In, and Voice Tools Dispatcher."
      },
      {
        name: "AirLLM",
        fullName: "lyogavin/Anima/tree/main/air_llm",
        url: "https://github.com/lyogavin/Anima",
        owner: "lyogavin",
        stars: 12400,
        forks: 1100,
        language: "Python",
        category: "LLM & Inference" as const,
        description: "Run 70B and 405B large language models on consumer 4GB-8GB VRAM GPUs via layer-wise SSD streaming."
      },
      {
        name: "Browser-Use",
        fullName: "browser-use/browser-use",
        url: "https://github.com/browser-use/browser-use",
        owner: "browser-use",
        stars: 28500,
        forks: 3100,
        language: "Python",
        category: "Agents & Automation" as const,
        description: "Make websites accessible for AI agents with vision and autonomous click/type navigation."
      },
      {
        name: "CodeDoctor-SWE",
        fullName: "lobbenedesign/codedoctor-swe",
        url: "https://github.com/lobbenedesign/codedoctor-swe",
        owner: "lobbenedesign",
        stars: 410,
        forks: 62,
        language: "TypeScript",
        category: "Code & SWE" as const,
        description: "Autonomous Codebase Diagnostic & Healing Studio with AST error tracing and sandboxed regression test verification."
      },
      {
        name: "DeepSeek-R1",
        fullName: "deepseek-ai/DeepSeek-R1",
        url: "https://github.com/deepseek-ai/DeepSeek-R1",
        owner: "deepseek-ai",
        stars: 76000,
        forks: 8900,
        language: "Python",
        category: "Reasoning & MCTS" as const,
        description: "Incentivizing Reasoning Capability in LLMs via Reinforcement Learning without Supervised Fine-Tuning."
      },
      {
        name: "Exo",
        fullName: "exo-explore/exo",
        url: "https://github.com/exo-explore/exo",
        owner: "exo-explore",
        stars: 19800,
        forks: 1450,
        language: "Python",
        category: "LLM & Inference" as const,
        description: "Run decentralized AI clusters on everyday consumer devices (Macs, iPhones, Androids) via peer-to-peer mesh."
      },
      {
        name: "GenUI-Canvas-Studio",
        fullName: "lobbenedesign/genui-canvas-studio",
        url: "https://github.com/lobbenedesign/genui-canvas-studio",
        owner: "lobbenedesign",
        stars: 380,
        forks: 55,
        language: "TypeScript",
        category: "Code & SWE" as const,
        description: "Infinite Generative UI Canvas & Real-Time Streaming Component Studio with Sandboxed Interactive Iframe Previews."
      },
      {
        name: "HyperRAG-Studio",
        fullName: "lobbenedesign/hyperrag-studio",
        url: "https://github.com/lobbenedesign/hyperrag-studio",
        owner: "lobbenedesign",
        stars: 540,
        forks: 82,
        language: "TypeScript",
        category: "RAG & Knowledge" as const,
        description: "Next-Gen Knowledge Graph RAG (LightRAG) & Speculative Decoding Studio (EAGLE 3.5x) with Google TurboQuant 4-bit."
      },
      {
        name: "KTransformers",
        fullName: "kvcache-ai/ktransformers",
        url: "https://github.com/kvcache-ai/ktransformers",
        owner: "kvcache-ai",
        stars: 8200,
        forks: 670,
        language: "C++",
        category: "LLM & Inference" as const,
        description: "Flexible, ultra-fast Python/C++ library to run DeepSeek-V3 and 671B MoE models on a single GPU + CPU RAM."
      },
      {
        name: "Nexus-Local-Engine",
        fullName: "lobbenedesign/nexus-local-engine",
        url: "https://github.com/lobbenedesign/nexus-local-engine",
        owner: "lobbenedesign",
        stars: 620,
        forks: 94,
        language: "TypeScript",
        category: "LLM & Inference" as const,
        description: "Universal Local LLM Orchestrator unifying Apple MLX, llama.cpp, AirLLM, KTransformers, Exo, and Google TurboQuant 4-bit KV."
      },
      {
        name: "OmniOS-Pilot",
        fullName: "lobbenedesign/omnios-pilot",
        url: "https://github.com/lobbenedesign/omnios-pilot",
        owner: "lobbenedesign",
        stars: 450,
        forks: 70,
        language: "TypeScript",
        category: "Vision & Multimodal" as const,
        description: "Multimodal Vision-Language Desktop Automation Agent with Pixel-Coordinate Visual Grounding and Emergency Panic Switch."
      },
      {
        name: "OpenHands",
        fullName: "All-Hands-AI/OpenHands",
        url: "https://github.com/All-Hands-AI/OpenHands",
        owner: "All-Hands-AI",
        stars: 44200,
        forks: 5600,
        language: "Python",
        category: "Code & SWE" as const,
        description: "Open-source software development agent that can write code, fix bugs, and execute shell commands."
      },
      {
        name: "OpenUI",
        fullName: "thesysdev/openui",
        url: "https://github.com/thesysdev/openui",
        owner: "thesysdev",
        stars: 18900,
        forks: 1950,
        language: "TypeScript",
        category: "Code & SWE" as const,
        description: "OpenUI lets you describe UI components and streams them directly into live interactive web elements."
      },
      {
        name: "Reasoning-Tree-MCTS",
        fullName: "lobbenedesign/reasoning-tree-mcts",
        url: "https://github.com/lobbenedesign/reasoning-tree-mcts",
        owner: "lobbenedesign",
        stars: 490,
        forks: 76,
        language: "TypeScript",
        category: "Reasoning & MCTS" as const,
        description: "Monte Carlo Tree Search (MCTS) Test-Time Compute Reasoning Studio with Sandbox Invariant Verification."
      },
      {
        name: "RL-Reasoning-Gym",
        fullName: "lobbenedesign/rl-reasoning-gym",
        url: "https://github.com/lobbenedesign/rl-reasoning-gym",
        owner: "lobbenedesign",
        stars: 390,
        forks: 58,
        language: "TypeScript",
        category: "Fine-Tuning & RL" as const,
        description: "Local Group Relative Policy Optimization (GRPO) Reinforcement Learning Studio with Verifiable Reward Models."
      },
      {
        name: "SWE-agent",
        fullName: "SWE-agent/SWE-agent",
        url: "https://github.com/SWE-agent/SWE-agent",
        owner: "SWE-agent",
        stars: 16800,
        forks: 1720,
        language: "Python",
        category: "Code & SWE" as const,
        description: "SWE-agent turns LM into software engineering agents capable of solving real bugs in GitHub repositories."
      },
      {
        name: "Unsloth",
        fullName: "unslothai/unsloth",
        url: "https://github.com/unslothai/unsloth",
        owner: "unslothai",
        stars: 28400,
        forks: 2100,
        language: "Python",
        category: "Fine-Tuning & RL" as const,
        description: "Finetune Llama 3.3, Mistral, Qwen 2.5 & DeepSeek-R1 2x-5x faster with 70% less memory using hand-written Triton kernels."
      },
      {
        name: "UI-TARS",
        fullName: "bytedance/ui-tars",
        url: "https://github.com/bytedance/ui-tars",
        owner: "bytedance",
        stars: 8700,
        forks: 890,
        language: "Python",
        category: "Vision & Multimodal" as const,
        description: "End-to-end multimodal GUI agent model for operating computers and mobile phones via visual grounding."
      }
    ];

    this.catalog = rawData.map(r => ({
      id: r.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      ...r,
      scoreCard: this.evaluator.evaluateRepo(r.name, r.stars, r.forks, r.language, r.description)
    }));
  }

  public getCatalog(filterLetter?: string, category?: string, minScore?: number, query?: string): GitHubRepoItem[] {
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

    // Default alphabetical sort A to Z
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  public evaluateCustomRepo(url: string, stars: number = 1200, forks: number = 180, language: string = "TypeScript", description: string = "AI open source repository"): GitHubRepoItem {
    const parts = url.replace("https://github.com/", "").split("/");
    const owner = parts[0] || "custom-dev";
    const name = parts[1] || "custom-repo";

    const item: GitHubRepoItem = {
      id: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      name,
      fullName: `${owner}/${name}`,
      url,
      owner,
      stars,
      forks,
      language,
      category: "LLM & Inference",
      description,
      scoreCard: this.evaluator.evaluateRepo(name, stars, forks, language, description)
    };

    this.catalog.push(item);
    return item;
  }
}
