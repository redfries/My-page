# Hero and scroll polish

## Findings

The tubes canvas was fixed to the viewport. Each WebGL frame moved the scene to follow the scrolling hero anchor. Native scrolling could move the text before that frame completed, making the figure appear stuck or detached. The fixed canvas also remained intersecting the viewport behind every opaque section, preventing the engine's built-in visibility handling from parking it.

There are no first-entry section reveal animations in this version. Project videos previously requested metadata and started playback at 25% visibility, putting media preparation directly on the first encounter. These are plausible contributors to first-pass stalls; the desktop baseline reproduced slow scrolling on both passes, not exclusively the first.

## Changes

- Keep the tubes at the app root, below the fixed stars, but give their wrapper an absolute `100svh` box matching the hero. Native scrolling now moves the rendered canvas and text together. The engine can observe the canvas leaving the viewport. No additional animation scheduler, quality ladder, or camera movement was added.
- Prepare project clips within 600px of the viewport, while retaining the 25% playback threshold and reduced-motion posters.
- Separate the hero description into a primary statement and supporting line, using the existing font with adjusted size, spacing, color, and balanced wrapping. Preserve the Syncopate headline.

## Local validation

Production build served with Vite preview; fresh browser cache before each run. Automated six-second down-and-up scroll, repeated twice, in Chrome headless at 1440 × 900. Frame timing was sampled with requestAnimationFrame, with long-task observation alongside it.

| Frames exceeding 33.4 ms | Before | After |
| --- | ---: | ---: |
| First pass | 31 | 18 |
| Repeat pass | 48 | 18 |

These are single-run diagnostic observations, not a device-independent benchmark. Slow frames and long tasks remain around the animated hero; physical phone testing is still useful. Random tube palettes, browser scheduling, and GPU behavior introduce variability.

At widths 390, 768, and 1440px, checks at scroll positions 0 → 350 → 1100 → 350 → 0 verified that the canvas follows document scrolling exactly and its anchor's relative center remains unchanged. No horizontal overflow. Reduced-motion checks verified the SVG fallback, visible description, and absence of playing video elements.

`npm run build`, `npx tsc --noEmit`, and `git diff --check` passed. Local diagnostic scripts, screenshots, and raw measurements are in the ignored `scratch/scroll-diagnose.mjs`, `scratch/scroll-checks.mjs`, and `scratch/*-metrics.json` files. The scripts connect to the dedicated local Chrome debugging port 9223 and preview port 5173.

For a physical-device follow-up, compare a fresh reload and immediate first scroll with a second down-and-up pass. Include a quick reversal while the logo crosses the top edge and mobile address-bar expansion/collapse. Check that the logo travels with the text and resumes without changing scale.
