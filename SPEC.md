# Official MCV Rarity Hub Spec

## Goal

Create the canonical MCV-controlled rarity source for Mars Cats Voyage, Mars Alien Cats Collection, Mars Cats in Spacesuits, Mars Cats Snipers, MetaZoku, and Battle Pawss.

The product is the rarity pipeline first and the browsing UI second. The site must make ranks easy to inspect, but data correctness decides launch readiness.

## Collection Model

Mars Cats Voyage is a unified collection group across Ethereum and ApeChain. Ranking must use canonical token identity so bridged or mirrored records do not double-count.

Mars Alien Cats Collection, Mars Cats in Spacesuits, Mars Cats Snipers, MetaZoku, and Battle Pawss are separate groups with independent trait schemas, score tables, and token pages.

## Data Model

Collection config:

- slug
- name
- group
- status
- token count
- source contracts
- chain labels
- metadata source
- marketplace and explorer URL bases
- canonical identity strategy
- raw metadata file

Token output:

- token ID
- canonical token ID
- name
- image
- rank
- normalized rarity score
- raw trait score
- trait count
- chain/source
- full weighted trait list

Trait output:

- category
- value
- occurrence count
- percentage
- rarity weight

Validation output:

- duplicate canonical records
- mock token count
- missing attributes
- 4-trait cat distribution

## Frontend Scope

Built:

- collection directory
- collection rarity table
- token search
- trait-count filter
- trait-value filter
- token detail page
- trait explorer
- mock/unverified data warnings

Future:

- client-side sortable table controls
- richer images once final IPFS/media URLs are verified
- embeddable widget wrapper for official site integration

## Review Gates

Before public launch:

- collection contracts verified
- metadata sources verified
- token counts validated
- MCV ETH + ApeChain canonical rules approved
- duplicate handling verified
- ranking formula approved
- 4-trait cat report approved
- desktop/mobile QA completed
- Jay/MCV approval obtained
