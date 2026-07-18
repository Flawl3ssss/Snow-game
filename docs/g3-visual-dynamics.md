# G3 visual dynamics

## Design goal

Make speed, contact, flight, and impact readable before the player looks at the HUD. Effects must reinforce the sled physics instead of covering the course.

## Visual language

| Physics or event | Visual response                                                | Player reads               |
| ---------------- | -------------------------------------------------------------- | -------------------------- |
| Low speed        | calm frame, no wind lines                                      | safe and precise movement  |
| High speed       | progressive world-space wind streaks, wider FOV, edge vignette | momentum and risk          |
| Ground contact   | pooled snow spray behind both runners                          | traction and surface speed |
| Airborne         | spray stops; projected shadow grows and fades                  | height and landing timing  |
| Landing          | white particle burst and brief rider squash                    | weight and impact          |
| Snowflake        | cyan radial particle burst                                     | successful collection      |
| Boost            | gold burst, sled glow, FOV pulse                               | immediate acceleration     |
| Rock             | grey burst and short camera shake                              | momentum loss              |

## Technical budget

- 44 recycled line segments for wind.
- 84 recycled snow particles and 60 recycled event particles.
- One transparent projected contact shadow.
- No per-frame geometry creation, post-processing chain, full-screen blur, or runtime texture loading.
- Effects are deterministic and expose a text snapshot for automated checks.
- Reduced-motion mode disables wind, shake, dynamic FOV, and the screen-speed vignette while retaining state-readable shadow and event feedback.

## Acceptance checks

1. Wind remains absent at 11 m/s and reaches full strength at 27 m/s.
2. Ground spray is emitted only while riding, grounded, and moving.
3. Airborne sleds retain a readable ground shadow while spray stops.
4. Pickups, boosts, rocks, and landings use distinct burst colors/intensities.
5. A high-speed browser run reports non-zero wind, spray, and event particles.
6. Typecheck, lint, unit tests, production build, and desktop/mobile browser tests pass.
