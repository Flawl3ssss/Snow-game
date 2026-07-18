# Snow Sling

Production-oriented mobile 3D web game prototype based on the Snow Sling GDD.

## Current stage

`G0 — Foundation`: architecture, deterministic fixed-step loop, platform boundary, diagnostics, automated checks, and first browser-safe scene.

The visible rider and sled are temporary primitives. Gameplay tuning begins in `G1`; they are not production art.

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
- `src/render` — Three.js scene and camera
- `src/platform` — platform abstraction and local implementation
- `src/ui` — DOM HUD and state surfaces
- `src/diagnostics` — debug/performance probes

See [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md) for the development gates.
