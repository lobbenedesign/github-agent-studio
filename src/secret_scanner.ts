/**
 * 🔑 Real Secret Scanner (TruffleHog/gitleaks-style, real repo file contents)
 *
 * The Security Shield used to mention "token leaks" without any actual detection
 * engine behind it (see COMPETITOR_RESEARCH.md, priority 1). This module is that
 * engine: it fetches a repo's real file tree (GitHub's Git Trees API, same
 * pattern as code_analyzer.ts) and, for a bounded sample of real text files,
 * fetches each file's real raw content and tests every line against a fixed set
 * of regex signatures for well-known secret formats.
 *
 * The regexes below are not invented — they are transcribed from gitleaks'
 * public default ruleset (https://github.com/gitleaks/gitleaks, MIT licensed,
 * config/gitleaks.toml, fetched 2026-08-26), the same class of pattern-matching
 * TruffleHog (https://github.com/trufflesecurity/trufflehog) and GitGuardian use
 * as their first detection layer. Each signature below carries the exact rule id
 * gitleaks uses so the source is checkable.
 *
 * Honesty about limits (important, and stated in every report this module
 * produces, not just here):
 *  - This is regex/pattern matching, NOT live credential validation. Unlike
 *    TruffleHog's "verified" mode (which authenticates to the actual service to
 *    confirm a secret is still active) or GitGuardian's validation checks, this
 *    module cannot and does not confirm whether a matched string is a real,
 *    still-valid credential — it only confirms the string's SHAPE matches a
 *    known secret format.
 *  - Regex-based secret detection has real, well-documented false-positive
 *    rates: example/placeholder keys in docs and tests, revoked keys left in
 *    history, and generic high-entropy patterns matching non-secret strings
 *    (hashes, encoded IDs, minified code) all produce hits that are not live
 *    leaked credentials. Every finding must be read as "matches a known secret
 *    SHAPE, needs human review" — never as a confirmed leak.
 *  - Matched values are always redacted before being returned or logged; the
 *    full secret text is never retained past the single regex test that found it.
 */

import { parseOwnerRepo, GitHubApiFetchError } from "./github_api_client";

const MAX_FILES_TO_SCAN = 120;
const MAX_FILE_BYTES = 400_000;

// Directories/paths that are near-certain noise for secret scanning (vendored
// deps, build output, lockfiles) — skipping them is a scan-quality decision,
// not a detection change; if a real secret is vendored in node_modules the
// leak already happened upstream and is out of scope for "this repo's own code".
const SKIP_PATH_SEGMENTS = ["node_modules/", "vendor/", "dist/", "build/", ".git/", "coverage/", "__pycache__/"];
const SKIP_EXACT_NAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "poetry.lock"]);
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "svg", "webp", "woff", "woff2", "ttf", "eot",
  "zip", "gz", "tar", "7z", "pdf", "mp4", "mp3", "wasm", "so", "dylib", "dll", "exe", "bin"
]);

export interface SecretSignature {
  id: string;
  description: string;
  regex: RegExp;
  /** The gitleaks rule id this pattern was transcribed from, for verifiability. */
  sourceRuleId: string;
}

// Transcribed from gitleaks' public default config (MIT licensed), fetched
// 2026-08-26 from github.com/gitleaks/gitleaks config/gitleaks.toml. Kept as
// a fixed literal `g` (global, multi-match per line) so every match on a line
// is caught, not just the first.
export const SECRET_SIGNATURES: SecretSignature[] = [
  {
    id: "aws-access-key-id",
    description: "AWS Access Key ID",
    regex: /\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\b/g,
    sourceRuleId: "aws-access-token"
  },
  {
    id: "github-pat-classic",
    description: "GitHub Personal Access Token (classic)",
    regex: /ghp_[0-9a-zA-Z]{36}/g,
    sourceRuleId: "github-pat"
  },
  {
    id: "github-pat-fine-grained",
    description: "GitHub Fine-Grained Personal Access Token",
    regex: /github_pat_\w{82}/g,
    sourceRuleId: "github-fine-grained-pat"
  },
  {
    id: "private-key-block",
    description: "PEM-format private key block (RSA/EC/OpenSSH/generic)",
    regex: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----[\s\S-]{64,}?KEY(?: BLOCK)?-----/gi,
    sourceRuleId: "private-key"
  },
  {
    id: "gcp-api-key",
    description: "Google Cloud / Firebase API Key",
    regex: /\b(AIza[\w-]{35})\b/g,
    sourceRuleId: "gcp-api-key"
  },
  {
    id: "slack-bot-token",
    description: "Slack Bot Token",
    regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    sourceRuleId: "slack-bot-token"
  },
  {
    id: "slack-webhook-url",
    description: "Slack Incoming Webhook URL",
    regex: /(?:https?:\/\/)?hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9+/]{43,56}/g,
    sourceRuleId: "slack-webhook-url"
  },
  {
    id: "stripe-secret-key",
    description: "Stripe Secret/Restricted API Key",
    regex: /\b(?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99}\b/g,
    sourceRuleId: "stripe-access-token"
  },
  {
    id: "npm-access-token",
    description: "npm Access Token",
    regex: /\bnpm_[a-z0-9A-Z]{36}\b/g,
    sourceRuleId: "npm-access-token"
  },
  {
    id: "jwt",
    description: "JSON Web Token (JWT)",
    regex: /\bey[a-zA-Z0-9]{17,}\.ey[a-zA-Z0-9/\\_-]{17,}\.(?:[a-zA-Z0-9/\\_-]{10,}={0,2})?\b/g,
    sourceRuleId: "jwt"
  },
  {
    id: "azure-connection-secret",
    description: "Azure AD client secret / connection-string-style credential",
    regex: /(?:^|[\s'"`>=:(,])([a-zA-Z0-9_~.]{3}\dQ~[a-zA-Z0-9_~.-]{31,34})/g,
    sourceRuleId: "azure-ad-client-secret"
  },
  {
    id: "generic-high-entropy-assignment",
    description:
      "Generic 'api/auth/credential/secret/token = <value>' assignment — highest false-positive rate of all rules here; frequently matches placeholders, env-var names, and test fixtures. Treat as a lead to review, not a confirmed leak.",
    regex: /[\w.-]{0,50}?(?:access|auth|api|credential|secret|token|passwd|password)[_-]?(?:key|token|secret)?[\x60'"\s=:]{1,5}([\w.=/+-]{16,150})/gi,
    sourceRuleId: "generic-api-key"
  }
];

export interface SecretMatch {
  ruleId: string;
  description: string;
  filePath: string;
  lineNumber: number;
  /** The matched text with all but the first 4 and last 4 characters replaced
   *  by asterisks — never the full secret value. */
  redactedMatch: string;
  fileUrl: string;
}

export interface SecretScanReport {
  repoFullName: string;
  defaultBranch: string;
  totalFilesInTree: number;
  eligibleTextFiles: number;
  filesScanned: number;
  matches: SecretMatch[];
  matchesByRule: Record<string, number>;
  scannedAt: string;
  /** Always present, always the same honest caveat — see module header. */
  falsePositiveWarning: string;
  signatureSource: string;
}

function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i + 1).toLowerCase();
}

function isEligible(path: string, size: number): boolean {
  if (size <= 0 || size > MAX_FILE_BYTES) return false;
  const lower = path.toLowerCase();
  if (SKIP_PATH_SEGMENTS.some((seg) => lower.includes(seg))) return false;
  const baseName = path.split("/").pop() || "";
  if (SKIP_EXACT_NAMES.has(baseName)) return false;
  const ext = extensionOf(path);
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

/** Same spread-out deterministic sampling strategy as code_analyzer.ts, so
 *  large repos get a genuine cross-section instead of just the first N files
 *  the tree API happens to list. */
function sampleFiles<T>(files: T[], max: number): T[] {
  if (files.length <= max) return files;
  const step = files.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i++) picked.push(files[Math.floor(i * step)]);
  return picked;
}

function redact(match: string): string {
  if (match.length <= 10) return match.slice(0, 2) + "*".repeat(Math.max(0, match.length - 2));
  return `${match.slice(0, 4)}${"*".repeat(match.length - 8)}${match.slice(-4)}`;
}

const AUTH_HEADERS = (): Record<string, string> => {
  const h: Record<string, string> = { "User-Agent": "GitHub-Agent-Studio-SecretScanner/1.0", Accept: "application/vnd.github+json" };
  const t = process.env.GITHUB_TOKEN;
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
};

export class SecretScanner {
  public async scanRepoForSecrets(ownerRepoOrUrl: string): Promise<SecretScanReport> {
    const { owner, repo } = parseOwnerRepo(ownerRepoOrUrl);
    const fullName = `${owner}/${repo}`;

    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: AUTH_HEADERS() });
    if (!metaRes.ok) {
      throw new GitHubApiFetchError(metaRes.status, `could not fetch repo metadata for ${fullName}: ${metaRes.status}`);
    }
    const meta = await metaRes.json();
    const branch = meta.default_branch || "main";

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: AUTH_HEADERS() }
    );
    if (!treeRes.ok) {
      throw new GitHubApiFetchError(treeRes.status, `could not fetch file tree for ${fullName}: ${treeRes.status}`);
    }
    const treeData = await treeRes.json();
    const allEntries: { path: string; type: string; size?: number }[] = treeData.tree || [];
    const allFiles = allEntries.filter((e) => e.type === "blob");

    const eligible = allFiles.filter((f) => isEligible(f.path, f.size ?? 0));
    const sample = sampleFiles(eligible, MAX_FILES_TO_SCAN);

    const matches: SecretMatch[] = [];
    const matchesByRule: Record<string, number> = {};
    let filesScanned = 0;

    for (const file of sample) {
      let content: string;
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
        const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        content = await res.text();
      } catch {
        continue; // one unreachable file doesn't fail the whole scan
      }

      filesScanned++;
      const lines = content.split("\n");
      const fileUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        if (line.length > 4000) continue; // minified/bundled line — regex cost without signal
        for (const sig of SECRET_SIGNATURES) {
          sig.regex.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = sig.regex.exec(line)) !== null) {
            const matchedText = m[1] || m[0];
            matches.push({
              ruleId: sig.id,
              description: sig.description,
              filePath: file.path,
              lineNumber: lineIdx + 1,
              redactedMatch: redact(matchedText),
              fileUrl: `${fileUrl}#L${lineIdx + 1}`
            });
            matchesByRule[sig.id] = (matchesByRule[sig.id] || 0) + 1;
            if (m[0].length === 0) sig.regex.lastIndex++; // guard against zero-length infinite loop
          }
        }
      }
      // `content`/`lines` fall out of scope here — nothing about a file's
      // actual text is retained past this iteration, matching code_analyzer.ts's
      // "analyze, don't download" discipline.
    }

    return {
      repoFullName: fullName,
      defaultBranch: branch,
      totalFilesInTree: allFiles.length,
      eligibleTextFiles: eligible.length,
      filesScanned,
      matches: matches.slice(0, 200),
      matchesByRule,
      scannedAt: new Date().toISOString(),
      falsePositiveWarning:
        "Regex-based secret detection has real false positives: example/placeholder keys in docs or tests, revoked keys left in git history, and (especially for the generic-high-entropy rule) non-secret strings that merely look like one. A match means 'shape matches a known secret format' — it does NOT mean a confirmed active leaked credential. Unlike TruffleHog's verified mode, this scanner does not attempt to authenticate with matched credentials.",
      signatureSource:
        "Regex signatures transcribed from gitleaks (github.com/gitleaks/gitleaks, MIT, config/gitleaks.toml) — the same class of pattern used by TruffleHog and GitGuardian as a first detection layer."
    };
  }
}
