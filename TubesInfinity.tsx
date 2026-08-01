import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Shared warp source, read by ParticleGrid in App.tsx. Values are viewport pixel
 * coordinates. The tubes engine owns its own scene and exposes no per-frame head
 * position, so nothing writes to this any more and `strength` stays 0 — which is
 * exactly the inert state ParticleGrid already treats as "no hero scene". It is
 * kept because App.tsx imports it, and because ParticleGrid only mounts on the
 * 'failed' path where there is no 3D scene to warp the grid anyway.
 */
export const heroWarp = { x: -10000, y: -10000, strength: 0 };

export type HeroStatus = 'loading' | 'ready' | 'failed';

/**
 * The tubes engine, verbatim from the reference (inspiration/ins.js). It is a
 * self-contained 775KB ES module with Three.js bundled in — it shares nothing
 * with the app's own `three` dependency, which is why this is a CDN import
 * rather than an npm one. Pinned to the exact version the reference uses; the
 * look is the whole point, and a minor bump could retune it.
 *
 * Original concept and implementation by Kevin Levron, CC BY-NC-SA 4.0 —
 * attribution required, non-commercial use only.
 */
const TUBES_SRC =
  'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js';

/**
 * Colour themes. One is picked at random on every load and clicking moves to
 * another at random, so the figure is never the same twice in a row.
 *
 * `setColors` treats the tube list as a gradient ramp and samples it across all
 * 16 tubes rather than assigning one colour per tube, so each theme reads as a
 * sweep from its first colour to its last. That is why the order matters and
 * why three stops is enough.
 */
const THEMES: { name: string; tubes: string[]; lights: string[] }[] = [
  {
    // The reference palette, copied exactly from inspiration/ins.js.
    name: 'neon',
    tubes: ['#f967fb', '#53bc28', '#6958d5'],
    lights: ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5'],
  },
  {
    // Monochrome. The tubes are metalness 1 at roughness 0.25, so with neutral
    // lights a greyscale ramp renders as chrome rather than as flat grey — the
    // white end blows through the bloom threshold and the dark end holds an
    // edge. #111 rather than pure black: a true #000 tube takes no specular at
    // all and the strand simply disappears instead of falling into shadow.
    name: 'mono',
    tubes: ['#ffffff', '#8a8a8a', '#111111'],
    lights: ['#ffffff', '#e6e6e6', '#ffffff', '#b4b4b4'],
  },
  {
    // The site's own cold family — the one theme that matches the headline
    // gradient above the figure instead of deliberately clashing with it.
    name: 'ice',
    tubes: ['#e0f2fe', '#38bdf8', '#6958d5'],
    lights: ['#7dd3fc', '#a78bfa', '#c4b5fd', '#60aed5'],
  },
  {
    name: 'ember',
    tubes: ['#fff1c9', '#fb923c', '#b91c1c'],
    lights: ['#fbbf24', '#f97316', '#ff4d4d', '#fde68a'],
  },
  {
    name: 'toxic',
    tubes: ['#eaffa3', '#4ade80', '#065f46'],
    lights: ['#a3e635', '#22c55e', '#2dd4bf', '#84cc16'],
  },
  {
    name: 'vapor',
    tubes: ['#ff71ce', '#b967ff', '#01cdfe'],
    lights: ['#ff71ce', '#05ffa1', '#b967ff', '#fffb96'],
  },
  {
    name: 'gold',
    tubes: ['#fff8e1', '#f5c542', '#6b3f04'],
    lights: ['#ffd76e', '#f59e0b', '#fff3c4', '#c2874a'],
  },
];

const LIGHT_INTENSITY = 200;

const pickTheme = (exclude?: number) => {
  if (THEMES.length < 2) return 0;
  let i = exclude;
  // Never land on the theme already showing, or a click would look like a
  // dead control.
  while (i === exclude) i = Math.floor(Math.random() * THEMES.length);
  return i as number;
};

/**
 * The figure is the engine's own idle ("sleep") path, not a custom curve.
 *
 * Its render loop drives the tube target at
 *   x = sleepRadiusX * cos(elapsed * sleepTimeScale1)
 *   y = sleepRadiusY * sin(elapsed * sleepTimeScale2)
 * and ships defaults of 300 / 150 / 1 / 2 — a 1:2 frequency ratio, which is a
 * Gerono lemniscate. The engine already traces an elongated infinity whenever
 * the pointer is away; that is what the reference stills are showing, not a
 * mouse being moved in a figure-8.
 *
 * So there is no path to author. The only change needed is to stop the cursor
 * from taking the wheel — see the onBeforeRender override below.
 */
const SLEEP_TIME_SCALE_1 = 1;
const SLEEP_TIME_SCALE_2 = 2;

/**
 * Radii in CSS pixels, matching the units the engine's sleep path uses. The
 * reference's 300 is right on a desktop and far too wide on a phone, so it is
 * scaled by viewport width and capped at the reference value. The 2:1 ratio is
 * held exactly — it is what makes the lemniscate read wide and flat instead of
 * as two circles.
 */
const figureRadii = () => {
  const rx = Math.max(96, Math.min(300, window.innerWidth * 0.36));
  return { rx, ry: rx * 0.5 };
};

/**
 * Publishes the box the figure occupies so the hero column can reserve exactly
 * that much room and the text never collides with it. The tubes lerp toward the
 * target with noise rather than sitting on it, so they overshoot the bare path;
 * the 1.18 covers that trailing envelope plus the thickest tube's radius.
 */
const publishFigureBox = () => {
  const { ry } = figureRadii();
  document.documentElement.style.setProperty(
    '--infinity-h',
    `${Math.round(ry * 2 * 1.18)}px`
  );
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/** Shape of the object the engine's factory returns. */
interface TubesApp {
  three: {
    camera: { position: { set(x: number, y: number, z: number): void } };
    size: { width: number; height: number; wWidth: number; wHeight: number };
    onBeforeRender: (state: { elapsed: number }) => void;
  };
  tubes: {
    target: { x: number; y: number; z: number };
    update(state: { elapsed: number }): void;
    setColors(colors: string[]): void;
    setLightsColors(colors: string[]): void;
  };
  dispose(): void;
}

interface Props {
  /** Called once the scene is live, or if it fails and the SVG should show. */
  onStatusChange?: (status: HeroStatus) => void;
  /**
   * The element in the hero layout that reserves room for the figure. The
   * camera is panned so the figure centres on this box: the canvas is fixed and
   * viewport-sized while the hero section is 100svh, so on a phone the two
   * centre lines sit tens of pixels apart.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const TubesInfinity: React.FC<Props> = ({ onStatusChange, anchorRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HeroStatus>('loading');

  // Before first paint, so the hero reserves the figure's box up front instead
  // of reflowing the text when the engine finishes loading.
  useLayoutEffect(() => {
    publishFigureBox();
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // The engine is a continuous animation with no meaningful still frame — its
    // tubes only form the figure by chasing a moving target. There is nothing to
    // freeze, so under reduced motion it is not started at all and the hero
    // falls through to the static SVG infinity App.tsx renders for 'failed'.
    if (!hasWebGL() || reducedMotion) {
      setStatus('failed');
      return;
    }

    let disposed = false;
    let app: TubesApp | undefined;
    let teardown: (() => void) | undefined;

    // If the CDN is blocked or slow, stop waiting and show the SVG rather than
    // leaving an empty hero behind the text.
    const failTimer = window.setTimeout(() => {
      if (!app && !disposed) setStatus('failed');
    }, 6000);

    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ TUBES_SRC);
        if (disposed || !canvasRef.current) return;

        const TubesCursor = mod.default as (
          canvas: HTMLCanvasElement,
          options: unknown
        ) => TubesApp;

        // The load-time theme is chosen here rather than applied after mount, so
        // the first frame is already the right palette instead of flashing the
        // default and correcting itself.
        let themeIndex = pickTheme();

        // Options in the shape the reference passes them, with the theme swapped in.
        app = TubesCursor(canvasRef.current, {
          tubes: {
            colors: THEMES[themeIndex].tubes,
            lights: {
              intensity: LIGHT_INTENSITY,
              colors: THEMES[themeIndex].lights,
            },
          },
        });

        const three = app.three;
        const tubes = app.tubes;

        // Vertical distance from the viewport's centre line to the reserved
        // box's, in CSS pixels. Recomputed on scroll and resize rather than per
        // frame — reading a rect inside the render loop would force layout every
        // frame. The canvas is fixed, so this shifts as the hero scrolls past.
        let anchorOffsetPx = 0;
        const measureAnchor = () => {
          const el = anchorRef?.current;
          if (!el) {
            anchorOffsetPx = 0;
            return;
          }
          const rect = el.getBoundingClientRect();
          anchorOffsetPx =
            rect.top + rect.height / 2 - window.innerHeight / 2;
        };

        /**
         * The whole modification: the stock loop hands the target to the cursor
         * whenever the pointer is over the canvas, and this canvas covers the
         * viewport — so the figure would only ever be an infinity while the mouse
         * sat still somewhere else. Overriding onBeforeRender keeps the engine's
         * own sleep path running unconditionally, so the lemniscate is permanent
         * and the cursor is simply not an input any more. Everything downstream —
         * the tubes, their materials, the four lights, the bloom — is untouched
         * engine code doing exactly what it does in the reference.
         */
        three.onBeforeRender = (state: { elapsed: number }) => {
          const worldPerPx = three.size.wWidth / three.size.width;
          const { rx, ry } = figureRadii();

          tubes.target.x =
            rx * worldPerPx * Math.cos(state.elapsed * SLEEP_TIME_SCALE_1);
          tubes.target.y =
            ry * worldPerPx * Math.sin(state.elapsed * SLEEP_TIME_SCALE_2);

          // Pan the camera so the figure lands on the reserved box. Raising the
          // camera pushes the scene down the frame, so a box below the centre
          // line takes a positive offset.
          three.camera.position.set(0, anchorOffsetPx * worldPerPx, 5);

          tubes.update(state);
        };

        measureAnchor();
        const onScroll = () => measureAnchor();
        const onResize = () => {
          publishFigureBox();
          measureAnchor();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);

        // Syncopate arrives from Google Fonts after first paint and changes the
        // height of the text above the figure, which moves the box the camera is
        // centred on. Re-measure once it lands.
        document.fonts?.ready.then(() => {
          if (!disposed) measureAnchor();
        });

        // Click to change theme. The reference shuffles to fully random colours;
        // going through a curated set instead is what keeps a monochrome pass in
        // the rotation, since random RGB would essentially never produce one.
        // Links and buttons are left alone so the nav and the scroll arrow still
        // work.
        const onClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('a, button')) return;
          themeIndex = pickTheme(themeIndex);
          app?.tubes.setColors(THEMES[themeIndex].tubes);
          app?.tubes.setLightsColors(THEMES[themeIndex].lights);
        };
        window.addEventListener('click', onClick);

        setStatus('ready');

        teardown = () => {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
          window.removeEventListener('click', onClick);
          // Releases the renderer and the engine's own pointer listeners. The
          // engine already parks itself off-screen via an IntersectionObserver
          // and on tab-hide via visibilitychange, so this only has to cover
          // unmount.
          app?.dispose();
        };

        if (disposed) teardown();
      } catch {
        if (!disposed) setStatus('failed');
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(failTimer);
      teardown?.();
    };
  }, [anchorRef]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${
        status === 'ready' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* The engine sizes itself to this canvas's parent, so the wrapper above
          is what defines the drawing buffer: exactly the viewport, independent
          of the hero section's 100svh. */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'manipulation' }}
      />
    </div>
  );
};

export default TubesInfinity;
