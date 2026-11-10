# Character and Asset Production — Manual vs AI vs Codex

## Recommendation
F2A now defines the [character asset contract](./CHARACTER_ASSET_CONTRACT.md), a runtime folder at `public/assets/characters/runner/`, and an ignored authoring staging area at `asset-source/runner/`. The following F2A procedure is the current preparation handoff; it does not authorize F2B implementation.

For F0–F1, **no character work is needed**. Let Codex prove the environment and performance first. For F2, use a licensed rigged humanoid with matching animation clips. You do not need to rig manually unless auto-rigging or retargeting fails.

## Responsibilities
**You:** choose visual references; check license terms; download/export approved assets; test the browser build; approve visual quality.
**Codex:** implement asset loading, materials, animation mixing, camera, input, optimization tools, and documentation; can generate procedural backgrounds and simple hard-surface environment geometry.
**AI 3D tools:** can generate a starting mesh, but often need cleanup; don't assume topology, UVs, skin weights or animation quality are production-ready.
**Blender / auto-rigging:** inspect geometry, correct transforms, rig or retarget clips, clean animation, export glTF/GLB. Codex can write Blender Python scripts if Blender is installed, but visual verification is still necessary.

## Lowest-risk F2 route
1. Find a **rigged humanoid** from a reputable asset library with terms allowing use on a public portfolio website; keep license and attribution details.
2. Get idle, running, jumping and landing animations compatible with that rig (e.g., a reputable animation library). Check redistribution/embedding terms.
3. Open in Blender if necessary; check facing direction, skeleton, mesh weights, root motion, feet, and scale.
4. Retarget clips if skeletons differ. Keep a consistent root bone and decide whether to bake/remove root motion for code-driven movement.
5. Export a compact `.glb` with animations. Verify the exported GLB in a standalone viewer before handing it to Codex.
6. Apply a silhouette material in R3F and inspect at actual gameplay scale. If anatomy/pose is unreadable, improve animation or silhouette rather than adding polygons.
7. Record provenance in `public/assets/ASSETS.md`.

## If you want a custom AI-generated character later
### Concept-image prompt
"Full-body side-profile concept sheet of a stylized athletic office worker parkour runner, realistic human proportions, clean readable silhouette, shirt with loosened tie, tailored trousers and practical shoes, strong dynamic posing, neutral studio background, front side back orthographic views, consistent clothing and anatomy, no text, no logos, game-ready design reference, restrained cinematic art direction."

### 3D generation prompt
"Create a single full-body humanoid office-worker character suitable for third-person/side-view parkour. Neutral A-pose, symmetrical limbs, separate readable silhouette, clean topology around shoulders elbows hips and knees, no props fused to hands, minimal clothing details, animation-ready proportions, export FBX or GLB for Blender cleanup. Avoid elaborate hair and accessories."

**Important:** Image-to-3D results may not have reliable topology or a working skeleton. An AI image is only a concept, not a game-ready rigged asset.

### Blender cleanup checklist
- Set consistent units and apply transforms.
- Remove loose/non-manifold geometry and unnecessary hidden surfaces.
- Check bone hierarchy, weights and deformation at joints.
- Check feet on ground, facing direction, and origin placement.
- Retarget and test idle, run, jump, land; check foot sliding and clipping.
- Reduce materials/textures and mesh complexity conservatively.
- Export GLB and test all animation clips after export.

## Performance targets — initial guidelines, not hard caps
Aim for a single character mesh with modest triangle count, a small skeleton, one or very few materials, and compressed textures or no detailed textures for silhouette rendering. Start by measuring rather than imposing arbitrary polygon numbers. A low-poly mesh with 70 bones and many draw calls can still be costly; a somewhat denser mesh with clean animation may be preferable.

## Licensing
Do not scrape proprietary game characters, extract assets from Vector/Swordigo, or assume AI outputs or free downloads are license-free. Keep source URLs, creator, license, attribution requirements, and whether redistribution within a public repo is permitted. If an asset license disallows source redistribution, don't commit it publicly; use an approved alternative or an appropriate asset delivery workflow.

## Alternative for F2 if assets are difficult
Use an openly licensed sample rigged humanoid to validate animation mechanics, then replace it with an approved custom silhouette later. Avoid spending weeks on custom rigging before we know the game feel works.

## F2A — Recommended Mixamo preparation

1. Choose the humanoid and review the applicable model, texture and animation terms yourself. Record source URLs, creators, attribution and intended public-web/repository delivery in `public/assets/ASSETS.md`. No asset is selected by this document. Consult [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html); it is not a substitute for checking the terms for your exact files and distribution route.
2. Use one selected/rigged character throughout the downloads. Adobe documents uploading and mapping a rigged FBX through its [rigging workflow](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html). Keep a local canonical rig rather than relying on the service to retain earlier selections.
3. Recommended download settings, where offered: FBX Binary, **With Skin** for the neutral T/A-pose model; **Without Skin** for each additional animation. Select 30 FPS and no keyframe reduction initially. Save originals before any cleanup. These are workflow recommendations; available labels/options can vary.
4. Preview idle, run, jump and landing on that same selected character. Choose ordinary forward running and a compatible jump/landing pair, without a turn, roll or traversal prop. Use **In Place** for Run where available; do not assume it removes all travel from every clip. Record speed/stride/trim settings and the exact library clip titles. Missing in-place options require Blender cleanup.
5. Save `model/runner.fbx` and `animations/{idle,run,jump,land}.fbx` plus actual referenced images in `asset-source/runner/` or another approved private location. The animation-only files still contain a skeleton and need compatibility checking. No download, upload or license acceptance has been performed by Codex.

## F2A — Blender normalization and retargeting

1. Work on copies. Record Blender/exporter versions. Import the canonical model and measure sole-to-crown height. Adopt metres, 1.80 m nominal height, a sole-centered asset origin and the contract's export axes. Normalize before combining actions; changing an animated/skinned rig's transforms blindly can break its bind pose. Verify skin deformation after each correction.
2. Import one source clip at a time into a temporary collection. Compare hierarchy, rest pose, bone axes and proportions with the canonical skeleton. Direct action reassignment is only appropriate when these agree. Otherwise map and retarget onto the canonical rig, correct pose offsets, then bake the evaluated animation. Do not leave constraints/IK or a duplicate source armature as a runtime dependency. No paid retargeting add-on is assumed or required by this task.
3. Remove locomotion translation/heading and full-body jump travel as described in the contract. Preserve articulated pelvis motion. Confirm every action on the same canonical mesh, not merely its source skeleton. Keep the original moving clips for reference; record nominal Run travel speed before making it in-place where available.
4. Name the four final actions exactly `Idle`, `Run`, `Jump`, `Land`. Give each its own range starting at zero, bake at 30 samples/second, and inspect feet, gait cycles and the Jump-to-Land-to-Idle pose sequence. Retain only the intended four clips in the export. Keep the cleaned `.blend` outside public assets.

## F2A — GLB export and round trip

Select the canonical mesh, armature and sole-origin container. Export glTF 2.0 Binary (`.glb`), with skinning, animations and +Y Up; embed optional PNG/JPEG images. Bake procedural materials to supported inputs or simplify them. Leave cameras, lights and compression requiring runtime decoders out of this initial handoff.

Use Actions mode with each action active/stashed on the rig, or NLA Tracks mode with one correctly named clip per track. Avoid merging everything into one animation. Blender 4.4+ action slots affect how actions merge; inspect your installed export options rather than assuming older tutorials apply. The [Blender glTF manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html#animations) describes these modes and sampling.

Re-import the GLB into a fresh Blender scene. Verify units, orientation, names, durations, binding, contacts and loop seams against the contract. Check any permitted standalone viewer locally; do not upload private assets to an online validator without permission. Record validation results in `VALIDATION.md`; only copy approved runtime files to `public/assets/characters/runner/`. Inspect the exported result, not just the authoring file. Exact budget and root-motion checks are project acceptance choices in the contract.

## F2A completion versus F2B readiness

F2A preparation can be complete with no character binaries present. F2B remains outstanding until the user supplies the packed `runner.glb` (model/rig plus `Idle`, `Run`, `Jump`, `Land`), completed provenance and manual validation records, resolves any asset exceptions, and separately approves F2B. Source-only FBXs or missing clips require further preparation first. Actual loader, animation blending and browser skinning/performance checks belong to F2B; movement, physics and camera following remain outside this preparation milestone.

## F2B.1 authorized local conversion

The F2B.1 request explicitly authorized correcting the supplied rest-pose mismatch. `scripts/build_runner.py` now uses Idle's canonical skin/rest rig, transfers rest-relative armature-space rotations, reconstructs canonical parent offsets, converts to local pose bases and bakes four actions. It stages `asset-source/runner/runner-candidate.glb` and `runner-canonical.blend`, never overwriting the original FBXs. `scripts/inspect_runner.py` records hierarchy, rest matrices, source transforms and keyed/empty channels; `compare-runner.mjs` summarizes differences.

Use Blender with `--background --python-exit-code 1 --python <script>` so a Python assertion fails the command. `scripts/validate-runner.mjs [GLB path]` uses the installed Three GLTFLoader and CPU skinning/animation checks. `scripts/roundtrip_runner.py` freshly reimports the staged GLB, compares sampled deformed surfaces to the canonical bake and renders front/side pose sheets; append `-- --check-only` to skip rendering. See [the F2B.1 report](../public/assets/characters/runner/VALIDATION.md) for exact commands and measured results.

The current output is a **technical source-motion prototype**, not an accepted in-place gameplay handoff. It retains the supplied root travel/arcs for inspection; root cleanup, clip-phase/contact/blend editing and the high-triangle budget review remain outstanding under the unchanged contract. Do not treat successful compatibility/export checks as final shadow-runner art, runtime/backend approval, or confirmed redistribution rights.
