/**
 * 🐙 GITHUB-AGENT STUDIO CLIENT SCRIPT
 * Handles A-Z Filtering, Live Sorting, Deep Repo Inspection Modal,
 * Textual Wiki Export, and Live Public GitHub API Scanner.
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
  fetchCatalog();
  fetchWikiArchive();
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
            <div class="repo-title"><a href="${r.url}" target="_blank" onclick="event.stopPropagation()">${r.name}</a></div>
            <div class="repo-author">${r.fullName} • <span style="color: #38bdf8;">${r.category}</span></div>
          </div>
          <span class="repo-badge-score">${r.scoreCard.totalScore}/100</span>
        </div>
        <div class="repo-desc">${r.description}</div>
        <div style="font-size: 11px; color: ${isTop ? '#4ade80' : '#fbbf24'}; font-weight: 600;">
          Verdict: ${r.scoreCard.recommendation}
        </div>
        <div class="repo-meta">
          <span>★ ${r.stars.toLocaleString()} | ⑂ ${r.forks.toLocaleString()}</span>
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

// 3. Modal Details
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
        <span style="font-size: 11px; color: var(--text-muted);">Author: <strong>${r.owner}</strong> • License: <strong>${r.license}</strong> • Issues: <strong>${r.openIssues}</strong></span>
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

// 4. Wiki Export
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

// 5. Scanner
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
    } catch {
      btnScan.textContent = "🔬 Run Evaluation";
    }
  });
}

// 6. Competitors
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
            <th>Deep Code Evaluation</th>
            <th>Forkability Score</th>
            <th>Strategic Roadmap Gen</th>
            <th>1-Click Clone / Fork</th>
            <th>Local Privacy</th>
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
          <td>${c.deepCodeAnalysis ? '✓ Yes' : '✗ No'}</td>
          <td>${c.forkabilityScore ? '✓ Yes (0-100)' : '✗ No'}</td>
          <td>${c.strategicRoadmapGen ? '✓ Yes' : '✗ No'}</td>
          <td>${c.oneClickForkClone ? '✓ Yes' : '✗ No'}</td>
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
