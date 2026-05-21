import fs from "node:fs";

const MARKET_ENDPOINT = "https://web3.okx.com/priapi/v1/nft/secondary/market";
const COLLECTION_URL = "https://web3.okx.com/nft/collection/btc/cream-cats";
const PROJECT_ID = 3274990;
const SATFLOW_RENDERER = "https://rendererv2.satflow.com/render";

const headers = {
  accept: "application/json",
  "content-type": "application/json",
  origin: "https://web3.okx.com",
  referer: COLLECTION_URL,
  "user-agent": "Mozilla/5.0",
};

let cursor = "";
let pageNum = 1;
let total = Infinity;
const records = [];

while (records.length < total) {
  const body = JSON.stringify({
    projectIn: [PROJECT_ID],
    sortBy: "makeOrderUsd",
    address: [],
    pageNum,
    pageSize: 100,
    cursor,
    filterBtcInscriptionPending: true,
  });
  const response = await fetch(MARKET_ENDPOINT, { method: "POST", headers, body });
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(`OKX Cream Cats import failed: ${JSON.stringify(payload).slice(0, 500)}`);

  const data = payload.data ?? {};
  const list = data.list ?? [];
  total = Number(data.total ?? total);
  records.push(...list);
  if (!data.cursor || list.length === 0) break;
  cursor = data.cursor;
  pageNum += 1;
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const unique = [...new Map(records.map((record) => [record.tokenId, record])).values()];
const tokens = unique.map(normalizeRecord).sort((a, b) => {
  return Number(a.inscriptionNumber || 0) - Number(b.inscriptionNumber || 0) || a.name.localeCompare(b.name);
});

fs.writeFileSync("data/raw/imported/cream-cats.json", `${JSON.stringify(tokens, null, 2)}\n`);
console.log(`Imported ${tokens.length} Cream Cats records from OKX.`);

function normalizeRecord(item) {
  let attrs = [];
  try {
    attrs = JSON.parse(item.specialProperties || "[]");
  } catch {
    attrs = [];
  }

  const name = String(item.name || "")
    .replace(/\uFF03/g, "#")
    .replace(/\uFF08/g, "(")
    .replace(/\uFF09/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  const inscriptionNumber = String(item.info || "").match(/#?(\d+)/)?.[1] ?? name.match(/#(\d+)\)/)?.[1] ?? "";

  return {
    tokenId: item.tokenId,
    canonicalTokenId: item.tokenId,
    name: name || `Cream Cats #${item.tokenId}`,
    image: item.resourceUrl || item.coverUrl || item.thumbnailUrl || satflowRenderUrl(item.tokenId),
    chain: "Bitcoin",
    source: "okx:btc:cream-cats",
    isMock: false,
    ownerAddress: item.ownerAddress || null,
    inscriptionNumber,
    okxId: item.id,
    okxProjectId: item.project,
    okxOpenRarityRank: Array.isArray(item.openRarity) ? (item.openRarity[0]?.rank ?? null) : null,
    okxLastPrice: item.lastPrice || null,
    attributes: attrs
      .map((attr) => ({
        trait_type: String(attr.name || "Unknown"),
        value: String(attr.key || "Unknown"),
      }))
      .filter((attr) => attr.trait_type !== "Unknown" && attr.value !== "Unknown"),
  };
}

function satflowRenderUrl(inscriptionId) {
  return `${SATFLOW_RENDERER}?id=${encodeURIComponent(inscriptionId)}&size=600`;
}
