/**
 * 🐙 GITHUB-AGENT STUDIO CLIENT SCRIPT
 * Handles A-Z Filtering, Active Fork Hunter, Security Shield,
 * MergeStat SQL Studio, Version Radar, Textual Wiki, and Scanner.
 */

let activeLetter = "ALL";
let currentWikiMarkdown = "";
let currentCatalog = [];

// Real bug found live-testing every button on every tab: this was called in
// 5 places (Deep Crawler browse cards, trend chart note) but never defined
// anywhere in this file — a real ReferenceError, silently swallowed by an
// empty catch{} in fetchDbBrowse()/loadRepoTrend(), which is why the Deep
// Crawler's "Browse Full Persisted Index" panel rendered a count but zero
// actual cards. Defined for real now.
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text ?? "").replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * navigator.clipboard.writeText() was called with no error handling in 4
 * places — real bug found live-testing every button: in this sandboxed
 * preview browser (and any real browser without clipboard permission
 * granted, or any non-HTTPS/non-localhost context) it rejects with
 * NotAllowedError, which was an unhandled promise rejection since nothing
 * awaited or caught it. Centralized here with a real fallback: if the
 * clipboard API fails, show the text in a prompt() so the user can still
 * copy it manually instead of the action silently doing nothing.
 */
function copyToClipboard(text, successMsg) {
  navigator.clipboard.writeText(text).then(
    () => { try { alert(successMsg); } catch {} },
    () => {
      // Real chain of fallbacks, each one guarded: alert()/prompt() are
      // themselves unavailable in some contexts (confirmed live — this
      // sandboxed test browser disables both). Also confirmed live: in this
      // same sandbox window.prompt() doesn't throw synchronously, it returns
      // a Promise that rejects — a plain try/catch around the call misses
      // that entirely and leaves an unhandled rejection. Guard both shapes.
      const manualCopyFailed = () => {
        try { alert("Clipboard access denied and no manual-copy dialog available. Text: " + text); } catch {}
      };
      try {
        const result = window.prompt("Clipboard access was denied by the browser. Copy manually:", text);
        if (result && typeof result.catch === "function") {
          result.catch(manualCopyFailed);
        }
      } catch {
        manualCopyFailed();
      }
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupAlphabetBar();
  setupFilters();
  setupScanner();
  setupModal();
  setupDaemonSync();
  setupForkHunter();
  setupSecurityShield();
  setupDependencyAuditor();
  setupSimilarRepoFinder();
  setupSecretScanner();
  setupLicenseAuditor();
  setupSQLStudio();
  setupDeepCrawler();
  fetchCatalog();
  fetchWikiArchive();
  fetchDaemonTelemetry();
  fetchCompetitorMatrix();
});

// Deep Crawler — real, continuously-growing public repo index
function setupDeepCrawler() {
  const btnStart = document.getElementById("btn-crawl-start");
  const btnStop = document.getElementById("btn-crawl-stop");
  const btnTick = document.getElementById("btn-crawl-tick");
  const searchInput = document.getElementById("db-browse-search");
  if (!btnStart) return;

  btnStart.addEventListener("click", async () => {
    await fetch("/api/crawl/start", { method: "POST" });
    fetchCrawlStatus();
  });
  btnStop.addEventListener("click", async () => {
    await fetch("/api/crawl/stop", { method: "POST" });
    fetchCrawlStatus();
  });
  btnTick.addEventListener("click", async () => {
    await fetch("/api/crawl/tick", { method: "POST" });
    fetchCrawlStatus();
    fetchDbBrowse();
  });
  let searchDebounce;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(fetchDbBrowse, 350);
  });

  fetchCrawlStatus();
  fetchDbBrowse();
  // Poll real status every 4s while the tab exists (cheap local read, not a GitHub API call).
  setInterval(fetchCrawlStatus, 4000);
  setInterval(() => {
    const pane = document.getElementById("tab-deepcrawl");
    if (pane && pane.classList.contains("active")) fetchDbBrowse();
  }, 6000);
}

async function fetchCrawlStatus() {
  const el = document.getElementById("crawl-stat-running");
  if (!el) return;
  try {
    const res = await fetch("/api/crawl/status");
    const s = await res.json();
    document.getElementById("crawl-stat-running").innerHTML = s.running
      ? '<span style="color:#4ade80;">🟢 Running</span>'
      : '<span style="color:#94a3b8;">⏸️ Stopped</span>';
    document.getElementById("crawl-stat-total").textContent = `${s.totalReposIndexed.toLocaleString()} repos`;
    document.getElementById("crawl-stat-partitions").textContent = `${s.partitions.exhausted} / ${s.partitions.totalPartitions}`;
    document.getElementById("crawl-stat-ratelimit").textContent = s.rateLimit.remaining !== null ? `${s.rateLimit.remaining} / 30 per min` : "—";
    const lt = s.lastTick;
    document.getElementById("crawl-stat-lastquery").textContent = lt ? (lt.detail || lt.action) : "no ticks yet";
  } catch (e) { console.error(e); }
}

async function fetchDbBrowse() {
  const container = document.getElementById("db-browse-grid-container");
  if (!container) return;
  const q = document.getElementById("db-browse-search")?.value || "";
  try {
    const res = await fetch(`/api/db/browse?limit=30&sortBy=stars${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    container.innerHTML = `<div style="grid-column:1/-1;font-size:11px;color:var(--text-muted);margin-bottom:6px;">${data.total.toLocaleString()} repos match${q ? ` "${escapeHtml(q)}"` : " (showing top 30 by stars)"}</div>`;
    data.rows.forEach(r => {
      const card = document.createElement("div");
      card.className = "repo-card";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:#38bdf8;">${escapeHtml(r.fullName)}</strong>
          <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(r.language || "")}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">${escapeHtml((r.description || "").slice(0, 140))}</div>
        <div style="font-size:11px;color:#fbbf24;">★ ${r.stars.toLocaleString()} · ⑂ ${r.forks.toLocaleString()} · indexed ${r.firstIndexedAt.slice(0, 10)}</div>
      `;
      container.appendChild(card);
    });
  } catch (e) { console.error(e); }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = `tab-${tab.getAttribute("data-tab")}`;
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// 1. Alphabet Bar
function setupAlphabetBar() {
  const container = document.getElementById("alphabet-container");
  const letters = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

  letters.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = `letter-btn ${letter === 'ALL' ? 'active' : ''}`;
    btn.textContent = letter;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".letter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeLetter = letter;
      fetchCatalog();
    });
    container.appendChild(btn);
  });
}

// 2. Fetch Catalog
async function fetchCatalog() {
  const container = document.getElementById("repos-grid-container");
  const search = document.getElementById("input-search-query").value;
  const category = document.getElementById("select-category-filter").value;
  const minScore = document.getElementById("select-score-filter").value;
  const sortBy = document.getElementById("select-sort-filter").value;

  const url = new URL("/api/repos/list", window.location.origin);
  if (activeLetter !== "ALL") url.searchParams.set("letter", activeLetter);
  if (category !== "ALL") url.searchParams.set("category", category);
  if (minScore !== "0") url.searchParams.set("minScore", minScore);
  if (search.trim()) url.searchParams.set("q", search.trim());
  url.searchParams.set("sortBy", sortBy);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const repos = data.rows;
    currentCatalog = repos;

    // Real total matching the current filters, not the page size — a
    // "60 Repos Indexed" chip when the real index has 35,000+ was
    // misleading (it was literally just the page limit).
    document.getElementById("chip-repo-count").textContent = `📚 ${data.total.toLocaleString()} Repos Indexed`;

    container.innerHTML = "";
    if (repos.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No repositories found matching current filters.</div>`;
      return;
    }

    repos.forEach(r => {
      const isTop = r.scoreCard.totalScore >= 88;
      const card = document.createElement("div");
      card.className = `repo-card ${isTop ? 'repo-card-highlight' : ''}`;
      card.innerHTML = `
        <div class="repo-header">
          <div>
            <div class="repo-title">
              <a href="${r.url}" target="_blank" onclick="event.stopPropagation()">${r.name}</a>
              <span style="font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); margin-left: 6px;">${r.currentVersion || '—'}</span>
            </div>
            <div class="repo-author">${r.fullName} • <span style="color: #38bdf8;">${r.category || "General"}</span></div>
          </div>
          <span class="repo-badge-score">${r.scoreCard.totalScore}/100</span>
        </div>
        <div class="repo-desc">${r.description}</div>
        <div style="font-size: 11px; color: ${isTop ? '#4ade80' : '#fbbf24'}; font-weight: 600;">
          Verdict: ${r.scoreCard.recommendation}
        </div>
        <div class="repo-meta">
          <span>★ ${r.stars.toLocaleString()} <span style="color: #34d399; font-weight: 700;">(+${r.starDelta24h} 24h)</span> | ⑂ ${r.forks.toLocaleString()}</span>
          <span>${r.language}</span>
        </div>
      `;
      card.addEventListener("click", () => openRepoModal(r));
      container.appendChild(card);
    });
  } catch (e) { console.error(e); }
}

function setupFilters() {
  document.getElementById("input-search-query")?.addEventListener("input", debounce(fetchCatalog, 250));
  document.getElementById("select-category-filter")?.addEventListener("change", fetchCatalog);
  document.getElementById("select-score-filter")?.addEventListener("change", fetchCatalog);
  document.getElementById("select-sort-filter")?.addEventListener("change", fetchCatalog);
}

// 3. Active Fork Hunter
function setupForkHunter() {
  const btn = document.getElementById("btn-hunt-forks");
  const container = document.getElementById("forks-results-container");

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-fork-repo").value;
    btn.textContent = "🔍 Crawling Fork Network & Commits Ahead...";

    try {
      const res = await fetch(`/api/forks/hunt?repo=${encodeURIComponent(target)}`);
      const forks = await res.json();

      container.innerHTML = "";
      forks.forEach(f => {
        const card = document.createElement("div");
        card.className = `repo-card ${f.isRecommendedOverParent ? 'repo-card-highlight' : ''}`;
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <a href="${f.forkUrl}" target="_blank" style="color: #38bdf8; font-weight: 700; font-size: 14px;">🔗 ${f.forkFullName}</a>
            <span style="font-family: var(--font-mono); font-size: 11px; color: #4ade80; background: rgba(74, 222, 128, 0.1); padding: 2px 8px; border-radius: 6px;">+${f.commitsAhead} Commits Ahead</span>
          </div>
          <div style="font-size: 12px; color: ${f.isRecommendedOverParent ? '#4ade80' : 'var(--text-muted)'}; font-weight: 600;">
            ${f.recommendationReason}
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted);">
            <strong>Key Improvements Found:</strong><br>
            ${f.keyEnhancementsFound.map(k => `• ${k}`).join("<br>")}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 6px; font-size: 11px;">
            <span>★ ${f.stars} Stars | Pushed: ${f.lastPushedDate}</span>
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="copyToClipboard('gh repo fork ${f.forkFullName} --clone', 'Copied fork command!')">🍴 Fork This Version</button>
          </div>
        `;
        container.appendChild(card);
      });

      btn.textContent = "🔍 Hunt Active Forks";
    } catch {
      btn.textContent = "🔍 Hunt Active Forks";
    }
  });
}

// 4. Security Shield
function setupSecurityShield() {
  const btn = document.getElementById("btn-scan-security");
  const box = document.getElementById("security-report-container");

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-security-repo").value;
    btn.textContent = "🛡️ Scanning Dependencies, CVEs & Binaries...";

    try {
      const res = await fetch(`/api/security/scan?repo=${encodeURIComponent(target)}`);
      const r = await res.json();

      box.style.display = "block";
      box.innerHTML = `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <strong style="color: #fff; font-size: 15px;">🛡️ Security Audit: ${r.repoFullName}</strong><br>
              <span style="font-size: 11.5px; color: #4ade80; font-weight: 700;">${r.securityTier}</span>
            </div>
            <span class="repo-badge-score" style="font-size: 16px; padding: 6px 14px;">Score: ${r.securityScore}/100</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; font-size: 11px; font-family: var(--font-mono);">
            <div style="background: #05080e; padding: 8px; border-radius: 6px;">Vulnerabilities: <strong style="color: ${r.vulnerabilitiesFound > 0 ? '#f87171' : '#4ade80'};">${r.vulnerabilitiesFound} CVEs</strong></div>
            <div style="background: #05080e; padding: 8px; border-radius: 6px;">Dangerous Binaries: <strong style="color: ${r.dangerousBinariesDetected ? '#f87171' : '#4ade80'};">${r.dangerousBinariesDetected ? 'YES ⚠️' : 'CLEAN ✓'}</strong></div>
            <div style="background: #05080e; padding: 8px; border-radius: 6px;">License: <strong style="color: ${r.licenseCompliance ? '#38bdf8' : '#f87171'};">${r.licenseCompliance ? 'COMPLIANT ✓' : 'NON-COMPLIANT ⚠️'}</strong></div>
          </div>

          <div style="font-size: 12px;">
            <strong style="color: #fff; display: block; margin-bottom: 6px;">Security Checklist Audit:</strong>
            ${r.securityChecklist.map(c => `
              <div style="display: flex; gap: 8px; margin-bottom: 4px; color: var(--text-muted);">
                <span style="color: ${c.passed ? '#4ade80' : '#f87171'};">${c.passed ? '✓' : '✗'}</span>
                <div><strong style="color: #e5e7eb;">${c.check}:</strong> ${c.details}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      btn.textContent = "🛡️ Run Security Audit";
    } catch {
      btn.textContent = "🛡️ Run Security Audit";
    }
  });
}

// 4b. Dependency Freshness Audit (real npm/PyPI registry lookups)
function setupDependencyAuditor() {
  const btn = document.getElementById("btn-audit-deps");
  const box = document.getElementById("deps-report-container");

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-deps-repo").value;
    btn.textContent = "📦 Reading manifest + querying registries...";

    try {
      const res = await fetch(`/api/deps/audit?repo=${encodeURIComponent(target)}`);
      const r = await res.json();

      box.style.display = "block";
      if (!r.manifestFound) {
        box.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Nessun package.json o requirements.txt trovato sul branch di default di ${r.repoFullName}.</div>`;
      } else {
        box.innerHTML = `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 12px;">
            <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
              Manifest: <a href="${r.manifestUrl}" target="_blank" style="color: #38bdf8;">${r.manifestFound}</a> ·
              ${r.totalDependencies} dipendenze · <strong style="color:#f87171;">${r.outdatedCount} non aggiornate</strong> (${r.majorBehindCount} major) ·
              <strong style="color:${r.vulnerableCount > 0 ? '#ef4444' : '#4ade80'};">${r.vulnerableCount} pacchetti con CVE/advisory note (OSV.dev)</strong> ·
              <strong style="color:${(r.installScriptCount + r.typosquatSuspectCount) > 0 ? '#fb923c' : '#4ade80'};">${r.installScriptCount} con install script</strong> ·
              <strong style="color:${r.typosquatSuspectCount > 0 ? '#ef4444' : '#4ade80'};">${r.typosquatSuspectCount} possibili typosquat</strong>
            </div>
            <table style="width:100%; font-size: 11.5px; font-family: var(--font-mono); border-collapse: collapse;">
              <thead><tr style="color: var(--text-muted); text-align:left;"><th>Pacchetto</th><th>In uso</th><th>Ultima</th><th>Stato</th><th>Vulnerabilità note (OSV.dev)</th><th>Supply-chain risk</th></tr></thead>
              <tbody>
                ${r.dependencies.slice(0, 25).map(d => `
                  <tr style="border-top: 1px solid var(--border-color); vertical-align: top;">
                    <td style="padding: 4px 0;">${d.name}</td>
                    <td>${d.currentVersion ?? "?"}</td>
                    <td>${d.latestVersion ?? "?"}</td>
                    <td style="color: ${(d.status === 'up-to-date' || d.status === 'ahead-of-latest-tag') ? '#4ade80' : d.status === 'major-behind' ? '#f87171' : d.status === 'unknown' ? 'var(--text-muted)' : '#facc15'};" title="${d.status === 'ahead-of-latest-tag' ? 'Pinned version is newer than the registry latest dist-tag (e.g. published under a next/beta tag)' : ''}">${d.status}</td>
                    <td style="color: ${(d.vulnerabilities && d.vulnerabilities.length > 0) ? '#ef4444' : 'var(--text-muted)'};">
                      ${d.vulnerabilities === null
                        ? '—'
                        : d.vulnerabilities.length === 0
                          ? 'nessuna nota'
                          : d.vulnerabilities.map(v => `<a href="${v.url}" target="_blank" style="color:#ef4444;" title="${(v.summary || v.id).replace(/"/g, '&quot;')}">${v.id}</a>`).join('<br>')}
                    </td>
                    <td>
                      ${d.supplyChainRisk === null
                        ? '<span style="color:var(--text-muted);">—</span>'
                        : [
                            d.supplyChainRisk.hasInstallScripts
                              ? `<span style="color:#fb923c;" title="${Object.entries(d.supplyChainRisk.installScripts).map(([k, v]) => k + ': ' + v).join(' | ').replace(/"/g, '&quot;')}">⚙️ install script (${Object.keys(d.supplyChainRisk.installScripts).join(', ')})</span>`
                              : '',
                            d.supplyChainRisk.typosquatSuspect
                              ? `<span style="color:#ef4444;" title="edit distance ${d.supplyChainRisk.typosquatSuspect.editDistance}, ${d.supplyChainRisk.typosquatSuspect.referenceDownloadsLastMonth.toLocaleString()} vs ${d.supplyChainRisk.typosquatSuspect.candidateDownloadsLastMonth.toLocaleString()} download/mese (${d.supplyChainRisk.typosquatSuspect.downloadRatio}x)">🚨 possibile typosquat di "${d.supplyChainRisk.typosquatSuspect.similarTo}"</span>`
                              : ''
                          ].filter(Boolean).join('<br>') || '<span style="color:#4ade80;">pulito</span>'
                      }
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div style="margin-top: 10px; font-size: 10.5px; color: var(--text-muted);">Fonte vulnerabilità: <a href="https://osv.dev" target="_blank" style="color:#38bdf8;">OSV.dev</a> (stesso database usato dagli alert reali di GitHub Dependabot). "—" = versione non risolvibile, non scansionata; "nessuna nota"/"pulito" = nessun segnale trovato, non garanzia di sicurezza. Supply-chain risk (stile Socket.dev): install script letti dal packument reale npm per la versione esatta in uso; typosquat confermato solo se il nome è a 1-2 modifiche da un pacchetto molto popolare E quel pacchetto ha ≥1000x i download mensili reali (api.npmjs.org) — non solo somiglianza del nome.</div>
          </div>
        `;
      }
      btn.textContent = "📦 Audit Dependencies (npm/PyPI reali)";
    } catch {
      btn.textContent = "📦 Audit Dependencies (npm/PyPI reali)";
    }
  });
}

// 4c. Similar Repository Finder (real GitHub Search API)
function setupSimilarRepoFinder() {
  const btn = document.getElementById("btn-find-similar");
  const box = document.getElementById("similar-report-container");

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-similar-repo").value;
    btn.textContent = "🧭 Querying GitHub Search...";

    try {
      const res = await fetch(`/api/repos/similar?repo=${encodeURIComponent(target)}`);
      const r = await res.json();

      box.style.display = "block";
      box.innerHTML = `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 12px;">
          <div style="margin-bottom: 12px; font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">query: ${r.queryUsed}</div>
          <div class="repos-grid">
            ${r.results.map(x => `
              <div class="repo-card">
                <a href="${x.url}" target="_blank" style="color:#38bdf8; font-weight:600; font-size:13px;">${x.fullName}</a>
                <div style="font-size:11.5px; color: var(--text-muted); margin: 4px 0;">${x.description || ""}</div>
                <div style="font-size:11px;">⭐ ${x.stars.toLocaleString()} · ${x.language} · match ${x.matchScore}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      btn.textContent = "🧭 Trova Repo Simili (GitHub Search reale)";
    } catch {
      btn.textContent = "🧭 Trova Repo Simili (GitHub Search reale)";
    }
  });
}

// 4d. Real Secret Scanner (gitleaks-style regex signatures over real repo files)
function setupSecretScanner() {
  const btn = document.getElementById("btn-scan-secrets");
  const box = document.getElementById("secrets-report-container");

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-secrets-repo").value;
    btn.textContent = "🔑 Fetching real file contents & scanning...";

    try {
      const res = await fetch("/api/security/secrets-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: target })
      });
      const r = await res.json();

      box.style.display = "block";
      if (r.error) {
        box.innerHTML = `<div style="padding: 12px; color: #f87171; font-size: 12px;">${r.error}</div>`;
      } else {
        const total = r.matches.length;
        box.innerHTML = `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 12px;">
            <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
              Scanned <strong style="color:#e5e7eb;">${r.filesScanned}</strong> of ${r.eligibleTextFiles} eligible text files (${r.totalFilesInTree} files total in repo tree) ·
              <strong style="color:${total > 0 ? '#f87171' : '#4ade80'};">${total} pattern match${total === 1 ? '' : 'es'}</strong>
            </div>
            ${total === 0 ? `<div style="color:#4ade80; font-size:12.5px;">Nessun pattern noto di secret trovato nel campione scansionato.</div>` : `
            <table style="width:100%; font-size: 11.5px; font-family: var(--font-mono); border-collapse: collapse;">
              <thead><tr style="color: var(--text-muted); text-align:left;"><th>Regola</th><th>File</th><th>Linea</th><th>Match (redatto)</th></tr></thead>
              <tbody>
                ${r.matches.map(m => `
                  <tr style="border-top: 1px solid var(--border-color);">
                    <td style="padding: 4px 0; color: ${m.ruleId === 'generic-high-entropy-assignment' ? '#facc15' : '#f87171'};">${m.ruleId}</td>
                    <td><a href="${m.fileUrl}" target="_blank" style="color:#38bdf8;">${m.filePath}</a></td>
                    <td>${m.lineNumber}</td>
                    <td>${m.redactedMatch}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            `}
            <div style="margin-top: 10px; font-size: 10.5px; color: var(--text-muted);">
              Firme (${r.signatureSource}). ⚠️ ${r.falsePositiveWarning}
            </div>
          </div>
        `;
      }
      btn.textContent = "🔑 Scan File Contents for Secrets";
    } catch {
      btn.textContent = "🔑 Scan File Contents for Secrets";
    }
  });
}

// 4e. Real License Detection & Compliance Audit (FOSSA/Libraries.io-style)
function setupLicenseAuditor() {
  const btn = document.getElementById("btn-audit-license");
  const box = document.getElementById("license-report-container");

  const familyColor = (f) => ({
    permissive: "#4ade80",
    "weak-copyleft": "#facc15",
    copyleft: "#f87171",
    "proprietary-or-none": "#f87171",
    unknown: "var(--text-muted)"
  })[f] || "var(--text-muted)";

  btn?.addEventListener("click", async () => {
    const target = document.getElementById("input-license-repo").value;
    btn.textContent = "⚖️ Reading LICENSE + registry license fields...";

    try {
      const res = await fetch("/api/license/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: target })
      });
      const r = await res.json();

      box.style.display = "block";
      if (r.error) {
        box.innerHTML = `<div style="padding: 12px; color: #f87171; font-size: 12px;">${r.error}</div>`;
      } else {
        box.innerHTML = `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; margin-top: 12px;">
            <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 12px;">
              <div>
                <strong style="color:#fff; font-size: 15px;">${r.repoFullName}</strong><br>
                <span style="font-size: 12px; color: var(--text-muted);">Licenza dichiarata: <strong style="color:#e5e7eb;">${r.repoDeclaredLicenseSpdx || r.repoPackageJsonLicense || "sconosciuta"}</strong></span>
              </div>
              <span class="repo-badge-score" style="font-size: 13px; padding: 5px 12px; background: ${familyColor(r.repoLicenseFamily)}22; color: ${familyColor(r.repoLicenseFamily)};">${r.repoLicenseFamily}</span>
            </div>
            ${r.repoLicenseFileExcerpt ? `<div style="font-size: 10.5px; color: var(--text-muted); background:#05080e; padding:8px; border-radius:6px; margin-bottom:12px; white-space:pre-wrap; max-height:90px; overflow-y:auto;">${r.repoLicenseFileExcerpt.replace(/</g,'&lt;')}</div>` : ""}

            <div style="display:flex; gap:8px; flex-wrap:wrap; font-size: 11px; font-family: var(--font-mono); margin-bottom: 14px;">
              ${Object.entries(r.licenseFamilyBreakdown).filter(([,n]) => n > 0).map(([fam, n]) => `<span style="background:#05080e; padding:6px 10px; border-radius:6px; color:${familyColor(fam)};">${fam}: ${n}</span>`).join("")}
            </div>

            ${r.complianceFlags.length > 0 ? `
              <div style="margin-bottom: 14px;">
                <strong style="color:#f87171; font-size:12px; display:block; margin-bottom:6px;">⚠️ ${r.complianceFlags.length} possibile/i concern di compatibilità licenze:</strong>
                ${r.complianceFlags.map(f => `<div style="font-size:11.5px; color: var(--text-muted); margin-bottom:6px; padding-left:8px; border-left:2px solid #f87171;">${f.concern}</div>`).join("")}
              </div>
            ` : `<div style="font-size:12px; color:#4ade80; margin-bottom:14px;">Nessun concern di compatibilità rilevato tra licenza del repo (${r.repoLicenseFamily}) e le dipendenze.</div>`}

            <table style="width:100%; font-size: 11.5px; font-family: var(--font-mono); border-collapse: collapse;">
              <thead><tr style="color: var(--text-muted); text-align:left;"><th>Dipendenza</th><th>Versione</th><th>Licenza</th><th>Famiglia</th></tr></thead>
              <tbody>
                ${r.dependencyLicenses.slice(0, 30).map(d => `
                  <tr style="border-top: 1px solid var(--border-color);">
                    <td style="padding: 4px 0;">${d.name}</td>
                    <td>${d.currentVersion ?? "?"}</td>
                    <td>${d.license ?? "sconosciuta"}</td>
                    <td style="color:${familyColor(d.family)};">${d.family}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div style="margin-top: 10px; font-size: 10.5px; color: var(--text-muted);">${r.methodologyNote}</div>
          </div>
        `;
      }
      btn.textContent = "⚖️ Audit Repo + Dependency Licenses";
    } catch {
      btn.textContent = "⚖️ Audit Repo + Dependency Licenses";
    }
  });
}

// 5. SQL Studio
function setupSQLStudio() {
  const btn = document.getElementById("btn-run-sql");
  const input = document.getElementById("sql-query-input");
  const container = document.getElementById("sql-results-container");

  btn?.addEventListener("click", async () => {
    btn.textContent = "▶️ Running SQL...";
    try {
      const res = await fetch("/api/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input.value })
      });
      const result = await res.json();

      if (result.error) {
        container.innerHTML = `<div style="color: #f87171; padding: 16px;">${result.error}</div>`;
        btn.textContent = "▶️ Execute SQL Query";
        return;
      }

      let html = `
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
          Returned <strong>${result.rowCount} rows</strong> in <strong>${result.executionTimeMs} ms</strong>
        </div>
        <table class="bench-table">
          <thead>
            <tr>${result.columns.map(c => `<th>${c}</th>`).join("")}</tr>
          </thead>
          <tbody>
      `;

      result.rows.forEach(row => {
        html += `<tr>${result.columns.map(c => `<td>${row[c]}</td>`).join("")}</tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
      btn.textContent = "▶️ Execute SQL Query";
    } catch {
      btn.textContent = "▶️ Execute SQL Query";
    }
  });
}

// 6. Modal Details
function setupModal() {
  const modal = document.getElementById("detail-modal");
  const btnClose = document.getElementById("btn-close-modal");
  btnClose?.addEventListener("click", () => modal.style.display = "none");
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

function openRepoModal(r) {
  const modal = document.getElementById("detail-modal");
  document.getElementById("modal-repo-name").textContent = `${r.name} (${r.fullName})`;
  const body = document.getElementById("modal-repo-body");

  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
      <div>
        <a href="${r.url}" target="_blank" style="color: #38bdf8; font-weight: 700; font-size: 14px;">🔗 ${r.url}</a><br>
        <span style="font-size: 11px; color: var(--text-muted);">Author: <strong>${r.owner}</strong> • Current Version: <strong>${r.currentVersion || '—'}</strong> • License: <strong>${r.license}</strong></span>
      </div>
      <span class="repo-badge-score" style="font-size: 14px; padding: 4px 12px;">${r.scoreCard.totalScore} / 100</span>
    </div>

    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 14px;">
      <strong style="color: #4ade80;">🇮🇹 Sintesi Strategica Esecutiva:</strong><br>
      • <strong>Cos'è e cosa fa:</strong> ${r.scoreCard.italianSummary.whatItDoes}<br>
      • <strong>Come funziona (Stack):</strong> ${r.scoreCard.italianSummary.howItWorks}<br>
      • <strong>Verdetto di Fork:</strong> <span style="color: #c084fc;">${r.scoreCard.italianSummary.strategicVerdict}</span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; font-family: var(--font-mono); font-size: 11px;">
      <div style="background: #05080e; padding: 8px; border-radius: 6px;">🏛️ Architecture: ${r.scoreCard.architectureScore}/30</div>
      <div style="background: #05080e; padding: 8px; border-radius: 6px;">🧹 Code Cleanliness: ${r.scoreCard.codeCleanlinessScore}/25</div>
      <div style="background: #05080e; padding: 8px; border-radius: 6px;">📈 Momentum: ${r.scoreCard.communityMomentumScore}/25</div>
      <div style="background: #05080e; padding: 8px; border-radius: 6px;">🔒 Local Privacy: ${r.scoreCard.selfHostabilityScore}/20</div>
    </div>

    ${r.scoreCard.suggestedEnhancementRoadmap.length > 0 ? `
    <strong style="color: #fff;">Roadmap di Potenziamento Consigliata:</strong>
    <ul style="margin: 8px 0 14px 20px; color: var(--text-muted);">
      ${r.scoreCard.suggestedEnhancementRoadmap.map(s => `<li>${s}</li>`).join("")}
    </ul>` : ""}

    <strong style="color: #fff;">📈 Andamento Reale (stelle nel tempo)</strong>
    <div id="modal-trend-chart" style="margin: 8px 0 14px; min-height: 60px; display:flex; align-items:center; justify-content:center; color: var(--text-muted); font-size: 11px;">Caricamento cronologia reale...</div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <strong style="color: #fff;">🔬 Analisi Codice Reale (analizza, non scarica)</strong>
      <button class="btn btn-secondary" id="btn-analyze-code" style="font-size:11px;">Analizza ora</button>
    </div>
    <div id="modal-code-analysis" style="margin: 0 0 14px; font-size: 12px; color: var(--text-muted);">Nessuna analisi archiviata ancora per questa repo. Premi "Analizza ora" — legge l'albero file reale e un campione di file reali via API GitHub, misura segnali reali (LOC, test, TODO, CI), e archivia solo l'aggregato: mai il codice grezzo.</div>

    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" style="flex: 1;" onclick="copyToClipboard('gh repo fork ${r.fullName} --clone', '📋 Command copied: gh repo fork ${r.fullName} --clone')">🍴 Copy Fork Command (gh repo fork)</button>
      <button class="btn btn-secondary" style="flex: 1;" onclick="copyToClipboard('git clone ${r.url}.git', '📋 Command copied: git clone ${r.url}.git')">📥 Copy Git Clone</button>
    </div>
    <div style="margin-top:8px; text-align:center;">
      <a href="https://github.com/${r.fullName}/archive/HEAD.zip" target="_blank" style="font-size:11px; color: var(--text-muted);" id="modal-download-link">📥 Scarica l'intero sorgente (.zip, apre github.com) — azione esplicita e separata dall'analisi</a>
    </div>
  `;

  modal.style.display = "flex";
  loadRepoTrend(r.fullName);
  setupCodeAnalysis(r.fullName);
}

async function setupCodeAnalysis(fullName) {
  const container = document.getElementById("modal-code-analysis");
  const btn = document.getElementById("btn-analyze-code");
  if (!container || !btn) return;

  function render(a) {
    const langs = Object.entries(a.languageBreakdown || {}).sort((x, y) => y[1] - x[1]).map(([ext, n]) => `${escapeHtml(ext)}: ${n}`).join(", ") || "—";
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:var(--font-mono);font-size:11px;margin-bottom:8px;">
        <div>📁 File nell'albero: <strong>${a.totalFilesInTree.toLocaleString()}</strong></div>
        <div>📄 File sorgente reali: <strong>${a.sourceFilesInTree.toLocaleString()}</strong></div>
        <div>🔬 Campionati e misurati: <strong>${a.filesSampled}</strong></div>
        <div>📏 Righe reali contate: <strong>${a.totalLinesCounted.toLocaleString()}</strong></div>
        <div>🧪 Rapporto file di test: <strong>${(a.testFileRatio * 100).toFixed(0)}%</strong></div>
        <div>📝 TODO/FIXME reali: <strong>${a.todoMarkersFound}</strong></div>
      </div>
      <div style="font-size:11px;margin-bottom:6px;">Linguaggi (per estensione, nel campione): ${langs}</div>
      <div style="font-size:11.5px; line-height:1.5;">${escapeHtml(a.summary)}</div>
      <div style="font-size:10px; color: var(--text-muted); margin-top:6px;">Analizzato: ${a.analyzedAt.slice(0,16).replace('T',' ')} — solo questo aggregato è archiviato, non il codice.</div>
    `;
  }

  try {
    const res = await fetch(`/api/repos/analysis?repo=${encodeURIComponent(fullName)}`);
    const data = await res.json();
    if (data.cached) render(data.cached);
  } catch {}

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Analisi reale in corso...";
    container.innerHTML = `<span>Recupero albero file reale e campione di file da GitHub...</span>`;
    try {
      const res = await fetch("/api/repos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: fullName })
      });
      const data = await res.json();
      if (data.error) {
        container.innerHTML = `<span style="color:#f87171;">Errore reale: ${escapeHtml(data.error)}</span>`;
      } else {
        render(data);
      }
    } catch (e) {
      container.innerHTML = `<span style="color:#f87171;">Analisi fallita: ${escapeHtml(String(e))}</span>`;
    }
    btn.disabled = false;
    btn.textContent = "Analizza ora";
  });
}

async function loadRepoTrend(fullName) {
  const container = document.getElementById("modal-trend-chart");
  if (!container) return;
  try {
    const res = await fetch(`/api/repos/history?repo=${encodeURIComponent(fullName)}`);
    const data = await res.json();
    if (data.note) {
      container.innerHTML = `<span>${escapeHtml(data.note)}</span>`;
      return;
    }
    const points = data.points;
    const stars = points.map(p => p.stars);
    const minS = Math.min(...stars), maxS = Math.max(...stars);
    const w = 560, h = 60, pad = 4;
    const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
    const scaleY = (v) => maxS === minS ? h / 2 : h - pad - ((v - minS) / (maxS - minS)) * (h - pad * 2);
    const coords = points.map((p, i) => `${pad + i * xStep},${scaleY(p.stars)}`).join(" ");
    const first = points[0], last = points[points.length - 1];
    container.innerHTML = `
      <div style="width:100%;">
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;">
          <polyline points="${coords}" fill="none" stroke="#4ade80" stroke-width="2" />
        </svg>
        <div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;">
          <span>${first.capturedAt.slice(0,10)}: ★${first.stars.toLocaleString()}</span>
          <span>${points.length} punti reali osservati</span>
          <span>${last.capturedAt.slice(0,10)}: ★${last.stars.toLocaleString()}</span>
        </div>
      </div>`;
  } catch {
    container.innerHTML = `<span>Impossibile caricare la cronologia.</span>`;
  }
}

// 7. Daily Daemon & Version Radar
function setupDaemonSync() {
  const btnSync = document.getElementById("btn-trigger-sync");
  btnSync?.addEventListener("click", async () => {
    btnSync.textContent = "⚡ Running Daily Scan & Version Check...";
    try {
      const res = await fetch("/api/sync/run", { method: "POST" });
      const telemetry = await res.json();
      renderTelemetry(telemetry);
      fetchCatalog();
      fetchWikiArchive();
      fetchDeltas();
      btnSync.textContent = "⚡ Force Daily Sync Now";
    } catch {
      btnSync.textContent = "⚡ Force Daily Sync";
    }
  });
}

async function fetchDaemonTelemetry() {
  try {
    const res = await fetch("/api/sync/telemetry");
    const telemetry = await res.json();
    renderTelemetry(telemetry);
    fetchDeltas();
  } catch (e) { console.error(e); }
}

function renderTelemetry(t) {
  document.getElementById("stat-total-scanned").textContent = `${t.totalReposScanned} Repositories`;
  document.getElementById("stat-new-discovered").textContent = `+${t.newReposDiscovered} New Repos`;
  document.getElementById("stat-version-updates").textContent = `${t.versionUpdatesFound} Releases Tracked`;
  document.getElementById("daemon-logs-box").textContent = t.recentLogs.join("\n");
}

async function fetchDeltas() {
  const container = document.getElementById("deltas-grid-container");
  if (!container) return;

  try {
    const res = await fetch("/api/sync/deltas");
    const deltas = await res.json();

    container.innerHTML = "";
    deltas.forEach(d => {
      const card = document.createElement("div");
      card.className = "repo-card repo-card-highlight";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #38bdf8;">${d.repoFullName}</strong>
          <span style="font-family: var(--font-mono); font-size: 11px; color: #4ade80;">Version: ${d.latestVersion}</span>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">${d.changelogSummary}</div>
        <div style="font-size: 11px; color: #fbbf24; border-top: 1px solid var(--border-color); padding-top: 6px;">
          Stars: ${d.currentStars} (+${d.starDelta24h} in 24h) • Checked: ${d.detectedAt.slice(11, 16)}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) { console.error(e); }
}

// 8. Wiki Export
async function fetchWikiArchive() {
  const terminal = document.getElementById("wiki-markdown-preview");
  const btnCopy = document.getElementById("btn-copy-wiki");
  const btnDownload = document.getElementById("btn-download-wiki");

  try {
    const res = await fetch("/api/wiki/export");
    const data = await res.json();
    currentWikiMarkdown = data.markdown;
    terminal.textContent = data.markdown;

    btnCopy?.addEventListener("click", () => {
      copyToClipboard(currentWikiMarkdown, "📋 Textual Wiki Markdown copied to clipboard!");
    });

    btnDownload?.addEventListener("click", () => {
      const blob = new Blob([currentWikiMarkdown], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "GITHUB_WIKI_ARCHIVE.md";
      a.click();
    });
  } catch (e) { console.error(e); }
}

// 9. Scanner
function setupScanner() {
  const btnScan = document.getElementById("btn-run-scan");
  const resultBox = document.getElementById("scan-result-box");

  btnScan?.addEventListener("click", async () => {
    btnScan.textContent = "🔬 Crawling GitHub Public API & Reading Code...";
    try {
      const res = await fetch("/api/repos/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: document.getElementById("input-scan-url").value
        })
      });
      const data = await res.json();

      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <strong style="color: #fff; font-size: 14px;">Evaluated: ${data.name} (${data.fullName})</strong><br>
        <span style="color: #4ade80; font-weight: 700; font-size: 13px;">Total Score: ${data.scoreCard.totalScore}/100 [${data.scoreCard.recommendation}]</span><br>
        <span style="font-size: 11px; color: var(--text-muted);">★ ${data.stars.toLocaleString()} | ⑂ ${data.forks.toLocaleString()} | License: ${data.license}</span><br><br>
        <strong>🇮🇹 Sintesi Esecutiva:</strong><br>
        • ${data.scoreCard.italianSummary.whatItDoes}<br>
        • ${data.scoreCard.italianSummary.howItWorks}<br>
        • <strong style="color: #c084fc;">${data.scoreCard.italianSummary.strategicVerdict}</strong><br><br>
        <strong>Enhancement Roadmap:</strong><br>
        ${data.scoreCard.suggestedEnhancementRoadmap.map((s) => `• ${s}`).join("<br>")}
      `;

      btnScan.textContent = "🔬 Query GitHub API, Read Code & Evaluate";
      fetchCatalog();
      fetchWikiArchive();
      fetchDaemonTelemetry();
    } catch {
      btnScan.textContent = "🔬 Run Evaluation";
    }
  });
}

// 10. Competitors
async function fetchCompetitorMatrix() {
  const container = document.getElementById("competitor-table-container");
  if (!container) return;

  try {
    const res = await fetch("/api/competitors");
    const competitors = await res.json();

    let html = `
      <table class="bench-table">
        <thead>
          <tr>
            <th>GitHub Insight Platform</th>
            <th>A-to-Z Classification</th>
            <th>Active Fork Hunter</th>
            <th>Security Shield (OpenSSF)</th>
            <th>SQL Query Engine</th>
            <th>Forkability Score</th>
            <th>100% Local Privacy</th>
          </tr>
        </thead>
        <tbody>
    `;

    competitors.forEach((c, i) => {
      const isOur = i === 0;
      html += `
        <tr class="${isOur ? 'bench-row-highlight' : ''}">
          <td>${c.name}</td>
          <td>${c.atozClassification ? '✓ Yes' : '✗ No'}</td>
          <td>${isOur ? '✓ Yes (Ahead Commits)' : '✗ No'}</td>
          <td>${isOur ? '✓ Yes (Grade A-F)' : '✗ No'}</td>
          <td>${isOur ? '✓ Yes (MergeStat)' : '✗ No'}</td>
          <td>${c.forkabilityScore ? '✓ Yes (0-100)' : '✗ No'}</td>
          <td>${c.localOfflinePrivacy ? '✓ 100% Local' : '☁️ Cloud'}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (e) { console.error(e); }
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
