import { OrbitLanding } from "@/components/OrbitLanding";
import { getCollectionSummaries } from "@/lib/rarity-data";

export default function Home() {
  const collections = getCollectionSummaries();

  return (
    <main className="landingShell">
      <OrbitLanding collections={collections} />
    </main>
  );
}
