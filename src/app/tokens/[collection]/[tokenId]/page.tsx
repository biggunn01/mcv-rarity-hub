import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, getToken } from "@/lib/rarity-data";

type Props = {
  params: Promise<{ collection: string; tokenId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: Props) {
  const { collection, tokenId } = await params;
  const data = getCollection(collection);
  const token = getToken(collection, tokenId);
  if (!data || !token) notFound();

  const firstSource = data.collection.sources.find((source) => source.chain === token.chain) ?? data.collection.sources[0];
  const marketplaceUrl = firstSource?.marketplaceBaseUrl?.includes("DATA_NEEDED")
    ? null
    : `${firstSource.marketplaceBaseUrl}${token.tokenId}`;
  const explorerUrl = firstSource?.explorerBaseUrl?.includes("DATA_NEEDED")
    ? null
    : `${firstSource.explorerBaseUrl}${token.tokenId}`;
  const scoreExplainer = data.formula.explanation;
  const rawScoreExplainer =
    "Raw score is the sum of included inverse-frequency weights before any collection-specific trait-count scarcity boost is applied.";
  const listingText = token.listing?.price.display ?? "Not listed";

  return (
    <main className="shell collectionShell tokenShell">
      <section className="tokenPageTop">
        <Link href={`/collections/${collection}`} className="backLink">Back to {data.collection.name}</Link>
        {token.isMock && <div className="notice">Mock token</div>}
      </section>

      <section className="tokenLayout">
        <div className="tokenArtworkCard">
          <div className="tokenImage" aria-label={`${token.name} image`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={token.image} alt={token.name} />
          </div>
          <div className="tokenImageTitle">
            <strong>{token.name}</strong>
          </div>
        </div>
        <div className="tokenSidePanel">
          <div className="tokenTitleBlock">
          <p className="eyebrow">{data.collection.name}</p>
          <h1>{token.name}</h1>
          <p className="tokenRankDisplay">Rank #{token.rank}</p>
          <p className="lede">Score {token.rarityScore.toFixed(4)} across {token.traitCount} traits on {token.chain}.</p>
          </div>
          <div className="tokenFacts">
            <dl className="tokenStats">
              <div>
                <dt>Listed</dt>
                <dd>{token.listing?.marketplaceUrl ? <a href={token.listing.marketplaceUrl}>{listingText}</a> : listingText}</dd>
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

      <section className="section">
        <h2>Traits</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Value</th>
                <th>Count</th>
                <th>Percentage</th>
                <th>Weight</th>
                <th>Scoring</th>
              </tr>
            </thead>
            <tbody>
              {token.attributes.map((trait) => (
                <tr key={`${trait.traitType}-${trait.value}`}>
                  <td>{trait.traitType}</td>
                  <td>{trait.value}</td>
                  <td>{trait.count}</td>
                  <td>{trait.percentage.toFixed(2)}%</td>
                  <td>{trait.rarityWeight.toFixed(4)}</td>
                  <td>{trait.includedInScore === false ? "Display only" : "Included in score"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
