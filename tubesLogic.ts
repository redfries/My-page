/**
 * Pure, deterministic math and state logic for the scroll-driven TubesInfinity
 * per-end unspooling vertical soul illumination system.
 *
 * Kept free of DOM/WebGL side effects so every threshold, per-end unspooling
 * curve, vertical spine crawl, non-direct pointer response, card illumination
 * score, and hero re-synchronization invariant can be unit-tested directly.
 */

export const HERO_SCROLL_START_RATIO = 0.01;
export const HERO_SCROLL_THRESHOLD_RATIO = 0.32;
export const SLEEP_TIME_SCALE_1 = 1;
export const SLEEP_TIME_SCALE_2 = 2;

export interface CardMetrics {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  accentColor: string;
}

export interface CardIlluminationOutput {
  id: string;
  /** 0..1 normalized illumination intensity for this card */
  illumination: number;
  /** Live tube light X position relative to the card's left edge (px) */
  glowX: number;
  /** Live tube light Y position relative to the card's top edge (px) */
  glowY: number;
  /** Whether this card is currently illuminated by the vertical soul stream */
  isActive: boolean;
  accentColor: string;
}

export interface IlluminationEvaluation {
  activeCardId: string | null;
  activeAccentColor: string | null;
  /** Continuous viewport X center for the vertical space stream (px) */
  targetViewportX: number;
  /** Continuous viewport Y center for the vertical space stream (px) */
  targetViewportY: number;
  /** Effective card/section width (px) */
  targetCardWidth: number;
  /** Effective card/section height (px) */
  targetCardHeight: number;
  cards: CardIlluminationOutput[];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Frame-rate independent exponential damping factor.
 */
export function dampFactor(lambda: number, dt: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-lambda * dt);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, dampFactor(lambda, dt));
}

/**
 * Returns whether the user has started scrolling so the leading end of the
 * infinity symbol releases from the Hero loop and flows vertically in space.
 */
export function isPastHeroThreshold(scrollY: number, heroHeight: number): boolean {
  if (heroHeight <= 0) return false;
  return scrollY / heroHeight >= HERO_SCROLL_START_RATIO;
}

/**
 * Computes the continuous transition factor (`0..1`) between Hero Infinity Mode (`0`)
 * and Vertical 3D Space Mode (`1`).
 */
export function computeHeroToCardBlend(scrollY: number, heroHeight: number): number {
  if (heroHeight <= 0) return 0;
  const ratio = scrollY / heroHeight;
  if (ratio <= HERO_SCROLL_START_RATIO) return 0;
  if (ratio >= HERO_SCROLL_THRESHOLD_RATIO) return 1;
  return smootherstep(HERO_SCROLL_START_RATIO, HERO_SCROLL_THRESHOLD_RATIO, ratio);
}

/**
 * Computes the background canvas opacity so the 3D tubes are 100% vivid in the
 * Hero section, and subtly recede into an atmospheric background soul (`~0.58`)
 * behind the cards so the foreground cards stay high-contrast and never look dull.
 */
export function computeCanvasBackgroundOpacity(blend: number): number {
  return Number(lerp(1.0, 0.82, clamp(blend, 0, 1)).toFixed(3));
}

/**
 * Computes the hero lemniscate radii in CSS pixels for a given viewport width.
 * Holds the exact 2:1 aspect ratio required for the Gerono lemniscate.
 */
export function computeHeroFigureRadii(viewportWidth: number): { rx: number; ry: number } {
  const rx = Math.max(96, Math.min(300, viewportWidth * 0.36));
  return { rx, ry: rx * 0.5 };
}

/**
 * Computes the subtle, non-direct 3D space field response to the user's pointer.
 */
export function computeBoundedPointerPull(
  anchorCenterX: number,
  anchorCenterY: number,
  viewportWidth: number,
  viewportHeight: number,
  pointerX: number,
  pointerY: number,
  pointerActive: boolean,
  simTime = 0
): { pullX: number; pullY: number; normX: number; normY: number } {
  if (!pointerActive || pointerX < -1000 || pointerY < -1000) {
    return { pullX: 0, pullY: 0, normX: 0, normY: 0 };
  }
  const dx = pointerX - anchorCenterX;
  const dy = pointerY - anchorCenterY;
  const normX = Math.tanh(dx / Math.max(320, viewportWidth * 0.45));
  const normY = Math.tanh(dy / Math.max(280, viewportHeight * 0.45));

  const maxPullX = clamp(viewportWidth * 0.065, 34, 88);
  const maxPullY = clamp(viewportHeight * 0.075, 28, 68);

  const harmonicX = Math.sin(simTime * 0.95 + normY * 1.5) * 16 * Math.abs(normX);
  const harmonicY = Math.cos(simTime * 0.8 + normX * 1.5) * 14 * Math.abs(normY);

  return {
    pullX: normX * maxPullX + harmonicX,
    pullY: normY * maxPullY + harmonicY,
    normX,
    normY,
  };
}

/**
 * Evaluates all registered cards in the viewport and computes:
 * - A clean vertical space spine `(targetViewportX, targetViewportY)` that
 *   guides the living 3D vertical stream through `AI SYSTEMS` and down to the footer.
 * - Per-card illumination intensity driven by the live 3D tubes.
 */
export function evaluateCardsIllumination(params: {
  cards: CardMetrics[];
  viewportWidth: number;
  viewportHeight: number;
  scrollY: number;
  maxScrollY: number;
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  tubeViewportX: number;
  tubeViewportY: number;
  blend: number;
}): IlluminationEvaluation {
  const {
    cards,
    viewportWidth,
    viewportHeight,
    scrollY,
    maxScrollY,
    pointerX,
    pointerY,
    pointerActive,
    tubeViewportX,
    tubeViewportY,
    blend,
  } = params;

  const pageProgress = maxScrollY > 0 ? clamp(scrollY / maxScrollY, 0, 1) : 0;
  const spineBaseX = viewportWidth * 0.5;
  const spineBaseY = viewportHeight * lerp(0.46, 0.62, smootherstep(0.03, 0.98, pageProgress));
  const defaultCardW = Math.min(960, viewportWidth * 0.8);
  const defaultCardH = Math.min(380, viewportHeight * 0.44);

  if (cards.length === 0) {
    return {
      activeCardId: null,
      activeAccentColor: null,
      targetViewportX: spineBaseX,
      targetViewportY: spineBaseY,
      targetCardWidth: defaultCardW,
      targetCardHeight: defaultCardH,
      cards: [],
    };
  }

  const rawWeights: number[] = [];
  let maxWeight = -1;
  let activeIndex = 0;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cx = c.left + c.width * 0.5;
    const cy = c.top + c.height * 0.5;

    const halfH = Math.max(90, c.height * 0.5);
    const dyFromSpine = Math.abs(cy - spineBaseY);
    const normalizedDy = dyFromSpine / (viewportHeight * 0.48 + halfH * 0.35);

    let score = Math.exp(-normalizedDy * normalizedDy * 2.3);

    const normalizedDx = Math.abs(cx - spineBaseX) / Math.max(1, viewportWidth * 0.65);
    score *= 1 - clamp(normalizedDx * 0.08, 0, 0.08);

    const isVisibleInViewport =
      c.top < viewportHeight * 0.96 && c.top + c.height > viewportHeight * 0.04;
    if (pointerActive && isVisibleInViewport && pointerX >= -100) {
      const distX = Math.max(0, Math.abs(pointerX - cx) - c.width * 0.5);
      const distY = Math.max(0, Math.abs(pointerY - cy) - c.height * 0.5);
      const pointerDist = Math.hypot(distX, distY);
      const pointerBonus = Math.exp(-(pointerDist * pointerDist) / (300 * 300));
      score *= 1 + pointerBonus * 0.45;
    }

    rawWeights.push(score);
    if (score > maxWeight) {
      maxWeight = score;
      activeIndex = i;
    }
  }

  let weightSum = 0;
  const sharpened = rawWeights.map((w) => {
    const ratio = maxWeight > 0 ? w / maxWeight : 0;
    const s = ratio < 0.28 ? 0 : Math.pow(ratio, 3);
    weightSum += s;
    return s;
  });

  let cardWeightedX = spineBaseX;
  let cardWeightedY = spineBaseY;
  let cardWeightedW = defaultCardW;
  let cardWeightedH = defaultCardH;

  if (weightSum > 0) {
    cardWeightedX = 0;
    cardWeightedY = 0;
    cardWeightedW = 0;
    cardWeightedH = 0;
    for (let i = 0; i < cards.length; i++) {
      const w = sharpened[i] / weightSum;
      if (w <= 0) continue;
      const c = cards[i];
      cardWeightedX += (c.left + c.width * 0.5) * w;
      cardWeightedY += (c.top + c.height * 0.5) * w;
      cardWeightedW += c.width * w;
      cardWeightedH += c.height * w;
    }
  } else {
    const c = cards[activeIndex];
    cardWeightedX = c.left + c.width * 0.5;
    cardWeightedY = c.top + c.height * 0.5;
    cardWeightedW = c.width;
    cardWeightedH = c.height;
  }

  const cardPresence = smootherstep(0.16, 0.7, clamp(maxWeight, 0, 1));
  const clampedCardY = clamp(
    cardWeightedY,
    viewportHeight * 0.3,
    viewportHeight * 0.72
  );
  const clampedCardX = clamp(
    cardWeightedX,
    viewportWidth * 0.38,
    viewportWidth * 0.62
  );

  const targetViewportX = lerp(spineBaseX, clampedCardX, cardPresence * 0.3);
  const targetViewportY = lerp(spineBaseY, clampedCardY, cardPresence * 0.68);

  const cardOutputs: CardIlluminationOutput[] = cards.map((c, i) => {
    const cx = c.left + c.width * 0.5;
    const cy = c.top + c.height * 0.5;

    const dx = Math.max(0, Math.abs(tubeViewportX - cx) - c.width * 0.55);
    const dy = Math.max(0, Math.abs(tubeViewportY - cy) - c.height * 0.55);
    const tubeProximity = Math.exp(-(dx * dx + dy * dy) / (360 * 360));

    const focusRatio = maxWeight > 0 ? rawWeights[i] / maxWeight : 0;
    const sectionScore = rawWeights[i];
    const rawIllum = clamp(
      sectionScore * 0.74 + tubeProximity * 0.46,
      0,
      1
    );
    const illumination = Number((rawIllum * blend).toFixed(3));

    return {
      id: c.id,
      illumination,
      glowX: Math.round((tubeViewportX - c.left) * 0.5) * 2,
      glowY: Math.round((tubeViewportY - c.top) * 0.5) * 2,
      isActive: blend > 0.15 && sectionScore > 0.25 && (i === activeIndex || focusRatio > 0.68),
      accentColor: c.accentColor,
    };
  });

  return {
    activeCardId: blend > 0.15 && maxWeight > 0.2 ? cards[activeIndex].id : null,
    activeAccentColor: cards[activeIndex].accentColor,
    targetViewportX,
    targetViewportY,
    targetCardWidth: cardWeightedW,
    targetCardHeight: cardWeightedH,
    cards: cardOutputs,
  };
}

/**
 * Computes the instantaneous 3D target offset `(offsetX, offsetY, offsetZ)` for
 * `tubes.target` at simulation time `simTime`.
 *
 * - At `blend === 0` (Hero Mode):
 *   Returns the exact horizontal Gerono lemniscate (`∞` symbol):
 *     `offsetX = heroRx * cos(t)`
 *     `offsetY = heroRy * sin(2t)`
 *     `offsetZ = 0`
 *
 * - At `blend > 0` (Vertical 3D Space Mode):
 *   Does NOT draw an infinity symbol and does NOT rotate on a fake axis.
 *   Instead, drives `tubes.target` along an open, living **Vertical 3D Space**
 *   trajectory (`verticalAspect = Y / X > 2.8`) with incommensurate vertical
 *   and horizontal frequencies and 3D Z-depth undulation. Because the engine's
 *   16 tubes trail `tubes.target` via `lerpTo`, scrolling down immediately
 *   pulls the leading end of the `∞` symbol downward with the user while the
 *   rest unspools naturally behind it into a vertical 3D ribbon in space!
 */
export function computeTubeOrbitOffsetPx(params: {
  simTime: number;
  heroRx: number;
  heroRy: number;
  cardWidth: number;
  cardHeight: number;
  blend: number;
  scrollY?: number;
  scrollVelocity?: number;
  pointerNormX?: number;
  pointerNormY?: number;
}): { offsetX: number; offsetY: number; offsetZ: number } {
  const {
    simTime,
    heroRx,
    heroRy,
    cardWidth,
    cardHeight,
    blend,
    scrollY = 0,
    scrollVelocity = 0,
    pointerNormX = 0,
    pointerNormY = 0,
  } = params;

  const t1 = simTime * SLEEP_TIME_SCALE_1;
  const t2 = simTime * SLEEP_TIME_SCALE_2;

  const heroX = heroRx * Math.cos(t1);
  const heroY = heroRy * Math.sin(t2);

  if (blend <= 0.0001) {
    return { offsetX: heroX, offsetY: heroY, offsetZ: 0 };
  }

  // Tall vertical sweep in space (~275..315px amplitude = ~550..630px peak-to-peak vertical travel)
  const verticalAmpY = clamp(Math.max(cardHeight * 0.76, 280), 270, 315);
  // Sleek, narrow horizontal weave in space (~62..88px amplitude) so motion is unmistakably vertical
  const verticalAmpX = clamp(cardWidth * 0.095, 62, 88);

  const scrollPhase = scrollY * 0.0022;
  const velocityDivePx = clamp(scrollVelocity * -0.08, -80, 80);
  const w = 1.65;
  const phase = simTime * w + scrollPhase;

  // Constant-momentum vertical space wave: fast vertical transit across 560px+ with
  // 3D horizontal/depth curvature at the peaks so the tubes never bunch up
  const spaceY =
    verticalAmpY * (0.88 * Math.sin(phase) - 0.16 * Math.sin(3 * phase)) +
    pointerNormY * 36 +
    velocityDivePx;

  const spaceX =
    verticalAmpX * Math.cos(phase) * 0.65 +
    verticalAmpX * 0.55 * Math.sin(2 * phase + 0.5 + pointerNormX * 1.2) +
    pointerNormX * 28;

  // True 3D Z-depth oscillation (in world units) so the vertical tubes weave
  // toward and away from the camera in space and catch the 4 point lights dynamically
  const spaceZ =
    0.58 * Math.cos(phase + pointerNormX * 0.8) +
    0.32 * Math.sin(2 * phase - pointerNormY * 0.8);

  return {
    offsetX: lerp(heroX, spaceX, blend),
    offsetY: lerp(heroY, spaceY, blend),
    offsetZ: spaceZ * blend,
  };
}

export interface RafThrottledFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  /** Immediately runs any pending invocation and cancels the scheduled frame */
  flush: () => void;
  /** Cancels any scheduled animation frame without running the callback */
  cancel: () => void;
  /** Returns whether a frame callback is currently scheduled */
  isPending: () => boolean;
}

/**
 * Creates a `requestAnimationFrame` throttler that coalesces high-frequency
 * calls (such as rapid `scroll`, `wheel`, or `pointermove` events, or DOM
 * illumination writes) so the underlying callback executes at most once per
 * animation frame with the latest arguments.
 */
export function createRafThrottler<T extends (...args: any[]) => void>(
  callback: T,
  requestFrame: (cb: FrameRequestCallback) => number = (cb) =>
    typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame(cb)
      : (setTimeout(() => cb(Date.now()), 16) as unknown as number),
  cancelFrame: (id: number) => void = (id) =>
    typeof globalThis.cancelAnimationFrame === 'function'
      ? globalThis.cancelAnimationFrame(id)
      : clearTimeout(id)
): RafThrottledFunction<T> {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;

  const invoke = () => {
    rafId = null;
    if (latestArgs !== null) {
      const args = latestArgs;
      latestArgs = null;
      callback(...args);
    }
  };

  const throttled = ((...args: Parameters<T>) => {
    latestArgs = args;
    if (rafId === null) {
      rafId = requestFrame(invoke);
    }
  }) as RafThrottledFunction<T>;

  throttled.flush = () => {
    if (rafId !== null) {
      cancelFrame(rafId);
      rafId = null;
    }
    if (latestArgs !== null) {
      const args = latestArgs;
      latestArgs = null;
      callback(...args);
    }
  };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelFrame(rafId);
      rafId = null;
    }
    latestArgs = null;
  };

  throttled.isPending = () => rafId !== null;

  return throttled;
}

export interface ScrollPerformanceBudget {
  isHeavyScroll: boolean;
  maxSteps: number;
  budgetMs: number;
  domUpdateMinIntervalMs: number;
}

/**
 * Computes an adaptive per-frame simulation and DOM update budget so tube
 * geometry rebuilds (`tubes.update`) and CSS custom property writes remain
 * locked at 60fps even during heavy scroll bursts.
 */
export function computeScrollPerformanceBudget(params: {
  scrollVelocity: number;
  filled: number;
  inHeroReturnCatchup: boolean;
  maxStepsNormal: number;
  maxStepsFill: number;
  baseBudgetMs: number;
}): ScrollPerformanceBudget {
  const {
    scrollVelocity,
    filled,
    inHeroReturnCatchup,
    maxStepsNormal,
    maxStepsFill,
    baseBudgetMs,
  } = params;

  const absVel = Math.abs(scrollVelocity);
  const isHeavyScroll = absVel > 900;
  const isExtremeScroll = absVel > 2200;

  if (filled < 1 || inHeroReturnCatchup) {
    return {
      isHeavyScroll,
      maxSteps: isHeavyScroll ? Math.min(4, maxStepsFill) : maxStepsFill,
      budgetMs: isHeavyScroll ? Math.min(3, baseBudgetMs) : baseBudgetMs,
      domUpdateMinIntervalMs: isHeavyScroll ? 32 : 14,
    };
  }

  return {
    isHeavyScroll,
    maxSteps: isExtremeScroll ? 1 : isHeavyScroll ? Math.min(2, maxStepsNormal) : maxStepsNormal,
    budgetMs: isExtremeScroll ? 1.6 : isHeavyScroll ? 2.4 : baseBudgetMs,
    domUpdateMinIntervalMs: isHeavyScroll ? 32 : 14,
  };
}


