import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./rarity-core.mjs";

loadLocalEnv();

const [slug, startArg, endArg, ...flagArgs] = process.argv.slice(2);
const flags = parseFlags(flagArgs);

if (!slug || !startArg || !endArg) {
  console.error("Usage: node scripts/import-metadata.mjs <collection-slug> <start-token-id> <end-token-id> [--chain Ethereum]");
  process.exit(1);
}

const root = process.cwd();
const collections = readJson(path.join(root, "data", "collections.json"));
const collection = collections.find((item) => item.slug === slug);

if (!collection) {
  console.error(`Unknown collection slug: ${slug}`);
  process.exit(1);
}

const start = Number(startArg);
const end = Number(endArg);
if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
  console.error("Token range must be integers with start <= end.");
  process.exit(1);
}

const imported = [];
const sources = flags.chain
  ? collection.sources.filter((source) => source.chain.toLowerCase() === flags.chain.toLowerCase())
  : collection.sources;

if (sources.length === 0) {
  throw new Error(`No matching sources for ${collection.name}${flags.chain ? ` on ${flags.chain}` : ""}`);
}

for (const source of sources) {
  const apiKey = process.env[source.scannerApiKeyEnv];
  if (!apiKey) {
    throw new Error(`${source.scannerApiKeyEnv} is required for ${collection.name} ${source.chain}`);
  }

  for (let tokenId = start; tokenId <= end; tokenId += 1) {
    const tokenUri = await readTokenUri(source, tokenId, apiKey);
    const metadata = await fetchMetadata(tokenUri);
    imported.push({
      tokenId: String(tokenId),
      canonicalTokenId: String(tokenId),
      name: metadata.name ?? `${collection.name} #${tokenId}`,
      image: normalizeMetadataUri(metadata.image),
      chain: source.chain,
      source: source.metadataSource,
      isMock: false,
      tokenUri,
      attributes: Array.isArray(metadata.attributes) ? metadata.attributes : [],
    });
  }
}

const outputPath = path.join(root, "data", "raw", "imported", `${slug}.json`);
writeJson(outputPath, imported);
console.log(`Imported ${imported.length} metadata records to data/raw/imported/${slug}.json`);

async function readTokenUri(source, tokenId, apiKey) {
  const paddedTokenId = tokenId.toString(16).padStart(64, "0");
  const calls = [
    { name: "tokenURI", data: `0xc87b56dd${paddedTokenId}` },
    { name: "uri", data: `0x0e89341c${paddedTokenId}` },
  ];

  const failures = [];
  for (const call of calls) {
    const result = await scannerEthCall(source, call.data, apiKey);
    if (result.ok) {
      const decoded = decodeAbiString(result.value);
      return decoded.replace("{id}", paddedTokenId);
    }
    failures.push(`${call.name}: ${result.error}`);
  }

  if (source.rpcUrlEnv && process.env[source.rpcUrlEnv]) {
    for (const call of calls) {
      const result = await rpcEthCall(source, call.data, process.env[source.rpcUrlEnv]);
      if (result.ok) {
        const decoded = decodeAbiString(result.value);
        return decoded.replace("{id}", paddedTokenId);
      }
      failures.push(`rpc ${call.name}: ${result.error}`);
    }
  }

  throw new Error(`metadata URI read failed for ${source.chain} ${source.contractAddress} #${tokenId}: ${failures.join(" | ")}`);
}

async function scannerEthCall(source, data, apiKey) {
  const url = new URL(source.scannerApiBaseUrl);
  if (source.scannerApiBaseUrl.includes("/v2/")) {
    url.searchParams.set("chainid", source.scannerChainId);
  }
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", "eth_call");
  url.searchParams.set("to", source.contractAddress);
  url.searchParams.set("data", data);
  url.searchParams.set("tag", "latest");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url);
  const payload = await response.json();
  const result = payload.result;
  if (!response.ok || !result || result === "0x" || payload.status === "0") {
    return { ok: false, error: JSON.stringify(payload) };
  }
  return { ok: true, value: result };
}

async function rpcEthCall(source, data, rpcUrl) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: source.contractAddress, data }, "latest"],
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.result || payload.result === "0x") {
    return { ok: false, error: JSON.stringify(payload) };
  }
  return { ok: true, value: payload.result };
}

async function fetchMetadata(uri) {
  const urls = normalizeMetadataUris(uri);
  const failures = [];
  for (const url of urls) {
    const response = await fetch(url, { headers: { "user-agent": "mcv-rarity-hub-metadata-importer" } });
    if (response.ok) {
      return response.json();
    }
    failures.push(`${response.status}: ${url}`);
  }
  throw new Error(`Metadata fetch failed after ${urls.length} attempt(s): ${failures.join(" | ")}`);
}

function normalizeMetadataUri(uri) {
  return normalizeMetadataUris(uri)[0];
}

function normalizeMetadataUris(uri) {
  if (!uri) return [uri];
  const ipfsPath = extractIpfsPath(uri);
  if (ipfsPath) {
    return [
      `https://ipfs.io/ipfs/${ipfsPath}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsPath}`,
    ];
  }
  return [uri];
}

function extractIpfsPath(uri) {
  if (uri.startsWith("ipfs://ipfs/")) return uri.slice("ipfs://ipfs/".length);
  if (uri.startsWith("ipfs://")) return uri.slice("ipfs://".length);
  const match = uri.match(/\/ipfs\/([^?#]+)/);
  return match?.[1] ?? null;
}

function decodeAbiString(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const offset = Number.parseInt(clean.slice(0, 64), 16) * 2;
  const length = Number.parseInt(clean.slice(offset, offset + 64), 16) * 2;
  const data = clean.slice(offset + 64, offset + 64 + length);
  return Buffer.from(data, "hex").toString("utf8");
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (!process.env[key]) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local is optional; deployment environments usually inject secrets.
  }
}

function parseFlags(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--chain") {
      result.chain = args[index + 1];
      index += 1;
    }
  }
  return result;
}
