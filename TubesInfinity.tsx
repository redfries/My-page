import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Shared warp source, written by the hero comet and read by ParticleGrid in
 * App.tsx. Values are viewport pixel coordinates. While `strength` is 0 the
 * grid behaves exactly as it always has, so if this component never loads the
 * background is completely unaffected.
 */
export const heroWarp = { x: -10000, y: -10000, strength: 0 };

export type HeroStatus = 'loading' | 'ready' | 'failed';

const FOV = 45;
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));

/**
 * Device tier, resolved once per page. The layout helpers below and the render
 * loop both depend on it, so it cannot be re-evaluated per call: a window
 * resize that crossed the 768px line would otherwise change the figure's
 * proportions out from under geometry that has already been built.
 */
let tier: { lowPower: boolean; weak: boolean } | undefined;
const deviceTier = () => {
  if (!tier) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency ?? 8;
    // GB of RAM, rounded down to a power of two and capped at 8. Chrome and
    // Android only — undefined on iOS, which is what the adaptive ladder in the
    // render loop is there to cover.
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
    const lowPower = coarse || window.innerWidth < 768 || cores <= 4;
    tier = {
      lowPower,
      weak: lowPower && ((deviceMemory ?? 8) <= 4 || cores <= 4),
    };
  }
  return tier;
};

/**
 * Geometry of the lemniscate, shared by the camera fit, the curve and the
 * hero's layout. The braid is wound wider on phones: the figure is fitted to
 * roughly a third of the width it gets on a desktop, so at the desktop radius
 * every strand lands inside the same ~5px bundle and the braid can't read as
 * anything but a fuzzy line.
 */
function buildShape() {
  const scale = 5.9;
  const yStretch = 0.82;
  const braidRadius = deviceTier().lowPower ? 0.19 : 0.13;
  return {
    scale,
    yStretch,
    braidRadius,
    depth: 0.5,
    // Extents of the traced figure in world units (the lemniscate peaks at
    // |y| = scale / 3).
    width: scale * 2 + braidRadius * 4,
    height: ((scale * 2) / 3) * yStretch + braidRadius * 4,
  };
}
let shapeCache: ReturnType<typeof buildShape> | undefined;
const figureShape = () => (shapeCache ??= buildShape());

/**
 * How far idle drift can carry the figure's edge beyond its static box, in
 * world units: the vertical wander plus the vertical reach of the roll about z
 * at this width. The hero reserves it, so the text keeps its distance at every
 * point in the drift instead of only at the pose the figure was measured in.
 * That difference is the gap "TO" was landing inside.
 */
const MOTION_ENVELOPE = 0.6;

/**
 * Camera distance at which the figure fills its target fraction of the
 * viewport. Shared by the camera fit and the tube-thickness calculation, so
 * line weight is always derived from the size the figure actually renders at.
 */
const fitDistance = (w: number, h: number) => {
  const SHAPE = figureShape();
  const aspect = w / h;
  // Phones fill more of the width; desktops leave breathing room. A portrait
  // phone used to get 0.627, which drew the figure ~245px wide — too small for
  // a braid to resolve in, and small enough to read as a low-res artefact
  // rather than a deliberate mark.
  const fill = aspect < 0.8 ? 0.78 : aspect < 1.2 ? 0.62 : 0.475;
  const distForWidth = SHAPE.width / (2 * TAN_HALF_FOV * aspect * fill);
  const distForHeight = SHAPE.height / (2 * TAN_HALF_FOV * fill);
  // Never let the figure eat the vertical space the hero text needs — this is
  // what keeps landscape phones and short windows readable.
  const minDist = SHAPE.height / (2 * TAN_HALF_FOV * (h < 560 ? 0.21 : 0.3));
  return Math.max(distForWidth, distForHeight, minDist);
};

/** CSS pixels per world unit at the fitted distance. */
const pixelsPerWorld = (w: number, h: number) =>
  h / (2 * TAN_HALF_FOV * fitDistance(w, h));

/**
 * Publishes the box the figure can occupy, drift included, so the hero layout
 * can reserve exactly that much room for it.
 */
const publishFigureBox = (w: number, h: number) => {
  const px = (figureShape().height + MOTION_ENVELOPE * 2) * pixelsPerWorld(w, h);
  document.documentElement.style.setProperty(
    '--infinity-h',
    `${Math.round(px)}px`
  );
};

const TIMING = {
  drawDuration: 2.6,
  drawStagger: 0.14,
  settleDuration: 1.2,
  startDelay: 0.35,
};

/**
 * Adaptive quality. No spec sniff catches every weak GPU — `deviceMemory` is
 * Chrome-only, and core count says little about the fill rate this scene leans
 * on — so the render loop watches real frame times and gives quality back when
 * the device can't hold its budget. Downward only, so it settles after a few
 * adjustments instead of oscillating; the cost is that a device throttled only
 * while loading stays stepped down until the next reload, which is the cheaper
 * failure of the two.
 */
const ADAPT = {
  slowFrameSec: 0.027, // slower than ~37fps
  stallSec: 0.5, // beyond this it's a stall (GC, tab switch), not steady load
  // Measured in seconds of sustained slowness, not frames. Counting frames
  // would make the worst devices wait the longest to be helped — 40 frames is
  // 1.3s at 30fps but 8s at 5fps, which is exactly backwards.
  slowSecsBeforeDrop: 1.2,
  /**
   * Ladder, applied in order. Resolution goes last and never far: a soft,
   * upscaled figure is the most conspicuous way this scene can fail, whereas
   * bloom is a wide blur that can lose half its resolution without anyone
   * being able to point at what changed.
   */
  steps: [
    { bloom: 0.72, dpr: 1 },
    { bloom: 0.5, dpr: 1 },
    { bloom: 0.5, dpr: 0.85 },
    { bloom: 0.5, dpr: 0.72 },
  ],
};

/**
 * Once the hero has scrolled past, the figure has already been carried
 * off-screen by the scroll parallax and the starfield is all that's left, which
 * needs neither bloom nor 60fps. Hysteresis between the two thresholds keeps a
 * scroll that hovers at the boundary from flipping state every frame.
 */
const BACKDROP_IN = 1;
const BACKDROP_OUT = 0.85;

const TUBE_COLORS = ['#ffffff', '#9ae6ff', '#b39dff', '#7dd3fc', '#e2e8f0'];
const LIGHT_COLORS = ['#7dd3fc', '#a78bfa', '#f0abfc', '#60aed5'];

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const wrap01 = (v: number) => ((v % 1) + 1) % 1;

// Draw easing: accelerates over the first 30%, then holds constant speed, so
// the comet still carries momentum when the loop closes. An ease-in-out would
// decelerate to a dead stop at the seam, which reads as fake in vacuum.
const ACCEL = 0.3;
const EASE_NORM = 1 - ACCEL / 2;
const easeInHold = (t: number) =>
  (t < ACCEL ? (t * t) / (2 * ACCEL) : ACCEL / 2 + (t - ACCEL)) / EASE_NORM;
const TERMINAL_SPEED = 1 / EASE_NORM / TIMING.drawDuration;

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

interface Props {
  /** Called once the 3D scene is live, or if it fails and the SVG should show. */
  onStatusChange?: (status: HeroStatus) => void;
  /**
   * The element in the hero layout that reserves room for the figure. The
   * camera is offset so the figure centres on this box, which is what keeps the
   * figure and the text agreeing on where the middle is — the canvas is fixed
   * and viewport-sized, while the hero section is 100svh, so on a phone the two
   * centre lines are tens of pixels apart.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const TubesInfinity: React.FC<Props> = ({ onStatusChange, anchorRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HeroStatus>('loading');

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Reserve the figure's room before first paint. The value is pure geometry —
  // it needs nothing from Three.js — so the hero must not have to wait on a
  // dynamic import to lay itself out, or the text visibly jumps when the real
  // measurement finally lands a few hundred milliseconds in. documentElement's
  // client box is used rather than innerWidth/innerHeight because that is what
  // a `fixed; inset: 0` canvas resolves against, scrollbar excluded.
  useLayoutEffect(() => {
    const publish = () =>
      publishFigureBox(
        document.documentElement.clientWidth,
        document.documentElement.clientHeight
      );
    publish();
    window.addEventListener('resize', publish);
    return () => window.removeEventListener('resize', publish);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Disposed guard — StrictMode mounts effects twice in development.
    let disposed = false;
    let teardown: (() => void) | undefined;

    if (!hasWebGL()) {
      setStatus('failed');
      return;
    }

    // If the chunk is slow (cold cache, poor network), fall back to the SVG
    // rather than leaving the hero empty.
    const failTimer = window.setTimeout(() => {
      if (!disposed && !teardown) setStatus('failed');
    }, 3000);

    (async () => {
      let THREE: typeof import('three');
      let EffectComposer: typeof import('three/examples/jsm/postprocessing/EffectComposer.js')['EffectComposer'];
      let RenderPass: typeof import('three/examples/jsm/postprocessing/RenderPass.js')['RenderPass'];
      let UnrealBloomPass: typeof import('three/examples/jsm/postprocessing/UnrealBloomPass.js')['UnrealBloomPass'];
      let OutputPass: typeof import('three/examples/jsm/postprocessing/OutputPass.js')['OutputPass'];

      try {
        const [three, ec, rp, ub, op] = await Promise.all([
          import('three'),
          import('three/examples/jsm/postprocessing/EffectComposer.js'),
          import('three/examples/jsm/postprocessing/RenderPass.js'),
          import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          import('three/examples/jsm/postprocessing/OutputPass.js'),
        ]);
        THREE = three;
        EffectComposer = ec.EffectComposer;
        RenderPass = rp.RenderPass;
        UnrealBloomPass = ub.UnrealBloomPass;
        OutputPass = op.OutputPass;
      } catch (err) {
        console.warn('Hero: 3D unavailable, using SVG infinity.', err);
        if (!disposed) setStatus('failed');
        return;
      }

      if (disposed) return;
      window.clearTimeout(failTimer);

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      const SHAPE = figureShape();
      const { lowPower, weak } = deviceTier();

      const QUALITY = {
        tubular: weak ? 420 : lowPower ? 560 : 840,
        radial: weak ? 8 : lowPower ? 9 : 12,
        stars: weak ? 0.35 : lowPower ? 0.55 : 1,
        sparks: weak ? 64 : lowPower ? 96 : 160,
        // Render at the device's real pixels. A flat cap of 2 left every 3x
        // phone — and any browser zoom past 200% — displaying an upscaled
        // buffer, which is what read as "240p". Total pixels are budgeted
        // instead, so a small dense screen gets native density while a 4K
        // desktop doesn't try to render 33M pixels.
        maxDpr: 3,
        maxPixels: weak ? 2.2e6 : lowPower ? 3.6e6 : 6.5e6,
        // Floor for the budget above, and the reason the desktop figure is
        // sharp on a 5K panel instead of soft: a floor of 2 outranked the pixel
        // budget entirely there, so a 2560x1440 window rendered 14.7M pixels
        // through twelve bloom passes. Only phones, where CSS resolution really
        // does look bad, still hold a floor above 1.
        minDpr: weak ? 1.9 : lowPower ? 2 : 1,
        // Bloom is a wide blur, so it costs nothing visually to run it below the
        // render resolution — and that headroom is what pays for native pixel
        // density on the figure itself, which is the part anyone can see.
        bloomScale: weak ? 0.6 : 0.7,
        // MSAA samples on the post-processing target. EffectComposer ignores
        // the renderer's own `antialias` flag, so this is what actually smooths
        // the tube edges. Nearly all of the benefit is in the first two
        // samples, and now that the tubes land 4-5 device px wide rather than
        // barely one, 4x only bought memory: it doubled the multisample
        // buffers, which are the largest allocation in the whole scene.
        samples: 2,
      };

      const viewportSize = () => ({
        w: canvas.clientWidth || window.innerWidth,
        h: canvas.clientHeight || window.innerHeight,
      });

      // ---------------------------------------------------------------
      // Renderer — transparent so the site's ParticleGrid shows through
      // ---------------------------------------------------------------
      const renderer = new THREE.WebGLRenderer({
        canvas,
        // Nothing is ever drawn straight to the default framebuffer — the last
        // pass composites a fullscreen quad — so an MSAA backbuffer here would
        // only burn memory and a resolve. `QUALITY.samples` does the real work.
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearAlpha(0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);

      // A multisampled, half-float render target gives the whole post chain
      // true edge antialiasing and smoother bloom (EffectComposer disposes it).
      const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: QUALITY.samples,
      });
      const composer = new EffectComposer(renderer, composerTarget);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(256, 256),
        0.5,
        0.28,
        0.55
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());

      const group = new THREE.Group();
      scene.add(group);

      const disposables: { dispose: () => void }[] = [];

      // ---------------------------------------------------------------
      // Braided lemniscate tubes
      // ---------------------------------------------------------------
      class BraidedLemniscate extends THREE.Curve<InstanceType<typeof THREE.Vector3>> {
        constructor(private phase: number) {
          super();
        }
        getPoint(t: number, target = new THREE.Vector3()) {
          const u = t * Math.PI * 2;
          const s = Math.sin(u);
          const c = Math.cos(u);
          const d = 1 + s * s;
          const x = (SHAPE.scale * c) / d;
          const y = ((SHAPE.scale * s * c) / d) * SHAPE.yStretch;
          const z = Math.sin(u * 2) * SHAPE.depth;
          const a = u * 2 + this.phase;
          return target.set(
            x + Math.cos(a) * SHAPE.braidRadius,
            y + Math.sin(a) * SHAPE.braidRadius,
            z + Math.sin(a + u) * SHAPE.braidRadius * 0.5
          );
        }
      }

      // The figure is fitted to a much smaller box on a phone than on a
      // desktop, so the same world-space radius lands at ~4 CSS px there and
      // barely 1 px here. A bright line thinner than a pixel aliases no matter
      // how much resolution or MSAA it gets, so hold a floor on line weight.
      // Desktops already clear the floor and are left exactly as they were.
      const BASE_TUBE_RADIUS = 0.028;
      const MIN_TUBE_PX = 2.4;
      const { w: fitW, h: fitH } = viewportSize();
      const cssPerWorld = pixelsPerWorld(fitW, fitH);
      const lineScale = Math.min(
        2.8,
        Math.max(1, MIN_TUBE_PX / (2 * BASE_TUBE_RADIUS * cssPerWorld))
      );

      // Five strands only read as a braid when the bundle they wind through is
      // wide enough to hold them apart. On a phone the band is ~9px and five
      // strands at a legible thickness lay down more ink than fits in it, so
      // they merge into one shimmering bar; three at full weight read as a
      // braid. Desktops and tablets are well clear of the threshold and keep
      // all five exactly as before.
      const braidBandPx = 2 * SHAPE.braidRadius * cssPerWorld;
      const palette = braidBandPx >= 12.5 ? TUBE_COLORS : TUBE_COLORS.slice(0, 3);

      const tubes = palette.map((hex, i) => {
        const curve = new BraidedLemniscate((i / palette.length) * Math.PI * 2);
        const geometry = new THREE.TubeGeometry(
          curve,
          QUALITY.tubular,
          BASE_TUBE_RADIUS * lineScale * (i === 0 ? 1.25 : 1),
          QUALITY.radial,
          true
        );
        geometry.setDrawRange(0, 0);
        const color = new THREE.Color(hex);
        const material = new THREE.MeshStandardMaterial({
          color: color.clone().multiplyScalar(0.15),
          emissive: color,
          emissiveIntensity: 0.75,
          metalness: 0.15,
          roughness: 0.45,
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        disposables.push(geometry, material);
        return { mesh, geometry, material, curve, indexCount: geometry.index!.count };
      });

      // Comet head
      const cometGeo = new THREE.SphereGeometry(0.11, 16, 16);
      const cometMat = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
      });
      const comet = new THREE.Mesh(cometGeo, cometMat);
      group.add(comet);
      disposables.push(cometGeo, cometMat);
      const cometLight = new THREE.PointLight('#ffffff', 22, 10, 2);
      comet.add(cometLight);

      scene.add(new THREE.AmbientLight('#0a0a12', 2));
      const orbitLights = LIGHT_COLORS.map((hex, i) => {
        const light = new THREE.PointLight(hex, 9, 18, 2);
        const angle = (i / LIGHT_COLORS.length) * Math.PI * 2;
        light.position.set(Math.cos(angle) * 6, Math.sin(angle) * 3, 2);
        scene.add(light);
        return { light, angle, speed: 0.1 + i * 0.03, radius: 5.5 + i * 0.6 };
      });

      // ---------------------------------------------------------------
      // Starfield — volumetric layers, not a shell, so no alignment band
      // ---------------------------------------------------------------
      const starField = new THREE.Group();
      scene.add(starField);
      const STAR_LAYERS = [
        { count: 320, size: 0.06, zNear: -16, zFar: -44, spread: 52, min: 0.06, max: 0.26 },
        { count: 240, size: 0.11, zNear: -44, zFar: -82, spread: 84, min: 0.1, max: 0.44 },
        { count: 110, size: 0.19, zNear: -82, zFar: -130, spread: 124, min: 0.2, max: 0.8 },
      ];
      let twinkle: { geo: any; col: Float32Array; base: Float32Array; count: number } | null =
        null;
      for (const layer of STAR_LAYERS) {
        const count = Math.round(layer.count * QUALITY.stars);
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * layer.spread;
          pos[i * 3 + 1] = (Math.random() - 0.5) * layer.spread * 0.8;
          pos[i * 3 + 2] = layer.zNear + Math.random() * (layer.zFar - layer.zNear);
          const b = layer.min + Math.pow(Math.random(), 2.4) * (layer.max - layer.min);
          const tint = Math.random();
          col[i * 3] = b * (tint > 0.82 ? 1 : 0.9);
          col[i * 3 + 1] = b * 0.94;
          col[i * 3 + 2] = b * (tint < 0.3 ? 1 : 0.88);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({
          size: layer.size,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        });
        starField.add(new THREE.Points(geo, mat));
        disposables.push(geo, mat);
        twinkle = { geo, col, base: col.slice(), count };
      }

      // ---------------------------------------------------------------
      // Spark / stardust pool
      // ---------------------------------------------------------------
      const SPARKS = QUALITY.sparks;
      const sparkPos = new Float32Array(SPARKS * 3);
      const sparkCol = new Float32Array(SPARKS * 3);
      const sparkVel = new Float32Array(SPARKS * 3);
      const sparkLife = new Float32Array(SPARKS);
      const sparkDecay = new Float32Array(SPARKS);
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
      sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
      const sparkMat = new THREE.PointsMaterial({
        size: 0.09,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
      group.add(sparkPoints);
      disposables.push(sparkGeo, sparkMat);

      let sparkCursor = 0;
      const tmpColor = new THREE.Color();
      const spawn = (
        o: InstanceType<typeof THREE.Vector3>,
        vx: number,
        vy: number,
        vz: number,
        decay: number,
        hex: string,
        brightness: number
      ) => {
        const i = sparkCursor;
        sparkCursor = (sparkCursor + 1) % SPARKS;
        sparkPos[i * 3] = o.x;
        sparkPos[i * 3 + 1] = o.y;
        sparkPos[i * 3 + 2] = o.z;
        sparkVel[i * 3] = vx;
        sparkVel[i * 3 + 1] = vy;
        sparkVel[i * 3 + 2] = vz;
        sparkLife[i] = 1;
        sparkDecay[i] = decay;
        tmpColor.set(hex).multiplyScalar(brightness);
        sparkCol[i * 3] = tmpColor.r;
        sparkCol[i * 3 + 1] = tmpColor.g;
        sparkCol[i * 3 + 2] = tmpColor.b;
      };

      // ---------------------------------------------------------------
      // Responsive fit — camera distance always frames the figure, and the
      // hero reserves exactly the height the figure actually occupies.
      // ---------------------------------------------------------------
      let baseCameraZ = 14;
      // World-space height of the camera, which is what centres the figure on
      // the box the hero reserved for it rather than on the middle of a
      // viewport-sized canvas.
      let baseCameraY = 0;
      // Set by the adaptive ladder in the render loop; both default to "device
      // is keeping up, render at the quality the budget above chose".
      let dprScale = 1;
      let bloomScale = QUALITY.bloomScale;
      // The canvas is fixed, so its viewport rect only moves on resize. Reading
      // it per frame — which is what projectToScreen used to do — forces a
      // synchronous layout on the main thread during the busiest part of the
      // whole timeline.
      let canvasRect = canvas.getBoundingClientRect();
      const resize = () => {
        const { w, h } = viewportSize();
        camera.aspect = w / h;
        baseCameraZ = fitDistance(w, h);
        camera.position.z = baseCameraZ;

        const dpr = Math.max(
          // Never render below CSS resolution: an upscaled buffer is the exact
          // problem this whole path exists to avoid. A device that can't hold
          // frame rate at 1:1 is better served by the SVG fallback than by a
          // blurry 3D scene.
          Math.min(1, window.devicePixelRatio || 1),
          Math.min(
            window.devicePixelRatio || 1,
            QUALITY.maxDpr,
            // Budget total pixels so a large dense screen doesn't render a
            // 4K-sized frame.
            Math.max(QUALITY.minDpr, Math.sqrt(QUALITY.maxPixels / Math.max(1, w * h)))
          ) * dprScale
        );
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        // The composer captured a pixel ratio of 1 at construction, so without
        // this its post chain renders at CSS resolution and gets upscaled to the
        // screen — the whole figure then looks soft/low-res on every device.
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
        // Must come after composer.setSize, which resizes every pass to the
        // full render resolution. `bloomPass.resolution` is only read in the
        // constructor, so setSize is the only way to actually move the glow off
        // the full-res path.
        bloomPass.setSize(
          Math.max(64, Math.round(w * dpr * bloomScale)),
          Math.max(64, Math.round(h * dpr * bloomScale))
        );

        canvasRect = canvas.getBoundingClientRect();

        // Republish the reserved box — the layout effect already did this before
        // first paint, and both sides compute it from the same geometry, so this
        // only matters after a resize.
        publishFigureBox(w, h);

        // Then centre the figure on that box. Measuring the anchor is what makes
        // this exact: the canvas is viewport-height while the hero section is
        // 100svh, so on a phone their centre lines sit tens of pixels apart, and
        // splitting the difference in either direction is what put the text and
        // the figure in each other's way.
        const anchor = anchorRef?.current;
        const perWorld = h / (2 * TAN_HALF_FOV * baseCameraZ);
        if (anchor && perWorld > 0) {
          const box = anchor.getBoundingClientRect();
          // Measured against the hero section rather than the viewport: the
          // canvas is fixed and the anchor is not, so at any scroll position but
          // zero their viewport rects differ by the scroll offset — and resize
          // does fire mid-page, every time a mobile URL bar collapses. The
          // section and the anchor scroll together, so their difference is the
          // resting offset at any scroll position, which is what the scroll
          // parallax in the render loop then displaces.
          const host = canvas.parentElement;
          const hostTop = host ? host.getBoundingClientRect().top : canvasRect.top;
          const shiftPx = box.top - hostTop + box.height / 2 - h / 2;
          baseCameraY = shiftPx / perWorld;
        } else {
          baseCameraY = 0;
        }
        camera.position.y = baseCameraY;
        camera.updateProjectionMatrix();
      };
      resize();

      // ---------------------------------------------------------------
      // Interaction
      // ---------------------------------------------------------------
      const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointerMove = (e: PointerEvent) => {
        parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const onClick = (e: MouseEvent) => {
        if (phase !== 'idle') return;
        // Don't trigger if user is clicking interactive buttons or links
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a, button'))) return;
        const baseHue = Math.random();
        tubes.forEach((tube, i) => {
          const c = new THREE.Color().setHSL((baseHue + i * 0.09) % 1, 0.75, 0.72);
          tube.material.emissive.copy(c);
          tube.material.color.copy(c).multiplyScalar(0.15);
        });
        orbitLights.forEach(({ light }, i) =>
          light.color.setHSL((baseHue + 0.5 + i * 0.12) % 1, 0.85, 0.6)
        );
        bloomBase = 0.9;
      };
      // Under reduced motion the scene is drawn exactly once, so anything that
      // resizes the drawing buffer has to redraw it or the canvas is left blank.
      const onResize = () => {
        resize();
        if (reducedMotion) composer.render();
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('click', onClick);
      window.addEventListener('resize', onResize);

      // Syncopate arrives from Google Fonts after first paint and changes the
      // height of the text above the figure, which moves the box the camera is
      // centred on. Re-measure once it lands.
      document.fonts?.ready.then(() => {
        if (!disposed) onResize();
      });

      // Ctrl+/- zoom and moving the window between displays change
      // devicePixelRatio, and neither reliably fires `resize`. Without this the
      // canvas keeps its old backing store and the compositor upscales it,
      // which is why zooming in used to soften the figure. Each match is
      // one-shot, so the query is re-armed at the new ratio every time.
      let dprQuery: MediaQueryList | undefined;
      const onDprChange = () => {
        onResize();
        watchDpr();
      };
      const watchDpr = () => {
        dprQuery?.removeEventListener('change', onDprChange);
        dprQuery = window.matchMedia(
          `(resolution: ${window.devicePixelRatio}dppx)`
        );
        dprQuery.addEventListener('change', onDprChange);
      };
      watchDpr();

      // Pause while the tab is hidden. There is deliberately no
      // IntersectionObserver here: this canvas is fixed and fills the viewport,
      // so it intersects on every section of the page and an observer on it can
      // only ever report "visible" — which is how the full-quality loop, bloom
      // included, ended up running behind Works, Profile and the footer for as
      // long as the page was open. Scroll position is what actually says whether
      // the figure is on screen, and the render loop reads it directly.
      let visible = true;
      const onVisibility = () => {
        if (document.hidden) {
          visible = false;
        } else {
          visible = true;
          clock.getDelta();
          if (!reducedMotion) loop();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      // ---------------------------------------------------------------
      // Timeline
      // ---------------------------------------------------------------
      type Phase = 'ignition' | 'settle' | 'idle';
      let phase: Phase = 'ignition';
      let settleStart = 0;
      let idleStart = 0;
      let cometProgress = 0;
      let cometSpeed = 0;
      let dustTimer = 0;
      let frame = 0;
      let slowTime = 0;
      let degraded = 0;
      // The timeline writes here rather than to the pass, so the scroll-out fade
      // can scale it without either of them overwriting the other.
      let bloomBase = 0.5;
      let backdrop = false;
      let throttleAcc = 0;
      const clock = new THREE.Clock();
      const headPos = new THREE.Vector3();
      const headTangent = new THREE.Vector3();
      const tmpPrev = new THREE.Vector3();
      const cometWorld = new THREE.Vector3();
      const dustOrigin = new THREE.Vector3();

      const projectToScreen = (v: InstanceType<typeof THREE.Vector3>) => {
        cometWorld.copy(v).project(camera);
        return {
          x: canvasRect.left + ((cometWorld.x + 1) / 2) * canvasRect.width,
          y: canvasRect.top + ((1 - cometWorld.y) / 2) * canvasRect.height,
        };
      };

      /**
       * Everything that only exists to serve the figure is switched off once the
       * figure is gone, leaving the starfield to carry the rest of the page. The
       * bloom pass alone is a dozen fullscreen draws per frame; on a phone that
       * was the entire cost of scrolling through the site.
       */
      const setBackdrop = (on: boolean) => {
        backdrop = on;
        tubes.forEach((t) => (t.mesh.visible = !on));
        sparkPoints.visible = !on;
      };

      let onStaticScroll: (() => void) | undefined;
      if (reducedMotion) {
        tubes.forEach((t) => t.geometry.setDrawRange(0, t.indexCount));
        comet.visible = false;
        cometLight.intensity = 0;
        phase = 'idle';

        // With no render loop running, the figure has to be carried off with the
        // page by hand. Otherwise the single rendered frame stays pinned to the
        // middle of a fixed, full-viewport canvas and hangs over Works and
        // Profile for the rest of the session. Redraws only while scrolling,
        // one per frame at most.
        let queued = false;
        const drawStatic = () => {
          queued = false;
          const past = window.scrollY / Math.max(1, window.innerHeight);
          setBackdrop(past > BACKDROP_IN);
          group.position.y = past * 2 * TAN_HALF_FOV * baseCameraZ;
          composer.render();
        };
        onStaticScroll = () => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(drawStatic);
        };
        window.addEventListener('scroll', onStaticScroll, { passive: true });

        drawStatic();
        setStatus('ready');
      }

      const enterSettle = (elapsed: number) => {
        phase = 'settle';
        settleStart = elapsed;
        cometSpeed = TERMINAL_SPEED;
        bloomBase = 1.2;
        // Circuit closes: the charge distributes around the ring as dust.
        for (let i = 0; i < 30; i++) {
          tubes[0].curve.getPoint(i / 30, dustOrigin);
          spawn(
            dustOrigin,
            dustOrigin.x * 0.05 + (Math.random() - 0.5) * 0.12,
            dustOrigin.y * 0.05 + (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.12,
            0.45,
            '#ffffff',
            0.5
          );
        }
      };

      const render = () => {
        // Time is accumulated rather than read per frame so that skipping a
        // frame in backdrop mode still hands the full elapsed interval to the
        // animation, and nothing runs in slow motion.
        throttleAcc += clock.getDelta();
        // 32fps is indistinguishable for a starfield turning at 0.004 rad/s, and
        // halving the frame count halves what scrolling the page costs.
        if (backdrop && throttleAcc < 0.031) return;
        // The clamped dt drives the animation so a long stall can't teleport
        // the comet; the raw value is what the adaptive ladder has to judge on,
        // since the clamp would report a 5fps device as if it were running 20.
        const rawDt = throttleAcc;
        throttleAcc = 0;
        const dt = Math.min(rawDt, 0.05);
        const elapsed = clock.elapsedTime;

        // How far the hero has scrolled away, in viewport heights.
        const past = window.scrollY / Math.max(1, window.innerHeight);
        if (past > BACKDROP_IN) {
          if (!backdrop) setBackdrop(true);
        } else if (past < BACKDROP_OUT) {
          if (backdrop) setBackdrop(false);
        }

        // Give back quality if the device can't sustain the frame rate. Only
        // once idle, and never in backdrop mode, where frames are deliberately
        // throttled and every one of them would read as a device too slow to
        // keep up: ignition is the heaviest stretch of the timeline by design,
        // so judging a device on it down-scales hardware that handles the steady
        // state perfectly well. Reaching idle also serves as the grace period for
        // shader compilation and first GPU uploads. resize() only touches camera
        // and buffer sizes, never the timeline or draw ranges, so it is safe to
        // call from here.
        if (phase === 'idle' && !backdrop && degraded < ADAPT.steps.length) {
          if (rawDt > ADAPT.slowFrameSec && rawDt < ADAPT.stallSec) {
            slowTime += rawDt;
            if (slowTime >= ADAPT.slowSecsBeforeDrop) {
              const step = ADAPT.steps[degraded++];
              bloomScale = QUALITY.bloomScale * step.bloom;
              dprScale = step.dpr;
              slowTime = 0;
              resize();
            }
          } else if (rawDt <= ADAPT.slowFrameSec) {
            slowTime = Math.max(0, slowTime - rawDt);
          }
        }

        if (phase === 'ignition') {
          const raw = clamp01((elapsed - TIMING.startDelay) / TIMING.drawDuration);
          cometProgress = easeInHold(raw);

          tubes.forEach((tube, i) => {
            const local = clamp01(
              (elapsed - TIMING.startDelay - i * TIMING.drawStagger) /
                (TIMING.drawDuration - i * TIMING.drawStagger)
            );
            const p = easeInHold(local);
            tube.geometry.setDrawRange(
              0,
              Math.floor((tube.indexCount * p) / 3) * 3
            );
          });

          tubes[0].curve.getPoint(wrap01(cometProgress), headPos);
          tubes[0].curve.getPoint(wrap01(cometProgress - 0.004), tmpPrev);
          headTangent.subVectors(headPos, tmpPrev).normalize();
          comet.position.copy(headPos);

          if (raw > 0.01 && raw < 1) {
            for (let s = 0; s < 3; s++) {
              spawn(
                headPos,
                -headTangent.x * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
                -headTangent.y * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
                -headTangent.z * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
                1.6,
                Math.random() < 0.7
                  ? '#ffffff'
                  : LIGHT_COLORS[(Math.random() * LIGHT_COLORS.length) | 0],
                1
              );
            }
          }

          // Drive warps the site's particle grid as it traces.
          const s = projectToScreen(comet.position);
          heroWarp.x = s.x;
          heroWarp.y = s.y;
          heroWarp.strength = 1;

          const shake = (1 - raw) * 0.05;
          group.position.set(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake,
            0
          );
          group.rotation.z = (Math.random() - 0.5) * shake * 0.25;

          if (raw >= 1) enterSettle(elapsed);
        }

        if (phase === 'settle') {
          const t = clamp01((elapsed - settleStart) / TIMING.settleDuration);
          const fade = 1 - easeInOutCubic(t);
          bloomBase = 1.2 - (1.2 - 0.5) * easeInOutCubic(t);

          cometProgress += cometSpeed * dt;
          tubes[0].curve.getPoint(wrap01(cometProgress), headPos);
          tubes[0].curve.getPoint(wrap01(cometProgress - 0.004), tmpPrev);
          headTangent.subVectors(headPos, tmpPrev).normalize();
          comet.position.copy(headPos);
          comet.scale.setScalar(0.3 + fade * 0.7);
          cometMat.opacity = fade;
          cometLight.intensity = 22 * fade;
          if (Math.random() < fade * 0.9) {
            spawn(
              headPos,
              -headTangent.x * 1.6 + (Math.random() - 0.5) * 0.5,
              -headTangent.y * 1.6 + (Math.random() - 0.5) * 0.5,
              -headTangent.z * 1.6 + (Math.random() - 0.5) * 0.5,
              1.1,
              '#ffffff',
              fade * 0.9
            );
          }

          group.position.multiplyScalar(0.9);
          group.rotation.z *= 0.9;

          const s = projectToScreen(comet.position);
          heroWarp.x = s.x;
          heroWarp.y = s.y;
          heroWarp.strength = fade;

          if (t >= 1) {
            phase = 'idle';
            idleStart = elapsed;
            comet.visible = false;
            cometLight.intensity = 0;
            heroWarp.strength = 0;
          }
        }

        if (phase === 'idle' && !reducedMotion) {
          // Oscillators are rebased to the phase start so each begins at
          // sin(0) = 0, and `ramp` eases amplitudes up from nothing — the
          // drift grows out of the settle pose with no discontinuity.
          const td = elapsed - idleStart;
          const ramp = easeInOutCubic(clamp01(td / 4));

          // Vertical wander and roll are held to what MOTION_ENVELOPE reserves.
          // They are the two components that move the figure's edge towards the
          // text, and reserving their full former reach would have cost the
          // desktop composition ~50px of clearance above and below the loop.
          group.position.x = Math.sin(td * 0.061) * 0.35 * ramp;
          group.position.y =
            (Math.sin(td * 0.047) * 0.2 + Math.sin(td * 0.113) * 0.07) * ramp;
          group.position.z = Math.sin(td * 0.039) * 0.3 * ramp;
          group.rotation.y =
            (Math.sin(td * 0.083) * 0.28 + Math.sin(td * 0.031) * 0.1) * ramp;
          group.rotation.x = Math.sin(td * 0.067) * 0.11 * ramp;
          group.rotation.z = Math.sin(td * 0.053) * 0.04 * ramp;
          camera.position.z = baseCameraZ + Math.sin(td * 0.037) * 0.45 * ramp;

          const breatheTarget = 0.68 + Math.sin(td * 0.8) * 0.08;
          const breathe = 0.75 + (breatheTarget - 0.75) * ramp;
          tubes.forEach((tube) => (tube.material.emissiveIntensity = breathe));

          if (bloomBase > 0.5) {
            bloomBase = Math.max(0.5, bloomBase - dt * 1.5);
          }

          dustTimer += dt;
          if (dustTimer > 0.22) {
            dustTimer = 0;
            tubes[(Math.random() * tubes.length) | 0].curve.getPoint(
              Math.random(),
              dustOrigin
            );
            spawn(
              dustOrigin,
              (Math.random() - 0.5) * 0.18,
              (Math.random() - 0.5) * 0.18,
              (Math.random() - 0.5) * 0.18,
              0.3,
              Math.random() < 0.5
                ? '#ffffff'
                : LIGHT_COLORS[(Math.random() * LIGHT_COLORS.length) | 0],
              0.4
            );
          }

          parallax.x += (parallax.tx - parallax.x) * 0.04;
          parallax.y += (parallax.ty - parallax.y) * 0.04;
          group.rotation.y += parallax.x * 0.1;
          group.rotation.x += parallax.y * 0.06;
        }

        // Parallax scroll: offset 3D infinity figure upwards in world space as user scrolls down
        const visibleH = 2 * TAN_HALF_FOV * baseCameraZ;
        group.position.y += past * visibleH;

        starField.rotation.y += dt * 0.004;
        starField.rotation.z += dt * 0.0012;
        starField.position.x += (-parallax.x * 1.4 - starField.position.x) * 0.02;
        starField.position.y += (parallax.y * 0.9 - starField.position.y) * 0.02;

        if (twinkle && frame % 2 === 0) {
          const { col, base, count, geo } = twinkle;
          for (let i = 0; i < count; i++) {
            const k =
              0.86 + Math.sin(elapsed * (0.5 + (i % 7) * 0.19) + i * 2.399) * 0.14;
            col[i * 3] = base[i * 3] * k;
            col[i * 3 + 1] = base[i * 3 + 1] * k;
            col[i * 3 + 2] = base[i * 3 + 2] * k;
          }
          geo.attributes.color.needsUpdate = true;
        }

        // The orbit lights and the sparks exist only to light and dress the
        // tubes, so neither is worth a frame's work once those are hidden.
        if (!backdrop) {
          orbitLights.forEach((o) => {
            const a = o.angle + elapsed * o.speed;
            o.light.position.set(
              Math.cos(a) * o.radius,
              Math.sin(a * 1.3) * 3,
              Math.sin(a) * 2 + 1.5
            );
          });
        }

        let alive = false;
        for (let i = 0; backdrop === false && i < SPARKS; i++) {
          if (sparkLife[i] <= 0) continue;
          alive = true;
          sparkLife[i] -= dt * sparkDecay[i];
          const f = sparkDecay[i] > 1 ? 0.94 : 0.995;
          sparkPos[i * 3] += sparkVel[i * 3] * dt;
          sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
          sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
          sparkCol[i * 3] *= f;
          sparkCol[i * 3 + 1] *= f;
          sparkCol[i * 3 + 2] *= f;
          if (sparkLife[i] <= 0) {
            sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0;
          }
        }
        if (alive) {
          sparkGeo.attributes.position.needsUpdate = true;
          sparkGeo.attributes.color.needsUpdate = true;
        }

        // Ease the glow out across the same band the backdrop switch uses, so
        // dropping the pass reads as the figure leaving rather than as the
        // starfield changing brightness in one step.
        const bloomFade =
          1 - clamp01((past - BACKDROP_OUT) / (BACKDROP_IN - BACKDROP_OUT));
        bloomPass.enabled = bloomFade > 0.02;
        bloomPass.strength = bloomBase * bloomFade;

        frame++;
        composer.render();
      };

      let rafId = 0;
      const loop = () => {
        if (disposed || !visible) return;
        rafId = requestAnimationFrame(loop);
        render();
      };

      if (!reducedMotion) {
        setStatus('ready');
        loop();
      }

      teardown = () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('click', onClick);
        if (onStaticScroll) window.removeEventListener('scroll', onStaticScroll);
        dprQuery?.removeEventListener('change', onDprChange);
        heroWarp.strength = 0;
        disposables.forEach((d) => d.dispose());
        composer.dispose?.();
        renderer.dispose();
        renderer.forceContextLoss?.();
      };

      if (disposed) teardown();
    })();

    return () => {
      disposed = true;
      window.clearTimeout(failTimer);
      teardown?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 w-full h-full block pointer-events-none z-0 transition-opacity duration-1000 ${
        status === 'ready' ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ touchAction: 'manipulation' }}
    />
  );
};

export default TubesInfinity;
