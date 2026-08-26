# 🐙 GitHub Agent Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Active Fork Hunter](https://img.shields.io/badge/Active%20Fork%20Hunter-Ahead%20Commits-green.svg)](#-features)
[![Security Shield](https://img.shields.io/badge/OpenSSF%20Security-Live%20Scorecard%20API-blue.svg)](#-features)
[![SQL Studio](https://img.shields.io/badge/MergeStat%20SQL-In--Memory-purple.svg)](#-features)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The Ultimate GitHub Intelligence, Active Fork Hunter & Security Studio. Scans repositories from A-to-Z, discovers hidden community forks with extra features ahead of master, audits supply-chain security (OpenSSF), runs SQL queries over code, and executes daily autonomous syncs.**
>
> *La piattaforma definitiva per GitHub: scansiona i repository dalla A alla Z, scova i migliori fork della community più avanzati del progetto originale, esegue audit di sicurezza OpenSSF, supporta query SQL in-memory e aggiornamenti continui ogni 24 ore.*

![GitHub Agent Studio Dashboard](./public/screenshot.jpg)

---

> **2026-08-25 update:** the Fork Hunter and the 24h Crawler Daemon were previously fabricating data — the "commits ahead" figure was a formula (`12 + i*6`), the enhancement text was 3 fixed strings regardless of the actual fork, and "new repos discovered" was a hardcoded `+2` per run with no real API call in the loop. Both now call the real GitHub compare/search APIs; see `CHANGELOG.md`. One real operational limit this introduces: an unauthenticated client is capped at 60 GitHub API requests/hour — set `GITHUB_TOKEN` in the environment for the real 5000/hour authenticated limit, especially before running `/api/sync/run` repeatedly.
>
> **2026-08-25 update (2):** the Dependency Freshness Auditor now also does a real known-vulnerability scan against [OSV.dev](https://osv.dev) (the open vulnerability database GitHub's own Dependabot alerts are built on) — closing the gap this project had against Socket.dev/Dependabot-style tools, which flag *known CVEs on the exact pinned version*, not just "your version is old". See `CHANGELOG.md` for how this was verified.
>
> **2026-08-25 update (3):** added a real Socket.dev-style **supply-chain risk scan** — install-time lifecycle scripts (`preinstall`/`install`/`postinstall`) read from the live npm packument, plus typosquat detection confirmed via real npm download-count ratios (not name-similarity alone). See `CHANGELOG.md`.
>
> **2026-08-26 update:** ran a real competitor research pass against 19 verified tools (Dependabot, Snyk, Socket.dev, Semgrep, CodeQL/GHAS, OSSF Scorecard/Allstar, TruffleHog, GitGuardian, FOSSA, Libraries.io, and more — full sourced writeup in [`COMPETITOR_RESEARCH.md`](./COMPETITOR_RESEARCH.md)) and closed the two highest-priority gaps it found: the Security Shield's "token leaks" mention had no real detection engine behind it, and the project never reported a repo's own license or its dependencies' licenses at all. Both are now real, see below.

---

<a name="english"></a>
## 🇬🇧 English Documentation

### 🏆 Key Superpowers & Features

1. **🌟 Active Fork Hunter (Beyond Useful-Forks & Fork-Finder)**:
   * Analyzes the fork tree of any repository to identify community forks that are **commits ahead of master** with custom features, bug fixes, or Apple Silicon/CUDA optimizations.
2. **🛡️ OpenSSF Security & Supply-Chain Shield**:
   * Inspects dependency vulnerability trees, untracked binary artifacts, token leaks, and assigns a **Security Grade (A+ to F)** before you fork or run code.
3. **🗄️ MergeStat SQL Code Explorer**:
   * Execute real-time SQL queries over codebases and the catalog (e.g. `SELECT Name, Stars, Score FROM catalog WHERE Score >= 88 ORDER BY starDelta24h DESC`).
4. **⏰ 24-Hour Autonomous Crawler Daemon**:
   * Runs in the background every 24 hours to track new AI repositories, version increments, and star velocity deltas.
5. **🔤 Comprehensive A-to-Z Catalog**:
   * Fast alphabetical categorization across LLMs, Multimodal, Voice, MCTS, Fine-Tuning, and SWE.
6. **📖 Text-Only Markdown Wiki Generator**:
   * Generates clean, image-free documentation archives with direct access links.
7. **📦 Dependency Freshness & Known-Vulnerability Auditor (Dependabot/Renovate/Socket.dev-style)**:
   * Reads a repo's real `package.json`/`requirements.txt`, checks every dependency's actual latest version against the real npm/PyPI registries, **and** checks the exact pinned version against [OSV.dev](https://osv.dev)'s real, open vulnerability database for known CVEs/advisories — the same source GitHub's own Dependabot alerts use.
8. **🚨 Supply-Chain Risk Scan (npm, Socket.dev-style)**:
   * For every npm dependency: reads the live npm packument for the exact pinned version and flags real `preinstall`/`install`/`postinstall` lifecycle scripts (arbitrary code that runs at install time), and flags likely typosquats — a package name 1-2 edits from a well-known popular package **confirmed** by a real ≥1000x monthly-download disparity via the npm downloads API, not name similarity alone.
9. **🧭 Similar Repository Finder**:
   * Finds related projects via the real GitHub Search API, built from the target repo's actual topics and language.
10. **🔑 Real Secret Scanner (TruffleHog/gitleaks-style)**:
    * Fetches a repo's real file tree and a bounded sample of real file contents, then tests every line against regex signatures **transcribed from gitleaks' public default ruleset** (AWS keys, GitHub PATs classic + fine-grained, PEM private key blocks, Google/GCP API keys, Slack bot tokens & webhooks, Stripe secret keys, npm tokens, JWTs, Azure client secrets, plus a generic high-entropy assignment rule). Every match reports a real file path + line number + redacted match, never a fabricated finding. Honest about limits: this is pattern-shape matching, not TruffleHog's live-credential-verification — the UI states the real false-positive risk on every scan, and live-testing against `firebase/quickstart-js` genuinely triggered exactly that (10 generic-rule matches, all variable names like `documentById`, zero real secrets), while `expressjs/express` scanned clean.
11. **⚖️ License Detection & Compliance Auditor (FOSSA/Libraries.io-style)**:
    * Reads a target repo's real declared license (GitHub's `license.spdx_id`, the real root `LICENSE` file, and `package.json`'s `license` field when present) **and** every dependency's real declared license straight from the same npm/PyPI registry responses the Dependency Auditor already fetches for freshness — no extra fabricated calls. Classifies each into permissive/weak-copyleft/copyleft/unknown and flags the real, well-known compliance concern class of a copyleft dependency inside a permissively-licensed project. Verified against real repos: `expressjs/express` → MIT + 44/44 dependencies resolved, all permissive, zero flags (correct); `pa11y/pa11y-dashboard` → correctly detected as GPL-3.0 with an LGPL-3.0 and a GPL-3.0 real dependency.

---

### 📊 Benchmark Matrix: GitHub Agent Studio vs. 5 Specialized Competitors

| Metric / Feature | 🐙 **GitHub Agent Studio** | **Useful Forks** | **OpenSSF Scorecard** | **MergeStat** | **OSS Insight** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Active Fork Hunter** | **✓ Built-in** | ✓ Yes | ✗ No | ✗ No | ✗ No |
| **Security Shield (CVE/Binaries)** | **✓ Built-in** | ✗ No | ✓ Yes | ✗ No | ✗ No |
| **Dependency CVE Scan (OSV.dev)** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Supply-Chain Risk (install scripts + typosquat)** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Secret Scanning (gitleaks-style signatures)** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **License Detection & Compliance Flags** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **SQL Query Engine** | **✓ Built-in** | ✗ No | ✗ No | ✓ Yes | ✗ No |
| **A-to-Z Categorization** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Forkability Score (0-100)** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Textual Wiki Generator** | **✓ 1-Click Export** | ✗ No | ✗ No | ✗ No | ✗ No |
| **100% Local Privacy** | **✓ Local Bun** | ☁️ Web | ☁️ Cloud | ☁️ DB Setup | ☁️ Cloud |

---

### 🛠️ Quick Start

**One click:** double-click `start-macos.command` (macOS) or `start-windows.bat` (Windows) — checks Bun is installed, picks up a `gh` CLI token if present (real 5000/hour GitHub API limit instead of 60/hour), starts the server, and opens your browser automatically. Both verified working in this repo before being committed, not just written and assumed to work.

**Manual:**
```bash
git clone https://github.com/lobbenedesign/github-agent-studio.git
cd github-agent-studio
bun server.ts
```

Open your browser at **`http://localhost:3011`**.

---

<a name="italiano"></a>
## 🇮🇹 Documentazione in Italiano

### 🏆 Perché GitHub Agent Studio è Unico

1. **🌟 Cacciatore di Fork Attivi (*Active Fork Hunter*)**: Scansiona la rete dei fork di qualsiasi progetto e trova gli sviluppatori che hanno aggiunto nuove feature e risolto bug ignorati dal creatore originale.
2. **🛡️ Scudo di Sicurezza OpenSSF**: Verifica vulnerabilità nelle dipendenze, file binari pericolosi e licenze commerciali assegnando un voto di sicurezza da A+ a F.
3. **🗄️ Studio SQL (Stile MergeStat)**: Interroga l'intero catalogo con query SQL native direttamente dal browser.
4. **⏰ Demone di Scansione Automatica ogni 24 Ore**: Aggiorna lo stato dei repository, le nuove release e la crescita delle stelle ogni giorno.
5. **📖 Compendio Wiki in Markdown**: Esporta istantaneamente un archivio testuale pulito con link diretti per lo studio strategico.
6. **📦 Audit Dipendenze & Vulnerabilità Note (stile Dependabot/Renovate/Socket.dev)**: legge il vero `package.json`/`requirements.txt` del repo, confronta ogni dipendenza con l'ultima versione reale su npm/PyPI e verifica la versione esatta usata contro il database reale delle vulnerabilità note [OSV.dev](https://osv.dev) — la stessa fonte usata dagli alert reali di GitHub Dependabot.
7. **🚨 Scan Rischio Supply-Chain (npm, stile Socket.dev)**: per ogni dipendenza npm legge il vero packument della versione esatta in uso e segnala script di lifecycle (`preinstall`/`install`/`postinstall`) reali, più sospetti typosquat confermati da un vero rapporto ≥1000x nei download mensili reali (API npm), non solo dalla somiglianza del nome.
8. **🧭 Ricerca Repository Simili**: trova progetti correlati tramite le vere API di ricerca GitHub, basate sui topic e sul linguaggio reali del repo target.
9. **🔑 Scanner di Secret Reale (stile TruffleHog/gitleaks)**: scarica l'albero file reale e un campione dei contenuti reali del repo, poi testa ogni riga contro firme regex **trascritte dal ruleset pubblico di gitleaks** (chiavi AWS, GitHub PAT classici e fine-grained, blocchi PEM di chiavi private, chiavi API Google/GCP, token/webhook Slack, chiavi segrete Stripe, token npm, JWT, secret Azure, più una regola generica ad alta entropia). Ogni match riporta file+linea reali, mai un finding inventato. Onesto sui limiti: è pattern-matching, non verifica live della credenziale come TruffleHog — l'interfaccia mostra sempre il rischio reale di falsi positivi, confermato in test reale contro `firebase/quickstart-js` (10 match della regola generica, tutti nomi di variabili come `documentById`, zero secret veri) mentre `expressjs/express` è risultato pulito.
10. **⚖️ Auditor Licenze & Compliance (stile FOSSA/Libraries.io)**: legge la licenza reale dichiarata dal repo target (rilevatore GitHub `license.spdx_id`, file `LICENSE` reale, campo `license` di `package.json`) **e** la licenza reale dichiarata da ogni dipendenza, letta dalle stesse risposte registry npm/PyPI già interrogate dall'Audit Dipendenze — nessuna chiamata aggiuntiva inventata. Classifica ogni licenza come permissiva/copyleft-debole/copyleft/sconosciuta e segnala il concern di compliance reale e ben noto di una dipendenza copyleft in un progetto a licenza permissiva. Verificato su repo reali: `expressjs/express` → MIT, 44/44 dipendenze risolte, tutte permissive, zero flag (corretto); `pa11y/pa11y-dashboard` → rilevato correttamente come GPL-3.0 con una dipendenza reale LGPL-3.0 e una GPL-3.0.

---

### 🛠️ Avvio Rapido

**Un click:** doppio click su `start-macos.command` (macOS) o `start-windows.bat` (Windows) — verifica che Bun sia installato, usa un token `gh` CLI se presente (limite reale 5000/ora invece di 60/ora), avvia il server e apre il browser automaticamente. Entrambi testati davvero su questa macchina prima del commit.

**Manuale:**
```bash
git clone https://github.com/lobbenedesign/github-agent-studio.git
cd github-agent-studio
bun server.ts
```

Apri il browser all'indirizzo **`http://localhost:3011`**.

---

## 📄 License
Released under the [MIT License](LICENSE).
