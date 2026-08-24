/**
 * 📊 5-Competitor Benchmark Matrix for GitHub Intelligence & Repository Analyzers
 * Compares GitHub Agent Studio against:
 * 1. GitHub Trending / Explore
 * 2. OSS Insight
 * 3. GitHunt
 * 4. Star-History
 * 5. Curated Awesome Lists
 */

export interface GitHubInsightCompetitor {
  name: string;
  atozClassification: boolean;
  deepCodeAnalysis: boolean;
  forkabilityScore: boolean;
  strategicRoadmapGen: boolean;
  oneClickForkClone: boolean;
  localOfflinePrivacy: boolean;
}

export class GitHubInsightBenchmark {
  public getComparison(): GitHubInsightCompetitor[] {
    return [
      {
        name: "🐙 GitHub Agent Studio (Our Software)",
        atozClassification: true,
        deepCodeAnalysis: true,
        forkabilityScore: true,
        strategicRoadmapGen: true,
        oneClickForkClone: true,
        localOfflinePrivacy: true
      },
      {
        name: "GitHub Trending / Explore",
        atozClassification: false,
        deepCodeAnalysis: false,
        forkabilityScore: false,
        strategicRoadmapGen: false,
        oneClickForkClone: true,
        localOfflinePrivacy: false
      },
      {
        name: "OSS Insight",
        atozClassification: false,
        deepCodeAnalysis: false,
        forkabilityScore: false,
        strategicRoadmapGen: false,
        oneClickForkClone: false,
        localOfflinePrivacy: false
      },
      {
        name: "GitHunt",
        atozClassification: false,
        deepCodeAnalysis: false,
        forkabilityScore: false,
        strategicRoadmapGen: false,
        oneClickForkClone: false,
        localOfflinePrivacy: false
      },
      {
        name: "Star-History",
        atozClassification: false,
        deepCodeAnalysis: false,
        forkabilityScore: false,
        strategicRoadmapGen: false,
        oneClickForkClone: false,
        localOfflinePrivacy: false
      },
      {
        name: "Curated Awesome Lists",
        atozClassification: true,
        deepCodeAnalysis: false,
        forkabilityScore: false,
        strategicRoadmapGen: false,
        oneClickForkClone: false,
        localOfflinePrivacy: true
      }
    ];
  }
}
