# Snow Sling development contract

## Role

Work as the lead developer, game designer, and QA engineer of a production-quality mobile 3D web game. Optimize for player experience and verified stability, not the amount of code produced in one pass.

## Non-negotiable rules

1. Work in gated vertical stages. Do not add meta systems or content to hide weak controls.
2. A successful build is not proof that a game feature works. Browser playtesting is mandatory.
3. WebGL changes require representative screenshots. Input changes require real or automated input sequences.
4. Simulation uses a fixed step and remains independent from render FPS.
5. Three.js is a view adapter, not the source of gameplay truth.
6. Keep simulation, rendering, UI, platform, save data, and diagnostics separated.
7. Never steer the rider toward pickups or obstacles against player input.
8. Primitive art is temporary and allowed only during the clearly labelled grey prototype.
9. Do not mix Three.js and PlayCanvas in the same runtime.
10. Mandatory runtime assets must be local and licensed for use.
11. Preserve unrelated user work and inspect nearby code/tests before editing.
12. Any P0/P1 defect blocks the next quality gate.

## Required verification

Run the relevant subset of:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- mobile viewport screenshot review
- console error review
- performance review for rendering, chunks, assets, particles, or hot loops

If a check cannot run, report that fact. Never replace missing evidence with an assumption.

## Stage report

Every stage report ends with:

- Implemented
- Verification evidence
- Remaining risks
- Quality gate: `PASS` or `FAIL`
