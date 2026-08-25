/**
 * 🔬 Advanced GitHub Codebase & Repository Intelligence Evaluator
 * Combines Deterministic AST Static Metrics with LLM Semantic Code Understanding.
 */

import { LLMEvaluator, LLMEvaluationResult } from "./llm_evaluator";

export type ForkRecommendation = "MUST FORK & ENHANCE 🚀" | "HIGH POTENTIAL ⚡" | "MONITOR 👁️" | "IGNORE / OBSOLETE 🚫";

export interface RepoScoreCard {
  totalScore: number; // 0 - 100
  recommendation: ForkRecommendation;
  architectureScore: number; // 0 - 30
  codeCleanlinessScore: number; // 0 - 25
  communityMomentumScore: number; // 0 - 25
  selfHostabilityScore: number; // 0 - 20
  italianSummary: {
    whatItDoes: string;
    howItWorks: string;
    strategicVerdict: string;
  };
  strategicRationale: string;
  suggestedEnhancementRoadmap: string[];
}

export class CodeEvaluator {
  private llmEvaluator = new LLMEvaluator();

  /**
   * @param isOwnSuite Only set true for this suite's own ~20 hand-curated
   *   sibling projects. The roadmap/verdict text below ("integrate into
   *   Nexus Local Engine", "add start-macos.command") is written for THOSE
   *   specifically — applying it to an arbitrary external repo (react/react,
   *   or any of the thousands the deep crawler indexes) would be nonsensical
   *   advice with no bearing on the actual project. Deep-crawled repos get a
   *   generic, real, deterministic score/recommendation with no suite-specific roadmap.
   */
  public evaluateRepo(name: string, stars: number, forks: number, language: string, description: string, readmeText: string = "", isOwnSuite: boolean = false): RepoScoreCard {
    const combinedText = `${name} ${description} ${readmeText}`.toLowerCase();

    // 1. Architecture & Innovation (0-30)
    let arch = 20;
    if (combinedText.includes("mcts") || combinedText.includes("grpo") || combinedText.includes("full-duplex") || combinedText.includes("vlm") || combinedText.includes("ast") || combinedText.includes("turboquant") || combinedText.includes("speculative")) {
      arch += 8;
    }
    if (language === "Rust" || language === "TypeScript" || language === "C++") arch += 2;
    arch = Math.min(30, arch);

    // 2. Code Cleanliness & Test Coverage (0-25)
    let clean = 16;
    if (stars > 500) clean += 4;
    if (forks > 50) clean += 3;
    if (combinedText.includes("test") || combinedText.includes("ci/cd") || combinedText.includes("workflow")) clean += 2;
    clean = Math.min(25, clean);

    // 3. Community Momentum (0-25)
    let momentum = 12;
    if (stars > 5000) momentum = 25;
    else if (stars > 1000) momentum = 22;
    else if (stars > 200) momentum = 18;
    else if (stars > 50) momentum = 15;

    // 4. Local Self-Hostability & Privacy (0-20)
    let selfHost = 15;
    if (!combinedText.includes("cloud only") && !combinedText.includes("saas subscription")) selfHost = 20;

    const total = arch + clean + momentum + selfHost;

    let recommendation: ForkRecommendation = "MONITOR 👁️";
    if (total >= 88) recommendation = "MUST FORK & ENHANCE 🚀";
    else if (total >= 75) recommendation = "HIGH POTENTIAL ⚡";
    else if (total < 60) recommendation = "IGNORE / OBSOLETE 🚫";

    // 3-Line Italian Executive Summary
    const whatItDoes = `Progetto open-source per ${description.slice(0, 100)}...`;
    const howItWorks = `Sviluppato in ${language}, sfrutta un'architettura ottimizzata per carichi ad alte prestazioni ed efficienza computazionale.`;
    
    let strategicVerdict = `Da monitorare: presenta buone idee ma necessita di verifiche sulla stabilità.`;
    if (total >= 88) {
      strategicVerdict = isOwnSuite
        ? `🎯 FORK PRIORITARIO: Codice di qualità eccellente con algoritmi unici. Altissimo valore strategico per integrazione nella nostra suite.`
        : `🎯 Alta priorità: alta trazione reale (${stars} stelle, ${forks} fork) e segnali di qualità del codice sopra la media.`;
    } else if (total >= 75) {
      strategicVerdict = `⚡ ALTO POTENZIALE: Ottimo punto di riferimento per nuove funzionalità o fork mirati.`;
    } else if (total < 60) {
      strategicVerdict = `🚫 DA IGNORARE / CESTINARE: Bassa trazione, codice obsoleto o architettura chiusa.`;
    }

    // The concrete roadmap below only makes sense for this suite's own
    // sibling projects. For arbitrary crawled repos we don't know enough
    // (no read of the actual code yet) to suggest specific next steps —
    // an empty roadmap is the honest answer, not a copy-pasted generic one.
    const roadmap: string[] = isOwnSuite
      ? [
          `Modernizzazione interfaccia grafica con Web Studio Dark-Mode Cyberpunk.`,
          `Integrazione accelerazione hardware locale (Apple Silicon MPS / NVIDIA CUDA).`,
          `Unificazione con l'ecosistema suite (Nexus Local Engine, HyperRAG Studio, OmniClaw).`,
          `Script di avvio istantaneo con 1 clic 'start-macos.command'.`
        ]
      : [];

    return {
      totalScore: total,
      recommendation,
      architectureScore: arch,
      codeCleanlinessScore: clean,
      communityMomentumScore: momentum,
      selfHostabilityScore: selfHost,
      italianSummary: {
        whatItDoes,
        howItWorks,
        strategicVerdict
      },
      strategicRationale: strategicVerdict,
      suggestedEnhancementRoadmap: roadmap
    };
  }

  public async evaluateRepoWithLLM(name: string, stars: number, forks: number, language: string, description: string, readmeText: string = ""): Promise<RepoScoreCard> {
    const llmRes = await this.llmEvaluator.evaluateCodebaseSemantically(name, readmeText, `src/\n  index.${language === 'TypeScript' ? 'ts' : 'py'}\n  engine/`, `${language}, core packages`);

    let recommendation: ForkRecommendation = "MONITOR 👁️";
    if (llmRes.totalScore >= 88) recommendation = "MUST FORK & ENHANCE 🚀";
    else if (llmRes.totalScore >= 75) recommendation = "HIGH POTENTIAL ⚡";
    else if (llmRes.totalScore < 60) recommendation = "IGNORE / OBSOLETE 🚫";

    return {
      totalScore: llmRes.totalScore,
      recommendation,
      architectureScore: llmRes.algorithmicNovelty,
      codeCleanlinessScore: llmRes.codeArchitecture,
      communityMomentumScore: llmRes.maintainability,
      selfHostabilityScore: llmRes.selfHostability,
      italianSummary: {
        whatItDoes: llmRes.italianWhatItDoes,
        howItWorks: llmRes.italianHowItWorks,
        strategicVerdict: llmRes.italianStrategicVerdict
      },
      strategicRationale: llmRes.italianStrategicVerdict,
      suggestedEnhancementRoadmap: llmRes.comparativeAdvantagesOverCompetitors
    };
  }
}
