import creamCats from "../../data/market/sat-types/cream-cats.json";

export type SatInfo = {
  sat: string;
  satRarity: string;
  satributes: string[];
  satBlock: number;
  satYear: number;
  charms: string[];
};

const satTypesBySlug: Record<string, Record<string, SatInfo>> = {
  "cream-cats": creamCats as Record<string, SatInfo>,
};

export function getSatInfo(collectionSlug: string, tokenId: string): SatInfo | null {
  return satTypesBySlug[collectionSlug]?.[tokenId] ?? null;
}
