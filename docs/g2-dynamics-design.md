# G2 dynamics and retention slice

## Quality contract

- Fantasy: launch a sled, read the mountain, choose a line, and turn one clean run into a better next attempt.
- Primary verbs: aim and release, steer, route through pickups/boosts, avoid rocks.
- Session target: 20–35 seconds per run with a useful decision every 1–3 seconds.
- Replay reason: improve distance/score, complete the three-snowflake goal, buy a tangible launch or glide upgrade.
- Pillars: readable physics, continuous momentum, skill-rewarding routes.
- Non-goals for this slice: ads, artificial energy, loot boxes, daily streak pressure, large cosmetic catalog.

## Reference conclusions

- [Ski Safari](https://apps.apple.com/om/app/ski-safari-freeplay/id564672254) layers stunts, score multipliers, faster rides, and objectives over a simple downhill verb. We adopt short combos, airtime reward, boosts, and a run goal.
- [Hill Climb Racing](https://fingersoft.com/games/hill-climb-racing/) connects physics runs to coins, upgrades, further distance, and repeatable challenges. We adopt persistent currency and two transparent physics upgrades.
- [Jetpack Joyride](https://play.google.com/store/apps/details?id=com.halfbrick.jetpackjoyride) uses simple control with frequent obstacles, coins, power-ups, missions, and customization. We adopt a readable pickup/rock/boost cadence without adding monetization pressure.
- [Alto's Adventure Zen Mode](https://blog.builtbysnowman.com/post/145301948017/altos-adventure-zen-mode) demonstrates that the mountain and motion must remain enjoyable without reward UI. We keep the playfield dominant and use compact, transient feedback.

## Implemented loop

`read route → steer → collect/avoid/boost → receive combo/airtime feedback → finish → earn snowflakes → upgrade → relaunch`

## Course language

| Object         | Meaning                | Immediate consequence                  |
| -------------- | ---------------------- | -------------------------------------- |
| Cyan snowflake | route and combo target | +currency, +score, extends combo       |
| Gold boost pad | deliberate speed line  | +3.8 m/s, FOV pulse, score             |
| Dark rock      | line-reading failure   | speed loss, camera impact, combo reset |
| Orange ramp    | airtime opportunity    | ballistic jump and landing reward      |

## Economy baseline

- Run reward = collected snowflakes + `floor(distance / 55)` + 5 for the run goal.
- First goal = collect 3 snowflakes.
- Launch upgrade starts at 10 snowflakes and adds 0.75 m/s.
- Glide upgrade starts at 12 snowflakes and reduces snow resistance by 6%.
- Both upgrades cap at level 5 and have visible, increasing costs.

The first successful center run earns enough for one launch upgrade. Side routes can favor distance, while the central ramp route favors score and airtime.

## Acceptance checks

1. A neutral first run can collect three snowflakes and complete its goal.
2. A boost visibly and numerically increases speed.
3. A rock removes speed and resets the combo only once.
4. Airtime is rewarded only after a grounded landing.
5. Progress persists and corrupt storage falls back safely.
6. An upgrade changes the next run's simulation, not only its UI label.
7. HUD remains readable at 390×844 and desktop viewport sizes.
8. Reset starts a clean course while preserving the player bank and upgrades.
