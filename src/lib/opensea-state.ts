import type { RankedToken, RarityCollection } from "./types";

type OpenSeaTokenState = {
  ownerAddress: string | null;
};

export async function getOpenSeaTokenState(collection: RarityCollection, token: RankedToken): Promise<OpenSeaTokenState> {
  const source = collection.sources.find((item) => item.chain === token.chain) ?? collection.sources[0];
  const openSea = source?.openSea;
  if (!source || !openSea) return { ownerAddress: null };

  const chain = openSea.type === "contract" ? openSea.chain : toOpenSeaChain(source.chain);
  if (!chain || !source.contractAddress) return { ownerAddress: null };

  try {
    const response = await fetch(
      `https://api.opensea.io/api/v2/chain/${chain}/contract/${source.contractAddress}/nfts/${token.tokenId}`,
      {
        headers: {
          ...(process.env.OPENSEA_API_KEY ? { "x-api-key": process.env.OPENSEA_API_KEY } : {}),
          "user-agent": "mcv-rarity-hub-opensea-token-state",
        },
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) return { ownerAddress: null };
    const payload = await response.json();
    const owner = payload.nft?.owners?.[0]?.address;
    return { ownerAddress: typeof owner === "string" ? owner : null };
  } catch {
    return { ownerAddress: null };
  }
}

function toOpenSeaChain(chain: string) {
  switch (chain) {
    case "Ethereum":
      return "ethereum";
    case "ApeChain":
      return "ape_chain";
    case "Base":
      return "base";
    default:
      return null;
  }
}
