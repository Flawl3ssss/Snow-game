Original prompt: создать качественную мобильную 3D web-игру по приложенному референсу, следуя полному ТЗ и производственному плану; результат должен быть профессиональным, а не сделанным «тяп-ляп».

## Current stage

G1 — grey movement prototype.

## Completed

- G0 merged to `main` in PR #1.
- Vite/TypeScript/Three.js foundation, fixed-step loop, state machine and CI are active.
- G0 mobile/desktop Playwright screenshots were reviewed.
- Deterministic sled simulation and five physics/control unit tests implemented.
- Pointer slingshot, relative drag/keyboard steering, follow camera, results/reset loop, and test hooks integrated.

## G1 goals

- deterministic surface-following sled simulation;
- pull/aim/release slingshot gesture;
- relative drag steering with no target attraction;
- natural speed decay and stable stop;
- `render_game_to_text` and deterministic `advanceTime` hooks;
- browser input bursts and screenshot review.

## Current limitations

- all rider/environment geometry is temporary grey-prototype art;
- local environment cannot download Playwright Chromium, so browser evidence runs in GitHub Actions;
- headless software-WebGL FPS is not a real-device performance measurement.

## Next verification

- Run format, lint, typecheck, unit tests, and production build.
- Run browser action client where Chromium is available; inspect BASE, RIDING, left-steer, and RESULTS screenshots.
- Tune only after observed control evidence; do not add economy before G1 feel checkpoint.

## Verification notes

- Local lint, TypeScript, 12 unit tests, and production build pass.
- The required browser action client was invoked, but this sandbox has no Playwright Chromium executable. GitHub Actions remains the browser evidence environment.
- First CI browser pass succeeded, but manual screenshot review caught camera lag clipping the rider on mobile and an intrusive debug overlay. Camera snapping for deterministic time jumps and opt-in `?debug` diagnostics were added; evidence must be regenerated.
- Second evidence review showed the cinematic lateral camera offset could still place the rider outside a narrow mobile frame at the track boundary. G1 now centers the camera on the rider; evidence must be regenerated once more.
- GitHub Pages deployment workflow added for a one-click playable build. It publishes both the current G1 branch and future `main` updates using the `/Snow-game/` asset base path.
- Control-feel fix: mobile drag steering is inverted into the requested camera-relative direction while keyboard controls stay conventional. Edge steering now fades over the final 2.25 m and clamps without velocity reversal, removing high-speed boundary chatter.
- Slingshot fix: horizontal aiming now uses the same corrected camera-relative direction as riding drag input, with separate unit and browser regression coverage.
- Launch trajectory fix: neutral input no longer erases the initial lateral launch velocity with active-steering response. Left, center, and right launches now remain visibly separated while neutral snow drag gradually straightens the sled.
