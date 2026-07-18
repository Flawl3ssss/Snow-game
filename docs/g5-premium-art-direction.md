# G5 art direction — premium smooth stylized 3D

The low-poly direction is retired. The target is smooth, authored stylized 3D:
rounded subdivision-like silhouettes, restrained PBR response, soft bevels,
layered construction, and visible differences between feather, textile, wood,
metal, packed snow, ice, stone, and painted course equipment.

Concept target: [`concepts/premium-stylized-art-direction-v2.jpg`](concepts/premium-stylized-art-direction-v2.jpg).

## Non-negotiable rules

- No flat shading, visible six-sided cones, voxel forms, or single-primitive props.
- Hero and interactive objects receive the strongest silhouette and material detail.
- Background detail remains softer so pickups, hazards, boosts, and ramps win.
- Every gameplay object has a visual model and a separate simple collision rule.
- Curves use sufficient radial segments to stay smooth at the chase-camera size.
- Repeated scenery keeps shared geometry and materials even when visually richer.

## Material language

| Surface          | Treatment                                                         |
| ---------------- | ----------------------------------------------------------------- |
| Penguin feathers | deep navy, soft broad highlight, high roughness                   |
| Belly and face   | warm cream, softer diffuse response                               |
| Scarf            | coral textile impression, thick rounded profile                   |
| Sled wood        | turquoise painted wood, rounded edges, leather straps             |
| Runners          | cool polished metal with curved TubeGeometry profile              |
| Packed snow      | cool white, subtle clearcoat, soft blue edge shading              |
| Ice pickups      | translucent cyan, emissive core, articulated snowflake silhouette |
| Boost equipment  | gold metal base, luminous inset chevrons                          |
| Course trim      | warm coral-orange painted safety material                         |
| Rock             | smooth weathered slate with a separate snow cap                   |

## Shipping decision

Blender is not present in the current execution environment. This slice therefore
ships smooth parameterized models made from rounded, capsule, tube, and high-segment
geometry with production pivots and material reuse. They are real runtime models,
not grey placeholders. The later DCC pass can replace them one-for-one through GLB
without changing gameplay because model roots and collision rules are already split.
