# Lead Rescue — app/

Zero-dependency static site: plain HTML/CSS/JS, no build step, no backend.
Deploys as-is to GitHub Pages (or any static host).

## Files

- `index.html` — landing page, demo, ROI calculator, offer, CTA
- `styles.css` — all styling, mobile-first, reduced-motion aware
- `app.js` — personalization, call simulation state machine, ROI calculator,
  speech synthesis (optional), copy-to-clipboard
- `404.html` — fallback page for GitHub Pages

## Personalization

Append query params to personalize the hero and CTA copy for a specific prospect:

```
index.html?business=SERVCON%20LLC&city=Stamford
```

`business` and `city` are read from the URL, trimmed, length-capped, and inserted
using `textContent` only (never `innerHTML`), so there is no HTML-injection risk.

## Local preview

From the repo root:

```
python3 -m http.server 8000 --directory app
```

Then open `http://localhost:8000/` (or with `?business=...` appended).

## Validation

```
node --check app/app.js
python3 scripts/check_site.py
python3 tests/site_smoke.py
```

## Notes

- The call simulation is clearly labeled as an interactive demo. It does not place
  a real call and does not require microphone access.
- Spoken agent lines use the browser's built-in `speechSynthesis` API when available;
  a mute control is always visible and defaults to on/off gracefully if unsupported.
- The ROI calculator produces an illustrative estimate only, with the assumption
  inputs shown next to the result — it is not a guaranteed outcome.
