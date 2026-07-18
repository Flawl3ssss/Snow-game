# Quality gates

## G0 — Foundation

- clean install, typecheck, unit tests and production build pass;
- first scene opens without console errors;
- portrait resize and visibility pause work;
- Playwright can exercise the first action and capture a screenshot;
- the diagnostics overlay exposes state, frame rate and fixed-step metrics.

## G1 — Grey movement prototype

- launch, steering and stopping are enjoyable for repeated runs;
- input never turns toward an object against the gesture;
- the same input tape produces the same simulation result at different render FPS;
- the launch is understandable without a text tutorial;
- meta, advertising and production art remain blocked until this gate passes.

## Later gates

The implementation order is fixed: camera/game feel, endless chunks, gameplay patterns, visual slice, economy/save, UI, audio, content, Yandex Games, optimization, release candidate.

P0/P1 defects block progression. Every gate needs build/test evidence plus an actual browser playtest.
