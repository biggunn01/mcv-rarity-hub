import { LandingBelowFold } from "@/components/LandingBelowFold";
import { OrbitLanding } from "@/components/OrbitLanding";
import { SiteHeader } from "@/components/SiteHeader";
import { getCollectionSummaries } from "@/lib/rarity-data";

export default function Home() {
  const collections = getCollectionSummaries();

  return (
    <main className="landingShell">
      <SiteHeader />
      <OrbitLanding collections={collections} />
      <LandingBelowFold />
    </main>
  );
}
