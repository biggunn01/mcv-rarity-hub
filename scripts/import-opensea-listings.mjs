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

for (const collection of targets) {
  const listings = [];
  const openSeaSources = (collection.sources ?? []).filter((source) => source.openSea?.slug);

  if (openSeaSources.length === 0) {
    console.warn(`${collection.slug}: no OpenSea collection slug configured, skipping listings`);
    continue;
  }

  for (const source of openSeaSources) {
    const sourceListings = await fetchCollectionListings(collection, source);
    listings.push(...sourceListings);
  }

  const bestByCanonicalToken = new Map();
  for (const listing of listings) {
    const current = bestByCanonicalToken.get(listing.canonicalTokenId);
    if (!current || listing.priceNative < current.priceNative) {
      bestByCanonicalToken.set(listing.canonicalTokenId, listing);
    }
  }

  const output = [...bestByCanonicalToken.values()].sort(
    (a, b) =>
      Number(a.canonicalTokenId) - Number(b.canonicalTokenId) ||
      a.canonicalTokenId.localeCompare(b.canonicalTokenId) ||
      a.chain.localeCompare(b.chain),
  );

  writeJson(path.join(root, "data", "market", "opensea-listings", `${collection.slug}.json`), output);
  console.log(`${collection.slug}: wrote ${output.length} active OpenSea listing records`);
}

async function fetchCollectionListings(collection, source) {
  const listings = [];
  let cursor = null;
  let page = 1;

  do {
    const url = buildListingsUrl(source.openSea.slug, cursor);
    const response = await fetchWithRetry(url, {
      headers: {
        ...(process.env.OPENSEA_API_KEY ? { "x-api-key": process.env.OPENSEA_API_KEY } : {}),
        "user-agent": "mcv-rarity-hub-opensea-listings-importer",
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`${collection.slug} OpenSea listings import failed: ${response.status} ${JSON.stringify(payload)}`);
    }

    for (const listing of Array.isArray(payload.listings) ? payload.listings : []) {
      const normalized = normalizeListing(source, listing);
      if (normalized) listings.push(normalized);
    }

    cursor = payload.next ?? null;
    console.log(`${collection.slug} ${source.chain}: listings page ${page}, total ${listings.length}`);
    page += 1;
    if (cursor) await sleep(650);
  } while (cursor);

  return listings;
}

function buildListingsUrl(collectionSlug, cursor) {
  const url = new URL(`https://api.opensea.io/api/v2/listings/collection/${collectionSlug}/all`);
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("next", cursor);
  return url;
}

function normalizeListing(source, listing) {
  const offer = listing.protocol_data?.parameters?.offer?.[0];
  const tokenId = offer?.identifierOrCriteria;
  const currentPrice = listing.price?.current;
  const decimals = Number(currentPrice?.decimals ?? 18);
  const rawValue = currentPrice?.value;
  if (!tokenId || !rawValue) return null;

  const priceNative = Number(rawValue) / 10 ** decimals;
  if (!Number.isFinite(priceNative)) return null;

  return {
    tokenId: String(tokenId),
    canonicalTokenId: String(tokenId),
    chain: source.chain,
    contractAddress: source.contractAddress,
    marketplaceUrl: source.marketplaceBaseUrl ? `${source.marketplaceBaseUrl}${tokenId}` : null,
    orderHash: listing.order_hash ?? null,
    status: listing.status ?? "ACTIVE",
    price: {
      value: rawValue,
      decimals,
      currency: currentPrice.currency ?? "ETH",
      native: round(priceNative),
      display: `${formatPrice(priceNative)} ${currentPrice.currency ?? "ETH"}`,
    },
    seller: listing.protocol_data?.parameters?.offerer ?? null,
    createdAt: listing.order_created_at ?? null,
    source: "opensea:listings:collection-all",
  };
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

function formatPrice(value) {
  return value >= 1 ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
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
