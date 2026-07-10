const overrides: Record<string, string> = {
  "mars-cats-snipers": "Sniper Cats",
  "mars-alien-cats": "Alien Cats",
};

export function displayCollectionName(slug: string, fallback: string): string {
  return overrides[slug] ?? fallback;
}
