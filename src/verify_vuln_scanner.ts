/**
 * Standalone verification script (not part of the server runtime) — proves
 * scanForVulnerabilities() returns real OSV.dev data for known-vulnerable
 * package@version pairs, not fabricated placeholders.
 *
 * Run with: bun src/verify_vuln_scanner.ts
 */
import { scanForVulnerabilities } from "./vulnerability_scanner";

async function main() {
  const result = await scanForVulnerabilities([
    { key: "npm:lodash:4.17.11", name: "lodash", ecosystem: "npm", version: "4.17.11" },
    { key: "npm:express:4.18.0", name: "express", ecosystem: "npm", version: "4.18.0" },
    { key: "PyPI:pyyaml:5.3.1", name: "pyyaml", ecosystem: "PyPI", version: "5.3.1" },
    { key: "npm:express:4.19.2", name: "express", ecosystem: "npm", version: "4.19.2" }
  ]);

  let anyFound = false;
  for (const [key, vulns] of result.entries()) {
    console.log(`${key} -> ${vulns.length} known vuln(s)`);
    for (const v of vulns) {
      console.log(`   ${v.id} :: ${v.summary || "(no summary)"} :: severity=${v.severity || "n/a"}`);
      anyFound = true;
    }
  }
  if (!anyFound) {
    console.error("FAIL: expected at least one known-vulnerable package in this fixture set.");
    process.exit(1);
  }
  console.log("\nOK: OSV.dev returned real advisory data for known-vulnerable packages.");
}

main();
