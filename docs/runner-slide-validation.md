# Runner Slide validation

## Source and retarget

The supplied source is public/assets/characters/runner/Slide.fbx. The staging script searches asset-source/runner first and accepts this existing source location. The source remains unchanged.

The clip has 47 samples at 30 Hz, frames 1–47, spanning 1.533333 seconds. Its hierarchy matches all 65 canonical joints and parent links. The existing Idle normalization and F2B rest-relative rotation correction are reused. Maximum bake position error was 0.000005263 m, maximum quaternion dot error was 0.000000179, and maximum non-root local translation was 0.000001551 m.

Source pelvis travel is about 6.663 m forward, with a 0.721 m vertical excursion. Source travel stays in the appended GLB clip and is available in the animation playground. Runtime gameplay clones strip lateral and forward pelvis travel while preserving the measured canonical vertical articulation.

The append script checks target node rest transforms and hierarchy, remaps only Slide channels and appends their accessors and binary data. The original four animation objects, nodes, meshes, skins, materials, accessors, buffer views and original binary prefix remain unchanged. Hash assertions use docs/runner-slide-baseline.json. The resulting asset has exactly five clips.

## Collider envelope

The canonical skinned mesh is measured every 1/120 second. Each 30 Hz key uses the maximum height across its neighbouring measured intervals plus 0.01 m, clamped to 0.80–1.80 m. The first and last three keys retain standing height to cover short animation blends. Linear interpolation drives the deterministic 120 Hz collider. Runtime skin tests check the mesh against this envelope.

| Phase | Clip time |
|---|---|
| Standing blend envelope | 0.000–0.0667 s |
| Entry to minimum collider | 0.0667–0.4000 s |
| Minimum 0.80 m collider | 0.4000–0.7333 s |
| Recovery to full standing | 0.7333–1.4667 s |
| Standing exit envelope | 1.4667–1.5333 s |

For a 1.20 m duct, the collider fits from approximately 0.26418 to 0.91726 s. The 1.533333 s slide travels 6.90 m at 4.5 m/s. Slide plays once at speed 1 with 0.06 s entry and exit blends. Key release has no gameplay effect. Repeated activation, jumping, airborne activation and activation during protected Land recovery are rejected.

Collider heights change over fixed steps. Swept overlap uses the height at the interval's entry and exit, covering the linear height segment and the full 0.44 m horizontal footprint. A collision during recovery fails immediately without extending the crouch. The established 1.1 s failure delay remains.

## Route compatibility

The G2.2 duct at x=51.70–53.65 gives an activation interval of approximately x=49.742–50.291. Earliest full recovery is x=56.642, beyond that roof's supported edge and its x=55.75 jump marker. The interrupted G2.3 work therefore required a course adjustment before an entire run could succeed.

G2.4 authorizes the route redesign. Its duct spans x=81.00–82.60 at 1.20 m clearance, on a 27.15 m roof. The calculated activation interval is x=78.692–79.591, about 0.899 m or 200 ms before fixed-step and input sampling tolerance. A teal stripe at x=79.0 indicates the intended press. Full recovery occurs by x=86.491, leaving at least 7.009 m before the x=93.5 jump marker.

## Reproduction

Use Blender 5.2 with scripts/stage_runner_slide.py to stage Slide against the saved canonical rig. Its output includes slide-staged.glb and slide-report.json in asset-source/runner. The report includes the sampled skin bounds and generated collider envelope.

Run scripts/append_runner_slide.mjs with the original four-clip GLB, staged Slide GLB and an output GLB as its three positional arguments. It requires a four-clip input and validates compatibility before writing. Keep the original input separately for baseline comparison.

Run node scripts/validate-runner.mjs against the five-clip output, then npm test, npm run typecheck and npm run build. The browser animation check exercises all five clips on WebGPU and WebGL 2 before the gameplay browser check.
