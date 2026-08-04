import React, { useEffect, useRef } from 'react';

/**
 * The background of the whole page: a drifting starfield on a plain 2D canvas,
 * sitting behind every section.
 *
 * 2D and not WebGL on purpose. The hero already owns a WebGL context with a
 * bloom pass on it, and a second one — for a few hundred dots — would cost more
 * than the rest of the page put together on a phone. Everything here is a
 * handful of multiplications and one `arc` per star.
 *
 * The stars are the only thing that reacts. Text and cards are left alone: the
 * pointer pushes the stars around it and they shake themselves back, which is
 * enough motion to feel alive without competing with the hero.
 */

/** One star per this many CSS px² of viewport, clamped at the ends. */
const AREA_PER_STAR = 8000;
const MIN_STARS = 50;
const MAX_STARS = 220;

/**
 * The pointer's reach, in CSS px, and how far a star at the very centre of it
 * is pushed aside — the push is a *displacement*, not a force, so a star can
 * never be flung: it slides at most this fraction of the radius out of the way
 * and springs back the moment the pointer moves on.
 */
const POINTER_RADIUS = 120;
const POINTER_PUSH = 0.3;
/** Jitter while a star is inside that radius — this is the shake itself. */
const POINTER_SHAKE = 0.25;
/** Spring toward wherever the star should be, and the drag that settles it. */
const SPRING = 0.08;
const DRAG = 0.86;

/**
 * Parallax: how much of the page's scroll each star takes, by depth. Near
 * stars move most. The field wraps, so scrolling never runs out of sky.
 */
const PARALLAX_NEAR = 0.28;
const PARALLAX_FAR = 0.05;

/** Constant drift, in CSS px per 1/60s, so the sky moves on a still page too. */
const DRIFT = 0.012;

interface Star {
  /** Home position. x is fixed; y wraps through the field height. */
  x: number;
  y: number;
  /** 0 = far, 1 = near. Drives size, brightness and parallax together. */
  depth: number;
  radius: number;
  alpha: number;
  /** Offset from home, and its velocity — this is all the physics there is. */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Twinkle phase and rate, fixed per star so no two pulse together. */
  phase: number;
  twinkle: number;
  /** A cold tint on some stars, to sit with the hero's palette. */
  tint: string;
}

const TINTS = [
  '255, 255, 255',
  '255, 255, 255',
  '255, 255, 255',
  '186, 230, 253', // sky-200
  '196, 181, 253', // violet-300
];

const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;
    let scrollShift = 0;

    // Parked off-screen until the pointer actually moves, so a touch device
    // never gets a phantom shove at the origin.
    let pointerX = -9999;
    let pointerY = -9999;

    const build = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      // Real device pixels, capped: a 3x phone would otherwise fill three
      // times the pixels for dots that are two across.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(
        MIN_STARS,
        Math.min(MAX_STARS, Math.round((width * height) / AREA_PER_STAR))
      );

      stars = new Array(count).fill(0).map(() => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          depth,
          radius: 0.4 + depth * 1.1,
          alpha: 0.18 + depth * 0.5,
          dx: 0,
          dy: 0,
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2,
          twinkle: 0.008 + Math.random() * 0.02,
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        };
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const s of stars) {
        // Where the star sits this frame: home, plus the page's scroll at this
        // depth, wrapped into the viewport, plus whatever the pointer did to it.
        const parallax =
          scrollShift * (PARALLAX_FAR + s.depth * (PARALLAX_NEAR - PARALLAX_FAR));
        let y = (s.y - parallax) % height;
        if (y < 0) y += height;
        const x = s.x + s.dx;
        y += s.dy;

        if (!reducedMotion) {
          // Where this star would like to be: aside, if the pointer is on it,
          // and home otherwise. Nearer stars move further, which reads as depth
          // rather than as a flat ripple.
          let wantX = 0;
          let wantY = 0;
          const px = x - pointerX;
          const py = y - pointerY;
          const dist = Math.hypot(px, py);
          if (dist < POINTER_RADIUS && dist > 0.001) {
            const push =
              (POINTER_RADIUS - dist) * POINTER_PUSH * (0.4 + s.depth);
            wantX = (px / dist) * push;
            wantY = (py / dist) * push;
            s.vx += (Math.random() - 0.5) * POINTER_SHAKE;
            s.vy += (Math.random() - 0.5) * POINTER_SHAKE;
          }

          s.vx = (s.vx + (wantX - s.dx) * SPRING) * DRAG;
          s.vy = (s.vy + (wantY - s.dy) * SPRING) * DRAG;
          s.dx += s.vx;
          s.dy += s.vy;
        }

        const twinkle = reducedMotion
          ? 1
          : 0.75 + 0.25 * Math.sin(s.phase + frame * s.twinkle);

        ctx.beginPath();
        ctx.arc(x, y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.tint}, ${s.alpha * twinkle})`;
        ctx.fill();

        // A wide, faint halo on the nearest few, so the field has some depth
        // instead of reading as uniform noise. Cheap: it is a handful of stars.
        if (s.depth > 0.88) {
          ctx.beginPath();
          ctx.arc(x, y, s.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.tint}, ${0.05 * twinkle})`;
          ctx.fill();
        }
      }
    };

    let raf = 0;
    const animate = () => {
      frame++;
      // Drift is folded into the scroll shift, so both move the field the same
      // way and the wrap only has to be handled once.
      scrollShift = window.scrollY - frame * DRIFT;
      draw();
      raf = requestAnimationFrame(animate);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    };
    const onPointerLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
    };
    const onResize = () => build();

    build();

    if (reducedMotion) {
      // No loop at all: one still sky, no drift, no pointer.
      scrollShift = 0;
      draw();
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      // On the document, not the window — `pointerleave` does not fire on the
      // window when the cursor exits the viewport, and a star left shoved aside
      // would sit there until the pointer came back.
      document.addEventListener('pointerleave', onPointerLeave);
      animate();
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

export default Starfield;
