import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared warp source, written by the hero comet and read by ParticleGrid in
 * App.tsx. Values are viewport pixel coordinates. While `strength` is 0 the
 * grid behaves exactly as it always has, so if this component never loads the
 * background is completely unaffected.
 */
export const heroWarp = { x: -10000, y: -10000, strength: 0 };

type Status = 'loading' | 'ready' | 'failed';

/** Geometry of the lemniscate, shared by the camera fit and the curve. */
const SHAPE = {
  scale: 5.9,
  yStretch: 0.82,
  depth: 0.5,
  braidRadius: 0.13,
};
// Extents of the traced figure in world units (lemniscate peaks at |y| = s/3).
const SHAPE_W = SHAPE.scale * 2 + SHAPE.braidRadius * 4;
const SHAPE_H = (SHAPE.scale * 2) / 3 * SHAPE.yStretch + SHAPE.braidRadius * 4;

const TIMING = {
  drawDuration: 2.6,
  drawStagger: 0.14,
  settleDuration: 1.2,
  startDelay: 0.35,
};

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
  onStatusChange?: (status: Status) => void;
}

const TubesInfinity: React.FC<Props> = ({ onStatusChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

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
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const lowPower =
        coarse ||
        window.innerWidth < 768 ||
        (navigator.hardwareConcurrency ?? 8) <= 4;

      const QUALITY = {
        tubular: lowPower ? 380 : 840,
        radial: lowPower ? 8 : 12,
        stars: lowPower ? 0.55 : 1,
        sparks: lowPower ? 96 : 160,
        maxDpr: lowPower ? 1.5 : 2,
        bloomScale: lowPower ? 0.5 : 1,
      };

      // ---------------------------------------------------------------
      // Renderer — transparent so the site's ParticleGrid shows through
      // ---------------------------------------------------------------
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !lowPower,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearAlpha(0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 220);

      const composer = new EffectComposer(renderer);
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

      const tubes = TUBE_COLORS.map((hex, i) => {
        const curve = new BraidedLemniscate((i / TUBE_COLORS.length) * Math.PI * 2);
        const geometry = new THREE.TubeGeometry(
          curve,
          QUALITY.tubular,
          0.028 * (i === 0 ? 1.25 : 1),
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
        group.add(new THREE.Mesh(geometry, material));
        disposables.push(geometry, material);
        return { geometry, material, curve, indexCount: geometry.index!.count };
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
      group.add(new THREE.Points(sparkGeo, sparkMat));
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
      const resize = () => {
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        const aspect = w / h;
        camera.aspect = aspect;

        // Phones fill more of the width; desktops leave breathing room. Scale target decreased by 20% total.
        const fill = aspect < 0.8 ? 0.75 : aspect < 1.2 ? 0.68 : 0.575;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const distForWidth = SHAPE_W / (2 * tanHalf * aspect * fill);
        const distForHeight = SHAPE_H / (2 * tanHalf * fill);
        // Never let the figure eat the vertical space the hero text needs —
        // this is what keeps landscape phones and short windows readable.
        const maxHeightFraction = h < 560 ? 0.24 : 0.34;
        const minDist = SHAPE_H / (2 * tanHalf * maxHeightFraction);
        baseCameraZ = Math.max(distForWidth, distForHeight, minDist);
        camera.position.z = baseCameraZ;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.maxDpr));
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloomPass.resolution.set(
          Math.max(64, Math.round(w * QUALITY.bloomScale)),
          Math.max(64, Math.round(h * QUALITY.bloomScale))
        );

        // Tell the layout how tall the figure renders, so the text never
        // collides with it on any screen.
        const visibleH = 2 * tanHalf * baseCameraZ;
        const px = (SHAPE_H / visibleH) * h;
        document.documentElement.style.setProperty(
          '--infinity-h',
          `${Math.round(px)}px`
        );
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
      const onClick = () => {
        if (phase !== 'idle') return;
        const baseHue = Math.random();
        tubes.forEach((tube, i) => {
          const c = new THREE.Color().setHSL((baseHue + i * 0.09) % 1, 0.75, 0.72);
          tube.material.emissive.copy(c);
          tube.material.color.copy(c).multiplyScalar(0.15);
        });
        orbitLights.forEach(({ light }, i) =>
          light.color.setHSL((baseHue + 0.5 + i * 0.12) % 1, 0.85, 0.6)
        );
        bloomPass.strength = 0.9;
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      canvas.addEventListener('click', onClick);
      window.addEventListener('resize', resize);

      // Pause when the hero is off-screen or the tab is hidden.
      let visible = true;
      const observer = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !reducedMotion) {
            clock.getDelta(); // drop accumulated time so nothing jumps
            loop();
          }
        },
        { threshold: 0 }
      );
      observer.observe(canvas);
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
      const clock = new THREE.Clock();
      const headPos = new THREE.Vector3();
      const headTangent = new THREE.Vector3();
      const tmpPrev = new THREE.Vector3();
      const cometWorld = new THREE.Vector3();
      const dustOrigin = new THREE.Vector3();

      const projectToScreen = (v: InstanceType<typeof THREE.Vector3>) => {
        cometWorld.copy(v).project(camera);
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + ((cometWorld.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - cometWorld.y) / 2) * rect.height,
        };
      };

      if (reducedMotion) {
        tubes.forEach((t) => t.geometry.setDrawRange(0, t.indexCount));
        comet.visible = false;
        cometLight.intensity = 0;
        phase = 'idle';
        composer.render();
        setStatus('ready');
      }

      const enterSettle = (elapsed: number) => {
        phase = 'settle';
        settleStart = elapsed;
        cometSpeed = TERMINAL_SPEED;
        bloomPass.strength = 1.2;
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
        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.elapsedTime;

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
          bloomPass.strength = 1.2 - (1.2 - 0.5) * easeInOutCubic(t);

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

          group.position.x = Math.sin(td * 0.061) * 0.35 * ramp;
          group.position.y =
            (Math.sin(td * 0.047) * 0.28 + Math.sin(td * 0.113) * 0.09) * ramp;
          group.position.z = Math.sin(td * 0.039) * 0.3 * ramp;
          group.rotation.y =
            (Math.sin(td * 0.083) * 0.28 + Math.sin(td * 0.031) * 0.1) * ramp;
          group.rotation.x = Math.sin(td * 0.067) * 0.11 * ramp;
          group.rotation.z = Math.sin(td * 0.053) * 0.05 * ramp;
          camera.position.z = baseCameraZ + Math.sin(td * 0.037) * 0.45 * ramp;

          const breatheTarget = 0.68 + Math.sin(td * 0.8) * 0.08;
          const breathe = 0.75 + (breatheTarget - 0.75) * ramp;
          tubes.forEach((tube) => (tube.material.emissiveIntensity = breathe));

          if (bloomPass.strength > 0.5) {
            bloomPass.strength = Math.max(0.5, bloomPass.strength - dt * 1.5);
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

        orbitLights.forEach((o) => {
          const a = o.angle + elapsed * o.speed;
          o.light.position.set(
            Math.cos(a) * o.radius,
            Math.sin(a * 1.3) * 3,
            Math.sin(a) * 2 + 1.5
          );
        });

        let alive = false;
        for (let i = 0; i < SPARKS; i++) {
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
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('click', onClick);
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
      className={`absolute inset-0 w-full h-full block transition-opacity duration-1000 ${
        status === 'ready' ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ touchAction: 'manipulation' }}
    />
  );
};

export default TubesInfinity;
