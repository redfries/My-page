# Portfolio UI and performance QA

Audit of the UI and performance fixes based on `0b0120d`.

## Fixes

- Hero fits phone landscape and short desktop windows without hiding its title
  behind the ASCII seam or crowding the fixed header. Live and fallback figures
  reserve the same space. Native scrolling and scene-group anchoring remain.
- Live motion preference changes stop the hero, stars, fallback grid and videos.
  Stars still redraw after resizing. Background canvases stop when covered by
  the opaque sections and resume when visible.
- Fixed the pinned engine's resize/visibility listener leak across disposal.
  The compatibility wrapper restores browser methods immediately after the
  synchronous factory call and removes only the recorded engine subscriptions.
  Bloom resources and temporary GPU probe contexts are released too.
- GPU device loss uses the SVG fallback for either engine backend. CDN timeout
  is terminal for that mount, so a late response cannot abruptly replace it.
  A failed ASCII worker recovers to the main-thread renderer.
- Simulation catch-up respects its 5 ms budget after each step instead of
  always performing up to three expensive updates. A single update cannot be
  interrupted; overdue whole steps are dropped, fractional timing is retained.
- Videos prepare nearby, play only at 25% visibility, pause on hiding, and
  safely handle pending/rejected playback. Redundant loading was removed.
- Clipped overflowing decorative hero glows on `/pre/` and `/ocr/`, and disabled
  smooth anchor scrolling/reveal delays for their reduced-motion mode.
- Fixed the rental specification grid's mobile overflow in its authoritative
  `Documents/house-rent/styles.css`, then copied only that stylesheet to
  `public/rent/styles.css`. The auto-deploy sync script was intentionally not run.
  Source and deployment-copy hashes match.

## Validation

- `npm test`: three listener lifecycle regression tests.
- `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- Browser geometry at 320x568, 390x844, 768x1024, 844x390, 1366x650,
  1920x390, 1440x900 and 1920x1080. No horizontal document overflow; hero title
  remains above the seam and the kicker below the header after entrance motion.
- Steady-state instrumented canvas counts: zero behind the work section; zero
  during reduced motion. Static star pixels survive a resize.
- Repeated motion toggles: resize/visibility listeners return to baseline
  (2/3), including rapid resize/disposal. Actual GPU device loss recovers to SVG.
- Blocked CDN, delayed CDN beyond six seconds, worker runtime failure, missing
  canvas support, autoplay denial, video visibility and simulated document
  hide/resume handlers, keyboard focus, and existing internal anchor targets.
- `/pre/`, `/ocr/`, `/rent/`: mobile and desktop smoke checks, loaded-image
  checks and no horizontal overflow after fixes. This is not an exhaustive
  rental interaction audit. CardTrack's external deployment was not modified.
- ASCII renderer/controller checks: worker and fallback visibility, tab hiding,
  reduced motion, StrictMode cleanup, resize, seven palettes and exact paper joins.
- Inspected saved hero/seam screenshots, including landscape, tablet and static
  fallback. The production build preserves the original engine and visual style.

## Performance limits

Testing used installed Chrome in headless mode on Intel Iris Plus graphics.
Mobile sizes/DPR/touch and CPU throttling are simulations, not physical-device
certification. Safari, Firefox, actual mobile URL-bar behavior, thermal throttling
and high-refresh hardware still need device checks.

Isolated samples after the fixes showed work/footer frame intervals near 16.8–17
ms at the 95th percentile, zero long tasks in the sampled phases, and no canvas
drawing underneath those opaque sections. The hero/seam remain substantially
more expensive: repeated runs varied around 17–50 ms p95. CPU profiles locate
the main cost in the pinned engine's tube `lerpTo`/curve geometry updates.

The 4x CPU-throttled seam sample improved from about 300 ms p95 before the
catch-up budget change to about 150 ms in the next run. These short local runs
are diagnostic, not a controlled device benchmark. The heavy 3D effect still
stutters under substantial CPU throttling; do not claim universal 60 fps or
lag-free operation. The static reduced-motion fallback avoids that cost.

## Local evidence

- `scratch/qa-before/` and `scratch/qa-after/`: initial screenshots and audit JSON.
- `scratch/qa-regressions.mjs`, `scratch/qa-regressions.json`: browser assertions.
- `scratch/qa-edge.mjs`: repeated setup/disposal and GPU loss checks.
- `scratch/qa-profile.mjs`, `scratch/qa-profile*.json`: CPU/frame profiles.
- `tests/engine-lifecycle.test.cjs`: committed-source-ready regression tests.

`scratch/` is intentionally git-ignored and remains available locally. Browser
scripts use the temporary Playwright installation in `scratch/qa-tools/`.
