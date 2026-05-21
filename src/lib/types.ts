export type Trait = {
  traitType: string;
  value: string;
  count: number;
  percentage: number;
  rarityWeight: number;
  includedInScore?: boolean;
};

export type RankedToken = {
  tokenId: string;
  canonicalTokenId: string;
  name: string;
  image: string;
  chain: string;
  source: string;
  isMock: boolean;
  traitCount: number;
  scoringTraitCount?: number;
  rarityScore: number;
  rawTraitScore: number;
  baseTraitAverage?: number;
  traitCountScarcityBoost?: number;
  rank: number;
  listing?: {
    tokenId: string;
    canonicalTokenId: string;
    chain: string;
    contractAddress: string;
    marketplaceUrl: string | null;
    orderHash: string | null;
    status: string;
    price: {
      value: string;
      decimals: number;
      currency: string;
      native: number;
      display: string;
    };
    seller: string | null;
    createdAt: number | null;
    source: string;
  } | null;
  attributes: Trait[];
};

export type CollectionSource = {
  chain: string;
  contractAddress: string;
  metadataSource: string;
  explorerBaseUrl: string;
  marketplaceBaseUrl: string;
  openSea?: {
    type: "collection" | "contract";
    slug?: string;
    chain?: string;
    contractAddress?: string;
  };
};

export type RarityCollection = {
  slug: string;
  name: string;
  group: string;
  status: string;
  summary: string;
  tokenCountExpected: number | null;
  bannerImage: string;
  sources: CollectionSource[];
  canonicalIdentity: {
    strategy: string;
    notes: string;
  };
  rawMetadataFile: string;
  rarityScoring?: {
    traitCountScarcityExponent?: number;
    notes?: string;
  };
  actualTokenCount: number;
  importedTokenCount?: number;
  excludedTokenCount?: number;
  hasMockData: boolean;
};

export type RarityData = {
  collection: RarityCollection;
  formula: {
    name: string;
    explanation: string;
    traitCountScarcityExponent?: number;
  };
  tokens: RankedToken[];
  traits: Trait[];
  categories: Array<{
    traitType: string;
    tokenCoverage: number;
    tokenCoveragePercentage: number;
    values: Trait[];
  }>;
  validation: {
    duplicateRecords: Array<{
      canonicalTokenId: string;
      ignoredTokenId: string;
      keptTokenId: string;
    }>;
    excludedNoTraitRecords?: Array<{
      canonicalTokenId: string;
      tokenId: string;
      reason: string;
    }>;
    mockTokenCount: number;
    missingAttributes: string[];
  };
};

export type CollectionSummary = {
  collection: RarityCollection;
};

export type RarityIndex = {
  generatedAt: string;
  official: boolean;
  warning: string;
  collections: Array<{
    slug: string;
    name: string;
    status: string;
    actualTokenCount: number;
    importedTokenCount?: number;
    excludedTokenCount?: number;
    hasMockData: boolean;
    output: string;
  }>;
};
