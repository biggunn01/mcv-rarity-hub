import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ClientSortLink, CollectionFilterForm, FilterBubbleLink } from "@/components/CollectionFilterControls";
import { getCollection, getCollectionSlugs } from "@/lib/rarity-data";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    traitCount?: string | string[];
    trait?: string | string[];
    category?: string | string[];
    sort?: string;
    page?: string;
    listed?: string;
  }>;
};

const PAGE_SIZE = 50;

const collectionLogoMap: Record<string, string> = {
  "mars-cats-voyage": "/collection-logos/mcv-official-logo.png",
  "mars-alien-cats": "/collection-logos/mars-alien-cats.avif",
  "mars-cats-in-spacesuits": "/collection-logos/mars-cats-in-spacesuits.avif",
  "mars-cats-snipers": "/collection-logos/mars-cats-snipers.avif",
  metazoku: "/collection-logos/metazoku.avif",
  "battle-pawss": "/collection-logos/battle-pawss.avif",
  "cream-cats": "/collection-logos/cream-cats.webp",
};

const collectionThemeMap: Record<string, { accent: string; accentRgb: string; warm: string }> = {
  "mars-cats-voyage": { accent: "#ff8a3d", accentRgb: "255, 138, 61", warm: "#ffb45f" },
  "mars-alien-cats": { accent: "#75e6ff", accentRgb: "117, 230, 255", warm: "#b36cff" },
  "mars-cats-in-spacesuits": { accent: "#72d8ff", accentRgb: "114, 216, 255", warm: "#ffffff" },
  "mars-cats-snipers": { accent: "#8dff9f", accentRgb: "141, 255, 159", warm: "#ffdc6c" },
  metazoku: { accent: "#c8ff2f", accentRgb: "200, 255, 47", warm: "#ffe65d" },
  "battle-pawss": { accent: "#ff6a3d", accentRgb: "255, 106, 61", warm: "#ffd36f" },
  "cream-cats": { accent: "#f4cf7a", accentRgb: "244, 207, 122", warm: "#ffffff" },
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getCollectionSlugs().map((slug) => ({ slug }));
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const filters = await searchParams;
  const data = getCollection(slug);
  if (!data) notFound();

  const query = typeof filters.q === "string" ? filters.q.trim().toLowerCase() : "";
  const traitCounts = toArray(filters.traitCount).map(Number).filter(Number.isFinite);
  const selectedTraits = toArray(filters.trait);
  const sort = filters.sort ?? "rank-asc";
  const listedOnly = filters.listed === "true";
  const currentPage = Math.max(1, Number(filters.page ?? 1) || 1);
  const traitCountScarcityExponent = data.formula.traitCountScarcityExponent ?? 0;
  const selectedTraitGroups = selectedTraits.reduce<Record<string, Set<string>>>((groups, encoded) => {
    const [traitType, value] = splitTrait(encoded);
    if (!traitType || !value) return groups;
    groups[traitType] ??= new Set();
    groups[traitType].add(value);
    return groups;
  }, {});

  const filteredTokens = data.tokens.filter((token) => {
    const matchesQuery = !query || matchesTokenSearch(token, query);
    const matchesTraitCount = traitCounts.length === 0 || traitCounts.includes(token.traitCount);
    const matchesTraits = Object.entries(selectedTraitGroups).every(([traitType, values]) =>
      token.attributes.some((attribute) => attribute.traitType === traitType && values.has(attribute.value)),
    );
    const matchesListed = !listedOnly || Boolean(token.listing);
    return matchesQuery && matchesTraitCount && matchesTraits && matchesListed;
  });
  filteredTokens.sort((a, b) => {
    if (sort.startsWith("category:")) {
      const [, traitType, direction] = sort.split(":");
      const aValue = traitType === "Chain" ? a.chain : getTraitValue(a.attributes, traitType);
      const bValue = traitType === "Chain" ? b.chain : getTraitValue(b.attributes, traitType);
      const compared = aValue.localeCompare(bValue) || a.rank - b.rank;
      return direction === "desc" ? compared * -1 : compared;
    }
    switch (sort) {
      case "rank-desc":
        return b.rank - a.rank;
      case "score-desc":
        return b.rarityScore - a.rarityScore || a.rank - b.rank;
      case "score-asc":
        return a.rarityScore - b.rarityScore || a.rank - b.rank;
      case "trait-count-desc":
        return b.traitCount - a.traitCount || a.rank - b.rank;
      case "trait-count-asc":
        return a.traitCount - b.traitCount || a.rank - b.rank;
      case "listed-desc":
        return listingSortValue(b) - listingSortValue(a) || a.rank - b.rank;
      case "listed-asc":
        return listingSortValue(a) - listingSortValue(b) || a.rank - b.rank;
      case "token-asc":
        return Number(a.canonicalTokenId) - Number(b.canonicalTokenId) || a.canonicalTokenId.localeCompare(b.canonicalTokenId);
      case "token-desc":
        return Number(b.canonicalTokenId) - Number(a.canonicalTokenId) || b.canonicalTokenId.localeCompare(a.canonicalTokenId);
      case "rank-asc":
      default:
        return a.rank - b.rank;
    }
  });
  const totalPages = Math.max(1, Math.ceil(filteredTokens.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const tokens = filteredTokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (listedOnly) params.set("listed", "true");
    for (const count of toArray(filters.traitCount)) params.append("traitCount", count);
    for (const trait of selectedTraits) params.append("trait", trait);
    if (sort !== "rank-asc") params.set("sort", sort);
    if (targetPage > 1) params.set("page", String(targetPage));
    const queryString = params.toString();
    return `/collections/${slug}${queryString ? `?${queryString}` : ""}`;
  };

  const sortHref = (nextSort: string) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (listedOnly) params.set("listed", "true");
    for (const count of toArray(filters.traitCount)) params.append("traitCount", count);
    for (const trait of selectedTraits) params.append("trait", trait);
    if (nextSort !== "rank-asc") params.set("sort", nextSort);
    const queryString = params.toString();
    return `/collections/${slug}${queryString ? `?${queryString}` : ""}`;
  };
  const hasTraitFilters = traitCounts.length > 0 || selectedTraits.length > 0;
  const activeFilterBubbles = [
    ...traitCounts.map((count) => ({
      key: `traitCount-${count}`,
      label: `${count} traits`,
      href: filterHref({ removeTraitCount: String(count) }),
    })),
    ...selectedTraits.map((trait) => {
      const [traitType, value] = splitTrait(trait);
      return {
        key: `trait-${trait}`,
        label: `${traitType}: ${value}`,
        href: filterHref({ removeTrait: trait }),
      };
    }),
    ...(listedOnly
      ? [
          {
            key: "listed",
            label: "Listed only",
            href: filterHref({ listed: false }),
          },
        ]
      : []),
  ];
  const collectionLogo = collectionLogoMap[data.collection.slug];
  const collectionTheme = collectionThemeMap[data.collection.slug] ?? { accent: "#8adce8", accentRgb: "138, 220, 232", warm: "#ff8b63" };
  const topScore = data.tokens.reduce((max, token) => Math.max(max, token.rarityScore), 0);
  const primaryChain = data.collection.sources[0]?.chain ?? tokens[0]?.chain ?? "Mixed";
  const filterStateKey = JSON.stringify({
    q: filters.q ?? "",
    traitCounts: toArray(filters.traitCount),
    selectedTraits,
    listedOnly,
    sort,
  });

  function filterHref(options: { removeTraitCount?: string; removeTrait?: string; listed?: boolean } = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    const nextListed = options.listed ?? listedOnly;
    if (nextListed) params.set("listed", "true");
    for (const count of toArray(filters.traitCount)) {
      if (count !== options.removeTraitCount) params.append("traitCount", count);
    }
    for (const trait of selectedTraits) {
      if (trait !== options.removeTrait) params.append("trait", trait);
    }
    if (sort !== "rank-asc") params.set("sort", sort);
    const queryString = params.toString();
    return `/collections/${slug}${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <main
      className="shell collectionShell marketplaceShell"
      style={{
        "--collection-accent": collectionTheme.accent,
        "--collection-accent-rgb": collectionTheme.accentRgb,
        "--collection-warm": collectionTheme.warm,
      } as CSSProperties}
    >
      <section className="marketCollectionHeader">
        <div className="marketCollectionTitle">
          {collectionLogo && (
            <div className="collectionHeaderLogo" aria-hidden="true">
              <Image src={collectionLogo} alt="" fill sizes="96px" priority />
            </div>
          )}
          <div>
            <h1>{data.collection.name}</h1>
            <p className="marketSubtitle">Rarity rankings</p>
          </div>
        </div>
        <div className="marketHeaderActions">
          <div className="rankedBadge">
            <span aria-hidden="true" />
            {data.collection.actualTokenCount.toLocaleString()} tokens ranked
          </div>
          <Link href="/" className="marketBackLink">Back</Link>
        </div>
      </section>

      <section className="marketStats" aria-label={`${data.collection.name} overview`}>
        <div>
          <span>Collection</span>
          <strong>{data.collection.actualTokenCount.toLocaleString()}</strong>
        </div>
        <div>
          <span>Top score</span>
          <strong>{topScore.toFixed(2)}</strong>
        </div>
        <div>
          <span>Chain</span>
          <strong>{primaryChain}</strong>
        </div>
        <div>
          <span>Page</span>
          <strong>{page} of {totalPages}</strong>
        </div>
      </section>

      {data.collection.hasMockData && (
        <div className="notice">
          {data.collection.hasMockData ? "Mock data only." : `${data.collection.actualTokenCount.toLocaleString()} ranked tokens from imported metadata`}
        </div>
      )}

      <section className="marketCollectionGrid">
        <aside className="filterBar marketFilterRail" aria-label="Collection filters">
          <CollectionFilterForm key={filterStateKey}>
            <label className="marketControlGroup">
              <span>Search</span>
              <input name="q" placeholder="Token ID..." defaultValue={filters.q ?? ""} />
            </label>
            {sort !== "rank-asc" && <input type="hidden" name="sort" value={sort} />}
            <div className="filterActions topFilterActions">
              <label className="listedToggle">
                <input name="listed" type="checkbox" value="true" defaultChecked={listedOnly} />
                <span>Listed</span>
              </label>
              <Link href={`/collections/${slug}`}>Clear all</Link>
            </div>
            <div className="traitValueFilters">
              <details className="traitCategory traitParent" open>
                <summary>
                  <span>Traits</span>
                  <small>{hasTraitFilters ? "Filtered" : `${data.categories.length} groups`}</small>
                </summary>
                <div className="nestedTraitGroups">
                  <details className="traitCategory">
                    <summary>
                      <span>Trait Count</span>
                      <small>{traitCounts.length ? "Filtered" : `${[...new Set(data.tokens.map((token) => token.traitCount))].length}`}</small>
                    </summary>
                    <div className="traitOptionGrid">
                      {[...new Set(data.tokens.map((token) => token.traitCount))]
                        .sort((a, b) => a - b)
                        .map((count) => (
                          <label key={count}>
                            <input name="traitCount" type="checkbox" value={count} defaultChecked={traitCounts.includes(count)} />
                            <span>{count} traits</span>
                          </label>
                        ))}
                    </div>
                  </details>

                  {data.categories.map((category) => {
                    const isFiltered = selectedTraits.some((traitValue) => traitValue.startsWith(`${category.traitType}:`));
                    return (
                      <details className="traitCategory" key={category.traitType}>
                        <summary>
                          <span>{category.traitType}</span>
                          <small>{isFiltered ? "Filtered" : category.values.length}</small>
                        </summary>
                        <div className="traitOptionGrid">
                          {category.values.map((traitValue) => {
                            const value = `${traitValue.traitType}:${traitValue.value}`;
                            return (
                              <label key={value}>
                                <input name="trait" type="checkbox" value={value} defaultChecked={selectedTraits.includes(value)} />
                                <span>{traitValue.value}</span>
                                <small>{traitValue.count}</small>
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            </div>
            {activeFilterBubbles.length > 0 && (
              <div className="activeFilters" aria-label="Selected filters">
                {activeFilterBubbles.map((filter) => (
                  <FilterBubbleLink href={filter.href} key={filter.key}>
                    <span>{filter.label}</span>
                    <span aria-hidden="true">x</span>
                  </FilterBubbleLink>
                ))}
              </div>
            )}
          </CollectionFilterForm>
        </aside>

        <div className="tableWrap marketTableWrap">
          <div className="tableMeta">
            <span>Showing {tokens.length.toLocaleString()} of {filteredTokens.length.toLocaleString()} tokens</span>
            <span>Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
          </div>
          <table className="marketRankTable">
            <thead>
              <tr>
                <th><ClientSortLink href={sortHref(sort === "rank-asc" ? "rank-desc" : "rank-asc")}>Rank</ClientSortLink></th>
                <th>Preview</th>
                <th><ClientSortLink href={sortHref(sort === "token-asc" ? "token-desc" : "token-asc")}>Token</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "score-desc" ? "score-asc" : "score-desc")}>Score</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "trait-count-desc" ? "trait-count-asc" : "trait-count-desc")}>Traits</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "listed-asc" ? "listed-desc" : "listed-asc")}>Listed</ClientSortLink></th>
                <th>Key Traits</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const isOneOfOneTier = data.collection.slug === "metazoku" && token.rank <= 4;
                return (
                <tr className={isOneOfOneTier ? "oneOfOneTier" : undefined} key={token.canonicalTokenId}>
                  <td className={`rankCell ${isOneOfOneTier ? "isOneOfOne" : ""}`}>#{token.rank}</td>
                  <td>
                    <Link
                      className="tokenThumb"
                      href={`/tokens/${data.collection.slug}/${token.canonicalTokenId}`}
                      aria-label={`Open ${token.name}`}
                      style={{ "--thumb-image": `url(${token.image})` } as CSSProperties}
                    >
                      <span />
                    </Link>
                  </td>
                  <td>
                    <Link href={`/tokens/${data.collection.slug}/${token.canonicalTokenId}`}>
                      <span className="tokenName">{token.name}</span>
                      <span className="tokenChain">{token.chain}</span>
                    </Link>
                  </td>
                  <td className="scoreCell">{token.rarityScore.toFixed(2)}</td>
                  <td>
                    <span className="traitCountPill" title={`${token.traitCount} scoring traits`}>{token.traitCount} traits</span>
                  </td>
                  <td>
                    <span className="listingPill">
                    {token.listing?.marketplaceUrl ? (
                      <a href={token.listing.marketplaceUrl}>{token.listing.price.display}</a>
                    ) : (
                      "Unlisted"
                    )}
                    </span>
                  </td>
                  <td className="keyTraitsCell">{token.attributes.slice(0, 3).map((item) => `${item.value}`).join(" - ")}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <nav className="pagination" aria-label="Token result pages">
          <Link aria-disabled={page <= 1} className={page <= 1 ? "disabled" : ""} href={pageHref(Math.max(1, page - 1))}>
            Previous
          </Link>
          <span>Page {page} / {totalPages}</span>
          <Link aria-disabled={page >= totalPages} className={page >= totalPages ? "disabled" : ""} href={pageHref(Math.min(totalPages, page + 1))}>
            Next
          </Link>
        </nav>
      </section>

      <section className="section">
        <details className="traitExplorer">
          <summary>
            <span>Trait Explorer</span>
            <small>{data.categories.length.toLocaleString()} categories</small>
          </summary>
          <div className="traitExplorerFormula">
            <p><strong>Trait weight</strong> = collection supply / number of tokens with that trait</p>
            {traitCountScarcityExponent > 0 ? (
              <>
                <p><strong>Base trait average</strong> = sum of non-Trait Count trait weights / token trait count</p>
                <p><strong>Trait Count boost</strong> = (collection supply / tokens with same trait count)<sup>{traitCountScarcityExponent}</sup></p>
                <p><strong>Rarity score</strong> = base trait average x Trait Count boost</p>
              </>
            ) : (
              <p><strong>Rarity score</strong> = sum of all scoring trait weights / scoring trait count</p>
            )}
            <p><strong>Rank order</strong> = rarity score high to low, then raw score high to low, then lower trait count, then token ID.</p>
          </div>
          <div className="traitGrid">
            {data.categories.map((category) => (
              <details className="traitCard" key={category.traitType}>
                <summary>
                  <span>{category.traitType}</span>
                </summary>
                <p>{category.tokenCoveragePercentage.toFixed(2)}% token coverage</p>
                <ul>
                  {category.values.map((traitValue) => (
                    <li key={`${traitValue.traitType}-${traitValue.value}`}>
                      <span>{traitValue.value}</span>
                      <span>{traitValue.count} / {traitValue.percentage.toFixed(2)}% / weight {traitValue.rarityWeight.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}

function toArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function splitTrait(encoded: string) {
  const index = encoded.indexOf(":");
  if (index === -1) return ["", ""];
  return [encoded.slice(0, index), encoded.slice(index + 1)];
}

function getTraitValue(attributes: Array<{ traitType: string; value: string }>, traitType: string) {
  return attributes.find((attribute) => attribute.traitType === traitType)?.value ?? "";
}

function listingSortValue(token: { listing?: { price: { native: number } } | null }) {
  return token.listing?.price.native ?? Number.POSITIVE_INFINITY;
}

function matchesTokenSearch(token: { tokenId: string; canonicalTokenId: string; name: string }, query: string) {
  if (/^\d+$/.test(query)) {
    const displayTokenId = token.name.match(/#(\d+)/)?.[1];
    return displayTokenId === query || token.tokenId === query || token.canonicalTokenId === query;
  }

  return (
    token.tokenId.toLowerCase().includes(query) ||
    token.canonicalTokenId.toLowerCase().includes(query) ||
    token.name.toLowerCase().includes(query)
  );
}
