import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHeroToCardBlend,
  computeHeroFigureRadii,
  computeBoundedPointerPull,
  computeCanvasBackgroundOpacity,
  evaluateCardsIllumination,
  computeTubeOrbitOffsetPx,
  isPastHeroThreshold,
  createRafThrottler,
  computeScrollPerformanceBudget,
} from './tubesLogic.ts';

test('scrolling down immediately releases from Hero mode and transitions to Vertical 3D Space mode', () => {
  const heroHeight = 1000;

  assert.equal(isPastHeroThreshold(0, heroHeight), false);
  assert.equal(computeHeroToCardBlend(0, heroHeight), 0);
  assert.equal(computeCanvasBackgroundOpacity(0), 1.0);

  // At 2% scroll, it immediately releases from the Hero infinity loop
  assert.equal(isPastHeroThreshold(20, heroHeight), true);
  const earlyBlend = computeHeroToCardBlend(100, heroHeight);
  assert.ok(earlyBlend > 0.1 && earlyBlend < 0.9, `expected smooth early blend, got ${earlyBlend}`);

  // By 32%+ of hero height, fully in Vertical 3D Space Mode with atmospheric background opacity (0.82)
  assert.equal(computeHeroToCardBlend(320, heroHeight), 1);
  assert.equal(computeCanvasBackgroundOpacity(1), 0.82);

  // Returning to top restores 0.0
  assert.equal(computeHeroToCardBlend(0, heroHeight), 0);
});

test('computeTubeOrbitOffsetPx traces a tall vertical 3D space trajectory (Y >> X, with Z depth) when scrolling', () => {
  const { rx, ry } = computeHeroFigureRadii(1440);
  let maxAbsX = 0;
  let maxAbsY = 0;
  let maxAbsZ = 0;

  for (let i = 0; i < 120; i++) {
    const pt = computeTubeOrbitOffsetPx({
      simTime: i * 0.08,
      heroRx: rx,
      heroRy: ry,
      cardWidth: 680,
      cardHeight: 400,
      blend: 1,
      scrollY: 600,
      scrollVelocity: 0,
      pointerNormX: 0.3,
      pointerNormY: -0.2,
    });
    maxAbsX = Math.max(maxAbsX, Math.abs(pt.offsetX));
    maxAbsY = Math.max(maxAbsY, Math.abs(pt.offsetY));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(pt.offsetZ));
  }

  // Must be unmistakably vertical (vertical reach > 2.5x horizontal weave) and alive in 3D Z depth
  assert.ok(maxAbsY > 260, `expected tall vertical space reach > 260px, got ${maxAbsY}`);
  assert.ok(maxAbsX < 125, `expected narrow horizontal weave < 125px, got ${maxAbsX}`);
  assert.ok(maxAbsY / maxAbsX > 2.4, `expected vertical aspect > 2.4, got ${maxAbsY / maxAbsX}`);
  assert.ok(maxAbsZ > 0.4, `expected 3D Z-depth motion > 0.4 world units, got ${maxAbsZ}`);
});

test('vertical spine guides the 3D space stream into AI SYSTEMS and down to footer with non-direct mouse math', () => {
  const viewportWidth = 1440;
  const viewportHeight = 900;
  const docCards = [
    { id: 'project-01', left: 120, docTop: 1100, width: 680, height: 420, accentColor: '#f59e0b' },
    { id: 'capability-01', left: 120, docTop: 2950, width: 560, height: 340, accentColor: '#38bdf8' },
    { id: 'contact-card', left: 120, docTop: 4650, width: 580, height: 320, accentColor: '#f967fb' },
  ];

  const evalTransition = evaluateCardsIllumination({
    cards: docCards.map((c) => ({ ...c, top: c.docTop - 480 })),
    viewportWidth,
    viewportHeight,
    scrollY: 480,
    maxScrollY: 4150,
    pointerX: 1080,
    pointerY: 320,
    pointerActive: true,
    tubeViewportX: 720,
    tubeViewportY: 440,
    blend: 1,
  });

  assert.ok(
    Math.abs(evalTransition.targetViewportX - viewportWidth * 0.5) < 120,
    `expected vertical spine X near center, got ${evalTransition.targetViewportX}`
  );

  const pull = computeBoundedPointerPull(
    evalTransition.targetViewportX,
    evalTransition.targetViewportY,
    viewportWidth,
    viewportHeight,
    1080,
    320,
    true,
    1.5
  );
  assert.ok(pull.pullX > 15 && pull.pullX < 105);
  assert.ok(pull.normX > 0.4);

  const evalBottom = evaluateCardsIllumination({
    cards: docCards.map((c) => ({ ...c, top: c.docTop - 4150 })),
    viewportWidth,
    viewportHeight,
    scrollY: 4150,
    maxScrollY: 4150,
    pointerX: -9999,
    pointerY: -9999,
    pointerActive: false,
    tubeViewportX: 720,
    tubeViewportY: 580,
    blend: 1,
  });
  assert.equal(evalBottom.activeCardId, 'contact-card');
});

test('returning to hero section restores exact horizontal Gerono lemniscate phase and coordinates', () => {
  const { rx, ry } = computeHeroFigureRadii(1440);
  const sampleTimes = [0, 0.73, 1.57, 3.14159, 5.42];

  for (const t of sampleTimes) {
    const heroOrbit = computeTubeOrbitOffsetPx({
      simTime: t,
      heroRx: rx,
      heroRy: ry,
      cardWidth: 920,
      cardHeight: 380,
      blend: 0,
    });
    assert.ok(Math.abs(heroOrbit.offsetX - rx * Math.cos(t)) < 1e-9);
    assert.ok(Math.abs(heroOrbit.offsetY - ry * Math.sin(2 * t)) < 1e-9);
    assert.equal(heroOrbit.offsetZ, 0);
  }
});

test('createRafThrottler coalesces high-frequency scroll/pointer events to one call per animation frame', () => {
  const pendingCallbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const mockRaf = (cb: FrameRequestCallback) => {
    const id = nextId++;
    pendingCallbacks.set(id, cb);
    return id;
  };
  const mockCancel = (id: number) => {
    pendingCallbacks.delete(id);
  };

  const received: number[] = [];
  const throttled = createRafThrottler((scrollY: number) => {
    received.push(scrollY);
  }, mockRaf, mockCancel);

  // Fire 5 rapid scroll updates before the next animation frame
  throttled(100);
  throttled(220);
  throttled(380);
  throttled(510);
  throttled(640);

  assert.equal(throttled.isPending(), true);
  assert.equal(pendingCallbacks.size, 1);
  assert.equal(received.length, 0);

  // Run the single scheduled rAF callback -> only the latest value (640) is processed
  for (const [, cb] of pendingCallbacks) cb(16.67);
  pendingCallbacks.clear();

  assert.equal(throttled.isPending(), false);
  assert.deepEqual(received, [640]);

  // Verify synchronous flush() during render loop and cancel() on unmount
  throttled(800);
  throttled(950);
  assert.equal(throttled.isPending(), true);
  throttled.flush();
  assert.equal(throttled.isPending(), false);
  assert.deepEqual(received, [640, 950]);

  throttled(1200);
  throttled.cancel();
  assert.equal(throttled.isPending(), false);
  assert.deepEqual(received, [640, 950]);
});

test('computeScrollPerformanceBudget throttles simulation steps and DOM interval during heavy scroll bursts', () => {
  const idleBudget = computeScrollPerformanceBudget({
    scrollVelocity: 120,
    filled: 1,
    inHeroReturnCatchup: false,
    maxStepsNormal: 3,
    maxStepsFill: 10,
    baseBudgetMs: 5,
  });
  assert.equal(idleBudget.isHeavyScroll, false);
  assert.equal(idleBudget.maxSteps, 3);
  assert.equal(idleBudget.domUpdateMinIntervalMs, 14);

  const heavyBudget = computeScrollPerformanceBudget({
    scrollVelocity: 1500,
    filled: 1,
    inHeroReturnCatchup: false,
    maxStepsNormal: 3,
    maxStepsFill: 10,
    baseBudgetMs: 5,
  });
  assert.equal(heavyBudget.isHeavyScroll, true);
  assert.equal(heavyBudget.maxSteps, 2);
  assert.equal(heavyBudget.budgetMs, 2.4);
  assert.equal(heavyBudget.domUpdateMinIntervalMs, 32);

  const extremeBudget = computeScrollPerformanceBudget({
    scrollVelocity: -2800,
    filled: 1,
    inHeroReturnCatchup: false,
    maxStepsNormal: 3,
    maxStepsFill: 10,
    baseBudgetMs: 5,
  });
  assert.equal(extremeBudget.isHeavyScroll, true);
  assert.equal(extremeBudget.maxSteps, 1);
  assert.equal(extremeBudget.budgetMs, 1.6);
});


