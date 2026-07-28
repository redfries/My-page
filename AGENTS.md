# Agent Instructions & Project Overview

This repository (`redfries/My-page`) contains Shabaaz Hussain's personal portfolio and embedded subprojects.

## 🚀 Live Site & Deployment
- **Domain**: [https://www.infinitys.me](https://www.infinitys.me)
- **Hosting Platform**: Vercel (Auto-deploys from GitHub `main` branch)
- **GitHub Repository**: `redfries/My-page`

---

## 🏗️ Architecture & Subprojects

The project is built with **Vite + React 19 + TypeScript**. Static sub-applications are hosted in the `public/` folder so Vite builds and serves them under specific path routes.

### Path Mapping:
1. **`/` (Root)**: Main Portfolio App (`App.tsx`, `index.html`)
2. **`/pre/`**: Personalised Reading Experience landing page (`public/pre/index.html`)
3. **`/ocr/`**: Arabic Cheque OCR landing page (`public/ocr/index.html`)
4. **`/credit-card-tracker/`**: Credit Card Rotation & Debt Manager (`public/credit-card-tracker/index.html`)

---

## ⚡ Hosting & Routing Rules (`vercel.json`)

Vercel configuration is defined in [`vercel.json`](./vercel.json):
- **Rewrites**: Handles routing for `/pre/*` and `/ocr/*`.
- **Cache-Control**: Enforces `max-age=0, no-cache, no-store, must-revalidate` for `/credit-card-tracker/*` so users always get fresh data without stale browser caching.

> ⚠️ **CRITICAL FOR AGENTS**: Do NOT delete `vercel.json` or modify the `public/` subfolder paths unless explicitly requested.

---

## 🔐 Database & Environment Secrets
- **Firebase Firestore**: Used by Credit Card Tracker (`card-tracker-m` database). Syncs collections `cards`, `transactions`, and `limitGroups` under `tracker_data/{syncKey}`.
- **Environment Variables**: `GEMINI_API_KEY` is defined in `.env` (ignored by Git) and configured in Vercel settings.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start local server (Port 3000)
npm run dev

# Build production bundle
npm run build
```
