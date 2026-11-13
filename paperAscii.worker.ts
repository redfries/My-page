import { createPaperAscii } from './paperAscii';

// The animated raster and noise work stay off the scrolling/UI thread.
let renderer: ReturnType<typeof createPaperAscii> = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let time = 3;
let previous = 0;
let active = false;
let reduced = false;

function tick() {
  if (!active || reduced || !renderer) return;
  const now = performance.now();
  time += previous ? Math.min(now - previous, 100) / 1000 : 0;
  previous = now;
  renderer.draw(time);
  timer = setTimeout(tick, Math.max(0, 1000 / 30 - (performance.now() - now)));
}

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      renderer = createPaperAscii(data.canvas, () => new OffscreenCanvas(1, 1), data.palette);
      if (!renderer) throw new Error('2D canvas unavailable');
      renderer.resize(data.width, data.height, data.dpr);
      renderer.draw(time);
    } else if (data.type === 'resize') {
      if (renderer?.resize(data.width, data.height, data.dpr)) renderer.draw(time);
    } else if (data.type === 'palette') {
      renderer?.setPalette(data.palette);
      renderer?.draw(time);
    } else if (data.type === 'state') {
      clearTimeout(timer);
      previous = 0;
      active = data.active;
      reduced = data.reduced;
      if (reduced) {
        time = 3;
        renderer?.draw(time);
      } else if (active) {
        timer = setTimeout(tick, 0);
      }
    }
  } catch {
    clearTimeout(timer);
    active = false;
    self.postMessage({ type: 'failed' });
  }
};
