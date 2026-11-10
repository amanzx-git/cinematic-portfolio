# Asset provenance and delivery manifest

F2B.1: the user supplied four Mixamo FBXs and explicitly requested local conversion to `characters/runner/runner.glb`. A technically validated reference-motion prototype now exists. Exact library titles/URLs, creators and license/redistribution evidence remain unconfirmed; local processing is not a rights clearance or external publication. Existing environment geometry and shaders are authored in project code.

## Runner — proposed `characters/runner/runner.glb`

Status: **LOCAL F2B.1 TECHNICAL EXPORT; RUNTIME ACCEPTANCE AND RIGHTS METADATA PENDING**. Temporary Mixamo Beta mannequin, not the final shadow-runner design. See the measured [validation report](characters/runner/VALIDATION.md).

| Item | Exact source title / URL / creator | License or applicable terms and date; evidence location | Attribution required | Public web delivery / public repository redistribution confirmed by user |
|---|---|---|---|---|
| Model and rig | User-supplied Idle.fbx; Beta_Joints + Beta_Surface; exact library title/URL/creator pending | pending | pending | NOT CONFIRMED / NOT CONFIRMED |
| Textures (each, or explicitly none) | None in export; two opaque source-color materials | No image assets | pending for underlying model | NOT CONFIRMED / NOT CONFIRMED |
| Idle animation | User-supplied Idle.fbx, user-identified Mixamo; exact library title/URL pending | pending | pending | NOT CONFIRMED / NOT CONFIRMED |
| Run animation | User-supplied Run.fbx, user-identified Mixamo; exact library title/URL pending | pending | pending | NOT CONFIRMED / NOT CONFIRMED |
| Jump animation | User-supplied Jump.fbx, user-identified Mixamo; exact library title/URL pending | pending | pending | NOT CONFIRMED / NOT CONFIRMED |
| Land animation | User-supplied Land.fbx, user-identified Mixamo; exact library title/URL pending | pending | pending | NOT CONFIRMED / NOT CONFIRMED |

- Local processing/output authorized by user in F2B.1, 2026-11-10; no external publication performed. The requested file is in Vite public delivery, so local serving/build copying applies. Public hosting/repository rights confirmation remains pending.
- Download date, original file names and source selection/settings for each item: pending
- Modifications: canonical Idle rest-pose correction and 30 Hz bake; 1.8 m normalization; join original body/joint shells. Source FBXs unchanged. Root motion retained; no trimming, decimation, new design or in-place cleanup.
- Blender 5.2.3 LTS; glTF exporter 5.2.41; GLB Actions mode, four clips, embedded data, no decoder extensions/images.
- File: 2,087,128 bytes; SHA-256 `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`; Idle 2.6 s, Run 0.633333 s, Jump 1 s, Land 1.033333 s.
- 65 Mixamo-named joints on canonical Idle neutral T-pose; height 1.8 m, +Y up / +Z forward; normalized source Run speed approximately 5.889 m/s. Root/contact/runtime details and remaining budget exceptions are in VALIDATION.md.
- Required license and attribution notices with file locations: pending
- Sampled rendered front/side poses were inspected; continuous realtime/contact/blend review is outstanding. Evidence and unchecked items: [characters/runner/VALIDATION.md](./characters/runner/VALIDATION.md).

F2B.1 explicitly requested the local public-directory target; it is supplied for this technical validation. Original FBXs, Blender authoring files and private evidence remain in ignored staging. Before external hosting or repository redistribution, finish the still-unconfirmed delivery/attribution fields for the intended channel. No asset publication occurred in this task.
