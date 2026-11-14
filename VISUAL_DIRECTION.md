# 안개골: 바람나침반 — VISUAL FIRST ART DIRECTION v2

## 0. Highest priority
This is an illustration-led, premium Korean-language visual novel. Visual coherence is a release blocker. Read this document BEFORE implementing UI. Never substitute generic Godot widgets, pixel-art placeholders, unrelated anime portraits, or procedurally drawn character faces in the final visual acceptance screenshots.

## 1. Ground truth references
- `assets/reference/village_visual_target.png` is the USER-PROVIDED background reference. It is a visual target, not an automatic license to invent other reference assets.
- The user has also established official character reference sheets for Pomi, Maru, Soren, Miro (Soren's dog), Karuviya grandmother, and Woodpecker uncle. They are NOT included in this package. Ask the user to add them under `assets/reference/characters/` and DO NOT invent their official faces, outfits, or proportions.
- Soren is an existing village resident. Pomi is the protagonist; Maru is the baker.

## 2. Image direction
- 16:9 cinematic compositions, 1920x1080 reference resolution; crop to fill without stretching.
- Cozy nostalgic anime, warm 1980s-inspired pastel countryside, luminous blue sky, peach-and-cream clouds, gardens, flowers, wooden buildings, inviting village street and distant mountains.
- The reference has American small-town architecture (church steeple, US flag, suburban houses). These are *reference-specific visual motifs*, NOT mandatory lore. Preserve the light, spatial density and pastoral mood; adapt architecture only with art-director approval. Do not claim the setting is the USA.
- Palette targets: cream #F8F0E4, warm paper #EEE1D0, caramel #A27C65, olive #929C77, sky blue #91BCEB, peach #F1C6AE, ink #55483F. These are interface starting points, not pixel-accurate colors sampled from the image.
- Avoid overprocessed bloom, intense god rays, excessive texture, photorealistic objects, random AI ornaments, mismatched line thickness, character/background lighting mismatch.

## 3. VN composition
- Background occupies full screen, unblurred by default. Portrait sprites are transparent PNG/WebP, at 60–78% of screen height for half-body composition, aligned on common baseline.
- Default scene: one speaker at a time; foreground speaker full opacity, secondary speaker 75–85% opacity. Keep faces clear of dialogue panel.
- Dialogue panel anchored to bottom, width 88–92%, height approx 22–26%, cream tinted 88–94% opaque; 12–18 px radius, very subtle border and shadow; no thick dark frames.
- Speaker tag sits on top-left edge of dialogue panel, muted caramel. Body font: Korean-capable readable sans, minimum 26 px at 1920x1080, high contrast; 2–3 lines max per beat. Avoid illegible decorative fonts. Choice buttons use same materials, spacing and focus states.
- UI chrome: top-right discreet History / Auto / Skip / Save / Settings; hide UI toggle for unobstructed background appreciation. Keyboard and mouse accessible.
- Motion: crossfade backgrounds 0.45–0.8s, character entrance 0.25–0.45s, expression swap 0.12–0.2s. Avoid excessive camera shake or jump cuts.

## 4. Asset workflow
1. Make an inventory of real user-provided reference files. Never fabricate missing assets.
2. Use user-provided background as the temporary first scene ONLY if composition and story scene fit; otherwise use clearly marked temporary background.
3. Extract or request individual transparent portrait sprites from official character sheets; do not crop a complex sheet into a dialogue portrait and pretend it is production-ready. Verify face/wardrobe consistency and alpha edges.
4. Naming: `bg_village_day.png`, `bg_bakery_day.png`, `bg_square_day.png`, `bg_path_dusk.png`, `bg_forest_dawn.png`; `ch_pomi_neutral.png`, `ch_pomi_worried.png`, etc.
5. Centralize scene asset references in a manifest. Missing assets must show a tasteful labeled placeholder, not crash.

## 5. Visual acceptance gates (mandatory)
- Screenshot at 1920x1080 for title, Pomi solo, Pomi+Maru dialogue, choice UI, twilight, forest silhouette.
- Check portrait/background color temperature, eye line, scale, bottom baseline, Korean font, dialogue readability, UI occlusion, asset stretching, alpha halos.
- No final sign-off until screenshots are inspected. If no image/screenshot tool available, explicitly report visual QA as unverified.
- At least one scene must show the provided village reference without UI (hide-UI mode).

## 6. MVP constraints
- First ship a 15-minute linear-ish ACT 1–5 visual novel with meaningful choices, not a free-roaming game.
- No arbitrary lore additions, no confirmed BCI implants or 2nd-season boy identity. Ending may hint at the boy with a distant silhouette only.
- Do not spend time building character movement animations before narrative scenes and visual QA pass.
