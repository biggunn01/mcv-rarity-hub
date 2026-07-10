// One-time importer: sat provenance for ordinal collections (currently cream-cats).
// Source: ordinals.com recursive endpoints (sat index enabled). Sat data is
// immutable, so the output is committed and never needs a scheduled refresh.
import path from "node:path";
import { readJson, writeJson } from "./rarity-core.mjs";

const COLLECTION = process.argv[2] ?? "cream-cats";
const root = process.cwd();
const raw = readJson(path.join(root, "data", "raw", "imported", `${COLLECTION}.json`));

const SATS_PER_BLOCK_EPOCH0 = 50n * 100_000_000n;
const BLOCKS_PER_EPOCH = 210_000n;
const BLOCKS_PER_PERIOD = 2016n;
const GENESIS_MS = Date.UTC(2009, 0, 3);

function classifySat(satInput) {
  const sat = BigInt(satInput);
  let remaining = sat;
  let epoch = 0n;
  let blockBase = 0n;
  let subsidy = SATS_PER_BLOCK_EPOCH0;
  while (remaining >= subsidy * BLOCKS_PER_EPOCH && subsidy > 0n) {
    remaining -= subsidy * BLOCKS_PER_EPOCH;
    blockBase += BLOCKS_PER_EPOCH;
    epoch += 1n;
    subsidy /= 2n;
  }
  const blockInEpoch = subsidy > 0n ? remaining / subsidy : 0n;
  const offset = subsidy > 0n ? remaining % subsidy : 0n;
  const block = blockBase + blockInEpoch;

  let rarity = "common";
  if (sat === 0n) rarity = "mythic";
  else if (offset === 0n && block % (BLOCKS_PER_EPOCH * 6n) === 0n) rarity = "legendary";
  else if (offset === 0n && blockInEpoch === 0n) rarity = "epic";
  else if (offset === 0n && block % BLOCKS_PER_PERIOD === 0n) rarity = "rare";
  else if (offset === 0n) rarity = "uncommon";

  const satStr = sat.toString();
  const satributes = [];
  if (block < 1000n) satributes.push("vintage");
  if (block === 9n) satributes.push("nineball");
  if (satStr === [...satStr].reverse().join("")) satributes.push("palindrome");
  if (sat % 100_000_000n === 0n) satributes.push("alpha");
  if ((sat + 1n) % 100_000_000n === 0n) satributes.push("omega");
  if (subsidy > 0n && offset === subsidy - 1n) satributes.push("black");

  const satYear = new Date(GENESIS_MS + Number(block) * 10 * 60 * 1000).getUTCFullYear();
  return { rarity, satributes, block: Number(block), satYear };
}

const out = {};
let done = 0;
for (const token of raw) {
  const id = token.canonicalTokenId ?? token.tokenId;
  const response = await fetch(`https://ordinals.com/r/inscription/${id}`, {
    headers: { accept: "application/json", "user-agent": "mcv-rarity-hub-sat-importer" },
  });
  if (!response.ok) {
    console.error(`${id}: HTTP ${response.status}`);
    continue;
  }
  const info = await response.json();
  if (typeof info.sat !== "number" && typeof info.sat !== "string") {
    console.error(`${id}: no sat in response`);
    continue;
  }
  const classified = classifySat(info.sat);
  out[id] = {
    sat: String(info.sat),
    satRarity: classified.rarity,
    satributes: classified.satributes,
    satBlock: classified.block,
    satYear: classified.satYear,
    charms: Array.isArray(info.charms) ? info.charms : [],
  };
  done += 1;
  if (done % 50 === 0) console.log(`${done}/${raw.length}`);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

writeJson(path.join(root, "data", "market", "sat-types", `${COLLECTION}.json`), out);
console.log(`wrote ${Object.keys(out).length}/${raw.length} sat records for ${COLLECTION}`);
