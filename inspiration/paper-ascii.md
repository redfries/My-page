# Hero-to-paper transition

Visual reference: [Paper ASCII by Scroll Shaders](https://scrollshaders.com/shaders/retro-ascii/ascii-paper).

The public reference is a watermarked preview of a Pro asset. No reference video,
poster, or proprietary shader is shipped here. `PaperTransition.tsx` is an original
Canvas 2D interpretation: flowing character density, hero-theme accents, and a
dark-to-paper edge that joins the existing `#f2f1ef` sections.

The band overlaps the final 72px of the hero and stays in document flow. It does
not change the tube engine, camera, figure anchor, or scroll behavior.

`paperAscii.ts` generates a domain-warped value-noise field with a cached glyph
atlas. Glyphs are rasterized only when dimensions or palette change; the
background is a small cell-resolution colour map. The palette reads `--paper`
and `--ink`. The upper edge matches the hero canvas's black (or charcoal on
fallback), while sparse upper glyphs echo the current tube theme. The engine
only publishes the theme's middle colour through `onAccentChange`; its rendering,
simulation and layout are unchanged. Palette updates do not restart the worker
or reset animation time.

No coloured background wash is drawn. Accents disappear above the lower third;
the bottom resolves to exact `#f2f1ef`. Canvas handles its own edge fades, without
a second CSS mask that can expose a darker fallback gradient. No fonts, videos,
or third-party packages are downloaded.

ASCII is reserved for the hero-to-Approach transition. The toolkit is a slim,
inset dark panel aligned to the content shell, on the continuous paper background.
Its label/count occupy a fixed left column on desktop and a top row on mobile;
the existing marquee is the only moving element. It mounts no canvases or workers.

On supported browsers `paperAscii.worker.ts` draws through OffscreenCanvas on a
worker, keeping this animation's computation and raster calls off the UI thread.
The same cached renderer falls back to the main thread if workers/OffscreenCanvas
are unavailable or fail. Preparation is scheduled during idle time; React's
StrictMode probe cancels preparation instead of building twice.

Animation targets 30fps and DPR is capped at 2. It starts at 30% visibility (the
small initial overlap remains still), pauses below that threshold or in hidden
tabs, and draws a still frame under reduced motion. CSS supplies a gradient
fallback when 2D canvas is unavailable. Worker and fallback paths both clean up
on unmount.
