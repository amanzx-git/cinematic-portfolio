# Character asset contract — F2A, version 1

Status: preparation complete; no character or animation has been supplied or approved. This contract defines the F2B handoff, not a loader or gameplay implementation. See [ASSET_WORKFLOW.md](./ASSET_WORKFLOW.md) for production steps.

## Scene integration conventions

These are project choices based on the current scene, not a demand to change the environment.

| Property | Contract |
|---|---|
| Units | Adopt 1 scene unit = 1 metre for character production. Existing rooftop is 28 units long and 3.4 units deep. |
| World axes | +X screen-right/run direction; +Y up; +Z toward the camera. Environment lies at negative Z. |
| Asset axes | Export GLB +Y up, character facing local +Z, right-handed. No negative scale. |
| Preview heading | Rotate the asset container +90 degrees around world Y to face +X; -90 degrees faces -X. Do not mirror with scale -1. |
| Height | Neutral standing sole-to-crown height 1.80 m; 1.70–1.90 m is acceptable if documented. Export at final size; runtime scale is [1,1,1]. |
| Local origin | [0,0,0] on the ground between the soles in the neutral standing pose, not at the hips. |
| Initial preview placement | Asset container position [0,0.12,0], with the heading above. This is a future preview convention, not code added in F2A. |
| Ground evidence | `Rooftop.tsx`: slab center Y=0, height 0.22 gives Y=0.11. Coping joints reach Y=0.119. Sole Y=0.12 clears both. |
| Clear corridor | Z=-1.7 to +1.7, centered on Z=0. Service equipment is behind it; facade detail is below it. Keep animated lateral body width inside this corridor. |
| Camera | Existing orthographic position [0,5,30], look-at [0,2,0], zoom=min(width/34,height/18). Preserve it for initial character review. |

Check scale from the exported neutral standing pose, not an arm-spread bounding box or a crouched animation. No automatic per-clip rescaling or recentering: it would cause pops. Narrow viewports make the character smaller because framing retains the rooftop width; verify readability in F2B rather than altering the camera during F2A.

## Required runtime file and rig

Deliver **`public/assets/characters/runner/runner.glb`**, glTF 2.0 binary, containing the skinned model, one canonical skeleton, embedded images if needed, and exactly four named animations: **`Idle`, `Run`, `Jump`, `Land`**. Separate animation GLBs/FBXs are not runtime inputs under this contract. FBX files are authoring sources only. A single packed file avoids runtime skeleton remapping and duplicate model downloads.

- One unanimated top-level node named `CharacterRoot`, at the sole origin with identity TRS in exported GLB coordinates. One armature/skin and preferably one skinned mesh. The hips remain anatomically above the origin; do not move the pelvis to ground level.
- Keep one canonical rest pose (A or T pose, recorded in the manifest), joint names, parent relationships, proportions and inverse bind matrices for all clips. Use unique node/joint names. Preserve Mixamo names after mapping; arbitrary bone names are acceptable when the four clips actually bind to this same rig. Do not rename joints independently per action.
- Include pelvis/spine/chest/neck/head, upper/lower arms/hands and upper/lower legs/feet. Toe joints are useful for contacts; fingers are optional. A separate ground root bone is optional and must be recorded. `CharacterRoot` is an asset container, not a request to replace the pelvis with a new bone.
- Normalize skin weights; at most four influences per vertex. No animated object/bone scale, negative scale, unbaked constraints, runtime IK, cloth simulation or required morph animation. Keep static axis-conversion transforms if needed by the exporter, identically across all clips; do not zero joint rest rotations.
- Simple opaque glTF-compatible materials; silhouette must read without detailed textures, emission or transparency. Embed optional PNG/JPEG images. No required Draco, Meshopt or KTX2 decoder, custom material extension, external URI, camera or light in the initial handoff. Those would require a separate loader/setup decision.

The installed Three r185 GLTFLoader already supports skins and animations; no new loader dependency is needed for this proposed format. Actual skinned-material/backend behavior remains an F2B verification task. No loader, mixer or character component is created here.

## Animation contract

All clips target the same exported skeleton, start at time 0, have nonzero duration and are baked at 30 samples/second initially. Durations below are selection guidelines, not reasons to retime good motion blindly. glTF does not encode our loop policy; F2B will configure playback explicitly.

| Exact clip name | Playback intent | Suggested duration | Required motion |
|---|---|---|---|
| `Idle` | Seamless repeating cycle | 2–5 s | Quiet breathing/weight shift, readable side pose, planted support feet with no unintended sliding or sinking. |
| `Run` | Seamless repeating cycle | 0.6–1.2 s | One complete left/right gait cycle, consistent cadence, in-place locomotion. Record nominal source travel speed in m/s or mark it unknown. |
| `Jump` | Once, hold last pose for preview if needed | 0.5–1.2 s | Anticipation, takeoff and airborne pose through a pre-contact end pose. Exclude a second full landing/recovery already provided by `Land`. |
| `Land` | Once, settle toward Idle | 0.2–0.7 s | Starts at contact/compression, absorbs impact, returns to an idle-compatible stance. No step forward, roll or locomotion unless separately approved. |

Match Jump's final pose to Land's start and Land's final pose to Idle. Name matching alone is insufficient: inspect pose continuity and transitions. Record clip lengths, loop intent, sample rate, source selection and any trim/resampling in the manifest. Do not export a duplicate `mixamo.com` action, `.001` name, bind-pose clip or all animations merged into one track.

## Root motion and compatibility verification

Policy: **in-place clips; no authored world displacement or facing changes**. Future code can own world X/Y movement, but none is implemented now. The asset container and armature object remain stationary for every clip. Remove the source's horizontal travel, turns and whole-body jump trajectory in Blender. Preserve local pelvic bob, breathing, limb articulation and landing compression. Zeroing every Hips translation key is not an acceptable root-motion fix.

Mixamo can encode travel on Hips rather than a ground root. Inspect `CharacterRoot`, armature object, any root joint AND pelvis curves. For cycles, net horizontal pelvis offset from first to last pose should be below 0.01 m, without accumulating drift over ten loops; small periodic sway is allowed. A stationary container alone does not prove in-place motion. For Jump, inspect sole/hip paths to distinguish articulated pose changes from an entire body following a baked ballistic arc; remove the latter so future movement is not applied twice. If travel cannot be separated cleanly, deliver the source for correction rather than silently changing the policy.

In Blender, compare source and target bone names, parents, rest orientations, proportions and bind/rest pose. Similar names alone do not prove compatibility. Apply actions directly only when these match; otherwise map and retarget onto the canonical armature, bake evaluated pose transforms, and remove source rigs/helpers from the export. Do not transplant source inverse bind matrices onto the target skin.

Re-import the final GLB into a fresh scene and play every clip at normal and slow speed. Check shoulders, wrists, hips, knees and ankles for bad deformation, twisted limbs or missing tracks. Inspect both sides and orthographic side view. For Idle, check support-foot drift against a ground grid (roughly <=0.01 m unintended movement). For Run, backwards foot travel during stance is normal in-place motion; an offline translating preview at the documented travel speed can assess gait matching, without baking that translation into the runtime file or adding game movement. Check ten-cycle seams and short transition previews; do not judge only still frames. Record whether each check passed, failed or was not checked.

## Initial performance budget

These are project intake targets, not measured frame-rate guarantees or automatic rejection caps. Inspect deformation first; budget exceptions require an explicit review before F2B instead of destructive decimation or bone deletion.

| Resource | Preferred target | Review threshold / notes |
|---|---|---|
| Geometry | 5k–15k evaluated triangles, one visible skinned mesh | Above 20k triangles; count exported triangulation, not Blender quads. |
| Skeleton | About 50–70 exported joints including fingers | Above 80 total joints; count helpers if exported. Preserve needed deformation. |
| Skinning | <=4 normalized influences per vertex | Report zero-weight vertices, invalid weights or unsupported influence sets. |
| Materials / draws | 1 opaque material / primitive | Above 2 visible primitives/draws, even if they reuse a material. |
| Textures | None for silhouette, or one 1024² base-color atlas | Max 2 images at <=1024² initially; optional detail must justify cost. No runtime texture decoder needed. |
| Decoded texture memory | <=12 MiB including mipmaps, conservatively RGBA8 | One 1024² RGBA8 image is ~5.33 MiB with mipmaps; compressed download size is not GPU memory. |
| Complete GLB | Aim <=3 MiB with all four animations | Above 5 MiB: inspect animation tracks/images and discuss before integration. |

F1.1 still has unresolved frame-time variance. F2B must compare environment-only versus character-enabled rendering on WebGPU and WebGL 2, including Low DPR; this contract does not promise 60 FPS. Keep original authoring files before reducing geometry, bones, sampling or texture resolution.

## Asset acceptance checklist

- [ ] User selected/approved the character and four animation sources; provenance and delivery rights are recorded separately for each, including textures.
- [ ] `runner.glb` re-imports with its skinned model and exactly `Idle`, `Run`, `Jump`, `Land`; no missing external resources or required decoder extensions.
- [ ] Measured height, +Y up / +Z forward, sole origin, container transforms and rest pose satisfy this contract.
- [ ] One canonical rig; joint bindings, weights and all four animations were checked on the final exported mesh.
- [ ] Root-motion checks passed on container, armature, root and hips; no accumulated travel, turning or baked jump arc. Local body bob retained.
- [ ] Idle support contacts, Run loop, Jump-to-Land and Land-to-Idle continuity checked after export; no broken skinning or unintended foot sliding.
- [ ] Triangle/joint/material/image counts and file/texture-memory estimates recorded; exceptions identified for review.
- [ ] Source URLs, creators, licenses/terms evidence, attribution, modifications and export settings filled in `public/assets/ASSETS.md`.
- [ ] Validation evidence written in `public/assets/characters/runner/VALIDATION.md`, including Blender/exporter version, clip durations and any unchecked items.
- [ ] F2B separately authorized. Actual browser silhouette, blending and backend validation are pending F2B, not claimed complete here.

## Exact handoff before F2B

1. `public/assets/characters/runner/runner.glb` — the model, skin, rig and all four clips above, packed together. **No separate runtime animation files are required.**
2. Complete the existing `public/assets/ASSETS.md` template with the model/texture and four animation provenances, rights evidence and required attribution. Supply any required license/notice files through the permitted delivery channel; link their locations in the manifest.
3. Complete `public/assets/characters/runner/VALIDATION.md` with the exported-asset checks and counts. Unchecked manual items remain outstanding, not implicitly passed.

If you cannot prepare the GLB yet, provide privately for further asset preparation: `model/runner.fbx` (mesh + skin + canonical rig in neutral pose), `animations/idle.fbx`, `animations/run.fbx`, `animations/jump.fbx`, `animations/land.fbx` (same selected rig, without duplicate mesh), all referenced texture images, and `runner.blend` if retargeting/cleanup was performed. These are source inputs to finish preparation, **not** a substitute for the validated runtime GLB or permission to start F2B. Keep source files in `asset-source/runner/` or another approved private location, never the Vite public directory by default.
