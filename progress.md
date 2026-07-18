Original prompt: создать качественную мобильную 3D web-игру по приложенному референсу, следуя полному ТЗ и производственному плану; результат должен быть профессиональным, а не сделанным «тяп-ляп».

## Current stage

G3 — visual dynamics and speed readability.

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
- Direct-aim correction: slingshot input now maps finger-left to launch-left and finger-right to launch-right without inversion; aim magnitude remains linear. Snow resistance was increased modestly to shorten the run while preserving gradual deceleration.
- Terrain physics overhaul: the rendered snow and deterministic simulation now share one height field with rolling downhill sections, climbs, crests, and two localized ramps.
- Slope dynamics use gravity projected along the surface. Measured regression points confirm acceleration from z=2 m to z=10 m and a speed loss greater than 1 m/s while climbing from z=58 m to z=65 m.
- Airborne dynamics are ballistic: ramp curvature can break ground contact, gravity produces rising and falling phases, air drag preserves momentum, and landing compares the flight velocity with the surface tangent to apply an impact-dependent speed loss.
- Rider pitch/roll and follow-camera height now use simulation state. Orange ramp surfaces expose intentional jump lines, while off-center routes retain ordinary rolling terrain.
- Physics coverage is now 10 focused sled tests (19 unit tests total), including no-underground penetration, uphill/downhill response, takeoff, apex, landing, and impact. A browser regression captures the airborne phase on desktop and mobile CI.
- Local typecheck, lint, formatting, all 19 unit tests, and production build pass. Local Playwright remains blocked only by the missing Chromium executable; CI is the browser verification environment.
- Slingshot screen-space correction: aiming now uses the same camera-relative horizontal conversion as riding. A finger pull to screen-left retracts and launches visually left; screen-right remains right, despite the follow camera's world-X projection being mirrored.
- Slingshot release correction: visual pull displacement and launch impulse now have separate conversions. Pulling to either visible side keeps the sled on that side after release instead of reusing the pull-space sign for flight.
- A structured 20-scenario physics playtest suite now covers launch power/angles, mirrored trajectories, steering/release/zigzag, slope acceleration, ramp slowdown, both jumps, low-speed contact, bypass routes, track edges, penetration, landing loss, and stable stopping.
- Playtesting found and fixed repeated edge-contact drag: forward speed is penalized only when crossing the boundary, not every frame while resting on it. A 12-second outward hold now reaches about 190 m at 6.6 m/s instead of stopping around 101 m.
- Playtesting also removed a 0.17-second near-zero micro-hop on the second ramp by requiring at least 1 m/s upward takeoff velocity. Low-power center runs now produce one readable jump; maximum power still clears both jump lines.
- Current measured balance: low-power center stops near 188 m, maximum center near 201 m, and a maximum-power off-center bypass near 267 m. The bypass advantage is retained as a plausible risk/reward consequence of avoiding landing impacts.
- G2 dynamics vertical slice added after reference analysis of Ski Safari, Hill Climb Racing, Alto's Adventure, and Jetpack Joyride. The target rhythm is a route decision every 1–3 seconds, a 20–35 second run goal, and a real post-run purchase.
- Deterministic course objects now include 15 cyan snowflake pickups, five gold boost lines, and four dark rock hazards. Pickups extend a timed combo, boosts add 3.8 m/s, rocks reduce momentum and reset the combo, and landed airtime awards score.
- Dynamic feedback now includes score/coin/mission HUD, transient event callouts, combo badge, speed-sensitive camera FOV, boost pulse, collision shake, animated collectibles, and synthesized launch/pickup/boost/impact/landing/result/upgrade sounds.
- Versioned local progression persists coins, records, run count, and two five-level upgrades. Launch adds 0.75 m/s per level; glide reduces snow resistance by 6% per level. Corrupt or unavailable storage falls back without blocking play.
- Economy balance makes the first successful central run complete a three-snowflake goal and earn enough for the first 10-coin launch upgrade. Side boost routes favor distance; central ramps favor score and airtime.
- Verification expanded to 49 unit/integration tests before browser CI. The professional browser-game preflight passes all 14 applicable gates with no warnings or failures.
- G3 adds physics-driven visual feedback: progressive world-space wind streaks, grounded snow spray, airborne contact shadow, landing squash/burst, event-colored particles, boost sled glow, and a CSS speed vignette.
- All effect pools are fixed and recycled (44 wind segments, 84 spray particles, 60 event particles). No per-frame mesh creation or post-processing pass was introduced.
- Visual effect state is now part of `render_game_to_text`, allowing browser tests to verify that high-speed motion, snow contact, and event feedback are active rather than relying only on screenshots.
- Ramp reliability fix: both ramp lips now use swept path detection, so a boosted sled cannot step over the takeoff zone between physics frames. Boosted center and ±5 m approach lines are covered at a deliberately coarse 50 ms simulation step.
- Ground steering is sharper through faster input response, stronger lateral acceleration, and slightly higher high-speed traction. Direction reversal now becomes meaningful within roughly 0.6 seconds without changing the direct-input convention.
- Air steering now applies limited lateral acceleration and a restrained visual roll. It is intentionally weaker than snow steering but can alter the landing line during a normal jump.
- G3.1 VFX readability pass replaces low-contrast one-pixel wind with 58 instanced cyan streaks, increases snow/event pools to 128/112 soft textured particles, hides expired particles correctly, and adds six pooled expanding event rings.
- Speed feedback now starts at 9.5 m/s, reaches full intensity at 25 m/s, uses animated edge streams with a clear center, expands FOV by up to 10 degrees, and gives boosts a longer emissive pulse plus local gold light.
- Ramp edge root cause fixed: a landing immediately before the next lip no longer lets the generic 0.22 s anti-bounce cooldown suppress a real ramp. Each explicit ramp zone is consumed once, preventing both missed takeoffs and duplicate hops.
- Physical and orange marker ramp width now match at ±6.4 m. Boosted lines at x = ±6.2, ±5, and center are regression-tested with 50 ms physics steps.
