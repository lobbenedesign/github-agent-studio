/**
 * 🐙 GITHUB-AGENT STUDIO CLIENT SCRIPT
 * Handles A-Z Alphabet Filtering, Search, Deep Repo Evaluation,
 * Textual Wiki Markdown Generation, and Competitor Benchmark Matrix.
 */

let activeLetter = "ALL";
let currentWikiMarkdown = "";

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupAlphabetBar();
  setupFilters();
  setupScanner();
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

  const url = new URL("/api/repos/list", window.location.origin);
  if (activeLetter !== "ALL") url.searchParams.set("letter", activeLetter);
  if (category !== "ALL") url.searchParams.set("category", category);
  if (minScore !== "0") url.searchParams.set("minScore", minScore);
  if (search.trim()) url.searchParams.set("q", search.trim());

  try {
    const res = await fetch(url.toString());
    const repos = await res.json();

    document.getElementById("chip-repo-count").textContent = `📚 ${repos.length} Repos Indexed`;

    container.innerHTML = "";
    if (repos.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No repositories found matching filters.</div>`;
      return;
    }

    repos.forEach(r => {
      const isTop = r.scoreCard.totalScore >= 88;
      const card = document.createElement("div");
      card.className = `repo-card ${isTop ? 'repo-card-highlight' : ''}`;
      card.innerHTML = `
        <div class="repo-header">
          <div>
            <div class="repo-title"><a href="${r.url}" target="_blank">${r.name}</a></div>
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
      container.appendChild(card);
    });
  } catch {}
}

function setupFilters() {
  document.getElementById("input-search-query")?.addEventListener("input", debounce(fetchCatalog, 250));
  document.getElementById("select-category-filter")?.addEventListener("change", fetchCatalog);
  document.getElementById("select-score-filter")?.addEventListener("change", fetchCatalog);
}

// 3. Wiki Export
async function fetchWikiArchive() {
  const terminal = document.getElementById("wiki-markdown-preview");
  const btnCopy = document.getElementById("btn-copy-wiki");

  try {
    const res = await fetch("/api/wiki/export");
    const data = await res.json();
    currentWikiMarkdown = data.markdown;
    terminal.textContent = data.markdown;

    btnCopy?.addEventListener("click", () => {
      navigator.clipboard.writeText(currentWikiMarkdown);
      alert("📋 Textual Wiki Markdown copied to clipboard!");
    });
  } catch {}
}

// 4. Scanner
function setupScanner() {
  const btnScan = document.getElementById("btn-run-scan");
  const resultBox = document.getElementById("scan-result-box");

  btnScan?.addEventListener("click", async () => {
    btnScan.textContent = "🔬 Crawling & Evaluating Codebase...";
    try {
      const res = await fetch("/api/repos/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: document.getElementById("input-scan-url").value,
          stars: document.getElementById("input-scan-stars").value,
          forks: document.getElementById("input-scan-forks").value,
          language: document.getElementById("input-scan-lang").value,
          description: document.getElementById("input-scan-desc").value
        })
      });
      const data = await res.json();

      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <strong style="color: #fff; font-size: 14px;">Evaluated: ${data.name} (${data.fullName})</strong><br>
        <span style="color: #4ade80; font-weight: 700; font-size: 13px;">Total Score: ${data.scoreCard.totalScore}/100 [${data.scoreCard.recommendation}]</span><br><br>
        • <strong>Architecture:</strong> ${data.scoreCard.architectureScore}/30<br>
        • <strong>Code Cleanliness:</strong> ${data.scoreCard.codeCleanlinessScore}/25<br>
        • <strong>Community Momentum:</strong> ${data.scoreCard.communityMomentumScore}/25<br>
        • <strong>Local Privacy:</strong> ${data.scoreCard.selfHostabilityScore}/20<br><br>
        <strong>Strategic Rationale:</strong> ${data.scoreCard.strategicRationale}<br>
        <strong>Enhancement Roadmap:</strong><br>
        ${data.scoreCard.suggestedEnhancementRoadmap.map((s) => `• ${s}`).join("<br>")}
      `;

      btnScan.textContent = "🔬 Run Deep Code Evaluation & Add to A-Z Catalog";
      fetchCatalog();
      fetchWikiArchive();
    } catch {
      btnScan.textContent = "🔬 Run Evaluation";
    }
  });
}

// 5. Competitors
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
