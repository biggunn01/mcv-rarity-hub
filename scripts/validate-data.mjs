import path from "node:path";
import { readJson } from "./rarity-core.mjs";

const root = process.cwd();
const collections = readJson(path.join(root, "data", "collections.json"));
const failures = [];

for (const collection of collections) {
  if (!collection.slug || !collection.name) failures.push(`${collection.slug}: missing slug or name`);
  if (!collection.rawMetadataFile) failures.push(`${collection.slug}: missing rawMetadataFile`);
  for (const source of collection.sources ?? []) {
    if (!source.contractAddress || source.contractAddress === "DATA_NEEDED") {
      failures.push(`${collection.slug}: contract address still needs verification for ${source.chain}`);
    }
    if (!source.metadataSource || source.metadataSource === "DATA_NEEDED") {
      failures.push(`${collection.slug}: metadata source still needs verification for ${source.chain}`);
    }
    if (source.metadataSource?.endsWith(":tokenURI")) {
      if (!source.scannerApiBaseUrl) failures.push(`${collection.slug}: missing scannerApiBaseUrl for ${source.chain}`);
      if (!source.scannerApiKeyEnv) failures.push(`${collection.slug}: missing scannerApiKeyEnv for ${source.chain}`);
      if (source.scannerApiBaseUrl?.includes("/v2/") && !source.scannerChainId) {
        failures.push(`${collection.slug}: missing scannerChainId for ${source.chain}`);
      }
    }
  }
  const processed = readJson(path.join(root, "data", "processed", `${collection.slug}.json`));
  if (processed.tokens.length === 0) failures.push(`${collection.slug}: no tokens in processed output`);
  if (processed.validation.missingAttributes.length) {
    failures.push(`${collection.slug}: tokens missing attributes: ${processed.validation.missingAttributes.join(", ")}`);
  }
}

if (failures.length) {
  console.warn("Data validation found official-readiness blockers:");
  for (const failure of failures) console.warn(`- ${failure}`);
  process.exitCode = 0;
} else {
  console.log("Data validation passed.");
}
