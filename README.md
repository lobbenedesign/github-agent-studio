# 🐙 GitHub Agent Studio

[![Bun](https://img.shields.io/badge/Bun-v1.4+-black.svg?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Active Fork Hunter](https://img.shields.io/badge/Active%20Fork%20Hunter-Ahead%20Commits-green.svg)](#-features)
[![Security Shield](https://img.shields.io/badge/OpenSSF%20Security-Grade%20A%2B-blue.svg)](#-features)
[![SQL Studio](https://img.shields.io/badge/MergeStat%20SQL-In--Memory-purple.svg)](#-features)

[English 🇬🇧](#english) • [Italiano 🇮🇹](#italiano)

> **The Ultimate GitHub Intelligence, Active Fork Hunter & Security Studio. Scans repositories from A-to-Z, discovers hidden community forks with extra features ahead of master, audits supply-chain security (OpenSSF), runs SQL queries over code, and executes daily autonomous syncs.**
>
> *La piattaforma definitiva per GitHub: scansiona i repository dalla A alla Z, scova i migliori fork della community più avanzati del progetto originale, esegue audit di sicurezza OpenSSF, supporta query SQL in-memory e aggiornamenti continui ogni 24 ore.*

![GitHub Agent Studio Dashboard](./public/screenshot.jpg)

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

---

### 📊 Benchmark Matrix: GitHub Agent Studio vs. 5 Specialized Competitors

| Metric / Feature | 🐙 **GitHub Agent Studio** | **Useful Forks** | **OpenSSF Scorecard** | **MergeStat** | **OSS Insight** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Active Fork Hunter** | **✓ Built-in** | ✓ Yes | ✗ No | ✗ No | ✗ No |
| **Security Shield (CVE/Binaries)** | **✓ Built-in** | ✗ No | ✓ Yes | ✗ No | ✗ No |
| **SQL Query Engine** | **✓ Built-in** | ✗ No | ✗ No | ✓ Yes | ✗ No |
| **A-to-Z Categorization** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Forkability Score (0-100)** | **✓ Built-in** | ✗ No | ✗ No | ✗ No | ✗ No |
| **Textual Wiki Generator** | **✓ 1-Click Export** | ✗ No | ✗ No | ✗ No | ✗ No |
| **100% Local Privacy** | **✓ Local Bun** | ☁️ Web | ☁️ Cloud | ☁️ DB Setup | ☁️ Cloud |

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

1. **🌟 Cacciatore di Fork Attivi (*Active Fork Hunter*)**: Scansiona la rete dei fork di qualsiasi progetto e trova gli sviluppatori che hanno aggiunto nuove feature e risolto bug ignorati dal creatore originale.
2. **🛡️ Scudo di Sicurezza OpenSSF**: Verifica vulnerabilità nelle dipendenze, file binari pericolosi e licenze commerciali assegnando un voto di sicurezza da A+ a F.
3. **🗄️ Studio SQL (Stile MergeStat)**: Interroga l'intero catalogo con query SQL native direttamente dal browser.
4. **⏰ Demone di Scansione Automatica ogni 24 Ore**: Aggiorna lo stato dei repository, le nuove release e la crescita delle stelle ogni giorno.
5. **📖 Compendio Wiki in Markdown**: Esporta istantaneamente un archivio testuale pulito con link diretti per lo studio strategico.

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
