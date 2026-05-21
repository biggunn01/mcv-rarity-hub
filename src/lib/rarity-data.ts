import battlePawss from "../../data/processed/battle-pawss.json";
import creamCats from "../../data/processed/cream-cats.json";
import marsAlienCats from "../../data/processed/mars-alien-cats.json";
import marsCatsInSpacesuits from "../../data/processed/mars-cats-in-spacesuits.json";
import marsCatsSnipers from "../../data/processed/mars-cats-snipers.json";
import rarityIndex from "../../data/processed/rarity-index.json";
import marsCatsVoyage from "../../data/processed/mars-cats-voyage.json";
import metazoku from "../../data/processed/metazoku.json";
import type { CollectionSummary, RankedToken, RarityData, RarityIndex } from "./types";

const collections = {
  "mars-cats-voyage": marsCatsVoyage as RarityData,
  "mars-alien-cats": marsAlienCats as RarityData,
  "mars-cats-in-spacesuits": marsCatsInSpacesuits as RarityData,
  "mars-cats-snipers": marsCatsSnipers as RarityData,
  metazoku: metazoku as RarityData,
  "battle-pawss": battlePawss as RarityData,
  "cream-cats": creamCats as RarityData,
};

export function getRarityIndex() {
  return rarityIndex as RarityIndex;
}

export function getCollections() {
  return Object.values(collections);
}

export function getCollectionSummaries(): CollectionSummary[] {
  return Object.values(collections).map((entry) => ({ collection: entry.collection }));
}

export function getCollection(slug: string) {
  return collections[slug as keyof typeof collections] ?? null;
}

export function getToken(collectionSlug: string, tokenId: string): RankedToken | null {
  const collection = getCollection(collectionSlug);
  if (!collection) return null;
  return (
    collection.tokens.find(
      (token) => token.tokenId === tokenId || token.canonicalTokenId === tokenId,
    ) ?? null
  );
}

export function getCollectionSlugs() {
  return Object.keys(collections);
}
