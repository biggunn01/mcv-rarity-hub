import path from "node:path";
import { buildCollectionRarity, readJson, writeJson } from "./rarity-core.mjs";

const root = process.cwd();
const collections = readJson(path.join(root, "data", "collections.json"));
const outputs = [];

for (const collection of collections) {
  const rawTokens = readJson(path.join(root, collection.rawMetadataFile));
  const listingsPath = path.join(root, "data", "market", "opensea-listings", `${collection.slug}.json`);
  const listings = readOptionalJson(listingsPath, []);
  const rarity = buildCollectionRarity(collection, rawTokens, { listings });
  const outputPath = path.join(root, "data", "processed", `${collection.slug}.json`);
  writeJson(outputPath, rarity);
  outputs.push({
    slug: collection.slug,
    name: collection.name,
    status: collection.status,
    actualTokenCount: rarity.collection.actualTokenCount,
    importedTokenCount: rarity.collection.importedTokenCount,
    excludedTokenCount: rarity.collection.excludedTokenCount,
    hasMockData: rarity.collection.hasMockData,
    output: `data/processed/${collection.slug}.json`,
  });
}

const hasMockData = outputs.some((collection) => collection.hasMockData);
const excludedTokenCount = outputs.reduce((sum, collection) => sum + collection.excludedTokenCount, 0);

writeJson(path.join(root, "data", "processed", "rarity-index.json"), {
  generatedAt: new Date().toISOString(),
  official: !hasMockData,
  warning: hasMockData
    ? "Current output contains mock data and must not be presented as official rankings."
    : excludedTokenCount > 0
      ? `${excludedTokenCount} imported token(s) had no trait metadata and were excluded from scoring. Rankings use real imported metadata.`
      : "Rankings use real imported metadata.",
  collections: outputs,
});

console.log(`Built rarity data for ${outputs.length} collections.`);

function readOptionalJson(filePath, fallback) {
  try {
    return readJson(filePath);
  } catch {
    return fallback;
  }
}
