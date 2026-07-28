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
├── TubesInfinity.tsx                 # 3D braided-infinity hero (Three.js, lazy-loaded)
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
  1. **ParticleGrid Canvas**: Interactive canvas background that distorts particles smoothly based on mouse proximity. Also accepts a warp point from the hero comet via the exported `heroWarp` object in `TubesInfinity.tsx` (inert when that scene is not running).
  2. **Hero Section**: 3D braided-infinity animation (`TubesInfinity.tsx`) that traces itself on load, then drifts in zero-g. Three.js is **dynamically imported** so it code-splits and never blocks first paint. Degrades to the original SVG infinity when WebGL is unavailable or the chunk is slow, and renders a static figure under `prefers-reduced-motion`. The component publishes the figure's rendered height as the `--infinity-h` CSS variable; the hero text anchors to it so the composition holds at every viewport size. Do not hardcode hero spacing in `vh`.
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
