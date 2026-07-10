import battlePawss from "../../data/market/opensea-stats/battle-pawss.json";
import marsAlienCats from "../../data/market/opensea-stats/mars-alien-cats.json";
import marsCatsInSpacesuits from "../../data/market/opensea-stats/mars-cats-in-spacesuits.json";
import marsCatsSnipers from "../../data/market/opensea-stats/mars-cats-snipers.json";
import marsCatsVoyage from "../../data/market/opensea-stats/mars-cats-voyage.json";
import metazoku from "../../data/market/opensea-stats/metazoku.json";

type SourceStats = {
  chain: string;
  collectionSlug: string;
  floorPrice: number;
  floorPriceSymbol: string;
  numOwners: number;
  totalVolume: number;
  totalSales: number;
};

const statsBySlug: Record<string, SourceStats[]> = {
  "mars-cats-voyage": marsCatsVoyage,
  "mars-alien-cats": marsAlienCats,
  "mars-cats-in-spacesuits": marsCatsInSpacesuits,
  "mars-cats-snipers": marsCatsSnipers,
  metazoku,
  "battle-pawss": battlePawss,
};

export type MarketStats = {
  numOwners: number;
  totalVolume: number;
  totalSales: number;
  floorPrice: number;
  floorPriceSymbol: string;
};

export function getMarketStats(slug: string): MarketStats | null {
  const sources = statsBySlug[slug];
  if (!sources || sources.length === 0) return null;
  const floors = sources.filter((source) => source.floorPrice > 0);
  return {
    numOwners: Math.max(...sources.map((source) => source.numOwners)),
    totalVolume: sources.reduce((sum, source) => sum + source.totalVolume, 0),
    totalSales: sources.reduce((sum, source) => sum + source.totalSales, 0),
    floorPrice: floors.length > 0 ? Math.min(...floors.map((source) => source.floorPrice)) : 0,
    floorPriceSymbol: sources[0].floorPriceSymbol || "ETH",
  };
}
