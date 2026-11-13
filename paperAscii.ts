// Rasterize glyphs once on resize; animation only copies cached glyphs.
const GLYPHS = ' .:-=+*#%@';
type Palette = { paper: string; ink: string; ground: string; accent: string };
type Surface = HTMLCanvasElement | OffscreenCanvas;
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Seeded, smoothly interpolated value noise. No per-frame random allocations.
const values = new Float32Array(128 * 128);
let seed = 719;
for (let i = 0; i < values.length; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  values[i] = (seed >>> 0) / 4294967296;
}
const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = values[(iy & 127) * 128 + (ix & 127)];
  const b = values[(iy & 127) * 128 + ((ix + 1) & 127)];
  const c = values[((iy + 1) & 127) * 128 + (ix & 127)];
  const d = values[((iy + 1) & 127) * 128 + ((ix + 1) & 127)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export function createPaperAscii(
  canvas: Surface,
  createSurface: () => Surface,
  palette: Palette,
) {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;
  const atlas = createSurface();
  const atlasCtx = atlas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  const map = createSurface();
  const mapCtx = map.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!atlasCtx || !mapCtx) return null;

  let width = 0, height = 0, scale = 1, cell = 12, row = 18;
  let columns = 0, rows = 0, tileWidth = 0, tileHeight = 0;
  let pixels: ImageData;
  let glyphs: Uint8Array, colors: Uint8Array, alphas: Float32Array;
  const rgb = (color: string) => {
    // Resolve design-system CSS colours once, through the canvas parser.
    atlasCtx.fillStyle = color;
    atlasCtx.fillRect(0, 0, 1, 1);
    return atlasCtx.getImageData(0, 0, 1, 1).data.slice(0, 3);
  };
  let paper = rgb(palette.paper), ground = rgb(palette.ground), accent = rgb(palette.accent);

  const paintAtlas = () => {
    atlas.width = tileWidth * GLYPHS.length;
    atlas.height = tileHeight * 3;
    atlasCtx.font = `bold ${Math.round(cell * scale)}px "Courier New", monospace`;
    atlasCtx.textAlign = 'center';
    atlasCtx.textBaseline = 'middle';
    // Echo the tube palette without colouring the paper background.
    const accentColor = `rgb(${Array.from(accent, (value, i) => Math.round(value * 0.6 + paper[i] * 0.4)).join(',')})`;
    [palette.paper, palette.ink, accentColor].forEach((color, index) => {
      atlasCtx.fillStyle = color;
      for (let i = 1; i < GLYPHS.length; i++) {
        atlasCtx.fillText(GLYPHS[i], (i + 0.5) * tileWidth, (index + 0.5) * tileHeight);
      }
    });
  };

  const setPalette = (next: Palette) => {
    palette = next;
    paper = rgb(palette.paper); ground = rgb(palette.ground); accent = rgb(palette.accent);
    if (tileWidth) paintAtlas();
  };

  const resize = (w: number, h: number, dpr: number) => {
    if (w === width && h === height && dpr === scale) return false;
    width = w; height = h; scale = dpr;
    // Larger, legible characters also bound the work on wide displays.
    cell = Math.max(width < 640 ? 11 : 13, Math.ceil(width / 144));
    row = cell * 1.4;
    columns = Math.ceil(width / cell); rows = Math.ceil(height / row);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    tileWidth = Math.ceil(cell * scale);
    tileHeight = Math.ceil(row * scale);
    paintAtlas();
    map.width = columns; map.height = rows;
    pixels = mapCtx.createImageData(columns, rows);
    glyphs = new Uint8Array(columns * rows);
    colors = new Uint8Array(columns * rows);
    alphas = new Float32Array(columns * rows);
    return true;
  };

  const draw = (time: number) => {
    if (!width || !height) return;
    for (let j = 0; j < rows; j++) {
      const v = j / (rows - 1);
      const envelope = smooth(0.04, 0.23, v) * (1 - smooth(0.6, 0.94, v));
      const warp = Math.sin(v * 4.5 + time * 0.55) * 0.65;
      for (let i = 0; i < columns; i++) {
        const index = j * columns + i;
        const x = i * cell / 145, y = j * row / 145;
        const flow = noise(x + warp - time * 0.5, y + time * 0.3);
        const detail = noise(x * 1.9 + flow * 1.6 + time * 0.2, y * 1.5 - time * 0.35);
        const density = smooth(0.06, 0.65, flow * 0.65 + detail * 0.35);
        const sheet = smooth(0.18, 0.76, v + (flow - 0.5) * 0.25 * Math.sin(v * Math.PI));
        // Colour belongs to the night-sky end. Below it: ink, then pure paper.
        const hot = smooth(0.85, 0.98, density) * (1 - smooth(0.18, 0.62, v));
        const offset = index * 4;
        for (let c = 0; c < 3; c++) {
          pixels.data[offset + c] = ground[c] + (paper[c] - ground[c]) * sheet;
        }
        pixels.data[offset + 3] = Math.round(255 * smooth(0, 0.16, v));
        glyphs[index] = Math.min(GLYPHS.length - 1, Math.floor(density * GLYPHS.length));
        colors[index] = hot > 0.32 ? 2 : sheet < 0.42 ? 0 : 1;
        alphas[index] = envelope * (0.7 + density * 0.3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    mapCtx.putImageData(pixels, 0, 0);
    // One small background upload instead of thousands of fillRects.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map, 0, 0, width, height);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const index = j * columns + i;
        if (!glyphs[index] || alphas[index] < 0.02) continue;
        ctx.globalAlpha = alphas[index];
        ctx.drawImage(atlas,
          glyphs[index] * tileWidth, colors[index] * tileHeight, tileWidth, tileHeight,
          i * cell, j * row, cell, row);
      }
    }
    ctx.globalAlpha = 1;
  };

  return { resize, draw, setPalette };
}
