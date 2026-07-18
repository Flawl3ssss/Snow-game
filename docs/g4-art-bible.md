# G4 art bible — Penguin Rush (superseded)

> This low-poly direction was rejected after visual review. The active art
> direction is [`g5-premium-art-direction.md`](g5-premium-art-direction.md).

## Direction

Snow Sling uses an original **soft stylized low-poly** look: broad readable
silhouettes, rounded hero shapes, faceted environment props, matte materials,
and restrained surface detail. The scene should feel playful and premium at
gameplay distance without depending on large textures or expensive shaders.

The playable character is a small emperor-penguin-inspired hero with a deep
navy body, warm ivory belly, coral beak and feet, and a short coral scarf. The
scarf is the character's identifying accent and secondary-motion element.

Concept target: [`concepts/penguin-art-direction-v1.jpg`](concepts/penguin-art-direction-v1.jpg).
The image is a direction target, not a texture or a promise of offline-rendered
detail. Runtime art keeps its composition, palette, silhouette hierarchy, and
route readability within a mobile WebGL budget.

## Research conclusions

- Alto's Adventure demonstrates that a snow game can feel rich through bold
  silhouettes, layered depth, changing atmosphere, and careful motion rather
  than dense geometry. Its art maker describes the target as a bold minimalist
  style with lighthearted charm: <https://www.harrynesbitt.com/blog/the-making-of-altos-adventure/>.
- Three.js recommends optimization around repeated objects and provides an
  `InstancedMesh` path for reducing draw calls: <https://threejs.org/manual/#en/optimize-lots-of-objects>.
- glTF remains the shipping contract for authored models. Future Blender assets
  must use stable pivots, normalized transforms, shared materials, and Meshopt
  or equivalent measured compression.

We borrow principles, not character designs or branded visual identity.

## Shape language

| Layer   | Shape rule                                         | Purpose                            |
| ------- | -------------------------------------------------- | ---------------------------------- |
| Penguin | round body, clear belly, short triangular flippers | friendly hero readable from behind |
| Sled    | four broad wooden slats over two dark runners      | direction and ground contact       |
| Track   | long calm snow masses with raised side banks       | route clarity                      |
| Ramp    | one continuous orange surface matching collision   | jump affordance                    |
| Pickup  | cyan crystalline star/snowflake                    | reward and route marker            |
| Boost   | gold plate with forward chevrons                   | immediate speed affordance         |
| Rock    | squat asymmetric slate mass                        | hazard silhouette                  |
| Trees   | three-tier faceted pines with snow caps            | depth without visual noise         |

## Palette

| Role           | Hex       |
| -------------- | --------- |
| Snow light     | `#EAF7FA` |
| Snow shadow    | `#B9DDEA` |
| Sky            | `#8ED8F2` |
| Penguin navy   | `#17324A` |
| Penguin ivory  | `#FFF1D6` |
| Coral accent   | `#FF765C` |
| Sled turquoise | `#20B6C9` |
| Ramp orange    | `#F59A3D` |
| Pickup cyan    | `#67E8F9` |
| Boost gold     | `#FFD04F` |
| Pine           | `#176B57` |
| Rock slate     | `#526B79` |

Gameplay meaning never depends on hue alone: pickups glow and rotate, boosts
are flat and chevron-shaped, hazards are raised irregular masses, and ramps
span the route vertically.

## Materials and lighting

- Matte materials dominate; roughness remains between `0.68` and `1.0`.
- Metalness is reserved for sled runners and tiny accents.
- Snow has cool vertex variation but no noisy photographic texture.
- One warm key light and one cool hemisphere fill create the palette split.
- Contact is communicated with the existing projected shadow and snow wake;
  expensive full-scene dynamic shadows stay out of the mobile slice.

## Animation language

- Idle: subtle breathing and scarf sway.
- Aim: body leans back against the band while flippers brace.
- Grounded ride: small speed-driven bob, steering lean, outside flipper balance.
- Airborne: both flippers open, feet lift, head follows steering input.
- Landing: existing squash is layered with a short body recovery.
- Reduced motion: secondary bob and scarf oscillation are removed; state poses
  remain so gameplay stays readable.

## Runtime budgets for this slice

- Hero and sled: under 8k visible triangles when replaced by a final GLB; the
  procedural version stays well below this.
- Repeated scenery: shared geometry/materials, then instancing before endless
  generation.
- Initial production asset payload target: under 4 MB compressed.
- Texture target: mostly color-only materials; authored textures at 1024px or
  below, KTX2/WebP only after measured validation.
- Pixel ratio remains capped at 1.75.
- Quality gate: 390×844 and desktop browser screenshots, no console errors,
  deterministic tests, and no regression in steering or ramp physics.

## Asset pipeline decision

The first character is procedural Three.js geometry because it is fast to
iterate, cheap to ship, and exposes every pivot needed for animation. It is not
a placeholder sphere: it is the approved runtime blockout. After its silhouette
and motion pass visual playtesting, it becomes the reference for a Blender GLB.
This prevents spending time rigging a model whose proportions are not yet proven
in the actual chase camera.
