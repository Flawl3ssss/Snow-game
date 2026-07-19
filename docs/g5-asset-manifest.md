# G5 complete model manifest

| ID                 | Model                   | Runtime construction                                                  |     Variants | Collision      | Status      |
| ------------------ | ----------------------- | --------------------------------------------------------------------- | -----------: | -------------- | ----------- |
| `chr_penguin`      | Penguin hero            | capsules, smooth shells, face, eyes, beak, feet, articulated flippers |            1 | sled proxy     | Implemented |
| `veh_sled`         | Crafted sled            | rounded slats, leather straps, curved metal runners, braces           |            1 | sled proxy     | Implemented |
| `prop_slingshot`   | Launch gate             | smooth wooden posts, caps, rope collars, elastic bands                |            1 | none           | Implemented |
| `ramp_snow`        | Snow ramp               | terrain-conforming groomed surface plus curved safety rails           |      2 sizes | shared terrain | Implemented |
| `pickup_snowflake` | Snowflake pickup        | six articulated rounded ice arms, branches, emissive core             |     animated | ground sweep   | Implemented |
| `pad_boost`        | Boost pad               | rounded metal base and six raised white chevron pieces                | 5 placements | ground sweep   | Implemented |
| `hazard_rock`      | Snow rock               | smooth high-detail stone shell plus snow cap                          |            3 | ground sweep   | Implemented |
| `env_fir`          | Snow-covered fir        | smooth overlapping needle masses, trunk and snow clump                |     4 scales | none           | Implemented |
| `env_mountain`     | Mountain backdrop       | 32-sided layered mountain and snow summit                             |     4 scales | none           | Implemented |
| `prop_sign`        | Direction sign          | rounded wooden board, pole, raised arrow                              |   left/right | none           | Implemented |
| `prop_fence`       | Safety fence            | smooth posts and two colored rails                                    |     repeated | none           | Implemented |
| `fx_shadow`        | Airborne contact shadow | soft projected blob                                                   |      dynamic | none           | Existing    |
| `fx_snow_wake`     | Runner snow wake        | pooled soft particles                                                 |      dynamic | none           | Existing    |

## Web budgets

- One shared instance geometry per tree layer; no unique tree meshes per placement.
- Course props reuse one material family and stable model roots.
- Hero stays procedural until the approved silhouette is converted into a rigged GLB.
- Texture payload remains zero for this pass; visual richness comes from geometry,
  lighting, material response, and animation rather than blurry generated textures.
- Future GLB replacements: Meshopt geometry compression, KTX2 textures, meter units,
  `+Y` up, `+Z` forward, applied transforms, explicit LOD and collision nodes.
