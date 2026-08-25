/**
 * 🚨 Supply-Chain Risk Scanner (Socket.dev-style, real npm registry metadata)
 *
 * DependencyAuditor already tells you a dependency is outdated (freshness) and
 * VulnerabilityScanner already tells you it has a known published CVE (OSV.dev).
 * Neither catches what Socket.dev specifically hunts for: a package that LOOKS
 * legitimate but carries risky supply-chain characteristics that predate any CVE
 * ever being filed — because most supply-chain attacks (event-stream, ua-parser-js,
 * the 2025/2026 npm phishing-token compromises) get caught by npm/OSV *after* the
 * fact, if at all. Socket instead flags this in advance via two real, checkable
 * signals: (1) lifecycle install scripts (preinstall/install/postinstall) that run
 * arbitrary code at `npm install` time, and (2) package names 1-2 edits away from a
 * vastly more popular package ("typosquatting"), confirmed via real download-count
 * disparity rather than name-similarity alone.
 *
 * Both signals here are computed from real, live data:
 *  - Install scripts come straight from the real npm packument
 *    (registry.npmjs.org/{name}) — the exact `scripts` object npm itself reads at
 *    install time for the pinned version.
 *  - The typosquat check computes a real Levenshtein distance against a static
 *    reference list of ~300 well-known popular npm package names (npm has no public
 *    "top N by downloads" endpoint, so — like real typosquat detectors — this uses a
 *    fixed, hand-curated corpus rather than a live top-N feed), then CONFIRMS every
 *    candidate against the real npm downloads API (api.npmjs.org/downloads/point) and
 *    only flags it if the popular package has >= 1000x the monthly downloads of the
 *    candidate — the same "1000x" ratio Socket.dev's own blog says it uses. A close
 *    name alone is never enough to flag by itself.
 *
 * This module never fabricates a risk score or percentage. Every field is either a
 * literal value read from the registry (the scripts object) or a literal number from
 * the downloads API.
 */

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month";

// Static, hand-curated reference corpus of well-known, extremely popular npm
// packages, used ONLY as typosquat candidates to diff against. This is not a live
// "top N" feed (npm doesn't publish one) — it is a fixed list, same approach real
// typosquat detectors use. Kept intentionally short and well-known so false
// positives (e.g. two genuinely unrelated small packages that happen to be 1 edit
// apart) stay rare.
export const POPULAR_PACKAGE_CORPUS: string[] = [
  "react", "react-dom", "vue", "angular", "express", "lodash", "axios", "chalk",
  "commander", "webpack", "babel-core", "typescript", "eslint", "prettier", "jest",
  "mocha", "chai", "moment", "dayjs", "uuid", "dotenv", "cors", "body-parser",
  "next", "nuxt", "svelte", "vite", "rollup", "esbuild", "jquery", "bootstrap",
  "tailwindcss", "redux", "mobx", "rxjs", "graphql", "apollo-server", "socket.io",
  "ws", "node-fetch", "request", "async", "underscore", "ramda", "immutable",
  "classnames", "styled-components", "emotion", "formik", "yup", "zod", "joi",
  "ajv", "mongoose", "sequelize", "prisma", "knex", "pg", "mysql2", "sqlite3",
  "redis", "ioredis", "bull", "agenda", "node-cron", "cron", "nodemailer",
  "passport", "jsonwebtoken", "bcrypt", "bcryptjs", "helmet", "morgan", "winston",
  "pino", "debug", "yargs", "minimist", "inquirer", "ora", "figlet", "boxen",
  "glob", "rimraf", "mkdirp", "fs-extra", "chokidar", "nodemon", "concurrently",
  "cross-env", "husky", "lint-staged", "semantic-release", "npm", "yarn", "pnpm",
  "vercel", "netlify-cli", "firebase", "aws-sdk", "@aws-sdk/client-s3", "stripe",
  "twilio", "sharp", "canvas", "puppeteer", "playwright", "cypress", "selenium-webdriver",
  "electron", "react-native", "expo", "ionic", "cordova", "three", "d3", "chart.js",
  "leaflet", "mapbox-gl", "socket.io-client", "ws", "sinon", "nock", "supertest",
  "node-sass", "sass", "less", "postcss", "autoprefixer", "core-js", "regenerator-runtime",
  "tslib", "reflect-metadata", "rxjs", "zone.js", "@angular/core", "@angular/common",
  "vue-router", "vuex", "pinia", "svelte-kit", "solid-js", "preact", "lit",
  "clsx", "date-fns", "luxon", "numeral", "big.js", "decimal.js", "validator",
  "sanitize-html", "dompurify", "marked", "showdown", "remark", "rehype",
  "highlight.js", "prismjs", "codemirror", "monaco-editor", "xterm", "blessed",
  "commander", "meow", "cac", "prompts", "enquirer", "chalk", "kleur", "picocolors",
  "colors", "cli-table3", "cli-progress", "listr2", "execa", "cross-spawn",
  "which", "shelljs", "tar", "unzipper", "adm-zip", "archiver", "multer",
  "formidable", "busboy", "cookie-parser", "cookie", "express-session",
  "connect-redis", "compression", "serve-static", "http-proxy-middleware",
  "ws", "engine.io", "socket.io-parser", "eventemitter3", "pify", "p-limit",
  "p-queue", "p-retry", "bluebird", "q", "rxjs", "xstate", "immer", "reselect",
  "normalizr", "json5", "yaml", "js-yaml", "toml", "ini", "dotenv-expand",
  "cross-fetch", "isomorphic-fetch", "whatwg-fetch", "form-data", "qs",
  "query-string", "url-parse", "path-to-regexp", "micromatch", "minimatch",
  "fast-glob", "globby", "ignore", "picomatch", "anymatch", "readdirp",
  "graceful-fs", "proper-lockfile", "lowdb", "nedb", "level", "leveldown",
  "better-sqlite3", "typeorm", "objection", "waterline", "bookshelf",
  "faker", "@faker-js/faker", "chance", "casual", "uuid", "nanoid", "shortid",
  "crypto-js", "jsonwebtoken", "node-jose", "jose", "tweetnacl", "argon2",
  "speakeasy", "otplib", "qrcode", "jimp", "gm", "svg2png", "html2canvas",
  "jspdf", "pdfkit", "pdf-lib", "xlsx", "exceljs", "csv-parse", "csv-stringify",
  "papaparse", "fast-csv", "handlebars", "ejs", "pug", "nunjucks", "mustache",
  "webpack-cli", "webpack-dev-server", "html-webpack-plugin", "mini-css-extract-plugin",
  "css-loader", "style-loader", "sass-loader", "ts-loader", "babel-loader",
  "@babel/core", "@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript",
  "eslint-config-airbnb", "eslint-plugin-react", "eslint-plugin-import",
  "stylelint", "commitizen", "conventional-changelog", "standard-version",
  "vitest", "ava", "tap", "jasmine", "karma", "protractor", "testcafe",
  "storybook", "@storybook/react", "styled-jsx", "vanilla-extract",
  "framer-motion", "gsap", "lottie-web", "swiper", "slick-carousel",
  "react-router", "react-router-dom", "react-query", "@tanstack/react-query",
  "swr", "recoil", "jotai", "zustand"
];

export interface SupplyChainRisk {
  hasInstallScripts: boolean;
  installScripts: Record<string, string>; // e.g. { postinstall: "node scripts/build.js" }
  typosquatSuspect: {
    similarTo: string;
    editDistance: number;
    candidateDownloadsLastMonth: number;
    referenceDownloadsLastMonth: number;
    downloadRatio: number; // referenceDownloads / candidateDownloads
  } | null;
  checkedAt: string;
}

/** Real Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchInstallScripts(name: string, version: string | null): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return {};
    const packument: any = await res.json();
    const targetVersion = (version && packument.versions?.[version]) ? version : packument["dist-tags"]?.latest;
    const scripts = packument.versions?.[targetVersion]?.scripts || {};
    const RISKY = ["preinstall", "install", "postinstall"];
    const found: Record<string, string> = {};
    for (const k of RISKY) {
      if (typeof scripts[k] === "string" && scripts[k].trim().length > 0) found[k] = scripts[k];
    }
    return found;
  } catch {
    return {};
  }
}

async function fetchMonthlyDownloads(name: string): Promise<number | null> {
  try {
    const res = await fetch(`${NPM_DOWNLOADS}/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.downloads === "number" ? data.downloads : null;
  } catch {
    return null;
  }
}

/**
 * Finds the closest popular-corpus name (edit distance 1-2, excluding an exact
 * match) for a given package name. Returns null if nothing in the corpus is
 * within distance 2.
 */
function findClosestPopularName(name: string): { candidate: string; distance: number } | null {
  let best: { candidate: string; distance: number } | null = null;
  for (const popular of POPULAR_PACKAGE_CORPUS) {
    if (popular === name) return null; // exact match to a popular package = not a typosquat
    // Cheap length pre-filter before computing full edit distance.
    if (Math.abs(popular.length - name.length) > 2) continue;
    const d = levenshtein(name, popular);
    if (d >= 1 && d <= 2) {
      if (!best || d < best.distance) best = { candidate: popular, distance: d };
    }
  }
  return best;
}

export interface SupplyChainQuery {
  key: string;
  name: string;
  ecosystem: "npm" | "pypi";
  currentVersion: string | null;
}

/**
 * Scans a list of npm dependencies for supply-chain risk signals. PyPI packages
 * are skipped (no counterpart Levenshtein-corpus or scripts convention has been
 * verified here) and returned as not-scanned. Bounded concurrency to avoid
 * hammering the public npm registry.
 */
export async function scanSupplyChainRisk(packages: SupplyChainQuery[]): Promise<Map<string, SupplyChainRisk>> {
  const result = new Map<string, SupplyChainRisk>();
  const npmPackages = packages.filter((p) => p.ecosystem === "npm");
  if (npmPackages.length === 0) return result;

  await mapWithConcurrency(npmPackages, 6, async (pkg) => {
    const [installScripts, closest] = await Promise.all([
      fetchInstallScripts(pkg.name, pkg.currentVersion),
      Promise.resolve(findClosestPopularName(pkg.name))
    ]);

    let typosquatSuspect: SupplyChainRisk["typosquatSuspect"] = null;
    if (closest) {
      const [candidateDownloads, referenceDownloads] = await Promise.all([
        fetchMonthlyDownloads(pkg.name),
        fetchMonthlyDownloads(closest.candidate)
      ]);
      if (candidateDownloads !== null && referenceDownloads !== null && candidateDownloads > 0) {
        const ratio = referenceDownloads / candidateDownloads;
        if (ratio >= 1000) {
          typosquatSuspect = {
            similarTo: closest.candidate,
            editDistance: closest.distance,
            candidateDownloadsLastMonth: candidateDownloads,
            referenceDownloadsLastMonth: referenceDownloads,
            downloadRatio: Math.round(ratio)
          };
        }
      }
    }

    result.set(pkg.key, {
      hasInstallScripts: Object.keys(installScripts).length > 0,
      installScripts,
      typosquatSuspect,
      checkedAt: new Date().toISOString()
    });
  });

  return result;
}
