import Link from "next/link";
import type { CSSProperties } from "react";
import { getCollection, getCollectionSlugs } from "@/lib/rarity-data";

const accentMap: Record<string, { accent: string; accentRgb: string }> = {
  "mars-cats-voyage": { accent: "#ff9a32", accentRgb: "255, 154, 50" },
  "mars-alien-cats": { accent: "#75e6ff", accentRgb: "117, 230, 255" },
  "mars-cats-in-spacesuits": { accent: "#9bdcff", accentRgb: "155, 220, 255" },
  "mars-cats-snipers": { accent: "#8dff9f", accentRgb: "141, 255, 159" },
  metazoku: { accent: "#c8ff2f", accentRgb: "200, 255, 47" },
  "battle-pawss": { accent: "#1ef9d8", accentRgb: "30, 249, 216" },
  "cream-cats": { accent: "#f4cf7a", accentRgb: "244, 207, 122" },
};

type Spotlight = {
  slug: string;
  collectionName: string;
  tokenName: string;
  image: string;
  score: string;
  supply: number;
  floorText: string;
  listedText: string;
  tokenHref: string;
  collectionHref: string;
  accent: string;
  accentRgb: string;
};

function buildSpotlights(): Spotlight[] {
  return getCollectionSlugs()
    .map((slug) => {
      const data = getCollection(slug);
      if (!data) return null;
      const top = data.tokens.find((token) => token.rank === 1) ?? data.tokens[0];
      if (!top) return null;
      const listedTokens = data.tokens.filter((token) => token.listing);
      const floorListing = listedTokens.reduce<(typeof listedTokens)[number] | null>((floor, token) => {
        if (!token.listing) return floor;
        if (!floor?.listing) return token;
        return token.listing.price.native < floor.listing.price.native ? token : floor;
      }, null);
      const satflow = data.collection.sources.find((source) => source.satflow)?.satflow ?? null;
      const floorText =
        floorListing?.listing?.price.display ??
        (satflow?.floorPrice !== undefined ? `${satflow.floorPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${satflow.floorPriceUnit ?? "BTC"}` : "—");
      const listedCount = listedTokens.length > 0 ? listedTokens.length : satflow?.totalListed ?? 0;
      const theme = accentMap[slug] ?? { accent: "#8adce8", accentRgb: "138, 220, 232" };
      return {
        slug,
        collectionName: data.collection.name,
        tokenName: top.name,
        image: top.image,
        score: top.rarityScore.toFixed(2),
        supply: data.collection.actualTokenCount,
        floorText,
        listedText: listedCount > 0 ? `${listedCount.toLocaleString()} listed` : "unlisted market",
        tokenHref: `/tokens/${slug}/${top.canonicalTokenId}`,
        collectionHref: `/collections/${slug}`,
        accent: theme.accent,
        accentRgb: theme.accentRgb,
      };
    })
    .filter((spotlight): spotlight is Spotlight => spotlight !== null);
}

export function LandingBelowFold() {
  const spotlights = buildSpotlights();
  const totalRanked = spotlights.reduce((sum, spotlight) => sum + spotlight.supply, 0);
  const chainCount = new Set(
    getCollectionSlugs().flatMap((slug) => getCollection(slug)?.collection.sources.map((source) => source.chain.toLowerCase()) ?? []),
  ).size;
  const tickerItems = spotlights.map((spotlight) => ({
    slug: spotlight.slug,
    label: spotlight.collectionName,
    floor: spotlight.floorText,
    listed: spotlight.listedText,
    supply: spotlight.supply,
    accent: spotlight.accent,
  }));

  return (
    <>
      <div className="rarityTicker" aria-hidden="true">
        <div className="rarityTickerTrack">
          {[0, 1].map((copy) => (
            <div className="rarityTickerGroup" key={copy}>
              {tickerItems.map((item) => (
                <span className="rarityTickerItem" key={`${copy}-${item.slug}`} style={{ "--tick-accent": item.accent } as CSSProperties}>
                  <span className="rarityTickerDot" />
                  <span className="rarityTickerName">{item.label}</span>
                  <span className="rarityTickerStat">{item.supply.toLocaleString()} ranked</span>
                  <span className="rarityTickerStat">floor {item.floor}</span>
                  <span className="rarityTickerStat">{item.listed}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="hallOfRarest" id="hall-of-rarest" aria-label="Hall of Rarest — the top ranked token of every collection">
        <span className="hallGhostTitle" aria-hidden="true">Rarest</span>
        <header className="hallHeader">
          <p className="eyebrow">Signal archive · Hall of Rarest</p>
          <h2>
            One specimen outranks
            <br />
            every other on its world.
          </h2>
          <p className="lede">The single #1-ranked token from each of the seven MCV collections — pulled live from the same scoring data that powers the tables.</p>
        </header>
        <ol className="hallGrid">
          {spotlights.map((spotlight, index) => (
            <li
              className="hallCard"
              key={spotlight.slug}
              style={{ "--hall-accent": spotlight.accent, "--hall-rgb": spotlight.accentRgb, "--hall-i": index } as CSSProperties}
            >
              <Link href={spotlight.tokenHref} className="hallCardLink" aria-label={`Open ${spotlight.tokenName}, rank 1 of ${spotlight.collectionName}`}>
                <span className="hallCardRank">
                  <em>#1</em> / {spotlight.supply.toLocaleString()}
                </span>
                <span className="hallCardArt" style={{ "--hall-image": `url(${spotlight.image})` } as CSSProperties}>
                  <span className="hallCardTick hallCardTickTl" aria-hidden="true" />
                  <span className="hallCardTick hallCardTickBr" aria-hidden="true" />
                </span>
                <span className="hallCardMeta">
                  <span className="hallCardCollection">{spotlight.collectionName}</span>
                  <span className="hallCardToken">{spotlight.tokenName}</span>
                  <span className="hallCardScore">score {spotlight.score}</span>
                </span>
              </Link>
              <Link href={spotlight.collectionHref} className="hallCardExplore">
                Enter rarity table
              </Link>
            </li>
          ))}
          <li className="hallCard hallStatCard" aria-label={`${totalRanked.toLocaleString()} tokens ranked in total`}>
            <span className="hallStatNumber">{totalRanked.toLocaleString()}</span>
            <span className="hallStatLabel">tokens ranked across {spotlights.length} worlds · {chainCount} chains</span>
            <span className="hallStatRule" aria-hidden="true" />
            <span className="hallStatHint">Every score recomputed from raw trait data</span>
          </li>
        </ol>
      </section>

      <footer className="siteFooter">
        <p className="siteFooterWordmark" aria-hidden="true">Mars Cats</p>
        <div className="siteFooterRow">
          <p className="siteFooterNote">
            Mars Cats Ventures Rarity Hub — trait-weighted rankings across {spotlights.length} collections and {chainCount} chains, recomputed from imported metadata.
          </p>
          <nav className="siteFooterNav" aria-label="Collections">
            {spotlights.map((spotlight) => (
              <Link href={spotlight.collectionHref} key={spotlight.slug} style={{ "--foot-accent": spotlight.accent } as CSSProperties}>
                {spotlight.collectionName}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
