import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getCollection, getToken } from "@/lib/rarity-data";

type Props = {
  params: Promise<{ collection: string; tokenId: string }>;
};

const collectionLogoMap: Record<string, string> = {
  "mars-cats-voyage": "/collection-logos/mcv-official-logo.png",
  "mars-alien-cats": "/collection-logos/mars-alien-cats.avif",
  "mars-cats-in-spacesuits": "/collection-logos/mars-cats-in-spacesuits.avif",
  "mars-cats-snipers": "/collection-logos/mars-cats-snipers.avif",
  metazoku: "/collection-logos/metazoku-official.png",
  "battle-pawss": "/collection-logos/battle-pawss-planet-logo.png",
  "cream-cats": "/collection-logos/cream-cats.webp",
};

const collectionThemeMap: Record<string, { accent: string; accentRgb: string; warm: string }> = {
  "mars-cats-voyage": { accent: "#ff8a3d", accentRgb: "255, 138, 61", warm: "#ffb45f" },
  "mars-alien-cats": { accent: "#75e6ff", accentRgb: "117, 230, 255", warm: "#b36cff" },
  "mars-cats-in-spacesuits": { accent: "#72d8ff", accentRgb: "114, 216, 255", warm: "#ffffff" },
  "mars-cats-snipers": { accent: "#8dff9f", accentRgb: "141, 255, 159", warm: "#ffdc6c" },
  metazoku: { accent: "#c8ff2f", accentRgb: "200, 255, 47", warm: "#ffe65d" },
  "battle-pawss": { accent: "#1ef9d8", accentRgb: "30, 249, 216", warm: "#f0fdef" },
  "cream-cats": { accent: "#f4cf7a", accentRgb: "244, 207, 122", warm: "#ffffff" },
};

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: Props) {
  const { collection, tokenId } = await params;
  const data = getCollection(collection);
  const token = getToken(collection, tokenId);
  if (!data || !token) notFound();

  const isOrdinalCollection = data.collection.slug === "cream-cats" || data.collection.sources.some((source) => {
    const chain = source.chain.toLowerCase();
    const metadataSource = source.metadataSource.toLowerCase();
    return chain.includes("bitcoin") || chain.includes("btc") || metadataSource.includes("ordinal");
  });
  const firstSource = data.collection.sources.find((source) => source.chain === token.chain) ?? data.collection.sources[0];
  const marketplaceUrl = isOrdinalCollection || firstSource?.marketplaceBaseUrl?.includes("DATA_NEEDED")
    ? null
    : `${firstSource.marketplaceBaseUrl}${token.tokenId}`;
  const explorerUrl = firstSource?.explorerBaseUrl?.includes("DATA_NEEDED")
    ? null
    : `${firstSource.explorerBaseUrl}${token.tokenId}`;
  const scoreExplainer = data.formula.explanation;
  const rawScoreExplainer =
    "Raw score is the sum of included inverse-frequency weights before any collection-specific trait-count scarcity boost is applied.";
  const listingText = isOrdinalCollection ? "Bitcoin Ordinal" : token.listing?.price.display ?? "Not listed";
  const collectionLogo = collectionLogoMap[data.collection.slug];
  const collectionTheme = collectionThemeMap[data.collection.slug] ?? { accent: "#8adce8", accentRgb: "138, 220, 232", warm: "#ff8b63" };

  return (
    <main
      className="shell collectionShell tokenShell marketplaceShell"
      style={{
        "--collection-accent": collectionTheme.accent,
        "--collection-accent-rgb": collectionTheme.accentRgb,
        "--collection-warm": collectionTheme.warm,
      } as CSSProperties}
    >
      <section className="tokenPageTop marketTokenTop">
        <Link href={`/collections/${collection}`} className="backLink">Back to {data.collection.name}</Link>
        {token.isMock && <div className="notice">Mock token</div>}
      </section>

      <section className="tokenLayout marketTokenLayout">
        <div className="tokenArtworkCard">
          <div className="tokenImage" aria-label={`${token.name} image`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={token.image} alt={token.name} />
          </div>
        </div>
        <div className="tokenSidePanel">
          <div className="tokenTitleBlock marketTokenTitle">
            <h1>{token.name}</h1>
            <div className="marketTokenMeta">
              {collectionLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={collectionLogo} alt="" />
              )}
              <span>{data.collection.name}</span>
              <span>{token.chain}</span>
              <span>Token #{token.canonicalTokenId}</span>
            </div>
          </div>
          <div className="tokenFacts marketTokenFacts">
            <dl className="tokenStats marketTokenStats">
              <div>
                <dt>Rank</dt>
                <dd className="rankValue">#{token.rank}</dd>
              </div>
              <div>
                <dt>Trait count</dt>
                <dd>{token.traitCount}</dd>
              </div>
              <div>
                <dt>{isOrdinalCollection ? "Type" : "Listed"}</dt>
                <dd className={!isOrdinalCollection && token.listing?.marketplaceUrl ? "listedValue" : undefined}>
                  {!isOrdinalCollection && token.listing?.marketplaceUrl ? <a href={token.listing.marketplaceUrl}>{listingText}</a> : listingText}
                </dd>
              </div>
              <div>
                <dt>
                  <span className="scoreHelp" tabIndex={0} data-help={scoreExplainer}>Rarity score</span>
                </dt>
                <dd>{token.rarityScore.toFixed(4)}</dd>
              </div>
              <div>
                <dt>
                  <span className="scoreHelp" tabIndex={0} data-help={rawScoreExplainer}>Raw score</span>
                </dt>
                <dd>{token.rawTraitScore.toFixed(4)}</dd>
              </div>
            </dl>
            <div className="links">
              {marketplaceUrl && <a href={marketplaceUrl}>Marketplace</a>}
              {explorerUrl && <a href={explorerUrl}>Explorer</a>}
            </div>
          </div>
        </div>
      </section>

      <section className="section marketTraitSection">
        <div className="marketTraitHeader">
          <h2>Traits</h2>
          <span>{token.attributes.length} traits</span>
        </div>
        <div className="tokenTraitCards">
          {token.attributes.map((trait) => (
            <article className={`tokenTraitCard ${getTraitRarityClass(trait.percentage)}`} key={`${trait.traitType}-${trait.value}`}>
              <span>{trait.traitType}</span>
              <strong>{trait.value}</strong>
              <div>
                <span>{trait.count} total</span>
                <span>Rarity {trait.percentage.toFixed(2)}%</span>
                <span>Weight {trait.rarityWeight.toFixed(2)}</span>
              </div>
              <small>{trait.includedInScore === false ? "Display only" : "Included in score"}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function getTraitRarityClass(percentage: number) {
  if (percentage < 1) return "traitRarityMythic";
  if (percentage < 5) return "traitRarityRare";
  if (percentage < 10) return "traitRarityUncommon";
  if (percentage < 25) return "traitRarityNotable";
  return "traitRarityCommon";
}
