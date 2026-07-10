import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { displayCollectionName } from "@/lib/display-names";
import { getCollection, getCollectionSlugs } from "@/lib/rarity-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

type Match = {
  slug: string;
  collectionName: string;
  tokenName: string;
  canonicalTokenId: string;
  image: string;
  rank: number;
  rarityScore: number;
};

export async function generateMetadata() {
  return {
    title: "Search a token · MCV Rarity Hub",
    description: "Look up any token ID across all seven Mars Cats Ventures collections and jump straight to its rarity rank.",
  };
}

function findMatches(query: string): Match[] {
  const normalized = query.replace(/^#/, "").trim();
  if (!normalized) return [];
  const idPattern = new RegExp(`#${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`);

  return getCollectionSlugs().flatMap((slug) => {
    const data = getCollection(slug);
    if (!data) return [];
    return data.tokens
      .filter(
        (token) =>
          String(token.canonicalTokenId) === normalized ||
          String(token.tokenId) === normalized ||
          idPattern.test(token.name),
      )
      .slice(0, 4)
      .map((token) => ({
        slug,
        collectionName: displayCollectionName(slug, data.collection.name),
        tokenName: token.name.replace(/\s*\(#\d+\)\s*$/, ""),
        canonicalTokenId: String(token.canonicalTokenId),
        image: token.image,
        rank: token.rank,
        rarityScore: token.rarityScore,
      }));
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const matches = query ? findMatches(query) : [];

  if (matches.length === 1) {
    redirect(`/tokens/${matches[0].slug}/${matches[0].canonicalTokenId}`);
  }

  return (
    <main className="shell collectionShell marketplaceShell searchShell">
      <SiteHeader />
      <section className="searchBody" aria-label="Token search">
        <p className="eyebrow">Universal lookup</p>
        <h1 className="searchTitle">Find any token&apos;s rank.</h1>
        <p className="lede">One ID, seven collections — we&apos;ll match it across every world.</p>
        <form className="heroSearch searchPageForm" action="/search" role="search">
          <input
            name="q"
            inputMode="numeric"
            placeholder="Token ID — e.g. 7865"
            defaultValue={query}
            aria-label="Search a token ID across all collections"
          />
          <button type="submit">Check rarity</button>
        </form>

        {query && matches.length === 0 && (
          <p className="searchEmpty">
            No signal on <strong>&ldquo;{query}&rdquo;</strong> in any charted world. Token IDs are numeric — try the number from the token&apos;s name.
          </p>
        )}

        {matches.length > 1 && (
          <>
            <p className="searchMeta">
              {matches.length} matches across the system — pick your world.
            </p>
            <div className="nearbyRanksRow searchResults">
              {matches.map((match) => (
                <Link
                  key={`${match.slug}-${match.canonicalTokenId}`}
                  href={`/tokens/${match.slug}/${match.canonicalTokenId}`}
                  className="nearbyRankCard"
                  style={{ "--nb-image": `url(${match.image})` } as CSSProperties}
                >
                  <span className="nearbyRankArt" aria-hidden="true" />
                  <span className="nearbyRankRank">#{match.rank.toLocaleString()}</span>
                  <span className="nearbyRankName">{match.tokenName}</span>
                  <span className="searchResultCollection">{match.collectionName}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
