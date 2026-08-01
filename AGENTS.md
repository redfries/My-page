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
    ├── lab/                          # Animation sandbox (infinitys.me/lab) - noindex
    │   ├── index.html                # Standalone tubes-infinity experiment
    │   └── infinity-tubes.js         # Self-contained Three.js engine (CDN importmap)
    └── credit-card-tracker/          # Subproject 3: CardTrack Pro (infinitys.me/credit-card-tracker)
        ├── index.html                # Single-page app layout (Tab Navigation, Modals, FAB)
        ├── style.css                 # Custom dark UI styling for CardTrack Pro
        └── app.js                    # Pure JS SPA logic, DataStore & FirestoreSync Engine
```

---

## 🌐 3. Detailed Subproject & Component Breakdown

### A. Main Portfolio App (`App.tsx`, `index.html`)
- **Route**: `https://www.infinitys.me/`
- **Key Sections**:
  1. **ParticleGrid Canvas**: Interactive dot-grid background that distorts based on mouse proximity. **Only mounted when the hero reports `failed`** — otherwise the hero canvas is the background. It still reads the exported `heroWarp` object from `TubesInfinity.tsx`, but nothing writes to it any more (see below), so `strength` stays `0` and that code path is inert.
  2. **Hero Section**: neon tube infinity (`TubesInfinity.tsx`). **This is a third-party engine, not our own Three.js scene** — read this whole block before touching it.
     - **The engine.** `threejs-components@0.0.19/build/cursors/tubes1.min.js`, loaded from jsDelivr via a `/* @vite-ignore */` dynamic import. It is a self-contained ~775 kB ES module with **its own Three.js bundled in**; it shares nothing with the repo's `three` dependency, which is now unused by the app. Pinned to that exact version deliberately — the look is the deliverable and a minor bump could retune it. Mounted with the reference's own options (`lights.intensity: 200`).
     - **Why the figure is an infinity.** The engine's render loop drives its tube target at `x = sleepRadiusX·cos(elapsed·sleepTimeScale1)`, `y = sleepRadiusY·sin(elapsed·sleepTimeScale2)` whenever the pointer is away, and ships defaults of `300 / 150 / 1 / 2`. A 1:2 frequency ratio at a 2:1 radius ratio **is a Gerono lemniscate** — the engine already draws an elongated infinity on its own. There is no custom curve anywhere in this repo, and none should be added.
     - **The one modification.** The stock loop hands the target to the cursor whenever the pointer is over the canvas, and our canvas covers the viewport, so the cursor would always win. `three.onBeforeRender` is overridden to run the sleep path unconditionally: the lemniscate is permanent and **the cursor is not an input**. Everything downstream — tubes, materials, the four lights, bloom — is untouched engine code. Do not "restore" cursor following; that removes the infinity.
     - **Layout invariant (unchanged and still load-bearing).** The hero is one centred flex column with a spacer reserving the figure's box, published as `--infinity-h` before first paint and measured via `anchorRef`. The camera is panned by `anchorOffsetPx · worldPerPx` so the figure centres on that spacer. Never anchor hero text to the section's centre line or hardcode spacing in `vh`: the canvas is `fixed` and viewport-sized while the section is `100svh`, so the two do not share a centre line. The anchor offset is recomputed on scroll/resize/`fonts.ready`, **never per frame** — a `getBoundingClientRect` inside the render loop forces layout every frame.
     - **Themes.** `THEMES` holds seven three-stop palettes (`neon` is the reference verbatim; `mono` is black-and-white; plus `ice`, `ember`, `toxic`, `vapor`, `gold`). One is chosen at random **before the engine mounts**, so the first frame is already correct; clicking picks another at random and never repeats the current one. `setColors` samples the tube list as a **gradient ramp across all 16 tubes**, not one colour per tube — so stop order is what defines a theme. Tubes render at `metalness: 1`, so a pure `#000000` stop takes no specular and vanishes; `mono` bottoms out at `#111111` for that reason.
     - **Cost and lifecycle come from the engine.** It brings its own `ResizeObserver` (sizing to the canvas's **parent**, hence the fixed full-viewport wrapper `div`), an `IntersectionObserver` that parks it off-screen, and `visibilitychange` handling. `dispose()` on unmount is all we add. The previous hand-rolled scroll-driven throttle, adaptive quality ladder and DPR watching are **gone** — do not reintroduce them against this engine.
     - **Degradation.** Falls back to the static SVG infinity (`status: 'failed'`) when WebGL is unavailable, when the CDN does not load within 6 s, or under `prefers-reduced-motion` — the engine has no meaningful still frame, since its tubes only form the figure by chasing a moving target.
     - **Licence.** The tubes engine is CC BY-NC-SA 4.0 by Kevin Levron — attribution required, non-commercial only. Reference material and the original snippet live in `inspiration/`.
  3. **Specializations**: Focus areas in **Machine Learning**, **LLMs**, **NLP**, and **AI System R&D**.
  4. **Tech Stack**: Categorized badges covering Python/PyTorch/TensorFlow, React/TypeScript/Next.js, Node.js/FastAPI/SQL, and LangChain/Hugging Face.
  5. **Projects Grid**: Dynamic project cards highlighting:
     - **Reading with AI** (`https://infinitys.me/pre`)
     - **Arabic Cheque OCR** (`https://infinitys.me/ocr`)
     - **Starlight Mobile AR**
     - **Quantum API**
  6. **Social & Contact**: Links to GitHub (`https://github.com/redfries`), LinkedIn (`https://www.linkedin.com/in/redfries/`), and Email (`studioinfinitys@gmail.com`).

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

### D. Subproject 3: CardTrack Pro (`public/credit-card-tracker/`)
- **Route**: `https://www.infinitys.me/credit-card-tracker/`
- **Purpose**: Credit card limit rotation, utilization tracking, dues management, and debt optimization.
- **Architecture**:
  - Pure JavaScript Single-Page Application (SPA) written in `app.js`.
  - **DataStore**: In-memory store for `_cards`, `_transactions`, and `_limitGroups`.
  - **Offline-First**: Persists state in `localStorage`.
  - **Real-Time Sync**: Uses Firebase SDK v8 (`firebase.firestore()`) to sync data in real time under the collection path `tracker_data/{syncKey}/{colName}` (`cards`, `transactions`, `limitGroups`).
  - **Firebase Database**: Connected to Firestore database `card-tracker-m`.

---

## ⚡ 4. Vercel Routing & Cache Control Specification (`vercel.json`)

All routing, rewrites, and HTTP header rules are centralized in [`vercel.json`](./vercel.json):

```json
{
  "rewrites": [
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
2. **Enforce Cache Control for Credit Card Tracker**: The `Cache-Control: max-age=0, no-cache, no-store, must-revalidate` header ensures users always load the newest JavaScript state rather than stale CDN caches.

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
