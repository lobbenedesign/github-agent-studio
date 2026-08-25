/**
 * 🐙 GITHUB-AGENT STUDIO CLIENT SCRIPT
 * Handles A-Z Filtering, Active Fork Hunter, Security Shield,
 * MergeStat SQL Studio, Version Radar, Textual Wiki, and Scanner.
 */

let activeLetter = "ALL";
let currentWikiMarkdown = "";
let currentCatalog = [];

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupAlphabetBar();
  setupFilters();
  setupScanner();
  setupModal();
  setupDaemonSync();
  setupForkHunter();
  setupSecurityShield();
  setupSQLStudio();
  fetchCatalog();
  fetchWikiArchive();
  fetchDaemonTelemetry();
  fetchCompetitorMatrix();
});

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
    const repos = await res.json();
    currentCatalog = repos;

    document.getElementById("chip-repo-count").textContent = `📚 ${repos.length} Repos Indexed`;

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
              <span style="font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); margin-left: 6px;">${r.currentVersion || 'v1.0'}</span>
            </div>
            <div class="repo-author">${r.fullName} • <span style="color: #38bdf8;">${r.category}</span></div>
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
  } catch {}
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
            <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="navigator.clipboard.writeText('gh repo fork ${f.forkFullName} --clone'); alert('Copied fork command!')">🍴 Fork This Version</button>
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
        <span style="font-size: 11px; color: var(--text-muted);">Author: <strong>${r.owner}</strong> • Current Version: <strong>${r.currentVersion || 'v1.0'}</strong> • License: <strong>${r.license}</strong></span>
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

    <strong style="color: #fff;">Roadmap di Potenziamento Consigliata:</strong>
    <ul style="margin: 8px 0 14px 20px; color: var(--text-muted);">
      ${r.scoreCard.suggestedEnhancementRoadmap.map(s => `<li>${s}</li>`).join("")}
    </ul>

    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" style="flex: 1;" onclick="navigator.clipboard.writeText('gh repo fork ${r.fullName} --clone'); alert('📋 Command copied: gh repo fork ${r.fullName} --clone')">🍴 Copy Fork Command (gh repo fork)</button>
      <button class="btn btn-secondary" style="flex: 1;" onclick="navigator.clipboard.writeText('git clone ${r.url}.git'); alert('📋 Command copied: git clone ${r.url}.git')">📥 Copy Git Clone</button>
    </div>
  `;

  modal.style.display = "flex";
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
  } catch {}
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
  } catch {}
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
      navigator.clipboard.writeText(currentWikiMarkdown);
      alert("📋 Textual Wiki Markdown copied to clipboard!");
    });

    btnDownload?.addEventListener("click", () => {
      const blob = new Blob([currentWikiMarkdown], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "GITHUB_WIKI_ARCHIVE.md";
      a.click();
    });
  } catch {}
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
  } catch {}
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
