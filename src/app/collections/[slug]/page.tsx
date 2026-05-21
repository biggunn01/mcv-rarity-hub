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
    <main className="shell collectionShell">
      <section className="pageHeader">
        <div className="collectionTitleBlock">
          {collectionLogo && (
            <div className="collectionHeaderLogo" aria-hidden="true">
              <Image src={collectionLogo} alt="" fill sizes="336px" priority />
            </div>
          )}
          <div>
            <Link href="/" className="backLink">Back to collections</Link>
            <p className="eyebrow">{data.collection.group}</p>
            <h1>{data.collection.name}</h1>
            <p className="lede">{data.collection.summary}</p>
          </div>
        </div>
        <div className="notice">
          {data.collection.hasMockData ? "Mock data only." : `${data.collection.actualTokenCount.toLocaleString()} ranked tokens from imported metadata`}
        </div>
      </section>

      <section className="section">
        <div className="filterBar">
          <CollectionFilterForm key={filterStateKey}>
            <input name="q" placeholder="Search token ID" defaultValue={filters.q ?? ""} />
            {sort !== "rank-asc" && <input type="hidden" name="sort" value={sort} />}
            <div className="traitValueFilters">
              <details className="traitCategory traitParent" open={hasTraitFilters}>
                <summary>
                  <span>Traits</span>
                  <small>{hasTraitFilters ? "Filtered" : "Collapsed"}</small>
                </summary>
                <div className="nestedTraitGroups">
                  <details className="traitCategory">
                    <summary>
                      <span>Trait Count</span>
                      <small>{traitCounts.length ? "Filtered" : "Open"}</small>
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
                          <small>{isFiltered ? "Filtered" : "Open"}</small>
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
            <div className="filterActions">
              <label className="listedToggle">
                <input name="listed" type="checkbox" value="true" defaultChecked={listedOnly} />
                <span>Listed</span>
              </label>
              <Link href={`/collections/${slug}`}>Clear all</Link>
            </div>
          </CollectionFilterForm>
        </div>

        <div className="tableWrap">
          <div className="tableMeta">
            <span>{filteredTokens.length.toLocaleString()} ranked tokens</span>
            <span>Showing {tokens.length.toLocaleString()} on page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th><ClientSortLink href={sortHref(sort === "rank-asc" ? "rank-desc" : "rank-asc")}>Rank</ClientSortLink></th>
                <th>Preview</th>
                <th><ClientSortLink href={sortHref(sort === "token-asc" ? "token-desc" : "token-asc")}>Token</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "score-desc" ? "score-asc" : "score-desc")}>Score</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "listed-asc" ? "listed-desc" : "listed-asc")}>Listed</ClientSortLink></th>
                <th><ClientSortLink href={sortHref(sort === "trait-count-desc" ? "trait-count-asc" : "trait-count-desc")}>Traits</ClientSortLink></th>
                <th><ClientSortLink href={sortHref("category:Chain:asc")}>Chain</ClientSortLink></th>
                <th>Key Traits</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.canonicalTokenId}>
                  <td>#{token.rank}</td>
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
                      {token.name}
                    </Link>
                  </td>
                  <td>{token.rarityScore.toFixed(4)}</td>
                  <td>
                    {token.listing?.marketplaceUrl ? (
                      <a href={token.listing.marketplaceUrl}>{token.listing.price.display}</a>
                    ) : (
                      "Not listed"
                    )}
                  </td>
                  <td>{token.traitCount}</td>
                  <td>{token.chain}</td>
                  <td>{token.attributes.slice(0, 3).map((item) => `${item.traitType}: ${item.value}`).join(", ")}</td>
                </tr>
              ))}
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
