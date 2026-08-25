/**
 * Real keyword-based category detection over a repo's actual description +
 * topics. Shared between the curated seed catalog and the deep crawler so
 * both use the same rule and the same honest default.
 *
 * This taxonomy (LLM/Agents/Voice/Vision/Reasoning/Fine-Tuning/Code/RAG) was
 * written for this suite's own AI/ML-focused sibling projects. Applied to an
 * arbitrary GitHub repo across 30 languages (what the deep crawler indexes),
 * most repos won't match any of these keywords — the old code silently
 * defaulted every unmatched repo to "LLM & Inference", which is simply
 * wrong for, say, a CSS framework or a game engine. Returns `null` instead
 * when nothing real matches; callers show that as "General / Uncategorized",
 * not a guessed category.
 */
export type RepoCategory =
  | "LLM & Inference"
  | "Agents & Automation"
  | "Vision & Multimodal"
  | "Voice & Audio"
  | "Reasoning & MCTS"
  | "Fine-Tuning & RL"
  | "Code & SWE"
  | "RAG & Knowledge";

export function detectCategory(description: string, topics: string[]): RepoCategory | null {
  const text = `${description || ""} ${(topics || []).join(" ")}`.toLowerCase();

  if (text.includes("agent") || text.includes("browser") || text.includes("automation")) return "Agents & Automation";
  if (text.includes("voice") || text.includes("audio") || text.includes("speech")) return "Voice & Audio";
  if (text.includes("vision") || text.includes("vlm") || text.includes("gui") || text.includes("multimodal")) return "Vision & Multimodal";
  if (text.includes("reasoning") || text.includes("mcts") || (text.includes("math") && text.includes("model"))) return "Reasoning & MCTS";
  if (text.includes("fine-tuning") || text.includes("fine tuning") || text.includes("rlhf") || text.includes("grpo")) return "Fine-Tuning & RL";
  if (text.includes("rag") || text.includes("retrieval augmented") || (text.includes("knowledge graph"))) return "RAG & Knowledge";
  if (text.includes("llm") || text.includes("large language model") || text.includes("inference engine")) return "LLM & Inference";
  if (text.includes("swe-agent") || text.includes("coding agent") || text.includes("code generation")) return "Code & SWE";

  return null;
}
