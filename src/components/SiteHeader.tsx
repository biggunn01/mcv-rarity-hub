import Link from "next/link";
import type { CSSProperties } from "react";
import { getCollectionSummaries } from "@/lib/rarity-data";

const accentMap: Record<string, string> = {
  "mars-cats-voyage": "#ff9a32",
  "mars-alien-cats": "#75e6ff",
  "mars-cats-in-spacesuits": "#9bdcff",
  "mars-cats-snipers": "#8dff9f",
  metazoku: "#c8ff2f",
  "battle-pawss": "#1ef9d8",
  "cream-cats": "#f4cf7a",
};

const shortNameMap: Record<string, string> = {
  "mars-cats-voyage": "Mars Cats",
  "mars-alien-cats": "Alien Cats",
  "mars-cats-in-spacesuits": "Spacesuits",
  "mars-cats-snipers": "Snipers",
  metazoku: "MetaZoku",
  "battle-pawss": "Battle Pawss",
  "cream-cats": "Cream Cats",
};

type Props = {
  activeSlug?: string;
};

export function SiteHeader({ activeSlug }: Props) {
  const collections = getCollectionSummaries();

  return (
    <header className="siteHeader">
      <Link href="/" className="siteHeaderBrand">
        <span className="siteHeaderMark" aria-hidden="true" />
        MCV Rarity Hub
      </Link>
      <nav className="siteHeaderNav" aria-label="Collections">
        {collections.map(({ collection }) => (
          <Link
            key={collection.slug}
            href={`/collections/${collection.slug}`}
            className={collection.slug === activeSlug ? "isActive" : undefined}
            style={{ "--hd-accent": accentMap[collection.slug] ?? "#8adce8" } as CSSProperties}
          >
            <span className="siteHeaderDot" aria-hidden="true" />
            {shortNameMap[collection.slug] ?? collection.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
