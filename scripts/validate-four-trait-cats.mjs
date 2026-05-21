import path from "node:path";
import { readJson, writeJson } from "./rarity-core.mjs";

const root = process.cwd();
const slug = process.argv[2] ?? "mars-cats-voyage";
const data = readJson(path.join(root, "data", "processed", `${slug}.json`));
const fourTraitCats = data.tokens.filter((token) => token.traitCount === 4);
const ranks = fourTraitCats.map((token) => token.rank);
const total = data.tokens.length;
const midpoint = total / 2;

const report = {
  collection: slug,
  generatedAt: new Date().toISOString(),
  scoringFormula: data.formula,
  totalTokens: total,
  totalFourTraitCats: fourTraitCats.length,
  rankDistribution: {
    bestRank: ranks.length ? Math.min(...ranks) : null,
    worstRank: ranks.length ? Math.max(...ranks) : null,
    topHalfCount: fourTraitCats.filter((token) => token.rank <= midpoint).length,
    bottomHalfCount: fourTraitCats.filter((token) => token.rank > midpoint).length,
  },
  topRankedFourTraitCats: fourTraitCats.slice().sort((a, b) => a.rank - b.rank).slice(0, 10),
  bottomRankedFourTraitCats: fourTraitCats.slice().sort((a, b) => b.rank - a.rank).slice(0, 10),
  suspiciousRankingAnomalies: findAnomalies(data.tokens, fourTraitCats),
  approvalRequired:
    "4-trait cat distribution must be reviewed by MCV before Mars Cats Voyage rankings are labeled official.",
};

writeJson(path.join(root, "reports", `${slug}-four-trait-validation.json`), report);
console.log(`4-trait validation written for ${slug}: ${fourTraitCats.length} matching tokens.`);

function findAnomalies(tokens, fourTraitTokens) {
  const anomalies = [];
  if (fourTraitTokens.length === 0) {
    anomalies.push("No 4-trait cats found. Verify metadata before approving official ranks.");
  }
  const worstFourTrait = fourTraitTokens.reduce((worst, token) => (!worst || token.rank > worst.rank ? token : worst), null);
  if (worstFourTrait && worstFourTrait.rank === tokens.length) {
    anomalies.push("A 4-trait cat is ranked last. Review whether its traits and Trait Count occurrence are genuinely common or the formula is over-penalizing.");
  }
  return anomalies;
}
