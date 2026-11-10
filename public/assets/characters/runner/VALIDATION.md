# Runner validation — F2B.1, 2026-11-10

**Technical rig/animation prototype validated and exported. Not the final shadow-runner appearance or an in-place gameplay-ready asset.** Source travel and vertical arcs are preserved for this validation pass. The F2A in-place motion policy and runtime acceptance checklist remain unchanged.

## Delivered GLB

- `runner.glb`: 2,087,128 bytes (1.99 MiB); SHA-256 `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Blender 5.2.3 LTS (`e13b728c6880`); Khronos glTF Blender I/O v5.2.41. glTF 2.0 binary, Actions mode, forced 30 Hz sampling, exactly Idle, Run, Jump, Land, each independently starting at time zero.
- One skin, 65 joints, one glTF mesh / two source-material primitives. Three.js creates two skinned primitive objects sharing the same Skeleton; these are body and joint surfaces, not duplicate characters.
- 49,112 triangles; 24,746 authoring / 28,374 exported vertices after seam splitting. Two opaque materials, zero images/external resources/required decoder extensions/cameras/lights. The triangle count exceeds the F2A review threshold; no destructive decimation was performed.
- Maximum three nonzero weights per vertex. Weight-sum error <=4.47e-8; rest bind/inverse-bind identity matrix element error <=7.79e-7.

## Source inspection and compatibility

All four original FBXs exist and were preserved byte-for-byte:

| File | SHA-256 |
|---|---|
| Idle.fbx | `0fa5acd74d6f41833d9207923c14a4343e3a13e4d3ac76f8b8dfa2da189b9c5d` |
| Run.fbx | `52525a337ff955cf66ab3db8a743af6cedaa77146ac1f4c30305badb880f4ccd` |
| Jump.fbx | `ad9e4ecf256204a9e0a218297f3293b246f45ed64cad048f1f6e8b5eee9506bb` |
| Land.fbx | `c293ee55c795287968284629ab05cfff17d9f4d73b605b6cc463ec0a864a329a` |

- Identical 65-bone names and parent relationships. Hips is the sole root, with spine/head, left/right arms/fingers and legs/feet branches. No missing/extra bones or parent mismatches. Full hierarchy/rest matrices are retained in private intake JSON.
- Idle alone contains skinned geometry: Beta_Joints (10,514 vertices) and Beta_Surface (14,232), both bound to its armature. Run/Jump/Land contain one animation armature and no mesh. Idle provides the canonical skeleton and bind skin.
- Rest poses do NOT match. Hips rest translation differs by 1.554316 raw units / approximately 0.015543 m after object scale. Thumb rest axes differ; maximum parent-relative matrix element difference is approximately 0.018605 at RightHandThumb2. Thumb length differences are below approximately 0.000000546 m. Direct action reassignment was rejected.
- Imported armatures share stationary zero translation, positive uniform 0.01 scale and approximately +90-degree X conversion. Mesh and rig/bind transforms are normalized together, not independently zeroed.
- Both source mesh objects have local scale (1,1,1), inheriting the armature's world 0.01/+90-degree-X conversion. Their world translation is zero to approximately 1e-8 m numerical precision. These complete mesh/armature matrices are recorded in intake.json.
- All original actions are named Armature|mixamo.com|Layer0. Imported scene FPS is 30; frame spans/durations appear below. Each has 650 scalar curve slots. All 52 nonterminal joints have keyed rotations. The 13 unkeyed terminal rotation joints (HeadTop_End, ten finger *4 tips, two Toe_End joints) inherit parent/rest transforms. No unexpected paths or animated scale were found. Original download FPS/key-reduction settings remain unknown.
- Blender reports unsupported FBX Short custom properties and an unwritable extension cache; imports and checks complete without an extension installation.

## Mathematically defined rest correction

The source rest and evaluated pose matrices are expressed in a common normalized basis. Each target joint orientation is computed as:

```text
targetPoseRotation = sourcePoseRotation * inverse(sourceRestRotation) * targetRestRotation
```

Target heads are reconstructed recursively from canonical parent/rest offsets. Source non-root local translation deltas, all below 0.000001 m, are mapped between equivalent rest-parent axes. Hips preserves source translation relative to source rest. Blender's `Bone.convert_local_to_pose(..., invert=True)` converts these intended pose matrices to local keys while accounting for parent/rest matrices. Quaternion signs remain continuous and scale stays one. See the [official Bone API](https://docs.blender.org/api/current/bpy.types.Bone.html#bpy.types.Bone.convert_local_to_pose).

This bakes evaluated corrected poses instead of copying incompatible scalar curves or source inverse bind matrices. Both original mesh shells are joined with their canonical skin/vertex groups and source materials. Source rigs/actions do not enter the export. Maximum bake position error is 0.000002585 m (0.002585 mm); maximum quaternion dot error is approximately 3.58e-7. All output clips key the full canonical rig independently (195 vector/quaternion tracks each, including constant unit scale).

## Scale and axes

Neutral source height is 1.809234 m. One uniform factor, 0.994895993, normalizes geometry, rest joints and all poses to 1.800000 m. There is no per-clip resizing. GLB is +Y up, facing +Z; forward is verified from foot-to-toe vectors and Run travel. Negative scales are absent.

CharacterRoot is an unanimated identity container, at the neutral sole plane (Y approximately 2.26e-7 m) and horizontally between the feet. Rig/mesh object transforms are normalized consistently; hips remain anatomically above the sole origin.

## Clips and root motion

Values below are exported glTF metres: X lateral, +Y up, +Z forward. Object/container transforms are static, but Hips carries source locomotion and articulation. These are NOT in-place clips. No heading extraction, translation flattening, ballistic removal, trimming or loop/phase editing was performed.

| Clip | Source frames / seconds | Hips net XYZ (m) | Hips Y range (m) | Max Hips rotation from first pose |
|---|---|---|---:|---:|
| Idle | 1–79 / 2.600000 | (0.008710, -0.000459, -0.004355) | 0.026171 | 34.619 degrees |
| Run | 1–20 / 0.633333 | (~0, ~0, 3.729366) | 0.078562 | 18.436 degrees |
| Jump | 1–31 / 1.000000 | (~0, ~0, 4.157342) | 1.094443 | 41.149 degrees |
| Land | 1–32 / 1.033333 | (0.051343, -0.577567, 0.077499) | 0.930683 | 40.182 degrees |

Run's normalized source travel speed is approximately 5.889 m/s. Pelvic rotations include articulation, not an isolated heading curve. Repeating Run would reset forward root position. Jump includes baked travel/height; Land begins airborne and includes descent/recovery. Jump→Land→Idle phases are not an approved motion handoff. Future loop intent is repeat for Idle/Run and once for Jump/Land; glTF itself does not encode this project policy.

## Automated and sampled visual checks

- Installed Three r185 GLTFLoader loads the delivered GLB. Structural checks enforce names, skin/joint counts, embedded-only buffers, normalized weights, positive scale, opaque materials, neutral height and forward orientation.
- Each clip is independently activated in AnimationMixer, sampled at 60 Hz (320 total sample times), and every skinned vertex is checked for finite deformation. Bone scale stays one. This is CPU asset inspection, not R3F integration or a GPU benchmark.
- A fresh Blender scene reimports the GLB with one character mesh and one armature. Bidirectional nearest-surface differences from the canonical bake at five times per clip are: Idle 0.001266 mm, Run 0.003516 mm, Jump 0.004717 mm, Land 0.004032 mm. Importer-only custom bone-shape helper meshes are excluded.
- CPU Cycles pose sheets contain five front and five side poses for every clip (40 rendered poses). These were visually inspected; no major limb twisting, exploding joints or detached skin was observed in these sampled poses. Proportions and facing remain consistent, with source articulation preserved.
- Review snapshots are centered independently for comparison; this does NOT validate ground contacts or remove root motion from the GLB. Evidence: ignored test-results/runner/{idle,run,jump,land}-poses.png. Detailed intake, bake, loader and round-trip evidence stays in ignored asset-source/runner/.
- **Visual limits:** continuous normal/slow realtime playback, rear/oblique review, support-foot locking/sliding, ten-cycle seams, blend transitions and subjective gameplay-scale readability are not signed off. Sampled visual/numeric checks do not certify every frame or a finished motion edit.

## Outstanding runtime acceptance

1. In-place cleanup and Jump/Land phase selection, then contacts, heading, seams and transition review. The F2A motion policy remains unchanged.
2. Review/reduce the 49,112-triangle source or approve a measured budget exception before runtime integration. No silent topology edits.
3. This is the supplied temporary Mixamo Beta mannequin, NOT the final cinematic shadow runner. No new character design, clothing, silhouette material or rig redesign was authored.
4. Exact library titles/URLs, license evidence and redistribution/attribution fields remain unconfirmed in [ASSETS.md](../../ASSETS.md). The request authorized local conversion/output; no publication or legal rights confirmation is claimed.
5. Runtime loader, blending, WebGPU/WebGL skinning/performance and movement remain outside F2B.1. Website/media/audio/environment/gameplay code is unchanged.

## Reproduce locally

Blender executable: C:/Program Files/Blender Foundation/Blender 5.2/blender.exe (not on PATH).

```text
blender --background --python-exit-code 1 --python scripts/inspect_runner.py
node scripts/compare-runner.mjs
blender --background --python-exit-code 1 --python scripts/build_runner.py
node scripts/validate-runner.mjs
blender --background --python-exit-code 1 --python scripts/roundtrip_runner.py
```

For numeric round-trip checks without re-rendering, append `-- --check-only` to the final command. Build outputs are staged in asset-source/runner/runner-candidate.glb and runner-canonical.blend; source FBXs are never overwritten. After successful checks/review, copy the candidate to runner.glb and validate the delivered path:

```text
node scripts/validate-runner.mjs public/assets/characters/runner/runner.glb
```
