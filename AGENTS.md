# 🤖 AI Agent Blueprint & Master Architecture Specification

> **THIS FILE IS THE AUTHORITATIVE MANUAL FOR ALL AI AGENTS & SUBAGENTS**  
> Every AI coding assistant (Antigravity, Cursor, Copilot, Claude, Windsurf, etc.) working on this repository MUST read and adhere strictly to this specification before inspecting, modifying, or creating code.

---

## 📌 1. Repository Identity & Live Infrastructure

- **Owner**: Shabaaz Hussain
- **Primary Domain**: [https://www.infinitys.me](https://www.infinitys.me)
- **GitHub Repository**: [`redfries/My-page`](https://github.com/redfries/My-page)
- **Hosting Platform**: Vercel (Auto-deploys from `main` branch)
- **Primary Framework**: Vite 6 + React 19 + TypeScript + TailwindCSS

---

## 🏗️ 2. Comprehensive Master Architecture Map

This codebase combines a **single-page React application** (the main portfolio) with **3 embedded static sub-applications**. All sub-applications reside in the `public/` directory so Vite passes them directly into `dist/` during build.

```
Shabaaz-Portfolio/
├── .env                              # Environment secrets (GEMINI_API_KEY) - IGNORED BY GIT
├── .env.local                        # Local fallback environment settings
├── .gitignore                        # Strict ignore rules (secrets, dist, tool logs)
├── AGENTS.md                         # THIS FILE - Master Agent Instructions
├── README.md                         # Human-readable repository overview
├── App.tsx                           # Main Portfolio Application (React 19)
├── TubesInfinity.tsx                 # Neon tube infinity hero (threejs-components CDN engine)
├── Starfield.tsx                     # Full-page 2D starfield behind every section
├── inspiration/                      # Tubes reference: original snippet, stills, CC BY-NC-SA notice
├── index.html                        # Main HTML entry point & Tailwind font imports
├── index.css                         # Global CSS styles
├── index.tsx                         # React 19 root mounting logic
├── package.json                      # Dependencies & npm build scripts
├── tsconfig.json                     # TypeScript compiler configuration (ES2022, React-JSX)
├── vercel.json                       # Vercel Rewrites & Cache-Control rules
├── vite.config.ts                    # Vite build configuration & env defines
└── public/                           # Static assets & sub-application routes
    ├── pre/                          # Subproject 1: Reading with AI (infinitys.me/pre)
    │   ├── index.html                # Editorial landing page
    │   ├── styles.css                # Geist + Instrument Serif dark minimal styling
    │   └── script.js                 # IntersectionObserver scroll reveal engine
    ├── ocr/                          # Subproject 2: Arabic Cheque OCR (infinitys.me/ocr)
    │   ├── index.html                # Cheque OCR research landing page
    │   ├── styles.css                # Dark technical dashboard layout
    │   └── script.js                 # Interactive pipeline visualizer & reveals
    └── lab/                          # Animation sandbox (infinitys.me/lab) - noindex
        ├── index.html                # Standalone tubes-infinity experiment
        └── infinity-tubes.js         # Self-contained Three.js engine (CDN importmap)

# Note: infinitys.me/credit-card-tracker/ is NOT in this repo. It is proxied to
# its own Vercel deployment — see section D below.
```

---

## 🌐 3. Detailed Subproject & Component Breakdown

### A. Main Portfolio App (`App.tsx`, `index.html`)
- **Route**: `https://www.infinitys.me/`
- **Key Sections**:
  1. **Background stack** (`App.tsx` root, all `fixed inset-0 z-0`, painted in DOM order): the hero's `TubesInfinity` canvas, then `ParticleGrid` if the hero failed, then `Starfield`. **The hero canvas lives at the root, not inside the hero section** — the two must share one layer, and the sky must paint *over* the hero canvas, because the engine's bloom composites at alpha 1: that canvas is opaque black wherever the figure is not, so anything behind it is not on the page at all. Stars in front of it are correct — faint dots, invisible against the lit tubes. The hero's `anchorRef` therefore comes from `App`, not `MainHero`. Every section is `z-10` and so paints above all of it.
  2. **Starfield** (`Starfield.tsx`): plain 2D canvas, ~50–220 stars by viewport area, capped at DPR 2. Parallax by depth on scroll plus a constant drift, and the pointer pushes nearby stars aside with a jitter and they spring home in ~0.6 s. The push is a bounded **displacement**, not an accumulating force — a force flings stars across the screen. **2D and not WebGL on purpose**: the hero already owns a WebGL context with a bloom pass, and a second one for a few hundred dots would cost more than the rest of the page on a phone. Under `prefers-reduced-motion` it draws one still frame and never starts a loop. Nothing else on the page reacts to it; the stars are the only thing that moves.
  3. **ParticleGrid Canvas**: Interactive dot-grid background that distorts based on mouse proximity. **Only mounted when the hero reports `failed`** — otherwise the hero canvas is the background. It still reads the exported `heroWarp` object from `TubesInfinity.tsx`, but nothing writes to it any more (see below), so `strength` stays `0` and that code path is inert.
  4. **Hero Section**: neon tube infinity (`TubesInfinity.tsx`). **This is a third-party engine, not our own Three.js scene** — read this whole block before touching it.
     - **The engine.** `threejs-components@0.0.19/build/cursors/tubes1.min.js`, loaded from jsDelivr via a `/* @vite-ignore */` dynamic import. It is a self-contained ~775 kB ES module with **its own Three.js bundled in**; it shares nothing with the repo's `three` dependency, which is now unused by the app. Pinned to that exact version deliberately — the look is the deliverable and a minor bump could retune it. Mounted with the reference's own options (`lights.intensity: 200`).
     - **Why the figure is an infinity.** The engine's render loop drives its tube target at `x = sleepRadiusX·cos(elapsed·sleepTimeScale1)`, `y = sleepRadiusY·sin(elapsed·sleepTimeScale2)` whenever the pointer is away, and ships defaults of `300 / 150 / 1 / 2`. A 1:2 frequency ratio at a 2:1 radius ratio **is a Gerono lemniscate** — the engine already draws an elongated infinity on its own. There is no custom curve anywhere in this repo, and none should be added.
     - **The one modification.** Everything we change lives in the `three.onBeforeRender` override; downstream — tubes, materials, the four lights, bloom — is untouched engine code. It does three things. (1) The stock loop hands the target to the cursor whenever the pointer is over the canvas, and our canvas covers the viewport, so the cursor would always win; the override runs the sleep path unconditionally, so the lemniscate is permanent and **the cursor is not an input**. Do not "restore" cursor following; that removes the infinity. (2) It advances that path on a **fixed 1/60 s step** (max 3 steps per frame, remainder dropped) rather than per rendered frame. (3) It positions the figure — see the layout invariant.
     - **How much of the infinity is on screen.** Each tube is a chain of points trailing the target, so the visible stroke is `points × lag per point`, and `lag = (1 − lerp) / lerp` steps. At the engine's stock `lerp 0.5` that is **a fifth of the loop** — a diagonal swoosh that never reaches its own crossing. We pass `lerp 0.35`, which draws **~45–60%**: a full lobe, the crossing, and a tail fading into the second lobe. `lerp` is the **only free lever** — every point is rebuilt on the CPU each step, so lengthening the tail with `minTubularSegments`/`maxTubularSegments` (left at the engine's 32–128) is the one knob here that shows up in the frame budget. Past ~70% the tail laps the head and spirals inward, drawing a second, smaller infinity inside the first. Every chain starts collapsed at the origin, so the figure grows out of a point and needs ~250 steps before the tail is full length; until then the clock runs at 2x and eases back, and frames get a bigger step budget under a 5 ms cap. Without that the figure sits as a short arc for the first five seconds — and much longer on a reload, where the cached module starts the engine inside the page's own load storm and the dropped backlog never catches up. `scratch/tail-sweep.mjs` and `scratch/tail-bundle.mjs` replay this chain offline — tune there, not by eye: a headless capture renders at a few fps, and before the fixed step existed that alone changed the figure (a 120 Hz phone drew half the coverage of a 60 Hz laptop).
     - **Layout invariant (load-bearing).** The hero is one centred flex column with a spacer reserving the figure's box, published as `--infinity-h` before first paint and measured via `anchorRef`. The **scene group** is moved by `−anchorOffsetPx · worldPerPx` so the figure centres on that spacer. **Never pan the camera to do this.** The engine derives its world size from `camera.position.length()`, recomputed on every resize — so a camera panned to follow the scroll makes the next resize compute a world several times too large, which feeds straight back into the pan. On a phone that resize arrives on every URL-bar show/hide, i.e. on every scroll, and the figure grows and slides out of frame a little more each time. Offset is measured against the **canvas's** rect, not `window.innerHeight` (they disagree while the URL bar is up), and refreshed inside the render loop whenever `scrollY` has moved — not from a `scroll` listener, which a busy phone can coalesce away mid-flick. Never anchor hero text to the section's centre line or hardcode spacing in `vh`: the canvas is `fixed` and viewport-sized while the section is `100svh`, so the two do not share a centre line.
     - **Themes.** `THEMES` holds seven three-stop palettes (`neon` is the reference verbatim; `mono` is black-and-white; plus `ice`, `ember`, `toxic`, `vapor`, `gold`). One is chosen at random **before the engine mounts**, so the first frame is already correct; clicking picks another at random and never repeats the current one. `setColors` samples the tube list as a **gradient ramp across all 16 tubes**, not one colour per tube — so stop order is what defines a theme. Tubes render at `metalness: 1`, so a pure `#000000` stop takes no specular and vanishes; `mono` bottoms out at `#111111` for that reason.
     - **Cost and lifecycle come from the engine.** It brings its own `ResizeObserver` (sizing to the canvas's **parent**, hence the fixed full-viewport wrapper `div`), an `IntersectionObserver` that parks it off-screen, and `visibilitychange` handling. `dispose()` on unmount is all we add. The previous hand-rolled scroll-driven throttle, adaptive quality ladder and DPR watching are **gone** — do not reintroduce them against this engine.
     - **Degradation.** Falls back to the static SVG infinity (`status: 'failed'`) when WebGL is unavailable, when the CDN does not load within 6 s, or under `prefers-reduced-motion` — the engine has no meaningful still frame, since its tubes only form the figure by chasing a moving target.
     - **Licence.** The tubes engine is CC BY-NC-SA 4.0 by Kevin Levron — attribution required, non-commercial only. Reference material and the original snippet live in `inspiration/`.
  5. **Specializations**: Focus areas in **Machine Learning**, **LLMs**, **NLP**, and **AI System R&D**.
  6. **Tech Stack**: Categorized badges covering Python/PyTorch/TensorFlow, React/TypeScript/Next.js, Node.js/FastAPI/SQL, and LangChain/Hugging Face.
  7. **Projects Grid**: Dynamic project cards highlighting:
     - **Reading with AI** (`https://infinitys.me/pre`)
     - **Arabic Cheque OCR** (`https://infinitys.me/ocr`)
     - **Starlight Mobile AR**
     - **Quantum API**
  8. **Social & Contact**: Links to GitHub (`https://github.com/redfries`), LinkedIn (`https://www.linkedin.com/in/redfries/`), and Email (`studioinfinitys@gmail.com`).

---

### B. Subproject 1: Personalised Reading Experience (`public/pre/`)
- **Route**: `https://www.infinitys.me/pre/`
- **Purpose**: Research paper reading assistant that encodes user interests using Qwen embeddings and highlights key sentences in PDFs.
- **Tech & Styling**:
  - Fonts: *Geist* and *Instrument Serif* via Google Fonts.
  - Black, minimal, editorial aesthetics with grain overlay.
  - Links out to external live Modal web app (`https://redfries--personalized-reading-v5-web-app.modal.run/`) and research feedback Google Form.

---

### C. Subproject 2: Arabic Cheque OCR (`public/ocr/`)
- **Route**: `https://www.infinitys.me/ocr/`
- **Purpose**: End-to-end computer vision and OCR system for localization, text extraction, and verification of Arabic cheque fields.
- **Tech Stack**: YOLOv8 / Cascade R-CNN, TrOCR, PyTorch, FastAPI, Qwen3.5.

---

### D. Subproject 3: CardTrack — **not in this repo**
- **Route**: `https://www.infinitys.me/credit-card-tracker/`
- **Source**: [`redfries/credit-card-tracker`](https://github.com/redfries/credit-card-tracker) (private), deployed as its own Vercel project at `credit-card-tracker-iota.vercel.app`.
- **How it is served**: `vercel.json` rewrites `/credit-card-tracker/:path*` to that deployment. Nothing is built or stored here.
- **To change the app, push to `master` on that repo.** Do not add files under `public/credit-card-tracker/` — Vercel matches the filesystem *before* rewrites, so any file there silently shadows the proxy and pins the route to a stale copy.

Until 3 Aug 2026 this route was a hand-copied snapshot in `public/credit-card-tracker/`
(`index.html`, `style.css`, `app.js`). It went stale — the source repo was rebuilt and
the copy here was not, so the live site served a June build for six weeks. The proxy
exists so the two repos cannot drift apart again.

---

## ⚡ 4. Vercel Routing & Cache Control Specification (`vercel.json`)

All routing, rewrites, and HTTP header rules are centralized in [`vercel.json`](./vercel.json):

```json
{
  "redirects": [
    {
      "source": "/credit-card-tracker",
      "destination": "/credit-card-tracker/",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/credit-card-tracker/:path*",
      "destination": "https://credit-card-tracker-iota.vercel.app/:path*"
    },
    {
      "source": "/pre/:path*",
      "destination": "/pre/index.html"
    },
    {
      "source": "/ocr/:path*",
      "destination": "/ocr/index.html"
    }
  ],
  "headers": [
    {
      "source": "/credit-card-tracker/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=0, no-cache, no-store, must-revalidate"
        },
        {
          "key": "Pragma",
          "value": "no-cache"
        },
        {
          "key": "Expires",
          "value": "0"
        }
      ]
    }
  ]
}
```

### Critical Rules for Agents:
1. **Never Delete `vercel.json`**: Vercel relies on this file to map static subprojects correctly without 404s on page refresh.
2. **Enforce Cache Control for Credit Card Tracker**: The `Cache-Control: max-age=0, no-cache, no-store, must-revalidate` header ensures users always load the newest JavaScript state rather than stale CDN caches. The tracker's own repo sets the same headers, so it is correct on either origin.
3. **The bare `/credit-card-tracker` path must stay a redirect, not a rewrite**: the app loads its CSS and JS with relative paths, so without the trailing slash the browser resolves them against `/` and the page loads unstyled and dead.
4. **Never recreate `public/credit-card-tracker/`**: filesystem matches beat rewrites, so a file there takes the route back off the proxy.

---

## 🔐 5. Database & Environment Security Rules

1. **Environment Secrets**:
   - `GEMINI_API_KEY` is loaded in `vite.config.ts` using `loadEnv`.
   - Local secrets reside in `.env` or `.env.local` (both ignored in `.gitignore`).
   - Production secrets are set directly in the **Vercel Project Settings ➔ Environment Variables**.

2. **Firestore Security Rules (`card-tracker-m`)**:
   - Database rules for Firestore are configured as:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /tracker_data/{syncKey}/{collectionName}/{document=**} {
           allow read, write: if collectionName in ['cards', 'transactions', 'limitGroups'];
         }
       }
     }
     ```

---

## 🛠️ 6. Guidelines & Workflows for Future AI Agents

1. **Adding a New Subproject**:
   - Create a subfolder under `public/<new-subproject>/`.
   - Place `index.html`, CSS, and JS inside `public/<new-subproject>/`.
   - Add a rewrite entry in `vercel.json` if client-side sub-routing is needed.
   - Add a project card entry in `App.tsx` pointing to `https://infinitys.me/<new-subproject>`.

2. **Editing `App.tsx`**:
   - Maintain the dark, sleek, premium visual design (black background `#030303`, smooth micro-animations, glassmorphism).
   - Use Lucide icons (`lucide-react`) for consistent iconography.

3. **Verifying Code Changes**:
   - Always verify that the project builds locally or via dry run (`npm run build`) before pushing changes to `main`.
