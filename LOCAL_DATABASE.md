# Local Metadata Database

The frontend must not call Etherscan, BaseScan, ApeScan, OpenSea, or any NFT API at runtime.

The app uses a local JSON database:

- raw source metadata: `data/raw/imported/*.json`
- reviewed fallback data: `data/raw/mock/*.json`
- generated rarity database: `data/processed/*.json`

Importers are maintenance tools only. They fetch metadata once, write local JSON, and then the rarity build reads that local data.

## Import Flow

1. Run an importer against OpenSea, a scanner, RPC endpoint, export, or manual JSON source.
2. Save results to `data/raw/imported/<collection>.json`.
3. Review token count, trait schema, image URLs, and failed records.
4. Update `data/collections.json` so `rawMetadataFile` points at the reviewed imported file.
5. Run `npm run build:rarity`.
6. Deploy the static app.

## OpenSea Import

OpenSea is the current full-dataset source for all configured collections:

```bash
npm run import:opensea
npm run import:opensea -- mars-cats-voyage
```

The importer writes local JSON only. Do not make the frontend depend on live OpenSea reads.

## Battle Pawss

Battle Pawss is imported from OpenSea's ApeChain collection records into local JSON.

## MCV ApeChain

The ApeChain MCV contract reverted for tested `tokenURI(uint256)` and `uri(uint256)` calls through scanner/RPC. Current ApeChain MCV metadata is imported from OpenSea's contract NFT endpoint, then deduped by canonical token ID during scoring.

ETH records are kept first when the same canonical token ID appears on ETH and ApeChain.
