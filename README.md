# Mars Cats Voyage Rarity Hub

Official rarity hub foundation for the Mars Cats Voyage ecosystem.

This repo is data-first. The UI reads generated rarity JSON from `data/processed`; rankings are built from collection config plus raw metadata. Current rankings use real metadata imported to the local database from OpenSea/scanner sources.

The site uses a local metadata database. Scanner, RPC, and OpenSea reads are import-time tools only; the frontend should never depend on live NFT API calls. See `LOCAL_DATABASE.md`.

## Stack

- Next.js App Router
- TypeScript
- Static JSON rarity output
- Node scripts for metadata/ranking/validation

## Commands

```bash
npm run build:rarity
npm run import:opensea
npm run import:metadata -- mars-cats-voyage 1 100
npm run lint
npm run build
npm run dev
```

## Data Flow

1. Configure collections in `data/collections.json`.
2. Put source metadata JSON in the configured `rawMetadataFile`.
3. Run `npm run build:rarity`.
4. Review generated files in `data/processed`.
5. Review `reports/mars-cats-voyage-four-trait-validation.json`.
6. Run `npm run build` before preview/deploy.

## OpenSea Bulk Metadata Import

OpenSea import is the current full-dataset path. It paginates collection/contract NFT records, including traits, and writes local JSON.

```bash
OPENSEA_API_KEY=... npm run import:opensea
OPENSEA_API_KEY=... npm run import:opensea -- battle-pawss
```

Imported output is written to `data/raw/imported/<collection-slug>.json`. The frontend never calls OpenSea at runtime.

## Scanner Metadata Import

Metadata import is configured through Etherscan v2:

- Ethereum uses chain ID `1`.
- Base uses chain ID `8453`.
- ApeChain uses chain ID `33139`.

The import script calls `tokenURI(tokenId)` through the explorer proxy API, then fetches the returned metadata JSON. Example:

```bash
ETHERSCAN_API_KEY=... npm run import:metadata -- mars-cats-voyage 1 100
```

For multi-chain collections, import one source range at a time:

```bash
npm run import:metadata -- mars-cats-voyage 1 100 --chain Ethereum
npm run import:metadata -- mars-cats-voyage 5501 5600 --chain ApeChain
```

Scanner imported output is written to `data/raw/imported/<collection-slug>.json`. After review, update the collection's `rawMetadataFile` to point at the imported file and run `npm run build:rarity`.

## Rarity Formula

Current recommended formula: normalized average inverse trait frequency.

Each trait gets a weight:

```text
trait rarity weight = collection token supply / number of tokens with that trait value
```

`Trait Count` is generated as a scoring trait category before rank calculation. For example, a 4-trait cat receives a `Trait Count: 4 traits` attribute, and that attribute has its own occurrence count, percentage, and rarity weight.

Each token gets a score:

```text
token score = sum of trait rarity weights, including Trait Count / number of scoring traits
```

This intentionally uses an average instead of a raw sum. A 4-trait cat is judged by how rare its visible traits and trait-count class are on average. Raw trait score is still preserved for inspection, but rank uses the normalized score.

Tie-breaks are deterministic:

1. Higher normalized rarity score
2. Higher raw trait score
3. Lower trait count
4. Lower canonical token ID

The tie-break behavior is deterministic and should be reviewed before changing the official formula.

## Adding A Collection

1. Add a collection record to `data/collections.json`.
2. Include source contract, chain, marketplace, explorer, metadata source, and canonical identity strategy.
3. Add raw metadata JSON with `tokenId`, `image`, `chain`, `source`, and `attributes`.
4. Run `npm run build:rarity`.
5. Confirm processed output and validation reports.

## MCV ETH + ApeChain Canonical Handling

Mars Cats Voyage uses `canonicalTokenId` for ranking. ETH and ApeChain records must resolve to one canonical token before score generation. If a duplicate canonical ID appears, the build keeps the first record and reports the ignored duplicate in `validation.duplicateRecords`.

Current handling is conservative: ETH records are kept as canonical when the same token ID also exists on ApeChain, and duplicate ApeChain records are reported in `validation.duplicateRecords`.

## 4-Trait Cats

Run:

```bash
node scripts/validate-four-trait-cats.mjs mars-cats-voyage
```

The report includes:

- total number of 4-trait cats
- rank distribution
- top-ranked 4-trait cats
- bottom-ranked 4-trait cats
- suspicious ranking anomalies

MCV should review this report after any metadata refresh or formula change.

## Preview / Deploy Plan

Recommended path:

1. Keep this as a standalone app until the team approves the formula.
2. Deploy on Vercel for review.
3. Attach to `rarity.marscatsvoyage.com` or mount inside the official MCV site once approved.
4. Keep generated `data/processed` as the public audit surface.

## Current Status

Real imported metadata is now loaded for:

- Mars Cats Voyage
- Mars Alien Cats Collection
- Mars Cats in Spacesuits
- Mars Cats Snipers
- MetaZoku
- Battle Pawss

Known data caveat: 11 Mars Cats in Spacesuits records return missing/404 trait metadata and are excluded from scoring instead of being ranked with fake traits.
