import { useEffect, useRef, type CSSProperties } from 'react';
import { createPaperAscii } from './paperAscii';

/** Native scrolling owns the seam. Rendering uses a 2D worker when available,
 * with the same cached renderer as a fallback on older browsers. */
export default function PaperTransition({ ground, accent }: {
  ground: string;
  accent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const paletteRef = useRef({ ground, accent });
  const updatePaletteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    paletteRef.current = { ground, accent };
    updatePaletteRef.current?.();
  }, [ground, accent]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: ReturnType<typeof createPaperAscii> = null;
    let worker: Worker | null = null;
    let frame = 0;
    let visible = false;
    let disposed = false;
    let time = 3;
    let previous = 0;
    let accumulator = 0;
    let width = 0, height = 0, dpr = 0;

    const tick = (now: number) => {
      if (disposed) return;
      const elapsed = previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      accumulator += elapsed;
      time += elapsed / 1000;
      if (accumulator >= 1000 / 30) {
        accumulator %= 1000 / 30;
        renderer?.draw(time);
      }
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      accumulator = 0;
      const active = visible && !document.hidden;
      if (worker) {
        worker.postMessage({ type: 'state', active, reduced: motion.matches });
      } else if (renderer) {
        if (motion.matches) {
          time = 3;
          renderer.draw(time);
        } else if (active) {
          frame = requestAnimationFrame(tick);
        }
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width === rect.width && height === rect.height && dpr === nextDpr) return;
      width = rect.width; height = rect.height; dpr = nextDpr;
      if (worker) {
        worker.postMessage({ type: 'resize', width, height, dpr });
      } else if (renderer?.resize(width, height, dpr)) {
        renderer.draw(time);
      }
    };

    const makeCanvas = () => {
      const canvas = document.createElement('canvas');
      canvas.className = 'paper-transition__canvas';
      host.replaceChildren(canvas);
      return canvas;
    };

    const readPalette = () => {
      const style = getComputedStyle(host);
      return {
        paper: style.getPropertyValue('--paper').trim() || '#f2f1ef',
        ink: style.getPropertyValue('--ink').trim() || '#171717',
        ...paletteRef.current,
      };
    };

    updatePaletteRef.current = () => {
      const palette = readPalette();
      if (worker) worker.postMessage({ type: 'palette', palette });
      else if (renderer) {
        renderer.setPalette(palette);
        renderer.draw(time);
      }
    };

    const prepare = () => {
      if (disposed) return;
      const palette = readPalette();
      resize();
      const fallback = () => {
        if (disposed) return;
        worker?.terminate();
        worker = null;
        renderer = createPaperAscii(makeCanvas(), () => document.createElement('canvas'), readPalette());
        renderer?.resize(width, height, dpr);
        renderer?.draw(time);
        sync();
      };
      const canvas = makeCanvas();
      if (typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
        try {
          worker = new Worker(new URL('./paperAscii.worker.ts', import.meta.url), { type: 'module' });
          worker.onerror = fallback;
          worker.onmessage = ({ data }) => { if (data.type === 'failed') fallback(); };
          const offscreen = canvas.transferControlToOffscreen();
          worker.postMessage({ type: 'init', canvas: offscreen, width, height, dpr, palette }, [offscreen]);
          sync();
          return;
        } catch {
          // A transferred canvas cannot be reused: fallback creates a new one.
        }
      }
      fallback();
    };

    // Build before first scroll without competing with the initial hero load.
    // StrictMode's probe effect cancels this before creating a worker/canvas.
    const usesIdle = typeof window.requestIdleCallback === 'function';
    const idle = usesIdle
      ? window.requestIdleCallback(prepare, { timeout: 800 })
      : window.setTimeout(prepare, 120);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
      sync();
    }, { threshold: [0, 0.3] });
    observer.observe(host);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (usesIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      worker?.terminate();
      updatePaletteRef.current = null;
      host.replaceChildren();
      observer.disconnect();
      resizeObserver.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return <div ref={ref} className="paper-transition" style={{ '--seam-ground': ground } as CSSProperties} aria-hidden="true" />;
}
