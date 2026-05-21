import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./rarity-core.mjs";

loadLocalEnv();

const [slugArg] = process.argv.slice(2);
const root = process.cwd();
const collections = readJson(path.join(root, "data", "collections.json"));
const targets = slugArg ? collections.filter((collection) => collection.slug === slugArg) : collections;

if (slugArg && targets.length === 0) {
  console.error(`Unknown collection slug: ${slugArg}`);
  process.exit(1);
}

const apiKey = process.env.OPENSEA_API_KEY;
if (!apiKey) {
  console.error("OPENSEA_API_KEY is required.");
  process.exit(1);
}

for (const collection of targets) {
  const imported = [];
  const openSeaSources = (collection.sources ?? []).filter((source) => source.openSea);

  if (openSeaSources.length === 0) {
    console.warn(`${collection.slug}: no OpenSea import source configured, skipping`);
    continue;
  }

  for (const source of openSeaSources) {
    const sourceTokens = await fetchSourceTokens(collection, source, apiKey);
    imported.push(...sourceTokens);
  }

  imported.sort(
    (a, b) =>
      Number(a.canonicalTokenId) - Number(b.canonicalTokenId) ||
      a.canonicalTokenId.localeCompare(b.canonicalTokenId) ||
      a.chain.localeCompare(b.chain),
  );

  writeJson(path.join(root, "data", "raw", "imported", `${collection.slug}.json`), imported);
  console.log(`${collection.slug}: wrote ${imported.length} OpenSea metadata records`);
}

async function fetchSourceTokens(collection, source, apiKey) {
  const tokens = [];
  let cursor = null;
  let page = 1;

  do {
    const url = buildOpenSeaUrl(source.openSea, cursor);
    const response = await fetchWithRetry(url, {
      headers: {
        "x-api-key": apiKey,
        "user-agent": "mcv-rarity-hub-opensea-importer",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`${collection.slug} ${source.chain} OpenSea import failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    const nfts = Array.isArray(payload.nfts) ? payload.nfts : [];
    for (const nft of nfts) {
      tokens.push(normalizeOpenSeaNft(collection, source, nft));
    }

    cursor = payload.next ?? null;
    console.log(`${collection.slug} ${source.chain}: page ${page}, total ${tokens.length}`);
    page += 1;
    if (cursor) await sleep(650);
  } while (cursor);

  return tokens;
}

async function fetchWithRetry(url, init) {
  let lastResponse = null;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429 && response.status < 500) return response;
    lastResponse = response;
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 2000 * (attempt + 1);
    await sleep(waitMs);
  }
  return lastResponse;
}

function buildOpenSeaUrl(openSea, cursor) {
  const base =
    openSea.type === "contract"
      ? `https://api.opensea.io/api/v2/chain/${openSea.chain}/contract/${openSea.contractAddress}/nfts`
      : `https://api.opensea.io/api/v2/collection/${openSea.slug}/nfts`;
  const url = new URL(base);
  url.searchParams.set("limit", "200");
  if (cursor) url.searchParams.set("next", cursor);
  return url;
}

function normalizeOpenSeaNft(collection, source, nft) {
  const tokenId = String(nft.identifier);
  const chain = source.chain;
  return {
    tokenId,
    canonicalTokenId: tokenId,
    name: nft.name ?? `${collection.name} #${tokenId}`,
    image: nft.display_image_url ?? nft.image_url ?? nft.original_image_url ?? "/mock-token.svg",
    chain,
    source: source.openSea.type === "contract" ? "opensea:contract-nfts" : "opensea:collection-nfts",
    isMock: false,
    tokenUri: nft.metadata_url ?? null,
    openseaUrl: nft.opensea_url ?? (source.marketplaceBaseUrl ? `${source.marketplaceBaseUrl}${tokenId}` : null),
    attributes: (Array.isArray(nft.traits) ? nft.traits : []).map((trait) => ({
      trait_type: trait.trait_type ?? "Unknown",
      value: trait.value ?? "Unknown",
    })),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadLocalEnv() {
  const envPaths = [path.join(process.cwd(), ".env.local")];
  for (const envPath of envPaths) {
    try {
      const text = fs.readFileSync(envPath, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    } catch {
      // Optional local env source.
    }
  }
}
