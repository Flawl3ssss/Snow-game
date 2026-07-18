# Snow Sling

Production-oriented mobile 3D web game prototype based on the Snow Sling GDD.

## Current stage

`G1 — Movement prototype`: pull/aim/release launch, deterministic sled movement, direct steering, natural speed decay, stable stop, and results loop.

The visible rider, sled, slingshot, and environment are temporary primitives. G1 validates control feel and physics before production art or economy work.

## Commands

```bash
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright requires Chromium. Install it once with:

```bash
npx playwright install chromium
```

## Architecture

- `src/app` — application lifecycle and state machine
- `src/simulation` — renderer-independent fixed-step state
- `src/input` — pointer and keyboard gesture translation
- `src/render` — Three.js scene and camera
- `src/platform` — platform abstraction and local implementation
- `src/ui` — DOM HUD and state surfaces
- `src/diagnostics` — debug/performance probes

See [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md) for the development gates.
