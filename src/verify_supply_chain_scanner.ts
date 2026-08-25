/**
 * Live verification for supply_chain_scanner.ts — hits the real npm registry and
 * downloads API, no mocks. Run with `bun src/verify_supply_chain_scanner.ts`.
 */
import { scanSupplyChainRisk } from "./supply_chain_scanner";

async function main() {
  const results = await scanSupplyChainRisk([
    // Known real historical typosquat of cross-env (still live on npm).
    { key: "typosquat-fixture", name: "crossenv", ecosystem: "npm", currentVersion: null },
    // Legitimate popular package itself — should NOT be flagged as its own typosquat.
    { key: "legit-fixture", name: "cross-env", ecosystem: "npm", currentVersion: null },
    // Package with real, well-known install/postinstall lifecycle scripts.
    { key: "install-script-fixture", name: "node-sass", ecosystem: "npm", currentVersion: "9.0.0" },
    // Ordinary package with no lifecycle scripts and no similar-name popular package.
    { key: "clean-fixture", name: "chalk", ecosystem: "npm", currentVersion: "5.3.0" }
  ]);

  for (const [key, risk] of results.entries()) {
    console.log(`\n--- ${key} ---`);
    console.log(JSON.stringify(risk, null, 2));
  }

  const typosquat = results.get("typosquat-fixture");
  const legit = results.get("legit-fixture");
  const installScript = results.get("install-script-fixture");
  const clean = results.get("clean-fixture");

  const assertions: [string, boolean][] = [
    ["crossenv flagged as typosquat of cross-env", !!typosquat?.typosquatSuspect && typosquat.typosquatSuspect.similarTo === "cross-env"],
    ["crossenv download ratio >= 1000x", (typosquat?.typosquatSuspect?.downloadRatio || 0) >= 1000],
    ["cross-env itself NOT flagged (exact match to its own corpus entry)", !legit?.typosquatSuspect],
    ["node-sass@9.0.0 has real postinstall/install scripts", !!installScript?.hasInstallScripts && "postinstall" in (installScript?.installScripts || {})],
    ["chalk@5.3.0 has no install scripts", clean?.hasInstallScripts === false],
    ["chalk@5.3.0 not flagged as typosquat", !clean?.typosquatSuspect]
  ];

  console.log("\n=== ASSERTIONS ===");
  let allPass = true;
  for (const [desc, pass] of assertions) {
    console.log(`${pass ? "PASS" : "FAIL"} — ${desc}`);
    if (!pass) allPass = false;
  }
  if (!allPass) {
    console.error("\nSome assertions failed.");
    process.exit(1);
  }
  console.log("\nAll assertions passed against live npm registry + downloads API.");
}

main();
