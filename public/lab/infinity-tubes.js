/**
 * ∞ LAB — Tubes Ignition Experiment (space edition)
 *
 * Evolves the portfolio's SVG stroke-draw infinity into 3D braided neon tubes
 * that trace the lemniscate on page load, floating in zero-gravity space:
 * - The site's original reactive particle grid lives INSIDE the scene as a
 *   spatial reference plane; the comet warps it while tracing, the mouse
 *   warps it afterwards (same spring physics as App.tsx's ParticleGrid).
 * - Deep starfield for parallax depth.
 * - Idle motion is weightless drift (layered slow precession, no bobbing),
 *   with stardust shed from the tubes.
 *
 * Phases: IGNITION (draw) -> SETTLE (pulse decay) -> IDLE (drift, parallax).
 * Click shifts the neon spectrum. Falls back to the SVG infinity if WebGL or
 * the CDN is unavailable.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fallbackToSvg = () => {
  document.body.classList.add('no-webgl', 'revealed');
  const fazers = document.getElementById('fazers');
  const hud = document.getElementById('hud-bottom');
  if (fazers) fazers.classList.add('done');
  if (hud) hud.style.opacity = '0';
};

// Skip 3D entirely if the CDN doesn't respond within 8s or fails to load.
const loadThree = () => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('three.js CDN timeout')), 8000)
  );
  const mods = Promise.all([
    import('three'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  return Promise.race([mods, timeout]);
};

let THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
try {
  const [three, ec, rp, ub, op] = await loadThree();
  THREE = three;
  EffectComposer = ec.EffectComposer;
  RenderPass = rp.RenderPass;
  UnrealBloomPass = ub.UnrealBloomPass;
  OutputPass = op.OutputPass;
} catch (err) {
  console.warn('∞ LAB: 3D unavailable, using SVG fallback.', err);
  fallbackToSvg();
  throw err; // stop module execution cleanly
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  tubeCount: 5,
  tubularSegments: 840,
  radialSegments: 12,
  tubeRadius: 0.028,
  braidRadius: 0.13,
  scale: 5.9,
  yStretch: 0.82,
  depth: 0.5,
  drawDuration: 2.6, // seconds for the full trace
  drawStagger: 0.14, // per-tube delay
  settleDuration: 1.2,
  // Monochrome-plus palette matching the site's black/white with cold neon accents
  tubeColors: ['#ffffff', '#9ae6ff', '#b39dff', '#7dd3fc', '#e2e8f0'],
  lightColors: ['#7dd3fc', '#a78bfa', '#f0abfc', '#60a5fa'],
};

// ---------------------------------------------------------------------------
// Curve: braided lemniscate of Bernoulli
// ---------------------------------------------------------------------------
class BraidedLemniscate extends THREE.Curve {
  constructor(scale, braidRadius, phase) {
    super();
    this.scale = scale;
    this.braidRadius = braidRadius;
    this.phase = phase;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const u = t * Math.PI * 2;
    const s = Math.sin(u);
    const c = Math.cos(u);
    const d = 1 + s * s;
    const x = (this.scale * c) / d;
    const y = ((this.scale * s * c) / d) * CONFIG.yStretch;
    const z = Math.sin(u * 2) * CONFIG.depth;
    // Braid: strands corkscrew around the shared spine (low frequency = smooth)
    const a = u * 2 + this.phase;
    return target.set(
      x + Math.cos(a) * this.braidRadius,
      y + Math.sin(a) * this.braidRadius,
      z + Math.sin(a + u) * this.braidRadius * 0.5
    );
  }
}

// ---------------------------------------------------------------------------
// Scene setup (all geometry created once, before the loop)
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#030303');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 14);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5, // strength
  0.28, // radius
  0.55 // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const group = new THREE.Group();
scene.add(group);

// --- Reactive particle grid (port of App.tsx ParticleGrid, on a space plane) ---
const GRID = {
  z: -6,
  spacing: 0.85,
  halfW: 17,
  halfH: 10.5,
  influenceRadius: 3.8, // ~200px at this depth, like the original
  pushFactor: 0.5,
  returnSpeed: 0.08,
  friction: 0.8,
  baseIntensity: 0.06,
};
const gridCols = Math.floor((GRID.halfW * 2) / GRID.spacing) + 1;
const gridRows = Math.floor((GRID.halfH * 2) / GRID.spacing) + 1;
const gridCount = gridCols * gridRows;
const gridOrigins = new Float32Array(gridCount * 2);
const gridPositions = new Float32Array(gridCount * 3);
const gridVel = new Float32Array(gridCount * 2);
const gridColors = new Float32Array(gridCount * 3);
// Radial falloff so the lattice reads as a local reference field around the
// drive and dissolves into the starfield at the edges — otherwise its regular
// rows compete with the stars and the whole background looks aligned.
const gridFalloff = new Float32Array(gridCount);
{
  let i = 0;
  for (let cx = 0; cx < gridCols; cx++) {
    for (let cy = 0; cy < gridRows; cy++) {
      const x = -GRID.halfW + cx * GRID.spacing;
      const y = -GRID.halfH + cy * GRID.spacing;
      gridOrigins[i * 2] = x;
      gridOrigins[i * 2 + 1] = y;
      gridPositions[i * 3] = x;
      gridPositions[i * 3 + 1] = y;
      gridPositions[i * 3 + 2] = GRID.z;
      // elliptical falloff, plus a little per-dot variance so the field breathes
      const nx = x / GRID.halfW;
      const ny = y / GRID.halfH;
      const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      gridFalloff[i] = Math.pow(1 - d * d, 1.6) * (0.75 + Math.random() * 0.25);
      const b = GRID.baseIntensity * gridFalloff[i];
      gridColors[i * 3] = b;
      gridColors[i * 3 + 1] = b;
      gridColors[i * 3 + 2] = b;
      i++;
    }
  }
}
const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.BufferAttribute(gridPositions, 3));
gridGeo.setAttribute('color', new THREE.BufferAttribute(gridColors, 3));
const gridMat = new THREE.PointsMaterial({
  size: 0.055,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});
scene.add(new THREE.Points(gridGeo, gridMat));

// warp influences: [{x, y, radius, strength}]
function updateGrid(influences) {
  for (let i = 0; i < gridCount; i++) {
    const px = gridPositions[i * 3];
    const py = gridPositions[i * 3 + 1];
    let glow = 0;
    for (const inf of influences) {
      const dx = inf.x - px;
      const dy = inf.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < inf.radius) {
        const angle = Math.atan2(dy, dx);
        const force = ((inf.radius - dist) / inf.radius) * inf.strength;
        // push away from the influence point (original ParticleGrid behavior)
        gridVel[i * 2] -= Math.cos(angle) * force * GRID.spacing * GRID.pushFactor * 0.1;
        gridVel[i * 2 + 1] -= Math.sin(angle) * force * GRID.spacing * GRID.pushFactor * 0.1;
        glow = Math.max(glow, force);
      }
    }
    // spring back home + friction
    gridVel[i * 2] += (gridOrigins[i * 2] - px) * GRID.returnSpeed;
    gridVel[i * 2 + 1] += (gridOrigins[i * 2 + 1] - py) * GRID.returnSpeed;
    gridVel[i * 2] *= GRID.friction;
    gridVel[i * 2 + 1] *= GRID.friction;
    gridPositions[i * 3] += gridVel[i * 2];
    gridPositions[i * 3 + 1] += gridVel[i * 2 + 1];
    // brighten dots near the warp, like the original's proximity alpha
    const b = (GRID.baseIntensity + glow * 0.2) * gridFalloff[i];
    gridColors[i * 3] = b;
    gridColors[i * 3 + 1] = b;
    gridColors[i * 3 + 2] = b;
  }
  gridGeo.attributes.position.needsUpdate = true;
  gridGeo.attributes.color.needsUpdate = true;
}

// --- Starfield (deep space backdrop) ---
// Scattered through open volumes at three depths rather than on a shell, so no
// band or edge forms. Each layer has its own point size, and brightness is
// gamma-weighted toward dim so a few stars read as near and most as far away.
const starField = new THREE.Group();
scene.add(starField);
const STAR_LAYERS = [
  { count: 320, size: 0.06, zNear: -16, zFar: -44, spread: 52, min: 0.06, max: 0.26 },
  { count: 240, size: 0.11, zNear: -44, zFar: -82, spread: 84, min: 0.10, max: 0.44 },
  { count: 110, size: 0.19, zNear: -82, zFar: -130, spread: 124, min: 0.20, max: 0.80 },
];
let twinkleSet = null; // only the sparse near-bright layer twinkles
for (const layer of STAR_LAYERS) {
  const pos = new Float32Array(layer.count * 3);
  const col = new Float32Array(layer.count * 3);
  for (let i = 0; i < layer.count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * layer.spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * layer.spread * 0.8;
    pos[i * 3 + 2] = layer.zNear + Math.random() * (layer.zFar - layer.zNear);
    const b = layer.min + Math.pow(Math.random(), 2.4) * (layer.max - layer.min);
    const tint = Math.random();
    col[i * 3] = b * (tint > 0.82 ? 1 : 0.9); // occasional warm star
    col[i * 3 + 1] = b * 0.94;
    col[i * 3 + 2] = b * (tint < 0.3 ? 1 : 0.88); // occasional cool star
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  starField.add(
    new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: layer.size,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    )
  );
  twinkleSet = { geo, col, base: col.slice(), count: layer.count };
}

function updateTwinkle(t) {
  const { geo, col, base, count } = twinkleSet;
  for (let i = 0; i < count; i++) {
    // each star scintillates on its own slow period
    const k = 0.86 + Math.sin(t * (0.5 + (i % 7) * 0.19) + i * 2.399) * 0.14;
    col[i * 3] = base[i * 3] * k;
    col[i * 3 + 1] = base[i * 3 + 1] * k;
    col[i * 3 + 2] = base[i * 3 + 2] * k;
  }
  geo.attributes.color.needsUpdate = true;
}

// --- Tubes ---
const tubes = [];
for (let i = 0; i < CONFIG.tubeCount; i++) {
  const phase = (i / CONFIG.tubeCount) * Math.PI * 2;
  const curve = new BraidedLemniscate(CONFIG.scale, CONFIG.braidRadius, phase);
  const geometry = new THREE.TubeGeometry(
    curve,
    CONFIG.tubularSegments,
    CONFIG.tubeRadius * (i === 0 ? 1.25 : 1),
    CONFIG.radialSegments,
    true
  );
  geometry.setDrawRange(0, 0); // revealed progressively during ignition
  const color = new THREE.Color(CONFIG.tubeColors[i % CONFIG.tubeColors.length]);
  const material = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.15),
    emissive: color,
    emissiveIntensity: 0.75,
    metalness: 0.15,
    roughness: 0.45,
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  tubes.push({ mesh, geometry, material, curve, indexCount: geometry.index.count });
}

// --- Comet head (the "speeder") ---
const cometGeo = new THREE.SphereGeometry(0.11, 16, 16);
const cometMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const comet = new THREE.Mesh(cometGeo, cometMat);
group.add(comet);
const cometLight = new THREE.PointLight('#ffffff', 22, 10, 2);
comet.add(cometLight);

// --- Ambient + orbiting neon lights (reference-style light rig) ---
scene.add(new THREE.AmbientLight('#0a0a12', 2));
const orbitLights = CONFIG.lightColors.map((hex, i) => {
  const light = new THREE.PointLight(hex, 9, 18, 2);
  const angle = (i / CONFIG.lightColors.length) * Math.PI * 2;
  light.position.set(Math.cos(angle) * 6, Math.sin(angle) * 3, 2);
  scene.add(light);
  return { light, angle, speed: 0.1 + i * 0.03, radius: 5.5 + i * 0.6 };
});

// --- Spark/stardust pool (fazer energy during ignition, drifting dust in idle) ---
const SPARKS = 160;
const sparkPositions = new Float32Array(SPARKS * 3);
const sparkColors = new Float32Array(SPARKS * 3);
const sparkVel = new Float32Array(SPARKS * 3);
const sparkLife = new Float32Array(SPARKS); // 0 = dead
const sparkDecay = new Float32Array(SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
const sparkMat = new THREE.PointsMaterial({
  size: 0.09,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});
group.add(new THREE.Points(sparkGeo, sparkMat));

let sparkCursor = 0;
const sparkColor = new THREE.Color();
function spawnParticle(origin, vx, vy, vz, decay, colorHex, brightness) {
  const i = sparkCursor;
  sparkCursor = (sparkCursor + 1) % SPARKS;
  sparkPositions[i * 3] = origin.x;
  sparkPositions[i * 3 + 1] = origin.y;
  sparkPositions[i * 3 + 2] = origin.z;
  sparkVel[i * 3] = vx;
  sparkVel[i * 3 + 1] = vy;
  sparkVel[i * 3 + 2] = vz;
  sparkLife[i] = 1;
  sparkDecay[i] = decay;
  sparkColor.set(colorHex).multiplyScalar(brightness);
  sparkColors[i * 3] = sparkColor.r;
  sparkColors[i * 3 + 1] = sparkColor.g;
  sparkColors[i * 3 + 2] = sparkColor.b;
}

function emitSpark(origin, tangent) {
  // shed backwards along the tangent with scatter — the loader's fazer lines
  spawnParticle(
    origin,
    -tangent.x * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
    -tangent.y * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
    -tangent.z * (2.2 + Math.random()) + (Math.random() - 0.5) * 0.6,
    1.6,
    Math.random() < 0.7 ? '#ffffff' : CONFIG.lightColors[(Math.random() * 4) | 0],
    1
  );
}

const dustOrigin = new THREE.Vector3();
function emitDust(curve) {
  // weightless stardust: barely moving, long-lived, dim
  curve.getPoint(Math.random(), dustOrigin);
  spawnParticle(
    dustOrigin,
    (Math.random() - 0.5) * 0.18,
    (Math.random() - 0.5) * 0.18,
    (Math.random() - 0.5) * 0.18,
    0.3,
    Math.random() < 0.5 ? '#ffffff' : CONFIG.lightColors[(Math.random() * 4) | 0],
    0.4
  );
}

// ---------------------------------------------------------------------------
// Interaction: parallax tilt + click to shift spectrum
// ---------------------------------------------------------------------------
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('click', () => {
  if (phase !== 'idle') return;
  const baseHue = Math.random();
  tubes.forEach((tube, i) => {
    const hue = (baseHue + i * 0.09) % 1;
    const c = new THREE.Color().setHSL(hue, 0.75, 0.72);
    tube.material.emissive.copy(c);
    tube.material.color.copy(c).multiplyScalar(0.15);
  });
  orbitLights.forEach(({ light }, i) => {
    light.color.setHSL((baseHue + 0.5 + i * 0.12) % 1, 0.85, 0.6);
  });
  bloomPass.strength = 0.9; // small flash on shift
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const wrap01 = (v) => ((v % 1) + 1) % 1;

// Draw easing: accelerates over the first 30%, then holds constant speed.
// Unlike ease-in-out it does NOT decelerate to zero at the end, so the comet
// still carries momentum when the loop closes — nothing stops dead in vacuum.
const ACCEL = 0.3;
const EASE_NORM = 1 - ACCEL / 2;
const easeInHold = (t) =>
  (t < ACCEL ? (t * t) / (2 * ACCEL) : ACCEL / 2 + (t - ACCEL)) / EASE_NORM;
// terminal speed in loops/second, carried into the settle phase
const TERMINAL_SPEED = 1 / EASE_NORM / CONFIG.drawDuration;

const fazersEl = document.getElementById('fazers');
const hudBottom = document.getElementById('hud-bottom');
const hudStatus = document.getElementById('hud-status');
const progressFill = document.getElementById('progress-fill');

let phase = 'ignition'; // ignition -> settle -> idle
let settleStart = 0;
let idleStart = 0;
let cometProgress = 0;
let cometSpeed = 0;
let dustTimer = 0;
const clock = new THREE.Clock();
const headPos = new THREE.Vector3();
const headTangent = new THREE.Vector3();
const tmpPrev = new THREE.Vector3();
const cometWorld = new THREE.Vector3();
const mouseWorld = new THREE.Vector3();
const unprojTmp = new THREE.Vector3();

// project the mouse ray onto the grid plane (z = GRID.z)
function mouseOnGridPlane() {
  unprojTmp.set(parallax.tx, -parallax.ty, 0.5).unproject(camera);
  unprojTmp.sub(camera.position).normalize();
  const t = (GRID.z - camera.position.z) / unprojTmp.z;
  mouseWorld.copy(camera.position).addScaledVector(unprojTmp, t);
  return mouseWorld;
}

if (REDUCED_MOTION) {
  // Static reveal: no shake, no sparks, no streaks — full infinity immediately
  tubes.forEach((t) => t.geometry.setDrawRange(0, t.indexCount));
  comet.visible = false;
  fazersEl.classList.add('done');
  hudBottom.style.opacity = '0';
  document.body.classList.add('revealed');
  phase = 'idle';
}

function enterSettle(elapsed) {
  phase = 'settle';
  settleStart = elapsed;
  cometSpeed = TERMINAL_SPEED; // momentum carries past the closure point
  bloomPass.strength = 1.2; // ignition pulse as the loop closes
  fazersEl.classList.add('done');
  hudStatus.textContent = 'Systems nominal';
  progressFill.style.width = '100%';
  setTimeout(() => (hudBottom.style.opacity = '0'), 900);
  document.body.classList.add('revealed');
  // circuit closes: the charge distributes around the whole ring as drifting dust
  const ring = tubes[0].curve;
  for (let i = 0; i < 30; i++) {
    ring.getPoint(i / 30, dustOrigin);
    spawnParticle(
      dustOrigin,
      dustOrigin.x * 0.05 + (Math.random() - 0.5) * 0.12,
      dustOrigin.y * 0.05 + (Math.random() - 0.5) * 0.12,
      (Math.random() - 0.5) * 0.12,
      0.45,
      '#ffffff',
      0.5
    );
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const gridInfluences = [];

  // --- IGNITION: comet traces the curve, tubes grow behind it ---
  if (phase === 'ignition') {
    const raw = clamp01((elapsed - 0.35) / CONFIG.drawDuration);
    const headProgress = easeInHold(raw);
    cometProgress = headProgress;

    tubes.forEach((tube, i) => {
      const local = clamp01(
        (elapsed - 0.35 - i * CONFIG.drawStagger) /
          (CONFIG.drawDuration - i * CONFIG.drawStagger)
      );
      const p = easeInHold(local);
      // keep draw range on triangle boundaries
      tube.geometry.setDrawRange(0, Math.floor((tube.indexCount * p) / 3) * 3);
    });

    // Comet rides the lead tube's head
    tubes[0].curve.getPoint(headProgress, headPos);
    tubes[0].curve.getPoint(Math.max(0, headProgress - 0.004), tmpPrev);
    headTangent.subVectors(headPos, tmpPrev).normalize();
    comet.position.copy(headPos);

    if (raw > 0.01 && raw < 1) {
      for (let s = 0; s < 3; s++) emitSpark(headPos, headTangent);
    }

    // The drive warps the space grid beneath it as it traces
    comet.getWorldPosition(cometWorld);
    gridInfluences.push({ x: cometWorld.x, y: cometWorld.y, radius: 5, strength: 1.6 });

    // Speeder shake — fades as the trace completes
    const shake = (1 - raw) * 0.05;
    group.position.set(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake,
      0
    );
    group.rotation.z = (Math.random() - 0.5) * shake * 0.25;

    progressFill.style.width = `${(raw * 100).toFixed(1)}%`;
    if (raw >= 1) enterSettle(elapsed);
  }

  // --- SETTLE: pulse decays, scene calms down ---
  if (phase === 'settle') {
    const t = clamp01((elapsed - settleStart) / CONFIG.settleDuration);
    const fade = 1 - easeInOutCubic(t);
    bloomPass.strength = 1.2 - (1.2 - 0.5) * easeInOutCubic(t);

    // Momentum: the comet keeps coasting around the closed loop, dissolving into
    // stardust as it goes, instead of freezing at the seam and blinking out.
    cometProgress += cometSpeed * dt;
    tubes[0].curve.getPoint(wrap01(cometProgress), headPos);
    tubes[0].curve.getPoint(wrap01(cometProgress - 0.004), tmpPrev);
    headTangent.subVectors(headPos, tmpPrev).normalize();
    comet.position.copy(headPos);
    comet.scale.setScalar(0.3 + fade * 0.7);
    cometMat.transparent = true;
    cometMat.opacity = fade;
    cometLight.intensity = 22 * fade;
    if (Math.random() < fade * 0.9) {
      spawnParticle(
        headPos,
        -headTangent.x * 1.6 + (Math.random() - 0.5) * 0.5,
        -headTangent.y * 1.6 + (Math.random() - 0.5) * 0.5,
        -headTangent.z * 1.6 + (Math.random() - 0.5) * 0.5,
        1.1,
        '#ffffff',
        fade * 0.9
      );
    }

    // residual ignition shake bleeds off toward zero
    group.position.multiplyScalar(0.9);
    group.rotation.z *= 0.9;

    // the travelling warp fades out as the mouse warp fades in — no hard handover
    comet.getWorldPosition(cometWorld);
    gridInfluences.push({ x: cometWorld.x, y: cometWorld.y, radius: 5, strength: 1.6 * fade });
    const settleMouse = mouseOnGridPlane();
    gridInfluences.push({
      x: settleMouse.x,
      y: settleMouse.y,
      radius: GRID.influenceRadius,
      strength: easeInOutCubic(t),
    });

    if (t >= 1) {
      phase = 'idle';
      idleStart = elapsed;
      comet.visible = false;
      cometLight.intensity = 0;
    }
  }

  // --- IDLE: weightless drift, breathe, parallax, stardust ---
  if (phase === 'idle') {
    if (!REDUCED_MOTION) {
      // Zero-g float: layered slow precession with incommensurate periods —
      // never repeats, never "swings". No up/down bobbing.
      //
      // Time is measured from the moment idle begins so every oscillator starts
      // at sin(0) = 0, and `ramp` eases the amplitudes up from nothing. Together
      // these mean the drift grows out of the settle pose continuously instead
      // of snapping to a mid-cycle offset.
      const td = elapsed - idleStart;
      const ramp = easeInOutCubic(clamp01(td / 4));

      group.position.x = Math.sin(td * 0.061) * 0.35 * ramp;
      group.position.y =
        (Math.sin(td * 0.047) * 0.28 + Math.sin(td * 0.113) * 0.09) * ramp;
      group.position.z = Math.sin(td * 0.039) * 0.3 * ramp;
      group.rotation.y =
        (Math.sin(td * 0.083) * 0.28 + Math.sin(td * 0.031) * 0.1) * ramp;
      group.rotation.x = Math.sin(td * 0.067) * 0.11 * ramp;
      group.rotation.z = Math.sin(td * 0.053) * 0.05 * ramp;
      // slow camera dolly, like stationkeeping
      camera.position.z = 14 + Math.sin(td * 0.037) * 0.45 * ramp;

      // ease from the ignition emissive level into the breathing cycle
      const breatheTarget = 0.68 + Math.sin(td * 0.8) * 0.08;
      const breathe = 0.75 + (breatheTarget - 0.75) * ramp;
      tubes.forEach((tube) => (tube.material.emissiveIntensity = breathe));
      // gentle spectrum-shift flash decay
      if (bloomPass.strength > 0.5) {
        bloomPass.strength = Math.max(0.5, bloomPass.strength - dt * 1.5);
      }

      // shed weightless stardust from the strands
      dustTimer += dt;
      if (dustTimer > 0.22) {
        dustTimer = 0;
        emitDust(tubes[(Math.random() * tubes.length) | 0].curve);
      }
    }
    // Parallax tilt (subtle, additive on top of the drift)
    parallax.x += (parallax.tx - parallax.x) * 0.04;
    parallax.y += (parallax.ty - parallax.y) * 0.04;
    group.rotation.y += parallax.x * 0.1;
    group.rotation.x += parallax.y * 0.06;

    // mouse warps the space grid — the original site's background, in orbit
    if (!REDUCED_MOTION) {
      const m = mouseOnGridPlane();
      gridInfluences.push({ x: m.x, y: m.y, radius: GRID.influenceRadius, strength: 1 });
    }
  }

  // Space grid + starfield (all phases)
  if (!REDUCED_MOTION) {
    updateGrid(gridInfluences);
    starField.rotation.y += dt * 0.004;
    starField.rotation.z += dt * 0.0012;
    // far field lags the foreground, so depth reads on mouse move
    starField.position.x += (-parallax.x * 1.4 - starField.position.x) * 0.02;
    starField.position.y += (parallax.y * 0.9 - starField.position.y) * 0.02;
    updateTwinkle(elapsed);
  }

  // Orbiting neon lights (all phases)
  orbitLights.forEach((o) => {
    const a = o.angle + elapsed * o.speed;
    o.light.position.set(
      Math.cos(a) * o.radius,
      Math.sin(a * 1.3) * 3,
      Math.sin(a) * 2 + 1.5
    );
  });

  // Particle physics (sparks + stardust, no gravity out here)
  let sparksAlive = false;
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) continue;
    sparksAlive = true;
    sparkLife[i] -= dt * sparkDecay[i];
    const fade = sparkDecay[i] > 1 ? 0.94 : 0.995; // dust lingers, sparks die fast
    sparkPositions[i * 3] += sparkVel[i * 3] * dt;
    sparkPositions[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
    sparkPositions[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    // additive blending: fading to black = fading out
    sparkColors[i * 3] *= fade;
    sparkColors[i * 3 + 1] *= fade;
    sparkColors[i * 3 + 2] *= fade;
    if (sparkLife[i] <= 0) {
      sparkColors[i * 3] = sparkColors[i * 3 + 1] = sparkColors[i * 3 + 2] = 0;
    }
  }
  if (sparksAlive) {
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  composer.render();
}

animate();
