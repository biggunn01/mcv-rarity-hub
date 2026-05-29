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
    status?: string;
    chain?: string;
    rankMin?: string;
    rankMax?: string;
    rarityMin?: string;
    rarityMax?: string;
    priceMin?: string;
    priceMax?: string;
  }>;
};

const PAGE_SIZE = 50;

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
  "battle-pawss": { accent: "#51b8ff", accentRgb: "81, 184, 255", warm: "#51e1d6" },
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
  const statusFilter = filters.status === "listed" || filters.listed === "true" ? "listed" : filters.status === "unlisted" ? "unlisted" : "all";
  const selectedChain = typeof filters.chain === "string" ? filters.chain : "";
  const listedOnly = statusFilter === "listed";
  const unlistedOnly = statusFilter === "unlisted";
  const rarityMin = parseOptionalNumber(filters.rarityMin);
  const rarityMax = parseOptionalNumber(filters.rarityMax);
  const rankMin = parseOptionalNumber(filters.rankMin);
  const rankMax = parseOptionalNumber(filters.rankMax);
  const priceMin = parseOptionalNumber(filters.priceMin);
  const priceMax = parseOptionalNumber(filters.priceMax);
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
    const matchesStatus =
      statusFilter === "all" ||
      (listedOnly && Boolean(token.listing)) ||
      (unlistedOnly && !token.listing);
    const matchesChain = !selectedChain || token.chain === selectedChain;
    const matchesRarityMin = rarityMin === null || token.rarityScore >= rarityMin;
    const matchesRarityMax = rarityMax === null || token.rarityScore <= rarityMax;
    const matchesRankMin = rankMin === null || token.rank >= rankMin;
    const matchesRankMax = rankMax === null || token.rank <= rankMax;
    const listingPrice = token.listing?.price.native ?? null;
    const matchesPriceMin = priceMin === null || (listingPrice !== null && listingPrice >= priceMin);
    const matchesPriceMax = priceMax === null || (listingPrice !== null && listingPrice <= priceMax);
    return matchesQuery && matchesTraitCount && matchesTraits && matchesStatus && matchesChain && matchesRarityMin && matchesRarityMax && matchesRankMin && matchesRankMax && matchesPriceMin && matchesPriceMax;
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
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (selectedChain) params.set("chain", selectedChain);
    if (filters.rankMin) params.set("rankMin", filters.rankMin);
    if (filters.rankMax) params.set("rankMax", filters.rankMax);
    if (filters.rarityMin) params.set("rarityMin", filters.rarityMin);
    if (filters.rarityMax) params.set("rarityMax", filters.rarityMax);
    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
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
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (selectedChain) params.set("chain", selectedChain);
    if (filters.rankMin) params.set("rankMin", filters.rankMin);
    if (filters.rankMax) params.set("rankMax", filters.rankMax);
    if (filters.rarityMin) params.set("rarityMin", filters.rarityMin);
    if (filters.rarityMax) params.set("rarityMax", filters.rarityMax);
    if (filters.priceMin) params.set("priceMin", filters.priceMin);
    if (filters.priceMax) params.set("priceMax", filters.priceMax);
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
            href: filterHref({ status: "all" }),
          },
        ]
      : []),
    ...(unlistedOnly
      ? [
          {
            key: "unlisted",
            label: "Not listed",
            href: filterHref({ status: "all" }),
          },
        ]
      : []),
    ...(selectedChain
      ? [
          {
            key: "chain",
            label: selectedChain,
            href: filterHref({ chain: "" }),
          },
        ]
      : []),
    ...(filters.rankMin
      ? [{ key: "rankMin", label: `Rank >= ${filters.rankMin}`, href: filterHref({ clearField: "rankMin" }) }]
      : []),
    ...(filters.rankMax
      ? [{ key: "rankMax", label: `Rank <= ${filters.rankMax}`, href: filterHref({ clearField: "rankMax" }) }]
      : []),
    ...(filters.rarityMin
      ? [{ key: "rarityMin", label: `Score >= ${filters.rarityMin}`, href: filterHref({ clearField: "rarityMin" }) }]
      : []),
    ...(filters.rarityMax
      ? [{ key: "rarityMax", label: `Score <= ${filters.rarityMax}`, href: filterHref({ clearField: "rarityMax" }) }]
      : []),
    ...(filters.priceMin
      ? [{ key: "priceMin", label: `Price >= ${filters.priceMin}`, href: filterHref({ clearField: "priceMin" }) }]
      : []),
    ...(filters.priceMax
      ? [{ key: "priceMax", label: `Price <= ${filters.priceMax}`, href: filterHref({ clearField: "priceMax" }) }]
      : []),
  ];
  const collectionLogo = collectionLogoMap[data.collection.slug];
  const collectionTheme = collectionThemeMap[data.collection.slug] ?? { accent: "#8adce8", accentRgb: "138, 220, 232", warm: "#ff8b63" };
  const chainOptions = [...new Set(data.tokens.map((token) => token.chain))].sort((a, b) => a.localeCompare(b));
  const listedTokens = data.tokens.filter((token) => token.listing);
  const floorListing = listedTokens.reduce<(typeof listedTokens)[number] | null>((floor, token) => {
    if (!token.listing) return floor;
    if (!floor?.listing) return token;
    return token.listing.price.native < floor.listing.price.native ? token : floor;
  }, null);
  const floorText = floorListing?.listing?.price.display ?? "Needed";
  const topListedToken = listedTokens.reduce<(typeof listedTokens)[number] | null>(
    (best, token) => (!best || token.rank < best.rank ? token : best),
    null,
  );
  const topListedText = topListedToken ? `#${topListedToken.rank.toLocaleString()}` : "Needed";
  const listedText = listedTokens.length > 0
    ? `${listedTokens.length.toLocaleString()} (${Math.round((listedTokens.length / data.tokens.length) * 100)}%)`
    : "Needed";
  const visibleTraitCategories = data.categories.filter((category) => category.traitType.toLowerCase() !== "trait count");
  const filterStateKey = JSON.stringify({
    q: filters.q ?? "",
    traitCounts: toArray(filters.traitCount),
    selectedTraits,
    statusFilter,
    selectedChain,
    rankMin: filters.rankMin ?? "",
    rankMax: filters.rankMax ?? "",
    rarityMin: filters.rarityMin ?? "",
    rarityMax: filters.rarityMax ?? "",
    priceMin: filters.priceMin ?? "",
    priceMax: filters.priceMax ?? "",
    sort,
  });

  function filterHref(options: { removeTraitCount?: string; removeTrait?: string; status?: string; chain?: string; clearField?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    const nextStatus = options.status ?? statusFilter;
    const nextChain = options.chain ?? selectedChain;
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextChain) params.set("chain", nextChain);
    if (filters.rankMin && options.clearField !== "rankMin") params.set("rankMin", filters.rankMin);
    if (filters.rankMax && options.clearField !== "rankMax") params.set("rankMax", filters.rankMax);
    if (filters.rarityMin && options.clearField !== "rarityMin") params.set("rarityMin", filters.rarityMin);
    if (filters.rarityMax && options.clearField !== "rarityMax") params.set("rarityMax", filters.rarityMax);
    if (filters.priceMin && options.clearField !== "priceMin") params.set("priceMin", filters.priceMin);
    if (filters.priceMax && options.clearField !== "priceMax") params.set("priceMax", filters.priceMax);
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
            {formatRankedCount(data.collection.actualTokenCount)} tokens ranked
          </div>
          <Link href="/" className="marketBackLink">Back</Link>
        </div>
      </section>

      <section className="marketStats" aria-label={`${data.collection.name} overview`}>
        <div>
          <span>Items</span>
          <strong>{data.collection.actualTokenCount.toLocaleString()}</strong>
        </div>
        <div>
          <span>Top Listed</span>
          <strong>{topListedText}</strong>
        </div>
        <div>
          <span>Floor</span>
          <strong>{floorText}</strong>
        </div>
        <div>
          <span>Listed</span>
          <strong>{listedText}</strong>
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
              <input name="status" type="hidden" value={statusFilter} />
              <div className="statusSegment" aria-label="Listing status filter">
                <Link className={statusFilter === "all" ? "isActive" : ""} href={filterHref({ status: "all" })}>All</Link>
                <Link className={statusFilter === "listed" ? "isActive" : ""} href={filterHref({ status: "listed" })}>Listed</Link>
                <Link className={statusFilter === "unlisted" ? "isActive" : ""} href={filterHref({ status: "unlisted" })}>Not Listed</Link>
              </div>
              <div className="chainSegment" aria-label="Chain filter">
                <Link className={!selectedChain ? "isActive" : ""} href={filterHref({ chain: "" })}>All Chains</Link>
                {chainOptions.map((chain) => (
                  <Link className={selectedChain === chain ? "isActive" : ""} href={filterHref({ chain })} key={chain}>
                    {chainLabel(chain)}
                  </Link>
                ))}
              </div>
              <Link href={`/collections/${slug}`}>Clear all</Link>
            </div>
            <details className="rangeFilterGroup" open>
              <summary>Rank</summary>
              <div className="rangeInputs">
                <input inputMode="numeric" name="rankMin" placeholder="Min" defaultValue={filters.rankMin ?? ""} />
                <span>to</span>
                <input inputMode="numeric" name="rankMax" placeholder="Max" defaultValue={filters.rankMax ?? ""} />
              </div>
              <button type="submit">Apply</button>
            </details>
            <details className="rangeFilterGroup" open>
              <summary>Price</summary>
              <div className="rangeCurrency">ETH</div>
              <div className="rangeInputs">
                <input inputMode="decimal" name="priceMin" placeholder="Min" defaultValue={filters.priceMin ?? ""} />
                <span>to</span>
                <input inputMode="decimal" name="priceMax" placeholder="Max" defaultValue={filters.priceMax ?? ""} />
              </div>
              <button type="submit">Apply</button>
            </details>
            <div className="traitValueFilters">
              <details className="traitCategory traitParent" open>
                <summary>
                  <span>Traits</span>
                  <small>{hasTraitFilters ? "Filtered" : `${visibleTraitCategories.length} groups`}</small>
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

                  {visibleTraitCategories.map((category) => {
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
                  <td className="scoreCell">
                    <span className="scorePill" title={`Rarity score ${token.rarityScore.toFixed(2)}`}>{token.rarityScore.toFixed(2)}</span>
                  </td>
                  <td>
                    <span className="traitCountPill" title={`${token.traitCount} scoring traits`}>{token.traitCount} traits</span>
                  </td>
                  <td>
                    <span className="listingPill">
                    {token.listing?.marketplaceUrl ? (
                      <a href={token.listing.marketplaceUrl} target="_blank" rel="noopener noreferrer">{token.listing.price.display}</a>
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

function parseOptionalNumber(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRankedCount(count: number) {
  if (count >= 1_000_000) {
    return `${trimCompactNumber(count / 1_000_000)}m`;
  }

  if (count >= 1_000) {
    return `${trimCompactNumber(count / 1_000)}k`;
  }

  return count.toLocaleString();
}

function trimCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function chainLabel(chain: string) {
  const normalized = chain.toLowerCase();
  if (normalized.includes("ape")) return "APE";
  if (normalized.includes("eth")) return "ETH";
  if (normalized.includes("btc") || normalized.includes("ordinal")) return "BTC";
  return chain.slice(0, 3).toUpperCase();
}
