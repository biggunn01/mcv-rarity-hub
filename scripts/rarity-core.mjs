import fs from "node:fs";
import path from "node:path";

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function normalizeTrait(attribute) {
  const value = String(attribute.value ?? "Unknown");
  return {
    traitType: String(attribute.trait_type ?? attribute.traitType ?? "Unknown"),
    value: normalizeTraitValue(value),
  };
}

function normalizeTraitValue(value) {
  const typoFixes = {
    "Sneackers Fashion": "Sneakers Fashion",
    "Sneackers Orange": "Sneakers Orange",
  };
  return typoFixes[value] ?? value;
}

export function buildCollectionRarity(collection, rawTokens, options = {}) {
  const listingLookup = new Map((options.listings ?? []).map((listing) => [String(listing.canonicalTokenId ?? listing.tokenId), listing]));
  const canonical = new Map();
  const duplicateRecords = [];

  for (const token of rawTokens) {
    const canonicalTokenId = String(token.canonicalTokenId ?? token.tokenId);
    if (canonical.has(canonicalTokenId)) {
      duplicateRecords.push({
        canonicalTokenId,
        ignoredTokenId: String(token.tokenId),
        keptTokenId: String(canonical.get(canonicalTokenId).tokenId),
      });
      continue;
    }
    canonical.set(canonicalTokenId, token);
  }

  const importedTokens = [...canonical.values()].map((token) => ({
    tokenId: String(token.tokenId),
    canonicalTokenId: String(token.canonicalTokenId ?? token.tokenId),
    name: token.name ?? `${collection.name} #${token.tokenId}`,
    image: token.image ?? "/mock-token.svg",
    chain: token.chain ?? "Unknown",
    source: token.source ?? "Unknown",
    isMock: Boolean(token.isMock),
    listing: listingLookup.get(String(token.canonicalTokenId ?? token.tokenId)) ?? null,
    attributes: Array.isArray(token.attributes) ? token.attributes.map(normalizeTrait) : [],
  }));
  const excludedNoTraitRecords = importedTokens
    .filter((token) => token.attributes.length === 0)
    .map((token) => ({
      canonicalTokenId: token.canonicalTokenId,
      tokenId: token.tokenId,
      reason: "missing-attributes",
    }));
  const tokens = importedTokens.filter((token) => token.attributes.length > 0);

  const supply = tokens.length;
  const traitCounts = new Map();
  const categoryCounts = new Map();

  for (const token of tokens) {
    const seenCategories = new Set();
    for (const trait of token.attributes) {
      const key = `${trait.traitType}::${trait.value}`;
      traitCounts.set(key, (traitCounts.get(key) ?? 0) + 1);
      seenCategories.add(trait.traitType);
    }
    for (const category of seenCategories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  const traits = [...traitCounts.entries()]
    .map(([key, count]) => {
      const [traitType, value] = key.split("::");
      return {
        traitType,
        value,
        count,
        percentage: round((count / supply) * 100),
        rarityWeight: round(supply / count),
      };
    })
    .sort((a, b) => a.traitType.localeCompare(b.traitType) || a.value.localeCompare(b.value));

  const traitCountTraits = buildTraitCountTraits(tokens, supply);
  const scoringTraitUniverse = [...traits, ...traitCountTraits];
  const traitLookup = new Map(scoringTraitUniverse.map((trait) => [`${trait.traitType}::${trait.value}`, trait]));
  const traitCountScarcityExponent = Number(collection.rarityScoring?.traitCountScarcityExponent ?? 0);
  const scoredTokens = tokens.map((token) => {
    const baseTraits = [
      ...token.attributes,
      {
        traitType: "Trait Count",
        value: `${token.attributes.length} traits`,
      },
    ];

    const scoringTraits = baseTraits.map((trait) => {
      const rarity = traitLookup.get(`${trait.traitType}::${trait.value}`);
      return {
        ...trait,
        count: rarity.count,
        percentage: rarity.percentage,
        rarityWeight: rarity.rarityWeight,
        includedInScore: true,
      };
    });
    const rawTraitScore = scoringTraits.reduce((sum, trait) => sum + trait.rarityWeight, 0);
    const rawAttributeScore = scoringTraits
      .filter((trait) => trait.traitType !== "Trait Count")
      .reduce((sum, trait) => sum + trait.rarityWeight, 0);
    const traitCountRarity = traitLookup.get(`Trait Count::${token.attributes.length} traits`);
    const traitCount = token.attributes.length;
    const scoringTraitCount = scoringTraits.length;
    const baseTraitAverage = traitCount === 0 ? 0 : rawAttributeScore / traitCount;
    const traitCountScarcityBoost =
      traitCountScarcityExponent > 0 && traitCountRarity
        ? Math.pow(traitCountRarity.rarityWeight, traitCountScarcityExponent)
        : 1;
    const rarityScore =
      traitCountScarcityExponent > 0
        ? baseTraitAverage * traitCountScarcityBoost
        : scoringTraitCount === 0
          ? 0
          : rawTraitScore / scoringTraitCount;

    return {
      ...token,
      traitCount,
      scoringTraitCount,
      baseTraitAverage: round(baseTraitAverage),
      traitCountScarcityBoost: round(traitCountScarcityBoost),
      rarityScore: round(rarityScore),
      rawTraitScore: round(rawTraitScore),
      attributes: scoringTraits,
    };
  });

  scoredTokens.sort(
    (a, b) =>
      b.rarityScore - a.rarityScore ||
      b.rawTraitScore - a.rawTraitScore ||
      a.traitCount - b.traitCount ||
      Number(a.canonicalTokenId) - Number(b.canonicalTokenId) ||
      a.canonicalTokenId.localeCompare(b.canonicalTokenId),
  );

  scoredTokens.forEach((token, index) => {
    token.rank = index + 1;
  });

  const allTraits = scoringTraitUniverse.sort(
    (a, b) => a.traitType.localeCompare(b.traitType) || a.value.localeCompare(b.value),
  );

  categoryCounts.set("Trait Count", supply);

  const categories = [...categoryCounts.entries()]
    .map(([traitType, count]) => ({
      traitType,
      tokenCoverage: count,
      tokenCoveragePercentage: round((count / supply) * 100),
      values: allTraits.filter((trait) => trait.traitType === traitType),
    }))
    .sort((a, b) => a.traitType.localeCompare(b.traitType));

  return {
    collection: {
      ...collection,
      actualTokenCount: supply,
      importedTokenCount: importedTokens.length,
      excludedTokenCount: excludedNoTraitRecords.length,
      hasMockData: scoredTokens.some((token) => token.isMock),
    },
    formula: {
      name:
        traitCountScarcityExponent > 0
          ? "Trait-count scarcity boosted inverse frequency"
          : "Normalized average inverse trait frequency",
      explanation:
        traitCountScarcityExponent > 0
          ? `Each trait weight is collection supply divided by that trait occurrence count. Trait Count is measured by occurrence rarity and applied as a scarcity boost to the token's average trait weight. This collection uses a ${traitCountScarcityExponent} exponent on Trait Count rarity, so structurally scarce low-trait-count tokens rank higher while individual trait rarity still orders tokens inside that group.`
          : "Each trait weight is collection supply divided by that trait occurrence count. Trait Count is included as its own scoring trait. A token score is the average of all trait weights, including Trait Count, so fewer-slot and higher-slot tokens are compared through explicit occurrence rarity instead of hidden slot-count bias.",
      traitCountScarcityExponent,
    },
    tokens: scoredTokens,
    traits: allTraits,
    categories,
    validation: {
      duplicateRecords,
      excludedNoTraitRecords,
      mockTokenCount: scoredTokens.filter((token) => token.isMock).length,
      missingAttributes: scoredTokens.filter((token) => token.traitCount === 0).map((token) => token.canonicalTokenId),
    },
  };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function buildTraitCountTraits(tokens, supply) {
  const counts = new Map();
  for (const token of tokens) {
    const value = `${token.attributes.length} traits`;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      traitType: "Trait Count",
      value,
      count,
      percentage: round((count / supply) * 100),
      rarityWeight: round(supply / count),
      includedInScore: false,
    }))
    .sort((a, b) => Number.parseInt(a.value, 10) - Number.parseInt(b.value, 10));
}
