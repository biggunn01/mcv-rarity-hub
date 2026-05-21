# Data Status And Remaining Review

Current app data is real imported metadata, not mock data. These items remain review/approval tasks before treating the formula and edge-case handling as final.

Contract addresses are now verified against Etherscan, BaseScan, or ApeScan pages. Metadata retrieval is configured to use Etherscan v2 `eth_call` / `tokenURI` reads by chain ID, then fetch the returned JSON URI.

The active full-dataset importer uses OpenSea NFT records as an import-time source and writes local JSON to `data/raw/imported/*.json`. The frontend does not call OpenSea, Etherscan, BaseScan, or ApeScan at runtime.

Required env vars for imports:

- `ETHERSCAN_API_KEY`
- `BASESCAN_API_KEY` and `APESCAN_API_KEY` are optional aliases only; current importer config uses `ETHERSCAN_API_KEY` for all configured chains.

## Mars Cats Voyage

- Imported Ethereum cats: `0xdd467a6c8ae2b39825a452e06b4fa82f73d4253d`
- Imported ApeChain cats: `0xca76944acbc4675f566d062d658bfadf6f469ca7`
- Review bridge/mirror mapping rules
- Review canonical token ID rules
- Confirm whether ETH should always be kept over ApeChain when token IDs duplicate
- Manual review of 4-trait cat validation report

## Mars Alien Cats Collection

- Imported metadata for Ethereum contract: `0xe5903df9d94cbacc0b9696137316c74a2f1d8909`
- Trait schema notes, if any

## Mars Cats In Spacesuits

- Imported metadata for Ethereum contract: `0xf148438326e50ec1c703cb8fc946a6b5a7884e98`
- 11 records have no usable trait metadata because their metadata URLs return `{ "status": 404 }`; these are excluded from scoring.
- Trait schema notes, if any

## Mars Cats Snipers

- Imported metadata for Base contract: `0x97b8158554154748bb7f80efe1a1ea002f898db8`
- Trait schema notes, if any

## MetaZoku

- Imported metadata for Ethereum contract: `0xbe477f544a6d1d4143ce3115be30489c26ee14e2`
- Trait schema notes, if any

## Battle Pawss

- Imported metadata for ApeChain contract: `0x3e22ba4e9f3bbc02c8346b5287e6f9f4299087e1`
- Trait schema notes, if any

## Cream Cats

- Imported 333 BTC Ordinals records from OKX collection `cream-cats`.
- Inscription IDs are used as canonical token IDs.
- Item links use OKX marketplace asset URLs and Ordinals explorer inscription URLs.
- OKX reports 168 owners and 0 active listed items at import time.
- Trait schema notes, if any

## Approval Needed

- Final rarity formula approval
- Tie-break approval
- Trait Count is currently included in score; approve or revise this formula choice.
- Public launch approval from Jay/MCV
