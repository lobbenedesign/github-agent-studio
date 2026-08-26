# Ricerca Competitor — GitHub Agent Studio

Data ricerca: 2026-08-26
Metodo: verifica reale via ricerca web di ciascuno strumento (nome, URL/repo, natura open-source vs SaaS). Nessun nome inventato.

---

## 1. Cosa fa DAVVERO github-agent-studio oggi (verificato dal codice)

Letto `README.md`, `server.ts` e tutti i file in `src/*.ts` (3.938 righe totali su 21 file). Feature reali confermate:

| Modulo | File | Cosa fa realmente |
|---|---|---|
| Fork Hunter | `src/fork_hunter.ts` | Confronta i fork reali via GitHub compare API per trovare fork "ahead" del master (dato reale dal 2026-08-25, prima era una formula fittizia `12 + i*6`) |
| Security Shield | `src/security_shield.ts` | Grade A+/F stile OSSF Scorecard, ispeziona dipendenze/binari/token |
| Dependency Auditor | `src/dependency_auditor.ts` + `src/vulnerability_scanner.ts` | Legge `package.json`/`requirements.txt` reali, confronta con npm/PyPI registry reali, e interroga **OSV.dev** per CVE reali sulla versione esatta pinnata |
| Supply-Chain Scanner | `src/supply_chain_scanner.ts` | Legge il packument npm reale della versione pinnata, rileva script `preinstall/install/postinstall`, rileva typosquat confermati da rapporto ≥1000x nei download reali (npm downloads API), non solo similarità nome |
| SQL Query Engine | `src/sql_query_engine.ts` | Query SQL in-memory sul catalogo (stile MergeStat) |
| Daily Cron Scheduler | `src/daily_cron_scheduler.ts` | Demone che gira ogni 24h per scoprire nuovi repo/versioni/star velocity (ora con chiamate API reali, non più `+2` hardcoded) |
| Repo Indexer / A-Z Catalog | `src/repo_indexer.ts`, `src/category_detector.ts` | Catalogazione alfabetica A-Z per categoria (LLM, Multimodal, Voice, MCTS, Fine-Tuning, SWE) |
| Wiki Generator | `src/wiki_generator.ts` | Esporta documentazione markdown testuale senza immagini |
| Similar Repo Finder | `src/similar_repo_finder.ts` | Usa la vera GitHub Search API sui topic/linguaggio del repo target |
| Deep Crawler / Version Tracker | `src/deep_crawler.ts`, `src/version_tracker.ts` | Analisi approfondita repo e tracciamento versioni |
| Code Analyzer/Evaluator + LLM Evaluator | `src/code_analyzer.ts`, `src/code_evaluator.ts`, `src/llm_evaluator.ts` | Valutazione codice, anche con supporto LLM locale (Ollama, coerente con l'approccio "no cloud" del progetto) |
| Competitor Benchmark | `src/competitor_benchmark.ts` | Genera la matrice comparativa già presente nel README |

Nota importante trovata nel README stesso: il changelog del 2026-08-25 documenta onestamente che Fork Hunter e Cron Scheduler **generavano dati finti** prima di essere corretti — ora usano API reali. Questo conferma che il progetto è nella fase "da demo a dati reali", il terreno giusto per capire dove investire dopo.

Assenze reali confermate leggendo il codice: nessun modulo per license/compliance (SPDX/SBOM), nessun secret scanner sul codice sorgente (solo "token leaks" generico menzionato nel Security Shield, non un vero scanner regex/entropy come TruffleHog), nessun static analysis (SAST) sul codice del repo target, nessuna GitHub Action/CI integrabile, nessun tracking storico (grafico stelle nel tempo), nessuna generazione SBOM.

---

## 2. Competitor reali verificati (19 strumenti, tutti confermati via web)

### Fork discovery / repo analytics

**1. Useful Forks** — https://github.com/useful-forks/useful-forks.github.io
Estensione Chrome + tool web che migliora la scopribilità della lista fork di GitHub filtrando automaticamente quelli senza commit propri sul branch principale dalla creazione. Punto di forza reale: leggerissimo, zero backend, integrato direttamente nella UI di GitHub. Open source. **Gap per github-agent-studio**: nessuna integrazione browser-nativa (bookmarklet/estensione) — oggi serve aprire la dashboard separata.

**2. MergeStat** — https://github.com/mergestat/mergestat-lite e https://www.mergestat.com/
Interroga repository git (e GitHub API) con SQL puro, sia da CLI locale sia da app web (`app.mergestat.com`). Punto di forza: schema SQL molto più ricco (commit, autori, blame, file) rispetto a un semplice catalogo. Open source (mergestat-lite) + prodotto hosted. **Gap**: il motore SQL di github-agent-studio lavora solo sul catalogo interno, non sulla cronologia commit/blame del repo git reale.

**3. OSS Insight (X-lab / PingCAP)** — https://ossinsight.io/ , repo https://github.com/pingcap/ossinsight, dati da https://github.com/X-lab2017/open-digger
Analizza oltre 10 miliardi di eventi GitHub in tempo reale (star, PR, issue, contributori) con query in linguaggio naturale via LLM. Punto di forza: scala di dati enorme (GHArchive + ClickHouse) impossibile da replicare in locale. Open source (ossinsight, open-digger) con hosting cloud per la UI pubblica. **Gap**: github-agent-studio non ha metriche storiche di community health (velocità PR, tempo di risposta issue, distribuzione contributori nel tempo).

**4. Star History** — https://www.star-history.com/ , repo https://github.com/star-history/star-history
Grafico open source della crescita delle stelle nel tempo per uno o più repo, embeddabile in README. Punto di forza: mostra il *momentum* reale (velocità), non solo il conteggio statico attuale. Open source. **Gap**: github-agent-studio mostra `starDelta24h` ma non un grafico storico multi-repo comparativo.

### Sicurezza supply-chain / dipendenze (ufficiali/large)

**5. GitHub Dependabot** — https://docs.github.com/en/code-security/dependabot
Crea automaticamente PR di aggiornamento dipendenze e alert di sicurezza su 25+ ecosistemi, nativo su ogni repo GitHub. Punto di forza: integrazione a costo zero, nessuna configurazione esterna, PR automatiche pronte da mergiare. Gratuito/incluso su GitHub (non open-source standalone, ma configurabile via `dependabot.yml`). **Gap**: github-agent-studio rileva le vulnerabilità (via OSV.dev) ma non genera PR di fix automatiche.

**6. GitHub Advanced Security / CodeQL** — https://docs.github.com/code-security/code-scanning e https://github.com/github/codeql
Motore di analisi statica (SAST) che GitHub stesso usa per il code scanning nativo; query aperte e mantenute dalla community su `github/codeql`. Punto di forza: analisi semantica profonda del flusso dati, non solo pattern matching testuale. Query open source, prodotto GHAS a pagamento per l'enforcement automatico. **Gap**: github-agent-studio non fa alcuna analisi statica del codice sorgente del repo target (solo delle dipendenze).

**7. OSSF Scorecard** — https://github.com/ossf/scorecard e https://scorecard.dev/
Il progetto upstream reale che ispira lo "OpenSSF Security Grade" di github-agent-studio: assegna punteggi 0-10 su euristiche di sicurezza (branch protection, code review, CI tests, ecc.) e pubblica scansioni settimanali di oltre 1 milione di repo su BigQuery pubblico. Open source, Go Action ufficiale. **Gap concreto e diretto**: github-agent-studio *si ispira* allo stile Scorecard ma non chiama la vera Scorecard REST API (`api.scorecard.dev`) né implementa i suoi controlli specifici (Branch-Protection, Code-Review, Dangerous-Workflow, Token-Permissions) — potrebbe usarla come fonte dati invece di reimplementare euristiche proprie.

**8. OSSF Allstar** — https://github.com/ossf/allstar
GitHub App che applica in modo continuo policy di sicurezza (es. branch protection obbligatoria) a livello di organizzazione, con azioni automatiche (apertura issue, modifica impostazioni) quando una policy viene violata. Open source. **Gap**: github-agent-studio è puramente di analisi/reporting, non ha alcun meccanismo di *enforcement* continuo o automazione delle correzioni.

### Scanner dipendenze/vulnerabilità dedicati

**9. Snyk** — https://snyk.io/
Piattaforma SaaS che scansiona codice, dipendenze open source, container e IaC con un database vulnerabilità curato manualmente da un team di sicurezza dedicato. Punto di forza: prioritizzazione "risk-based" che riduce il rumore rispetto a un semplice elenco di CVE. Closed source/SaaS (CLI gratuita con limiti). **Gap**: github-agent-studio elenca le CVE trovate ma non le prioritizza per exploitability/reachability reale nel codice.

**10. Socket.dev** — https://socket.dev/
Analizza il comportamento dei pacchetti (script di installazione, codice offuscato, account maintainer nuovi) con un motore di analisi statica proprietario su npm/PyPI/Maven/Go, calcolando punteggi 0-100 su 5 categorie. Gratuito per repo open source, motore proprietario. **Gap diretto**: github-agent-studio replica solo due segnali di Socket (install scripts + typosquat) — Socket copre anche codice offuscato, nuovi maintainer sospetti, permessi eccessivi (`eval`, accesso rete/filesystem a runtime).

**11. Renovate (Mend)** — https://github.com/renovatebot/renovate
Bot open source (AGPL-3.0) di aggiornamento dipendenze automatico su 90+ package manager, con PR raggruppate e policy di scheduling configurabili. Open source + hosted da Mend. **Gap**: come Dependabot, genera azione (PR) non solo diagnosi — github-agent-studio si ferma al report.

**12. Trivy (Aqua Security)** — https://github.com/aquasecurity/trivy , https://trivy.dev/
Scanner open source "tutto in uno": pacchetti OS, dipendenze linguaggio, container image, IaC, Kubernetes — un solo binario senza dipendenze esterne. Open source (Apache 2.0). **Gap**: github-agent-studio copre solo npm/PyPI a livello applicativo, non container image né IaC (Dockerfile, Terraform) del repo.

**13. Grype (Anchore)** — https://github.com/anchore/grype
Scanner CLI open source per immagini container e filesystem, basato su SBOM generate da Syft, copre OS package (Alpine/Debian/RHEL) oltre ai linguaggi applicativi. Open source (Apache 2.0), gira 100% locale senza account. **Gap**: nessuna generazione/lettura SBOM (formato SPDX/CycloneDX) in github-agent-studio — Grype dimostra che è uno standard ormai atteso.

### Analisi statica del codice / qualità

**14. Semgrep** — https://github.com/semgrep/semgrep
Motore di analisi statica leggero (SAST) con regole "che sembrano codice", supporta 30+ linguaggi; la Community Edition è open source (LGPL 2.1), il prodotto completo aggiunge SCA e secret detection. **Gap**: github-agent-studio non fa alcuna scansione di pattern di codice pericolosi (SQL injection, uso di `eval`, credenziali hardcoded) nel codice sorgente del repo, solo nelle dipendenze.

### Secret scanning

**15. GitGuardian** — https://www.gitguardian.com/
Piattaforma SaaS che rileva 450+ tipi di segreti con validazione attiva (verifica se la credenziale trovata è ancora valida), monitora anche CI/CD, Slack, Jira. Closed source/SaaS (CLI `ggshield` gratuita). **Gap**: il "token leaks" citato nel Security Shield di github-agent-studio non è un vero scanner regex/entropy — GitGuardian mostra lo standard reale (centinaia di pattern + validazione).

**16. TruffleHog** — https://github.com/trufflesecurity/trufflehog
Scanner open source (AGPL-3.0, 26,8k stelle) che rileva 800+ tipi di segreti con **verifica live delle credenziali** (si autentica realmente al servizio per confermare che il secret è ancora attivo), copre git history, Slack, S3, Docker image. Open source. **Gap diretto e concreto**: github-agent-studio potrebbe implementare uno scan reale della cronologia commit del repo target cercando pattern di secret noti (AWS keys, API token) — oggi non lo fa affatto.

### License / compliance

**17. FOSSA** — https://fossa.com/
Piattaforma SaaS che identifica ogni componente open source e la sua licenza, segnala violazioni di policy e genera documenti di attribuzione/SBOM automaticamente, con 99.8% di accuratezza dichiarata su 17+ linguaggi. Closed source/SaaS (on-prem disponibile). **Gap**: github-agent-studio non legge/riporta MAI la licenza delle dipendenze o del repo target — è un buco completo nella "sicurezza prima di forkare".

**18. Libraries.io** — https://libraries.io/ (repo https://github.com/librariesio/libraries.io , ora parte di Tidelift)
Servizio open source che traccia oltre 10 milioni di pacchetti su 32 package manager, mappa l'albero delle dipendenze e verifica la compliance delle licenze. Open source, API gratuita con rate limit. **Gap**: fornisce un "SourceRank" (punteggio di salute pacchetto basato su popolarità/manutenzione/community) che github-agent-studio non calcola per le singole dipendenze, solo per il repo principale.

### Supply-chain / provenance avanzato

**19. Sigstore (cosign) + SLSA** — https://www.sigstore.dev/ , https://slsa.dev/ , repo cosign: https://github.com/sigstore/cosign
Toolkit open source per firma keyless di artefatti software (container, binari) con autorità di certificazione basata su OIDC (Fulcio) e log di trasparenza immutabile (Rekor); SLSA definisce i livelli di provenance della build. Entrambi open source, progetti OpenSSF/Linux Foundation. **Gap**: github-agent-studio non verifica mai se le release/artefatti di un repo sono firmati o hanno provenance verificabile — un segnale di fiducia sempre più richiesto prima di adottare codice di terze parti.

---

## 3. Sintesi — 6 capacità concrete e implementabili, prioritizzate

Tutte realizzabili con GitHub REST/GraphQL API, OSV.dev, registry npm/PyPI, e Ollama locale — stesso approccio "reale, no-cloud" già usato nel progetto (vedi changelog che ha già eliminato dati fittizi da Fork Hunter e Cron Scheduler).

### Priorità 1 — Secret scanning reale sul repo target
**Ispirato da**: TruffleHog, GitGuardian.
**Perché è prezioso**: oggi il Security Shield menziona "token leaks" ma senza un vero motore di detection. Implementare uno scan regex/entropy (pattern per AWS keys, GitHub PAT, chiavi private, ecc.) sui file del repo via GitHub API (`contents` o `search/code`) è realistico e chiude un gap di sicurezza reale e visibile, non decorativo — è esattamente il tipo di controllo "prima di forkare/eseguire codice" che il progetto promette nel README.

### Priorità 2 — License detection e compliance flag
**Ispirato da**: FOSSA, Libraries.io.
**Perché è prezioso**: il Dependency Auditor legge già `package.json`/`requirements.txt` reali — aggiungere la lettura del campo `license` (via npm packument/PyPI JSON, già interrogati) e la licenza del repo stesso (`GET /repos/{owner}/{repo}/license` di GitHub, gratuita) è a costo quasi nullo e riempie un buco completo: oggi lo strumento non dice mai se una dipendenza è GPL/AGPL/proprietaria in un progetto che l'utente vuole forkare commercialmente.

### Priorità 3 — Integrazione reale con OSSF Scorecard API (invece di reimplementare euristiche)
**Ispirato da**: OSSF Scorecard.
**Perché è prezioso**: il "Security Grade A+/F" attuale è un'euristica proprietaria; la vera Scorecard API (`api.scorecard.dev`, gratuita, dati pre-calcolati per oltre 1M di repo) dà controlli standard e riconosciuti (Branch-Protection, Dangerous-Workflow, Token-Permissions, Pinned-Dependencies) con una singola chiamata HTTP. Aumenta la credibilità del punteggio mostrato senza reinventare la ruota.

### Priorità 4 — Storico stelle/attività (star velocity nel tempo, non solo delta 24h)
**Ispirato da**: Star History, OSS Insight.
**Perché è prezioso**: il Cron Scheduler già traccia `starDelta24h` ogni 24h — basta persistere lo storico (già hanno `repo_database.ts`) e esporre un endpoint che restituisce la serie temporale per repo, per costruire un grafico di crescita reale nel tempo. Trasforma un dato "snapshot" in un segnale di momentum, il vero valore che Star History dimostra essere richiesto.

### Priorità 5 — SBOM generation/export (formato SPDX o CycloneDX semplificato)
**Ispirato da**: Grype/Syft, FOSSA.
**Perché è prezioso**: il Dependency Auditor ha già tutti i dati necessari (nome pacchetto, versione pinnata, licenza se aggiunta in Priorità 2, CVE da OSV.dev) — serializzarli in un JSON SBOM minimale standard è quasi solo lavoro di formattazione, ma sblocca l'interoperabilità con qualunque altro tool di sicurezza dell'ecosistema (requisito sempre più comune in ambito enterprise/compliance).

### Priorità 6 — Static pattern scan leggero sul codice sorgente (non solo dipendenze)
**Ispirato da**: Semgrep, CodeQL.
**Perché è prezioso**: oggi ogni controllo di github-agent-studio guarda le *dipendenze*, mai il *codice del repo target stesso*. Un set minimo di regole leggere (uso di `eval`/`exec`, comandi shell con input non sanificato, credenziali hardcoded in chiaro — sovrapponibile alla Priorità 1) via ricerca testuale sui file principali del repo, eventualmente arricchito da valutazione LLM locale (Ollama, già integrato in `llm_evaluator.ts`), darebbe un primo segnale SAST reale senza dover reimplementare un motore semantico come CodeQL.

---

## Fonti consultate (tutte verificate via ricerca web il 2026-08-26)

- Dependabot: https://docs.github.com/en/code-security/dependabot
- CodeQL / GitHub Advanced Security: https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql , https://github.com/github/codeql
- OSSF Scorecard: https://github.com/ossf/scorecard , https://scorecard.dev/
- OSSF Allstar: https://github.com/ossf/allstar
- Snyk: https://snyk.io/ , https://docs.snyk.io/whats-snyk
- Socket.dev: https://socket.dev/ , https://docs.socket.dev/docs/faq
- Renovate: https://github.com/renovatebot/renovate , https://docs.renovatebot.com/
- Trivy: https://github.com/aquasecurity/trivy , https://trivy.dev/
- Grype: https://github.com/anchore/grype
- Semgrep: https://github.com/semgrep/semgrep , https://semgrep.dev/docs/introduction
- GitGuardian: https://www.gitguardian.com/
- TruffleHog: https://github.com/trufflesecurity/trufflehog
- FOSSA: https://fossa.com/solutions/oss-license-compliance/
- Libraries.io: https://libraries.io/ , https://github.com/librariesio/libraries.io
- OSS Insight: https://ossinsight.io/ , https://github.com/pingcap/ossinsight
- OpenDigger / X-lab: https://github.com/X-lab2017/open-digger
- Star History: https://www.star-history.com/ , https://github.com/star-history/star-history
- Sigstore / cosign: https://github.com/sigstore/cosign , https://www.sigstore.dev/
- SLSA: https://slsa.dev/
- Useful Forks: https://github.com/useful-forks/useful-forks.github.io
- MergeStat: https://github.com/mergestat/mergestat-lite , https://www.mergestat.com/
