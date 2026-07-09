import { LandingBelowFold } from "@/components/LandingBelowFold";
import { OrbitLanding } from "@/components/OrbitLanding";
import { getCollection, getCollectionSlugs, getCollectionSummaries } from "@/lib/rarity-data";

export default function Home() {
  const collections = getCollectionSummaries();
  const chainCount = new Set(
    getCollectionSlugs().flatMap((slug) => getCollection(slug)?.collection.sources.map((source) => source.chain.toLowerCase()) ?? []),
  ).size;

  return (
    <main className="landingShell">
      <OrbitLanding collections={collections} chainCount={chainCount} />
      <LandingBelowFold />
    </main>
  );
}
