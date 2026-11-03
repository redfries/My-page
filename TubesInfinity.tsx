import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clamp,
  damp,
  lerp,
  isPastHeroThreshold,
  computeHeroToCardBlend,
  computeHeroFigureRadii,
  computeCanvasBackgroundOpacity,
  computeBoundedPointerPull,
  evaluateCardsIllumination,
  computeTubeOrbitOffsetPx,
  createRafThrottler,
  computeScrollPerformanceBudget,
  type CardMetrics,
  type IlluminationEvaluation,
} from './tubesLogic';

/**
 * Shared warp source, read by ParticleGrid in App.tsx. Values are viewport pixel
 * coordinates.
 */
export const heroWarp = { x: -10000, y: -10000, strength: 0 };

export type HeroStatus = 'loading' | 'ready' | 'failed';

/**
 * `threejs-components@0.0.19/build/cursors/tubes1.min.js`
 * Original concept and implementation by Kevin Levron, CC BY-NC-SA 4.0 —
 * attribution required, non-commercial use only.
 */
const TUBES_SRC =
  'https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js';

const THEMES: { name: string; tubes: string[]; lights: string[] }[] = [
  {
    name: 'neon',
    tubes: ['#f967fb', '#53bc28', '#6958d5'],
    lights: ['#83f36e', '#fe8a2e', '#ff008a', '#60aed5'],
  },
  {
    name: 'mono',
    tubes: ['#ffffff', '#8a8a8a', '#111111'],
    lights: ['#ffffff', '#e6e6e6', '#ffffff', '#b4b4b4'],
  },
  {
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
const TUBE_LERP = 0.35;
const SIM_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 3;
const FILL_STEPS = 250;
const FILL_RATE = 2;
const FILL_MAX_STEPS_PER_FRAME = 8;
const FILL_BUDGET_MS = 5;

const pickTheme = (exclude?: number) => {
  if (THEMES.length < 2) return 0;
  let i = exclude;
  while (i === exclude) i = Math.floor(Math.random() * THEMES.length);
  return i as number;
};

const publishFigureBox = () => {
  const { ry } = computeHeroFigureRadii(window.innerWidth);
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

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [125, 211, 252];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixHexColors(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface TubeMeshInstance {
  points: { x: number; y: number; z: number }[];
  geometry: { update(): void };
}

interface TubesApp {
  three: {
    size: { width: number; height: number; wWidth: number; wHeight: number };
    minPixelRatio?: number;
    maxPixelRatio?: number;
    resize?: () => void;
    onBeforeRender: (state: { elapsed: number; delta: number }) => void;
  };
  tubes: {
    target: { x: number; y: number; z: number };
    position: { x: number; y: number; z: number };
    tubes?: TubeMeshInstance[];
    update(state: { elapsed: number }): void;
    setColors(colors: string[]): void;
    setLightsColors(colors: string[]): void;
  };
  dispose(): void;
}

interface CachedCardLayout {
  el: HTMLElement;
  id: string;
  docLeft: number;
  docTop: number;
  width: number;
  height: number;
  accentColor: string;
  lastIllum: number;
  lastGlowX: number;
  lastGlowY: number;
  lastActive: boolean;
}

interface Props {
  onStatusChange?: (status: HeroStatus) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const TubesInfinity: React.FC<Props> = ({ onStatusChange, anchorRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HeroStatus>('loading');

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

    let disposed = false;
    let app: TubesApp | undefined;
    let teardown: (() => void) | undefined;

    let pointerX = -9999;
    let pointerY = -9999;
    let pointerActive = false;
    let latestScrollY = window.scrollY;

    // Coalesce high-frequency pointer and scroll events via requestAnimationFrame
    const rafPointerThrottler = createRafThrottler((cx: number, cy: number) => {
      pointerX = cx;
      pointerY = cy;
      pointerActive = true;
    });

    const rafScrollThrottler = createRafThrottler((sy: number) => {
      latestScrollY = sy;
    });

    const onPointerMove = (e: PointerEvent) => {
      rafPointerThrottler(e.clientX, e.clientY);
    };
    const onPointerLeave = () => {
      rafPointerThrottler.cancel();
      pointerActive = false;
    };
    const onWindowScroll = () => {
      rafScrollThrottler(window.scrollY);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    let cachedCards: CachedCardLayout[] = [];
    let heroHeightPx = window.innerHeight;
    let maxScrollYPx = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    let heroRestOffsetPx = 0;
    let frameLeft = 0;
    let frameTop = 0;
    let frameWidth = window.innerWidth;
    let frameHeight = window.innerHeight;

    const measureStaticLayout = () => {
      const sy = window.scrollY;
      latestScrollY = sy;
      const el = anchorRef?.current ?? document.getElementById('infinity-spacer');
      const canvas = canvasRef.current;
      const heroEl =
        el?.closest('section') ?? document.getElementById('hero-section');
      heroHeightPx = heroEl?.clientHeight || window.innerHeight;
      maxScrollYPx = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );

      if (canvas) {
        const frame = canvas.getBoundingClientRect();
        frameLeft = frame.left;
        frameTop = frame.top;
        frameWidth = frame.width || window.innerWidth;
        frameHeight = frame.height || window.innerHeight;
      } else {
        frameLeft = 0;
        frameTop = 0;
        frameWidth = window.innerWidth;
        frameHeight = window.innerHeight;
      }

      if (el) {
        const box = el.getBoundingClientRect();
        const docCenterY = box.top + sy + box.height * 0.5;
        heroRestOffsetPx = docCenterY - (frameTop + frameHeight * 0.5);
      } else {
        heroRestOffsetPx = 0;
      }

      const cardEls = Array.from(
        document.querySelectorAll<HTMLElement>('[data-illuminate-card]')
      );
      cachedCards = cardEls.map((cardEl, idx) => {
        const rect = cardEl.getBoundingClientRect();
        const accentColor = cardEl.dataset.accentColor || '#7dd3fc';
        cardEl.style.setProperty('--glow-color', accentColor);
        return {
          el: cardEl,
          id: cardEl.dataset.illuminateCard || cardEl.id || `card-${idx}`,
          docLeft: rect.left,
          docTop: rect.top + sy,
          width: rect.width,
          height: rect.height,
          accentColor,
          lastIllum: -1,
          lastGlowX: -9999,
          lastGlowY: -9999,
          lastActive: false,
        };
      });
    };

    measureStaticLayout();

    let lastBodyMode = '';
    let lastBodyCard = '';
    let lastBodyBlend = '';
    let lastCanvasOpacity = -1;
    let lastDomCommitTimeMs = 0;

    // rAF-throttled DOM writer so CSS custom properties and data attributes
    // never cause synchronous style thrashing during heavy scroll bursts
    const commitDomIllumination = createRafThrottler(
      (
        scrollY: number,
        blend: number,
        evalResult: IlluminationEvaluation
      ) => {
        if (disposed) return;
        const mode = isPastHeroThreshold(scrollY, heroHeightPx)
          ? 'illuminating'
          : 'hero';
        const activeCardStr = evalResult.activeCardId ?? '';
        const blendStr = blend.toFixed(2);

        if (mode !== lastBodyMode) {
          lastBodyMode = mode;
          document.body.dataset.tubesMode = mode;
          const spacer =
            anchorRef?.current ?? document.getElementById('infinity-spacer');
          spacer?.setAttribute('data-tubes-mode', mode);
        }
        if (activeCardStr !== lastBodyCard) {
          lastBodyCard = activeCardStr;
          document.body.dataset.illuminatedCard = activeCardStr;
          const spacer =
            anchorRef?.current ?? document.getElementById('infinity-spacer');
          spacer?.setAttribute('data-active-card', activeCardStr);
        }
        if (blendStr !== lastBodyBlend) {
          lastBodyBlend = blendStr;
          document.body.dataset.heroBlend = blendStr;
          const spacer =
            anchorRef?.current ?? document.getElementById('infinity-spacer');
          spacer?.setAttribute('data-tubes-blend', blendStr);
        }

        const desiredOpacity = computeCanvasBackgroundOpacity(blend);
        if (
          containerRef.current &&
          Math.abs(desiredOpacity - lastCanvasOpacity) >= 0.01
        ) {
          lastCanvasOpacity = desiredOpacity;
          containerRef.current.style.opacity = String(desiredOpacity);
        }

        for (let i = 0; i < cachedCards.length; i++) {
          const c = cachedCards[i];
          const out = evalResult.cards[i];
          if (!out) continue;

          if (Math.abs(out.illumination - c.lastIllum) >= 0.008) {
            c.lastIllum = out.illumination;
            c.el.style.setProperty('--illumination', String(out.illumination));
          }

          if (out.illumination > 0.01) {
            if (Math.abs(out.glowX - c.lastGlowX) >= 4) {
              c.lastGlowX = out.glowX;
              c.el.style.setProperty('--glow-x', `${out.glowX}px`);
            }
            if (Math.abs(out.glowY - c.lastGlowY) >= 4) {
              c.lastGlowY = out.glowY;
              c.el.style.setProperty('--glow-y', `${out.glowY}px`);
            }
          }

          if (out.isActive !== c.lastActive) {
            c.lastActive = out.isActive;
            if (out.isActive) {
              c.el.dataset.illuminated = 'true';
            } else {
              delete c.el.dataset.illuminated;
            }
          }
        }
      }
    );

    const evaluateAndScheduleDomIllumination = (
      scrollY: number,
      blend: number,
      tubeViewportX: number,
      tubeViewportY: number,
      minIntervalMs = 14
    ) => {
      if (cachedCards.length === 0) {
        measureStaticLayout();
      }

      const metrics: CardMetrics[] = new Array(cachedCards.length);
      for (let i = 0; i < cachedCards.length; i++) {
        const c = cachedCards[i];
        metrics[i] = {
          id: c.id,
          left: c.docLeft,
          top: c.docTop - scrollY,
          width: c.width,
          height: c.height,
          accentColor: c.accentColor,
        };
      }

      const evalResult = evaluateCardsIllumination({
        cards: metrics,
        viewportWidth: frameWidth,
        viewportHeight: frameHeight,
        scrollY,
        maxScrollY: maxScrollYPx,
        pointerX,
        pointerY,
        pointerActive,
        tubeViewportX,
        tubeViewportY,
        blend,
      });

      const now = performance.now();
      if (
        now - lastDomCommitTimeMs >= minIntervalMs ||
        scrollY === 0 ||
        blend <= 0.01
      ) {
        lastDomCommitTimeMs = now;
        commitDomIllumination(scrollY, blend, evalResult);
      }

      return evalResult;
    };

    if (!hasWebGL() || reducedMotion) {
      setStatus('failed');
      let fallbackRaf = 0;
      let fallbackSimTime = 0;
      let fallbackBlend = 0;
      let fallbackCardX = window.innerWidth * 0.5;
      let fallbackCardY = window.innerHeight * 0.5;
      const tickFallback = () => {
        if (disposed) return;
        rafScrollThrottler.flush();
        rafPointerThrottler.flush();
        const sy = latestScrollY;
        const targetBlend = computeHeroToCardBlend(sy, heroHeightPx);
        fallbackBlend = damp(fallbackBlend, targetBlend, 12, 1 / 60);
        if (fallbackBlend < 0.001) fallbackBlend = 0;
        if (fallbackBlend > 0.999) fallbackBlend = 1;

        fallbackSimTime += SIM_STEP;
        const { rx, ry } = computeHeroFigureRadii(window.innerWidth);
        const orbit = computeTubeOrbitOffsetPx({
          simTime: fallbackSimTime,
          heroRx: rx,
          heroRy: ry,
          cardWidth: 680,
          cardHeight: 380,
          blend: fallbackBlend,
          scrollY: sy,
        });

        const evalRes = evaluateAndScheduleDomIllumination(
          sy,
          fallbackBlend,
          fallbackCardX + orbit.offsetX,
          fallbackCardY - orbit.offsetY
        );
        commitDomIllumination.flush();
        fallbackCardX = damp(fallbackCardX, evalRes.targetViewportX, 9, 1 / 60);
        fallbackCardY = damp(fallbackCardY, evalRes.targetViewportY, 9, 1 / 60);
        heroWarp.x = fallbackCardX + orbit.offsetX;
        heroWarp.y = fallbackCardY - orbit.offsetY;
        heroWarp.strength = fallbackBlend > 0.02 ? 1 : 0;

        if (!reducedMotion) {
          fallbackRaf = requestAnimationFrame(tickFallback);
        }
      };
      tickFallback();
      const rafFallbackScroll = createRafThrottler(() => {
        if (reducedMotion) tickFallback();
      });
      window.addEventListener('scroll', rafFallbackScroll, { passive: true });
      return () => {
        disposed = true;
        cancelAnimationFrame(fallbackRaf);
        rafFallbackScroll.cancel();
        rafPointerThrottler.cancel();
        rafScrollThrottler.cancel();
        commitDomIllumination.cancel();
        window.removeEventListener('scroll', rafFallbackScroll);
        window.removeEventListener('scroll', onWindowScroll);
        window.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerleave', onPointerLeave);
      };
    }

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

        let themeIndex = pickTheme();
        const isSoftGl = detectSoftwareGl();

        app = TubesCursor(canvasRef.current, {
          tubes: {
            colors: THEMES[themeIndex].tubes,
            lights: {
              intensity: LIGHT_INTENSITY,
              colors: THEMES[themeIndex].lights,
            },
            lerp: TUBE_LERP,
          },
        });

        const three = app.three;
        const tubes = app.tubes;

        if (isSoftGl && three.minPixelRatio !== undefined) {
          three.minPixelRatio = 1;
          three.maxPixelRatio = 1;
          three.resize?.();
        }

        measureStaticLayout();

        // Keep group at origin with zero rotation—all motion happens genuinely
        // in 3D space through `tubes.target` and the engine's `lerpTo` chain!
        tubes.position.x = 0;
        tubes.position.y = 0;
        tubes.position.z = 0;

        const tubeList = tubes.tubes ?? [];
        const initWorldPerPx = three.size.wWidth / three.size.width;
        const initHeroWorldY = -(heroRestOffsetPx - window.scrollY) * initWorldPerPx;
        for (let i = 0; i < tubeList.length; i++) {
          const pts = tubeList[i].points;
          for (let j = 0; j < pts.length; j++) {
            pts[j].y = initHeroWorldY;
          }
        }

        let simTime = 0;
        let simSteps = 0;
        let backlog = 0;
        let transitionCatchupSteps = 0;

        let prevScrollY = window.scrollY;
        let scrollVelocity = 0;
        let dampedBlend = computeHeroToCardBlend(window.scrollY, heroHeightPx);
        let dampedSpineX = frameLeft + frameWidth * 0.5;
        let dampedSpineY = frameTop + frameHeight * 0.5;
        let dampedCardW = Math.min(960, frameWidth * 0.8);
        let dampedCardH = Math.min(380, frameHeight * 0.44);
        let lastAppliedLightKey = '';

        three.onBeforeRender = (state: { elapsed: number; delta: number }) => {
          // Flush any pending rAF-throttled scroll/pointer updates once for this frame
          rafScrollThrottler.flush();
          rafPointerThrottler.flush();

          const dt = clamp(state.delta || SIM_STEP, 0.001, 0.05);
          const worldPerPx = three.size.wWidth / three.size.width;
          const { rx, ry } = computeHeroFigureRadii(frameWidth);

          const scrollY = window.scrollY !== latestScrollY ? window.scrollY : latestScrollY;
          latestScrollY = scrollY;
          const deltaScrollY = scrollY - prevScrollY;
          prevScrollY = scrollY;

          const instVelocity = deltaScrollY / dt;
          scrollVelocity = damp(scrollVelocity, instVelocity, 10, dt);
          if (Math.abs(scrollVelocity) < 0.5) scrollVelocity = 0;

          if (scrollY < 20 && Math.abs(scrollVelocity) < 120) {
            const spacerEl =
              anchorRef?.current ?? document.getElementById('infinity-spacer');
            if (spacerEl) {
              const box = spacerEl.getBoundingClientRect();
              heroRestOffsetPx =
                box.top + scrollY + box.height * 0.5 - (frameTop + frameHeight * 0.5);
            }
          }

          const rawBlend = computeHeroToCardBlend(scrollY, heroHeightPx);
          if (rawBlend === 0 && dampedBlend > 0.05) {
            transitionCatchupSteps = 220;
          }

          const blendLambda = rawBlend === 0 ? 28 : 10;
          dampedBlend = damp(dampedBlend, rawBlend, blendLambda, dt);
          if (rawBlend === 0 && dampedBlend < 0.01) dampedBlend = 0;
          if (rawBlend === 1 && dampedBlend > 0.995) dampedBlend = 1;

          const frameCenterX = frameLeft + frameWidth * 0.5;
          const frameCenterY = frameTop + frameHeight * 0.5;

          const pull = computeBoundedPointerPull(
            dampedSpineX,
            dampedSpineY,
            frameWidth,
            frameHeight,
            pointerX,
            pointerY,
            pointerActive,
            simTime
          );

          const heroViewportCenterX = frameCenterX;
          const heroViewportCenterY =
            frameCenterY + heroRestOffsetPx - scrollY * (1 - dampedBlend);

          const activeCenterX_px = lerp(
            heroViewportCenterX,
            dampedSpineX,
            dampedBlend
          );
          const activeCenterY_px = lerp(
            heroViewportCenterY,
            dampedSpineY,
            dampedBlend
          );

          const previewOrbit = computeTubeOrbitOffsetPx({
            simTime,
            heroRx: rx,
            heroRy: ry,
            cardWidth: dampedCardW,
            cardHeight: dampedCardH,
            blend: dampedBlend,
            scrollY,
            scrollVelocity,
            pointerNormX: pull.normX,
            pointerNormY: pull.normY,
          });

          const tubeViewportX = activeCenterX_px + previewOrbit.offsetX;
          const tubeViewportY = activeCenterY_px - previewOrbit.offsetY;

          const filled = Math.min(1, simSteps / FILL_STEPS);
          const inHeroReturnCatchup =
            transitionCatchupSteps > 0 && dampedBlend < 0.05;

          const perfBudget = computeScrollPerformanceBudget({
            scrollVelocity,
            filled,
            inHeroReturnCatchup,
            maxStepsNormal: MAX_STEPS_PER_FRAME,
            maxStepsFill: FILL_MAX_STEPS_PER_FRAME,
            baseBudgetMs: FILL_BUDGET_MS,
          });

          const evalResult = evaluateAndScheduleDomIllumination(
            scrollY,
            dampedBlend,
            tubeViewportX,
            tubeViewportY,
            perfBudget.domUpdateMinIntervalMs
          );

          const desiredSpineX = evalResult.targetViewportX + pull.pullX;
          const desiredSpineY = evalResult.targetViewportY + pull.pullY;

          dampedSpineX = damp(dampedSpineX, desiredSpineX, 9, dt);
          dampedSpineY = damp(dampedSpineY, desiredSpineY, 9, dt);
          dampedCardW = damp(dampedCardW, evalResult.targetCardWidth, 6, dt);
          dampedCardH = damp(dampedCardH, evalResult.targetCardHeight, 6, dt);

          // Harmonize the 4 point lights subtly toward the active section/card accent
          const baseLights = THEMES[themeIndex].lights;
          const accent = evalResult.activeAccentColor;
          const tintAmount = Number((dampedBlend * 0.48).toFixed(2));
          const lightKey = `${themeIndex}:${accent ?? 'none'}:${tintAmount}`;
          if (lightKey !== lastAppliedLightKey) {
            lastAppliedLightKey = lightKey;
            if (tintAmount <= 0.02 || !accent) {
              tubes.setLightsColors(baseLights);
            } else {
              tubes.setLightsColors([
                mixHexColors(baseLights[0], accent, tintAmount),
                mixHexColors(baseLights[1], accent, tintAmount * 0.7),
                mixHexColors(baseLights[2], accent, tintAmount),
                baseLights[3],
              ]);
            }
          }

          const scrollBoost = perfBudget.isHeavyScroll
            ? 0
            : clamp(Math.abs(scrollVelocity) / 1100, 0, 0.8);
          const rateMultiplier =
            filled < 1 || inHeroReturnCatchup
              ? FILL_RATE * 1.4
              : 1 + scrollBoost;
          const maxSteps = perfBudget.maxSteps;

          backlog = Math.min(
            backlog + dt * rateMultiplier,
            SIM_STEP * maxSteps
          );

          const deadline = performance.now() + perfBudget.budgetMs;
          let steps = 0;
          while (backlog >= SIM_STEP && steps < maxSteps) {
            backlog -= SIM_STEP;
            simTime += SIM_STEP;
            simSteps++;
            steps++;
            if (inHeroReturnCatchup && transitionCatchupSteps > 0) {
              transitionCatchupSteps--;
            }

            const stepOrbit = computeTubeOrbitOffsetPx({
              simTime,
              heroRx: rx,
              heroRy: ry,
              cardWidth: dampedCardW,
              cardHeight: dampedCardH,
              blend: dampedBlend,
              scrollY,
              scrollVelocity,
              pointerNormX: pull.normX,
              pointerNormY: pull.normY,
            });

            const targetViewportX = activeCenterX_px + stepOrbit.offsetX;
            const targetViewportY = activeCenterY_px - stepOrbit.offsetY;

            tubes.target.x = (targetViewportX - frameCenterX) * worldPerPx;
            tubes.target.y = -(targetViewportY - frameCenterY) * worldPerPx;
            tubes.target.z = stepOrbit.offsetZ;

            tubes.update({ elapsed: simTime });

            if (steps >= 1 && performance.now() > deadline) {
              break;
            }
          }

          heroWarp.x = tubeViewportX;
          heroWarp.y = tubeViewportY;
          heroWarp.strength = 1;
        };

        const onResize = createRafThrottler(() => {
          publishFigureBox();
          measureStaticLayout();
        });
        window.addEventListener('resize', onResize, { passive: true });
        window.visualViewport?.addEventListener('resize', onResize);

        document.fonts?.ready.then(() => {
          if (!disposed) measureStaticLayout();
        });

        const onClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('a, button')) return;
          themeIndex = pickTheme(themeIndex);
          lastAppliedLightKey = '';
          app?.tubes.setColors(THEMES[themeIndex].tubes);
          app?.tubes.setLightsColors(THEMES[themeIndex].lights);
        };
        window.addEventListener('click', onClick);

        setStatus('ready');

        teardown = () => {
          onResize.cancel();
          window.removeEventListener('resize', onResize);
          window.visualViewport?.removeEventListener('resize', onResize);
          window.removeEventListener('click', onClick);
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
      rafPointerThrottler.cancel();
      rafScrollThrottler.cancel();
      commitDomIllumination.cancel();
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      teardown?.();
    };
  }, [anchorRef]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="tubes-canvas-container"
      className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-700 ${
        status === 'ready' ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'manipulation' }}
      />
    </div>
  );
};

export default TubesInfinity;
