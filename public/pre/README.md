# personalised reading experience — landing page

A dark, minimal, CRED-inspired landing page for the Personalized Reading Experience research project.

## What this is

A single-page static site that introduces your tool, explains how it works in three steps, lists features and tech stack, and directs visitors to two places: the live app on Hugging Face Spaces, and your Google Form for the user study.

Designed for deploy to Netlify in under a minute.

## Files

```
index.html        the page
styles.css        all styles
script.js         scroll-reveal animations (minimal)
netlify.toml      deploy config (caching, security headers)
README.md         this file
```

## Deploy to Netlify (the fast way)

1. Go to https://app.netlify.com/drop
2. Drag the entire folder onto the drop zone
3. Done. You get a URL like `https://random-name-12345.netlify.app`
4. Optional: in Site Settings → Change site name, pick something cleaner like `pre-reader.netlify.app`

That's it. No build step, no framework, no nonsense.

## Deploy to Netlify (the slightly nicer way, via GitHub)

If you want auto-deploy when you push to GitHub:

1. Push these files to a GitHub repo
2. On Netlify, click "Add new site" → "Import an existing project"
3. Connect GitHub, pick the repo, accept defaults (no build command, publish directory `.`)
4. Every push to `main` redeploys automatically

## Before you deploy — three things to customize

Open `index.html` and edit:

### 1. The feedback form link
Find this line near the bottom (in the `cta` section):
```html
<a class="card-link card-link-accent" href="YOUR_GOOGLE_FORM_LINK_HERE" ...>
```
Replace `YOUR_GOOGLE_FORM_LINK_HERE` with your actual Google Form URL.

### 2. The app link (already set)
The Hugging Face Space link is already in place:
```html
<a class="card-link" href="https://huggingface.co/spaces/Peacein/personalized-reading-experience" ...>
```
If you redeploy under a new username or different space, update it.

### 3. Optional copy edits
- The hero headline is `the parts that matter. nothing else.` — change if you want a different angle.
- The manifesto paragraph is in the `.manifesto-text` section.
- The footer says "King Fahd University of Petroleum and Minerals" — keep or change.

## Custom domain (optional)

If you want `pre.yourdomain.com` or similar:

1. In Netlify → Domain Settings → Add custom domain
2. Either let Netlify register a new domain (paid), or point DNS from a domain you own
3. Netlify provisions HTTPS automatically via Let's Encrypt

If you grabbed a free domain via the GitHub Student Pack (Name.com / Namecheap), use that.

## Design notes (for future you)

- **Colors** are CSS variables at the top of `styles.css`. Change `--accent` to recolor the hover and accent card. `--bg` is the page background.
- **Fonts** are Geist (body) and Instrument Serif (italic flourishes), both from Google Fonts. To change, edit the `<link>` in `index.html` head and the `--font-sans` / `--font-serif` variables in CSS.
- **Animations** are intersection-observer triggered. Anything with the `.reveal` class fades up when it enters the viewport. To disable for accessibility, the `prefers-reduced-motion` media query already handles that.
- **Mobile** — the layout collapses cleanly at 640px. Test on your phone before sending the link to participants.

## What's intentionally not here

- No build tool. No npm. No React. This is a static three-file site because that's what the project needs right now.
- No analytics. Add Plausible or Fathom if you want session counts; do not add Google Analytics on a research-study landing page without disclosing it.
- No backend. The feedback form lives on Google Forms; this page just links there.

## Troubleshooting

**Fonts not loading?** Make sure the `<link>` in the head isn't being blocked by an extension. They're served from Google Fonts CDN.

**Animations look janky?** Check that `script.js` is loading — open browser dev tools, look at the Network tab. The file should return 200.

**The form link card 404s?** You forgot to replace `YOUR_GOOGLE_FORM_LINK_HERE` in `index.html`.

**Netlify deploy fails?** Don't include `netlify.toml` until you know your build works without it. Worst case, delete it — this site needs zero build configuration.
