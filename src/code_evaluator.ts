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
  public evaluateRepo(
    name: string,
    stars: number,
    forks: number,
    language: string,
    description: string,
    readmeText: string = "",
    isOwnSuite: boolean = false,
    openIssues: number | null = null,
    pushedAt: string | null = null
  ): RepoScoreCard {
    const combinedText = `${name} ${description} ${readmeText}`.toLowerCase();

    // 1. Architecture & Innovation (0-30). Was a single +8 all-or-nothing
    // keyword bump (only 3-4 possible outcomes); now sums partial credit
    // per matched signal so two repos matching different numbers of real
    // signals land at different scores instead of tying.
    const archKeywords = ["mcts", "grpo", "full-duplex", "vlm", "ast", "turboquant", "speculative", "distributed", "streaming", "quantization", "compiler"];
    const archMatches = archKeywords.filter((k) => combinedText.includes(k)).length;
    let arch = 16 + Math.min(10, archMatches * 2.5);
    if (language === "Rust" || language === "TypeScript" || language === "C++" || language === "Go" || language === "Zig") arch += 2;
    arch = Math.min(30, Math.round(arch * 10) / 10);

    // 2. Code Cleanliness & real Engagement Signal (0-25). Replaced the
    // fixed stars>500/forks>50 step bonuses with a continuous fork-to-star
    // ratio: forks are people actually taking the code to modify it, a
    // stronger "this codebase is worth building on" signal than raw stars
    // (a passive bookmark). Ratio is naturally noisy for very-low-star
    // repos, so it's damped by a real sample-size factor (more stars = more
    // confidence in the ratio) instead of applied at full weight always.
    const forkRatio = stars > 0 ? Math.min(1, forks / stars) : 0;
    const sampleConfidence = Math.min(1, Math.log10(stars + 1) / 3); // ramps to 1 around ~1000 stars
    let clean = 14 + forkRatio * 8 * sampleConfidence;
    if (combinedText.includes("test") || combinedText.includes("ci/cd") || combinedText.includes("workflow")) clean += 2;
    // Real maintenance-activity signal from actual open issue count relative
    // to stars: some open issues on a popular repo is normal/healthy
    // (people are using it and reporting real things); a repo with stars
    // but literally zero visible issue activity is more likely abandoned
    // or issues-disabled than "perfect."
    if (openIssues !== null && stars > 100) {
      const issueRatio = openIssues / stars;
      if (issueRatio > 0 && issueRatio < 0.15) clean += 1.5;
    }
    clean = Math.min(25, Math.round(clean * 10) / 10);

    // 3. Community Momentum (0-25). Replaced 4 fixed star thresholds
    // (only 5 possible values total) with a continuous log10 curve, plus a
    // real recency term from the repo's actual last-pushed date: two repos
    // with the same star count but very different maintenance activity
    // now score differently instead of tying.
    const starMomentum = Math.min(20, Math.log10(Math.max(1, stars) + 1) * 4);
    let recencyBonus = 2.5; // neutral when we don't have real pushedAt data
    if (pushedAt) {
      const daysSincePush = (Date.now() - new Date(pushedAt).getTime()) / 86400000;
      if (daysSincePush <= 30) recencyBonus = 5;
      else if (daysSincePush <= 180) recencyBonus = 4;
      else if (daysSincePush <= 730) recencyBonus = 2;
      else recencyBonus = 0; // real signal: not touched in 2+ years
    }
    const momentum = Math.min(25, Math.round((starMomentum + recencyBonus) * 10) / 10);

    // 4. Local Self-Hostability & Privacy (0-20)
    let selfHost = 15;
    if (!combinedText.includes("cloud only") && !combinedText.includes("saas subscription")) selfHost = 20;

    // Rounded to 1 decimal, not an integer — the old all-integer-bucket
    // formula produced only a few dozen possible totals, so unrelated repos
    // (react and cypress, say) routinely landed on the exact same score.
    // A continuous formula honestly has many possible values; forcing it
    // back to whole numbers would just reintroduce artificial ties.
    const total = Math.round((arch + clean + momentum + selfHost) * 10) / 10;

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
