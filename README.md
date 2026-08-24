# 🐙 GitHub Agent Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Daemon](https://img.shields.io/badge/24h%20Crawler%20Daemon-Active%20%7C%20Version%20Tracker-green.svg)](#-features)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The Universal A-to-Z GitHub Repository Intelligence, Version Delta Tracker & Daily Daemon. Automatically monitors GitHub every 24 hours for new releases, computes strategic impact scores (0–100), and generates clean text-only Markdown Wiki archives with direct access links.**
>
> *L'intelligenza universale per GitHub con demone di scansione continua a 24 ore: traccia nuove release e versioni, valuta l'impatto strategico del codice (0–100) e genera archivi Wiki testuali in Markdown pulito con link diretti di accesso.*

![GitHub Agent Studio Dashboard](./public/screenshot.jpg)

---

<a name="english"></a>
## 🇬🇧 English Documentation

### 🏆 Why GitHub Agent Studio is the Ultimate Intelligence Platform

1. **⏰ 24-Hour Autonomous Crawler Daemon**:
   * Runs in the background every 24 hours to automatically discover newly trending AI repositories on GitHub and detect new release tags/commits on existing tracked codebases.
2. **🔄 Version & Release Delta Tracker**:
   * Tracks star velocity deltas ($\Delta$ stars / 24h), release versions (e.g. `v1.2.0` $\rightarrow$ `v1.3.0`), and breaking changelogs.
3. **🔤 Comprehensive A-to-Z Categorization**:
   * Indexes and filters repositories alphabetically from A to Z across LLMs, Agents, Vision, Voice, MCTS, and SWE.
4. **🔬 Deep Code & Architecture Evaluator**:
   * Analyzes repo structure, AST complexity, community velocity, and self-hostability to compute an objective **Strategic Score (0–100)** and actionable verdict (`MUST FORK & ENHANCE 🚀`, `HIGH POTENTIAL ⚡`, `MONITOR 👁️`, `IGNORE 🚫`).
5. **📖 Clean Textual Wiki Archive Generator**:
   * Generates structured, image-free Markdown documentation with direct clickable URLs and strategic enhancement roadmaps in one click.
6. **💾 Persistent Local Database**:
   * Saves the catalog to `data/catalog.json` so your intelligence index survives server reboots.

---

### 📊 Benchmark: GitHub Agent Studio vs. Top 5 Competitors

| Metric / Feature | 🐙 **GitHub Agent Studio** | **GitHub Trending** | **OSS Insight** | **GitHunt** | **Awesome Lists** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **24h Autonomous Daemon** | **✓ Built-in** | ✗ No | ✗ No | ✗ Extension only | ✗ Manual |
| **Version & Release Tracker**| **✓ Live Delta** | ✗ Releases only | ✗ Metrics only | ✗ No | ✗ No |
| **A-to-Z Alphabetical Index** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✓ Static text |
| **Deep Code Quality Score**| **✓ Yes (0-100)** | ✗ Stars only | ✗ Metrics only | ✗ Stars only | ✗ No |
| **Forkability Recommendation**| **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Textual Wiki Generator** | **✓ 1-Click Export** | ✗ No | ✗ No | ✗ No | ✗ Manual |
| **100% Local Privacy** | **✓ Local Bun** | ✗ Cloud | ✗ Cloud | ✗ Cloud | ✓ Static |

---

### 🛠️ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/lobbenedesign/github-agent-studio.git
cd github-agent-studio

# 2. Run with Bun
bun server.ts
```

Open your browser at **`http://localhost:3011`**.

---

<a name="italiano"></a>
## 🇮🇹 Documentazione in Italiano

### 🏆 Perché GitHub Agent Studio è Unico

1. **⏰ Demone di Scansione Automatica ogni 24 Ore**: Lavora in background per scansionare costantemente GitHub, individuare nuovi progetti emergenti e rilevare nuovi aggiornamenti di versione dei progetti già archiviati.
2. **🔄 Radar delle Versioni & Delta Changelog**: Monitora il salto di versione (es. da `v1.2` a `v1.3`), le stelle guadagnate nelle ultime 24 ore e le modifiche al codice.
3. **🔤 Classificazione da A a Z con Ordinamento Rapido**: Filtra per lettera alfabetica, per punteggio strategico o per crescita nelle ultime 24 ore.
4. **🔬 Analisi del Codice & Indice di Forkabilità (0-100)**: Legge l'architettura dei file e genera la sintesi in 3 righe (*Cos'è, Come funziona, Verdetto strategico*).
5. **📖 Archivio Wiki Testuale con Link Diretti**: Esporta in un attimo un compendio pulito in Markdown senza immagini per lo studio strategico.

---

### 🛠️ Avvio Rapido

```bash
git clone https://github.com/lobbenedesign/github-agent-studio.git
cd github-agent-studio
bun server.ts
```

Apri il browser all'indirizzo **`http://localhost:3011`**.

---

## 📄 License
Released under the [MIT License](LICENSE).
