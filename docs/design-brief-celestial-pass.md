# Design Brief — Celestial Pass (2026-07-08)

Goal: lift rarity.marscatsvoyage.com from 7/10 to award caliber. The weak act is the landing
solar system (flat, logo-stickered spheres); collection/token pages need micro-interaction and
type discipline, not reinvention. Builds on refinement/bold/award/signature passes — no redos.

## References & borrowed techniques (concrete, per site)

1. **Equinox — equinox.space** (Awwwards SOTD 7.33, May 2024)
   - Physically-lit space bodies: fresnel rim falloff + real light direction instead of unlit
     logo-textured `MeshBasicMaterial`. → Custom GLSL planet shaders with day/night terminator
     from the central sun, accent-colored fresnel rim.
   - Atmosphere shells: additive fresnel shell mesh around each planet, day-side boosted.
   - Nothing static in space: every body rotates; surfaces churn via time-driven noise.

2. **Exo Ape — exoape.com** (SOTD-winning studio)
   - Display type formula: huge + light weight + 0.9 line-height + −0.04em tracking.
   - Two type sizes only: 14px eyebrow label + display; nothing in between.
   - Line-mask reveals: translateY(100%)→0 inside overflow:hidden, 80–100ms stagger.

3. **Lusion — lusion.co** (Awwwards Site of the Year 2023)
   - Slow color-only transitions (400–500ms) on buttons/links = "expensive" feel; position
     snaps fast, color drifts slow.
   - Let the WebGL carry the landing; keep supporting copy restrained.

4. **Linear — linear.app** (industry dark-UI benchmark)
   - Two motion speeds only: 100ms hover / 250ms layout.
   - Row hover = quiet background fill (#1c1c1f), never borders/shadows appearing; right-aligned
     action ("View →") fades in with opacity + 4px translateX at 100ms. → rarity table rows.
   - Mono for anything that IS data (ranks, scores, counts).

5. **Superpower — superpower.com** (Awwwards SOTD + case study)
   - Tinted accent chips: accent text on 10%-alpha accent bg, full pill radius — the recipe for
     rarity-tier badges under per-collection accents.
   - Near-invisible surface separation (~2% luminance delta cards) + staggered row entrances.

## What changes per page

- **Landing:** planets rebuilt as procedural shader worlds — per-collection archetypes
  (gas giant / ice world with caps / ringed dust world / volcanic cracked / ocean swirl /
  toxic banded), animated turbulent orange sun (MCV), fresnel atmosphere shells, fading orbital
  motion trails replacing full dashed ellipses, always-faint depth-scaled labels. Fixed hover
  teleport bug (accumulated angles). Mobile H1/stat-line overflow fixed.
- **Collection:** Linear-style row hover with reveal action, Superpower tinted chips for
  listings/traits, two-speed motion tokens.
- **Token:** staggered trait-row entrances, tinted rarity chips, mono data discipline.

## Constraints respected
- Per-collection `--collection-accent(-rgb)` vars; CSS appended as labeled block in globals.css;
  entrance keyframes never end in `transform: none` on positioned elements.
