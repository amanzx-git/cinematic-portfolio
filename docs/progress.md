# Cinematic Portfolio — Development Progress

## Current milestone

**G2.2 - Functional Slide Mechanic.** Hold Down, S or the Slide touch control to clear the maintenance duct on the development route at `/lab/game`.

**Website: W4.5 - Cinematic intro audio handoff implemented.** Play fades ambient out before native intro audio; mode selection and Back restore the same ambient element. W4.4 loading/Skip/visual transitions are preserved. Physical iOS/Android browser review remains outstanding; no subsequent milestone is authorized.

**F2B.1 — Character compatibility/export validation: complete as a technical source-motion prototype.** A locally validated runner.glb with four corrected clips is delivered. In-place/contact/phase cleanup, triangle-budget review, final shadow-runner art and provenance remain outstanding; broader runtime integration and gameplay/F3 are not implemented or authorized by this asset-only task. F0, F1, F1.1 and F2A preparation remain complete.

## F0 completed work

- Vite/React/TypeScript application, pinned rendering stack and npm lockfile.
- Minimal lit floor and fixed camera; no character, city, effects or gameplay.
- Initialized WebGPURenderer, automatic WebGL 2 fallback, fresh-canvas retry and forced fallback URL.
- Responsive R3F root, loading/error UI, actual backend display, FPS/frame-time toggle, DPR/viewport readout and three quality presets.
- README, backend unit tests and dependency-free CDP browser verification.

## Technical decisions

React/DOM 19.2.0, R3F 9.6.1, Three.js 0.185.1, @types/three 0.185.0, TypeScript 5.9.3, Vite 8.3.7. Installed source/types and official renderer documentation checked. No Drei or additional runtime libraries required.

WebGL 2 uses WebGPURenderer's built-in backend. Initialization finishes before a custom R3F root mounts the same canvas. ResizeObserver updates viewport size. Low/Balanced/High cap DPR at 1/1.5/2. Frame counters mutate outside React state. Failed, uninitialized renderers are collected rather than disposed: Three's dispose calls async setAnimationLoop and would retry rejected initialization.

## Verification — 2026-11-10

- `npm run typecheck`: passed.
- `npm run build`: passed; Vite warns about a roughly 1.46 MB minified JS chunk (403 kB gzip). Warning is not suppressed.
- `npm test`: 4/4 passed: preferred renderer, failure retry, forced fallback, both unavailable.
- `node tests/browser.mjs`: headless Chrome 157.0.8103.39 on Windows; actual WebGPU, forced WebGL 2 and automatic fallback with navigator.gpu removed rendered successfully. Narrow 390 × 844 viewport at simulated device DPR 2, Low actual DPR 1, no horizontal overflow and diagnostics toggle verified. Both-backends-unavailable readable error checked; zero runtime/console errors.
- Browser screenshots under ignored `test-results/`; WebGL screenshot visually inspected for floor and readable controls.
- Half-second headless smoke samples: WebGPU ~113 FPS / 8.9 ms, forced WebGL ~116 FPS / 8.6 ms, fallback ~118 FPS / 8.5 ms. Narrow Low ~120 FPS / 8.3 ms. These are not laptop benchmarks or performance guarantees.
- npm install audit: zero vulnerabilities. No lint task configured.

## F0 known limitations (historical)

WebGL 1 unsupported. WebGPU needs a secure context and working browser/driver adapter. Later GPU-device-loss recovery is not implemented. Future TSL effects require fallback validation. Edge and interactive owner-laptop review remain untested; GPU hardware, CPU/GPU timings, median/1% lows and loading benchmarks were not measured. Bundle optimization can be assessed as scene/assets grow.

## F1 implementation

- Replaced the test floor with a 28-unit rooftop: coping, fascia, facade ribs, recessed panels, restrained warm accents and a foreground edge. The run surface is clear; no obstacles or gameplay.
- Fixed, slightly downward-looking orthographic camera. Resize-based framing keeps the whole rooftop in view and expands vertical space on portrait screens, with space above the roof for future jumping.
- Three depth-separated instanced skyline layers (148 simplified buildings in three draws), distant antenna, depth fog and distance-tinted silhouettes. No simulated parallax or camera motion.
- TSL sky gradient plus two broad, slowly drifting sine bands. A comparison toggle selects a static-gradient material that excludes the drift math. Materials are cached; only a time uniform changes each frame. The same nodes compile to both backends.
- Shared box geometry and rooftop materials with explicit cleanup, static instance transforms, warm directional light and cool ambient fill. No textures, postprocessing, shadow maps, volumetrics, extra packages or per-frame React updates.
- Existing backend fallback, quality presets, loading/error handling and frame diagnostics preserved. README and browser checks updated.

## F1 verification — 2026-11-10

- `npm run typecheck`: passed.
- `npm test`: 4/4 passed.
- `npm run build`: passed. JS 1,546.68 kB minified / 426.70 kB gzip, versus F0 1,460.83 / 402.50 kB: +85.85 kB (+5.9%) / +24.20 kB (+6.0%). Existing large-chunk warning remains. No lint task configured.
- `node tests/browser.mjs`: passed against the development server. Actual WebGPU, forced WebGL 2, automatic fallback with navigator.gpu removed, both-backends-unavailable error UI, diagnostics/effects toggles, resizing and all three DPR caps verified. Zero captured runtime exceptions or console errors.
- Desktop approximately 16:9 canvas (1,359 × 771 CSS pixels), plus 390 × 844 narrow browser viewport. All quality caps checked at simulated device DPR 2. Desktop and narrow screenshots visually reviewed: rooftop remains visible, no obvious z-fighting or unintended geometry clipping. Artifacts: ignored `test-results/auto-desktop-on.png`, `webgl-desktop-on.png`, `auto.png`, `webgl.png`, and `measurements.json`.
- Runtime dependency versions unchanged. TSL imports/material signatures checked in installed Three r185 source/types and official Three TSL documentation.

### F1 performance samples

Windows, Node 26.7.0, headless Chrome 157.0.8103.39, AMD Ryzen 5 5600H; installed GPUs: NVIDIA GTX 1650 and AMD Radeon Graphics. The active hardware adapter was not identified. Each row is a three-second requestAnimationFrame sample after warmup, not an instrumented GPU benchmark. Desktop Balanced used DPR 1.5; Low used DPR 1. No postprocessing in either comparison.

| Backend | Quality / drift | Median ms | p99 ms | Max ms | 1% low FPS |
|---|---|---:|---:|---:|---:|
| WebGPU | Balanced / off | 8.4 | 16.8 | 33.3 | 40.0 |
| WebGPU | Balanced / on | 8.4 | 25.4 | 41.5 | 30.0 |
| WebGPU | Low / on | 8.3 | 16.5 | 24.7 | 53.8 |
| WebGL 2 | Balanced / off | 16.6 | 25.4 | 33.5 | 32.5 |
| WebGL 2 | Balanced / on | 8.4 | 25.0 | 33.2 | 36.0 |
| WebGL 2 | Low / on | 8.3 | 8.4 | 8.5 | 118.0 |

1% low is 1000 / mean of slowest 1% of frame intervals. Narrow Low diagnostic samples were roughly 96–120 FPS. Desktop results vary with browser scheduling; the reversed WebGL off/on result illustrates this noise. These samples do not isolate shader cost or prove stable 60 FPS. CPU/GPU timing and loading benchmarks were not collected. Longer interactive measurements on a confirmed adapter, plus Edge testing, remain limitations. Low DPR reduces pixel cost; no adaptive resolution was introduced.

## F1.1 implementation — 2026-11-10

- Preserved the orthographic camera, framing, renderer selection/fallback and three quality presets.
- Replaced random building distributions with 33 authored towers across three districts: stepped landmarks, industrial roof plants, aerials, flanking masses and quieter central space. Their 60 silhouette components share three instanced draws and one box geometry. Distance-separated blue-gray palettes replace the previous uniformly contrasted rectangles.
- Added rear-corner vents, low rear railings and an antenna structure; facade conduits, elbows, inset louvers, lintels, subtle panel color changes, coping joints and lower foreground brackets. Equipment stays behind z=-1.7; the full front run corridor remains clear. Nothing has collision or gameplay behavior.
- Rooftop details share geometry and six materials across seven instanced batches, including eight-sided pipes. The scene uses 11 draws by construction before culling (three skyline, seven rooftop, one sky), with about 2.5k triangles. Instance transforms upload only on mount/data changes; shared resources and instance buffers are disposed explicitly.
- Refined the single-draw TSL sky with three color zones, aspect-correct soft horizon glow, a restrained sun and the existing slow drift. Baseline and drift materials are cached; no new animation systems, textures, postprocessing, volumetrics, shadows, dependencies or per-frame React updates.
- Added a dependency-free production performance runner and percentile tests. It retains long frame gaps, separates navigation startup, warm-up, switch transitions and steady state, records long tasks/coarse main-thread counters, rejects visibility changes and supports an empty-tab control. No benchmark hooks were added to application code.

## F1.1 verification

- TypeScript checking: passed (`npm run typecheck`, also included in build).
- Unit tests: 6/6 passed (`npm test`): four existing backend tests plus percentile/long-gap retention tests.
- Production build: passed. JS 1,548.49 kB minified / 427.71 kB gzip; F1 was 1,546.68 / 426.70 kB, a change of +1.81 / +1.01 kB. Existing large-chunk warning remains. No lint task configured.
- `TEST_URL=http://127.0.0.1:4173 node tests/browser.mjs`: passed against production preview. Actual WebGPU, forced WebGL 2, automatic fallback without navigator.gpu, unsupported-graphics UI, diagnostics/drift toggles, resize and Low/Balanced/High DPR caps all verified. Zero captured runtime/console errors. Desktop approximately 16:9 and narrow 390 × 844 screenshots reviewed: clear run surface, readable details and no obvious z-fighting or unintended clipping.
- `DEBUG_PORT=9222 node tests/performance.mjs`: passed on the production build. Six steady-state samples, both backends and drift states, plus separate startup/warm-up records. `CONTROL_ONLY=1` run passed separately. Exact metadata, main-thread counters and percentiles are retained in [f1-1-baseline.json](./f1-1-baseline.json).
- Screenshots and raw interval data remain in ignored `test-results/`: `auto-desktop-on.png`, `webgl-desktop-on.png`, `webgl.png`, `f1-1-auto-on.png`, `f1-1-webgl-on.png`, `f1-1-baseline.json`, and `f1-1-control.json`.
- Existing React/R3F/Three versions and backend architecture are unchanged. TSL gradient/glow and instancing worked on both active backends. A dependency-level Three.Clock deprecation warning was observed in Chrome logging; no new runtime exceptions were captured.

### F1.1 measurement conditions

Production preview at localhost:4173; Windows, Node 26.7.0, headless Chrome 157.0.8103.39. Host previously identified as Ryzen 5 5600H with Radeon integrated graphics and GTX 1650. CDP reports ANGLE on AMD Radeon Graphics, D3D11 driver 31.0.21921.3001; the separate WebGPU adapter was not independently identified. Browser viewport 1440 × 1080, canvas 1374 × 689 CSS pixels. Simulated device DPR 1.5; Balanced actual DPR 1.5 (2061 × 1033 drawing buffer), Low actual DPR 1 (1374 × 689 buffer). No postprocessing in any sample.

Fresh navigation per backend, without resetting browser/driver caches. Startup is navigation 0–5 seconds, warm-up 5–15 seconds. After each material or DPR switch a further five seconds are recorded separately and excluded from steady-state statistics. Balanced records 30 seconds per drift state, in opposite state order across backends. Low records 15 seconds with drift on. The empty-tab scheduling control records 30 seconds separately. Diagnostics remained enabled. Nearest-rank percentiles use all requestAnimationFrame intervals, including long gaps; 1% low is 1000 divided by the mean of the slowest 1% of intervals. These are scheduling intervals, not GPU-completion times.

| Backend | Navigation phase | Median ms | P95 ms | P99 ms | Max ms |
|---|---|---:|---:|---:|---:|
| WebGPU | Startup 0–5 s | 16.9 | 58.3 | 266.5 | 533.4 |
| WebGPU | Warm-up 5–15 s | 16.7 | 33.4 | 41.7 | 58.2 |
| WebGL 2 | Startup 0–5 s | 16.7 | 25.2 | 34.4 | 141.6 |
| WebGL 2 | Warm-up 5–15 s | 8.4 | 16.8 | 17.1 | 41.8 |

| Backend | Preset / drift | Duration s | Median ms | P95 ms | P99 ms | Max ms | 1% low FPS |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| WebGPU | Balanced / off | 30 | 16.6 | 33.4 | 42.0 | 66.6 | 19.4 |
| WebGPU | Balanced / on | 30 | 8.4 | 16.8 | 25.1 | 41.5 | 31.4 |
| WebGPU | Low / on | 15 | 8.3 | 8.4 | 8.5 | 8.7 | 117.3 |
| WebGL 2 | Balanced / on | 30 | 8.4 | 16.9 | 25.1 | 34.1 | 36.8 |
| WebGL 2 | Balanced / off | 30 | 8.4 | 24.7 | 25.2 | 316.7 | 22.6 |
| WebGL 2 | Low / on | 15 | 8.3 | 8.9 | 16.7 | 25.0 | 57.7 |
| Empty tab | Scheduling control | 30 | 8.3 | 8.5 | 9.0 | 17.4 | 62.3 |

### F1.1 investigation findings and limits

- Startup and steady-state stalls are distinct. WebGPU's first five seconds contained 169/73/226 ms main-thread long tasks around module/renderer setup and the first scene mount; WebGL had a 135 ms initial task. Startup includes loading, initialization and first rendering, so these are not isolated shader compilation timings. The much larger early frame gaps are excluded from the steady tables, but are retained in the report.
- Warmed Balanced samples still contain spikes, including a 316.7 ms WebGL gap. No >=50 ms main-thread long tasks were reported in any steady scene sample. Per 30-second Balanced window, main-thread task time was about 3.4–4.2 seconds, including 2.3–2.7 seconds of script and 19–33 ms of layout. This does not prove a CPU or GPU cause; the counters do not measure GPU work, driver waits or OS descheduling.
- Low DPR reduced pixel count by about 56% and substantially improved the sampled tail. The empty-tab control was also much smoother than Balanced. These observations are consistent with pixel cost and render/compositor scheduling contributing, but are not an isolated GPU diagnosis.
- Drift-on samples were not slower than drift-off in this run. Do not infer that drift improves performance: sequential samples, cache state, thermal/power behavior and scheduling noise are uncontrolled. Neither drift nor shader warm-up alone explains the data. Source review found static instance data/materials and no per-frame React state or resource construction in scene code.
- A non-headless Chrome attempt was rejected when its tab became hidden during recording; it is not included in the tables. The rejected raw file is `test-results/f1-1-rejected-headed.json`. Valid results above are longer headless samples, not an interactive benchmark. No stable 60 FPS claim is made, and no causal speedup versus F1's short development-server samples is claimed. A visible-browser run on a confirmed adapter, with a GPU/main-thread trace if stalls persist, is still needed to establish interactive frame pacing and root cause. The reusable runner supports that follow-up without changing scene code.
- No adaptive resolution, renderer architecture changes or speculative performance fixes were introduced. GPU device-loss recovery and WebGL 1 remain unsupported as before; Edge was not measured in this pass.

## F2A preparation — 2026-11-10

- Inspected the existing scene composition, rooftop, orthographic camera, renderer and installed loader support. No environment, runtime code or dependencies changed.
- Added [CHARACTER_ASSET_CONTRACT.md](./CHARACTER_ASSET_CONTRACT.md): model/rig/clip naming, units, axes, sole origin, placement, budgets, root-motion policy, compatibility checks and an acceptance checklist. These are preparation conventions; no character has been loaded or validated.
- Adopted 1 unit = 1 metre, nominal height 1.80 m, asset +Y up / +Z forward, sole origin [0,0,0] and runtime scale 1. Future right-facing preview: position [0,0.12,0], Y rotation +90 degrees. Existing slab top is Y=0.11 and its joints reach Y=0.119. The Z=0 corridor remains clear. Camera/framing are preserved.
- Runtime handoff is one `runner.glb` containing the skinned humanoid, one canonical skeleton and exactly `Idle`, `Run`, `Jump`, `Land`. No separate runtime clip files are required. Clips are in-place; world translation/turning and a baked full-body jump arc must be removed while retaining local body articulation. Raw FBX is an authoring input, not a new runtime loader decision.
- Prepared `public/assets/characters/runner/` with README and an explicitly unverified `VALIDATION.md` template, plus `public/assets/ASSETS.md` for model/texture and per-animation provenance, terms, attribution, export settings and rights confirmation.
- Prepared `asset-source/runner/` with a local `.gitignore` and README for raw model/animation FBX files, textures, optional Blender project and private evidence. No binaries are present. Ignored source staging is outside Vite public delivery; it is not encryption or permission to redistribute.
- Extended [ASSET_WORKFLOW.md](./ASSET_WORKFLOW.md) with recommended same-character Mixamo downloads, Blender normalization/retargeting, in-place cleanup, GLB export and fresh-import checks. Official Adobe and Blender references are linked there. No third-party asset was selected, downloaded, uploaded or licensed on the user's behalf.
- Initial review targets: 5k–15k triangles, about 50–70 joints, <=4 normalized weights per vertex, one material/primitive, no textures or small <=1024² atlas inputs, <=12 MiB decoded+mipped texture memory, and <=3 MiB packed GLB preferred. Exceptions need review, not destructive optimization; they do not guarantee a frame rate. F1.1 frame-pacing limitations remain open.

### F2A verification

- `npm run build`: passed, including TypeScript checking. Runtime JS remains 1,548.49 kB minified / 427.71 kB gzip, with the same content hash as F1.1. Existing large-chunk warning remains. No lint task is configured.
- `npm test`: 6/6 existing tests passed. No new code tests were added for this documentation/directory preparation.
- Directory inventory checked: only README, validation/provenance templates and source-staging ignore rules were added; there is no model, animation binary or placeholder character.
- No new browser or animation compatibility claim: there are no assets to exercise. F2B must verify actual skinning, clip binding/blending, side-view readability and performance on WebGPU and WebGL 2 after separate approval.

### Outstanding manual requirements before F2B

1. Choose and approve the character and four animation sources; document permissions for the intended public-web and repository delivery separately, along with attribution and required notices. All manifest rights fields remain unconfirmed.
2. Supply **`public/assets/characters/runner/runner.glb`**, with model + skin + canonical rig and the embedded clips **`Idle`, `Run`, `Jump`, `Land`**. Match the contract's scale, orientation, origin, in-place policy and clip names. No separate animation GLBs/FBXs are required if this file is complete.
3. Complete **`public/assets/ASSETS.md`** and **`public/assets/characters/runner/VALIDATION.md`**, including actual counts, clip durations, manual root-motion/compatibility/contact results, export versions/settings, evidence and known exceptions. Supply required license/notice files using a permitted delivery channel and record their locations. Templates are not passed validation.
4. If GLB preparation is not yet possible, privately supply `model/runner.fbx`, `animations/idle.fbx`, `animations/run.fbx`, `animations/jump.fbx`, `animations/land.fbx`, any referenced texture images, and `runner.blend` if cleanup/retargeting was performed. These permit further preparation; source-only delivery does not satisfy the final GLB handoff or authorize F2B.
5. Resolve missing clips, deformation/root-motion issues, unverified rights and budget exceptions, then separately authorize F2B. No primitive humanoid or arbitrary third-party substitute will be used to bypass the prerequisite.

## Next action

Stop after F2A. Wait for the manual asset handoff and explicit F2B approval. No loader, mixer, character preview, gameplay, physics, movement, camera following or F3 work was implemented. Run instructions and the environment remain unchanged.

## F2A FBX processing intake — 2026-11-10

- Explicit user authorization covered F2A processing only. Read AGENTS.md, asset contract/workflow and progress; environment and runtime dependencies remain unchanged.
- Moved Idle/Run/Jump/Land FBXs from `source/` into ignored `asset-source/runner/`. Blender 5.2.3 LTS is installed and CLI import succeeded via its full executable path.
- Added reusable read-only intake and rest-comparison scripts in `scripts/`. Idle contains two meshes linked to a 65-bone armature; other inputs contain 65-bone animation rigs without meshes. Names/parents match, but pelvis rest position and parent-relative thumb rest orientations differ between Idle and the three animation rigs.
- Stopped before combination/export under the user's incompatible-skeleton constraint. No `runner.glb` was produced; no final geometry/texture counts, root-motion, scale/orientation, weight, transition or deformation checks are claimed. Detailed verified intake and pending checks are in `public/assets/characters/runner/VALIDATION.md`; private raw evidence is in the ignored staging folder.
- F2B readiness: blocked. Obtain animations downloaded on the exact Idle character/rig, or separately authorize retargeting; then complete export, round-trip/manual validation and provenance. No F2B/gameplay work was implemented.
- Verification: `npm.cmd run typecheck`, `npm.cmd test` (6/6) and `npm.cmd run build` passed. Existing large-chunk warning remains; runtime bundle hash/size is unchanged. Used `npm.cmd` because PowerShell execution policy blocks the npm.ps1 shim. No dependencies were added.

## F2A repeat compatibility inspection — 2026-11-10

- Searched the workspace for the newly downloaded FBXs. Only the existing four staging files were found, with the previous sizes/timestamps; requested the new folder location. No newer set has been identified, so findings apply only to the available inputs. Current SHA-256 values are recorded in validation; prior byte identity cannot be established without prior hashes.
- Re-ran Blender inspection with Idle as canonical. All rigs have 65 matching names/parents, but Hips rest position and parent-relative thumb orientations still differ. Object scale/axis conversion match: positive uniform 0.01, approximately +90-degree X rotation, metric scene scale 1. The raw Hips rest offset is approximately 0.015543 m after object scaling. Safe transfer requires rest-pose correction/retarget baking; simple action reassignment has not been approved by validation.
- Expanded reusable inspection to record hashes, FPS/units, object transforms, sampled pelvis/root orientations and root/foot world paths. Imported frame spans at 30 FPS: Idle 1–79 (2.600 s), Run 1–20 (0.633 s), Jump 1–31 (1.000 s), Land 1–32 (1.033 s).
- Armature objects are stationary; Hips is the sole root. Run and Jump carry approximately 3.748498 m and 4.178672 m horizontal source travel, respectively. Jump/Land pelvis vertical ranges are 1.100057/0.935458 m; separating trajectories from articulation requires further review. No root-motion cleanup or final orientation/deformation pass is claimed.
- No merge/export or F2B/gameplay work performed. Updated asset validation with verified measurements and pending checks. New file location/replacement is required to inspect the intended new downloads.
- Verification: `npm.cmd run typecheck`, `npm.cmd test` (6/6), `npm.cmd run build` passed. Unchanged runtime bundle; existing large-chunk warning remains. No new dependencies.

## W0 + W1 — Cinematic website opening — 2026-11-10

- Explicitly authorized website opening/menu only. Read AGENTS.md, progress and current React/R3F entry, styling, dependency and test architecture. Added `src/website/` with the opening state flow (`LOADING`, `AWAITING_ENTER`, `ENTRANCE_ANIMATION`, `HOME_MENU`), resource loading, reduced-motion hook and separate CSS. No dependencies, backend, renderer or rooftop changes.
- Root `/` now serves the full-viewport website. `/lab` and `/lab?backend=webgl` lazy-load the existing laboratory, including its stylesheet. Changed only its backend switch links to retain `/lab`. Existing lab browser/performance runners now target `/lab` while TEST_URL remains the server origin. No game/character resources or lab chunks are requested by the opening.
- Essential loading waits on the actual local media manifest, poster load and document fonts. Indeterminate status contains no percentages or artificial delay. Failed resources fall back to static visuals; an 8-second network watchdog and explicit static continuation avoid trapping visitors. Videos stream only after Enter.
- Added a replaceable authored SVG city illustration and `public/media/website/media.json` (both video entries deliberately null). Expected final files: `public/media/website/entrance.mp4` (short once-only opening) and `idle.mp4` (seamless loop). Enable paths in the manifest after adding files; detailed delivery instructions are in that folder's README. No final video or audio asset has been supplied or claimed validated.
- Configured video flow: Enter → muted entrance → muted looping idle → menu. Skip, video errors, rejected play promises and a 15-second entrance watchdog lead to a usable menu/static background. Sound control is unavailable before Enter; mute/unmute is explicit. Idle can be paused/resumed. Reduced motion skips all videos/requests and disables CSS animation/transitions, including when the preference changes live.
- Menu exposes Play, About, Projects and Contact with short provisional content panels, focus transfer/return and Escape handling. Play only reports availability; there is no introduction, mode selection, game integration or game download. Actual project/contact content remains for a later authorized milestone.

### W0/W1 verification

- `npm.cmd run typecheck`, `npm.cmd test` (8/8) and `npm.cmd run build`: passed. No new dependency. Build separates the approximately 199.5 kB website entry from the approximately 1,357.1 kB lazy laboratory chunk (minified). The existing large-chunk warning applies to the lab chunk.
- `node tests/website-browser.mjs`: passed against production preview. Checked pending manifest loading, keyboard Enter, initial focus, menu panels and Escape focus return, real video playback/end-to-idle loop, initial muted playback, explicit mute/unmute state, pause/resume, keyboard skip, missing manifest/poster/videos, rejected autoplay, reduced-motion no-video/no-animation behavior and no game/lab resource requests from the opening. `/lab?backend=webgl` still renders its canvas with the correct backend switch URL. Zero captured runtime exceptions/console errors.
- Browser: headless Chrome, 1440×1000 desktop and 390×844 mobile, CPU/software rendering because the first sandboxed GPU launch failed. Desktop/mobile screenshots visually inspected; no horizontal overflow. Artifacts: ignored `test-results/website-home.png`, `website-mobile.png`. This was functional UI verification, not a new GPU performance measurement or a full lab backend/performance regression run.
- Video QA used a tiny locally generated VP8/WebM fixture served at the configured test video URLs, exercising real browser decoding/playback without downloading third-party assets. Final H.264/AAC files, audible sound quality, cross-browser codec support, final edit continuity and mobile-device playback still require manual review after delivery. No final video art-direction approval is claimed.
- Stopped after W1. No publication, W2, Play introduction, mode selection, game integration or changes to environment/rendering behavior.
## W1.1 — Homepage and Enter branding — 2026-11-10

- Updated the shared opening/menu branding to `AMAN / PORTFOLIO`, `BRIDGING THE GAP BETWEEN CODE & CREATIVITY`, `The Journey Is Just Beginning.`, `Every line of code. Every leap forward.`, and `CODE · MOTION · PROGRESS`. Updated the home link accessible name and document title/description to Aman.
- Kept the serif/italic cinematic treatment with a compact two-line heading. Reduced vertical spacing on shorter viewports; short landscape screens arrange the four menu options in a single row. Navigation, focus handling, reduced-motion transitions and media behavior are preserved. Renderer, environment, gameplay and media pipeline are unchanged.
- Verification: TypeScript, 8/8 unit tests and production build passed (existing lab chunk-size warning remains). The full existing website browser suite passed, including keyboard, video/mute/pause/skip, missing media, rejected autoplay, reduced motion and `/lab` checks.
- Separately checked exact branding in both Enter and home-menu states at 1440×900, 1366×768, 1024×600, 390×844, 375×667, 320×568 and 844×390. All four menu options and Enter fit inside the viewport with no page scrolling at those sizes. Screenshots retained in ignored `test-results/w1-1-1440.png` and `w1-1-390.png`. No new milestone work implemented.

## W2 — Cinematic Play introduction and mode selection — 2026-11-10

- Read AGENTS.md, progress and the W0/W1/W1.1 website, media and test architecture. Implemented only `HOME_MENU → PLAY_INTRO → MODE_SELECTION`. Preserved the Aman branding, homepage content and lab/renderer/environment. No dependencies, engine, gameplay, multiplayer or backend changes.
- Added `PlayExperience.tsx`, `ModeSelection.tsx` and `play.css`. Play replaces the old availability panel with a full-viewport cinematic scene using the existing backdrop, typography, colors and restrained transitions. The small mode module loads only after Play; its actual import completion gates Skip and destination entry. No game, character or lab assets are imported by this flow.
- Extended the existing manifest with optional `playIntro` (default null). To enable the final video, place `public/media/website/play-intro.mp4` and set `playIntro` to `/media/website/play-intro.mp4`. It is requested only after Play and inherits the current mute preference. Existing Enter consent remains required before Play is accessible. Video end continues to modes, or a genuine loading message while the destination module is pending.
- With no video, missing media or rejected playback, three short atmospheric captions provide a 6.6-second fallback (2.2 seconds per caption). This is editorial intro pacing, independent of loading readiness, not simulated progress or canonical game lore. A 20-second video failure/stall watchdog switches to captions. Reduced motion uses all three captions statically, no video requests or animated transitions, and a ready-gated Skip button without automatic caption advancement.
- Skip uses a native button and appears as soon as mode selection is ready. Back is always available; Escape also returns home, restoring focus to Play. Focus moves to the newly entered intro/modes section. A failed destination module shows a clear error with Back and Reload rather than entering a broken screen. Reload returns through the normal opening.
- Modes are informational previews: Play as Recruiter explicitly says the first playable mode is in development and gameplay is unavailable; Play as Aman and Play with Friend show Coming Soon. No mode has a broken launch button. README and media instructions reflect the final W2 flow.

### W2 verification

- `npm.cmd run typecheck`, `npm.cmd test` (9/9) and production build passed. Website entry is approximately 202.7 kB minified / 64.2 kB gzip; mode selection is a separate approximately 1.85 kB / 0.59 kB module. The lab remains a separate approximately 1,357.1 kB chunk with the existing size warning.
- `node tests/play-browser.mjs`: passed against production preview. Natural caption completion and actual video completion were both tested with the destination request deliberately held: Skip stays absent, a real loading state appears after intro completion, and the screen opens when the request is released. Keyboard and touch Skip, Back/Escape and focus restoration, all three unavailable mode labels, actual muted video playback, explicit unmute and preference retention, missing/rejected video, reduced motion and destination-load failure recovery passed. Network checks found no character/game/lab resources. Zero captured runtime exceptions/console errors.
- `node tests/website-browser.mjs`: existing opening, keyboard panels, video-to-idle, sound/pause, skip, missing resources, rejected autoplay, reduced motion and preserved `/lab` WebGL 2 checks passed. Updated only its old Play-panel expectation because W2 now owns that action.
- Headless Chrome in CPU/software mode; 1440×900 desktop and 390×844 mobile mode screenshots visually reviewed, with no horizontal overflow. Evidence: ignored `test-results/w2-modes-desktop.png` and `w2-modes-mobile.png`. Video tests use a small locally generated VP8/WebM fixture, not a downloaded asset; no final video has been supplied. Final H.264/AAC decoding, audio quality/consent behavior on physical browsers/devices and final art direction require manual review when the real video arrives. No performance guarantee or new renderer benchmark is claimed.
- Stopped after W2. No publication or later milestone implementation.

## W3.1 — Entrance and idle video integration — 2026-11-10

- Read AGENTS.md, progress and W0–W2 website/media implementation. Both required files are present. User explicitly confirmed `entrance.mp4` was already reversed and must retain arm down → raised; no reversal or media re-encoding was performed. FFmpeg/ffprobe were not on PATH or in checked common installation locations, and were not needed after that confirmation.
- Enabled `/media/website/entrance.mp4` and `/media/website/idle.mp4` in the existing manifest; `playIntro` remains null. Entrance: 6,084,945 bytes, 1920×1080, 5 s, H.264/30 fps, no audio. Idle: 794,224 bytes, 1024×592, 5.041667 s, H.264/24 fps, mp4a audio. Added read-only `scripts/inspect-website-media.mjs` for MP4 boxes/track metadata/hashes; sources remain unchanged.
- Added `HomepageBackground.tsx` to keep two video layers. Both mount only after Enter: entrance plays once and idle preloads paused/muted, so video readiness does not extend initial essential loading. On completion, entrance is paused/silenced before idle plays. The decoded final entrance frame remains while idle prepares; a presented-frame callback gates a 450 ms idle dissolve. Entrance is hidden only after the dissolve. Menu interaction is available while idle is pending.
- Preserved LOADING → AWAITING_ENTER → ENTRANCE_ANIMATION → HOME_MENU, all Aman branding, Enter consent/current mute preference, Skip, keyboard focus, sound/pause controls and W2 navigation. Missing/rejected videos use existing static/menu fallbacks. Reduced motion mounts neither homepage video and makes no media requests. No renderer, environment, game/character, dependency or backend changes.
- Backgrounds remain full-viewport with cover framing. Desktop object-position is 65%; portrait is 75%, keeping head/torso on the right and the menu readable. Landscape-to-portrait cover necessarily crops peripheral raised-arm/scene details; no portrait-specific source was invented.

### W3.1 verification and known limitations

- TypeScript checking, 9/9 unit tests and production build passed. Website entry approximately 203.86 kB minified / 64.57 kB gzip. Lab remains a separate approximately 1,357.1 kB chunk with the existing size warning.
- `node tests/homepage-media-browser.mjs`: passed using the actual delivered videos on production preview, 1440×900 and 390×844. Verified once-only entrance, paused idle preload, decoded-layer coverage throughout the handoff, no concurrently unmuted/playing videos, two idle loop wraps, preserved mute choice, keyboard About/Escape and menu visibility/no horizontal overflow. A held idle request past entrance completion retained the decoded final frame, then transitioned when released. Reduced-motion no-video/no-download and game/lab request isolation passed. No black flash observed in the local transition review.
- The final headless Chrome/software run reported 246 idle frames with 1 dropped on each viewport (earlier runs reported 0). This is a short local functional sample, not a hardware/mobile or network performance guarantee. Initial/slow-network startup was not benchmarked. Source MP4s have movie metadata after media data (not fast-start); local Vite range playback worked, but fast-start remuxing remains a possible delivery improvement.
- `node tests/website-browser.mjs` and `node tests/play-browser.mjs`: passed, covering existing opening/W2 flows, missing media, rejected playback, reduced motion, keyboard/touch, sound/pause, destination readiness and preserved lab. Opening tests now select the active video layer instead of assuming exactly one video element. Zero captured runtime exceptions/console errors.
- Source-level visual issues remain: entrance's detailed cloudy skyline changes to idle's illustrated clear skyline, and the character/framing/exposure differ. The dissolve softens this, but the shots do not match. Idle's end camera/skyline does not match its start: **a visible loop reset remains**. Source watermarks (DeeVid AI / PixVerse.ai) remain untouched. No seamless-loop or matching-art-direction claim is made. Audible AAC loop quality and physical-device/browser playback require manual review.
- Detailed metadata, hashes, behavior and limitations are in `public/media/website/VALIDATION.md`; delivery docs/README updated. Evidence: ignored `test-results/w3-entrance-{1440,390}.png`, `w3-idle-{1440,390}.png`, `w3-idle-wait.png`, `w3-media-results.json` and per-frame debug records. Desktop/mobile screenshots visually reviewed.
- Stopped after W3.1. No game integration, new gameplay, source-video regeneration, publication or later milestone work.

## City poster replacement — 2026-11-10

- Replaced `public/media/website/city-poster.svg` with the supplied sunset skyline image, matched visually to `Sunset Skyline with Rooftop Silhouettes.png` in Downloads. The SVG embeds the original 1671×941 PNG unchanged, preserving all existing poster paths without additional asset requests. Branding, layouts, videos and playback logic are unchanged.
- Verified SVG XML parsing and byte-identical embedded PNG content. Poster is now approximately 1.94 MB rather than the small procedural illustration; essential loading continues to wait on its real load. TypeScript, 9/9 unit tests and production build passed; existing lab chunk warning remains.

## W3.0 — Cinematic background audio — 2026-11-10

- Read AGENTS.md, progress and the existing website, video, Play and mute architecture. Found the supplied `public/media/audio/ambient.mp3` (1,740,651 bytes; Chrome duration 56.749569 s; SHA-256 `7c02c8481019cc924fbf03dc17eed1e83cbec4d9f004749704d55e1e4e91b486`). No soundtrack was downloaded, generated, edited or replaced.
- Added one persistent native audio element, `backgroundMusic.ts`, `useBackgroundMusic.ts` and `SoundControl.tsx`. The element has no source/request/playback before Enter. Enter invokes play synchronously in the user gesture; a new visitor hears a 650 ms fade to 35% volume. Explicit saved mute is respected and prevents source loading/playback until unmuted. Saved unmute never bypasses the fresh Enter gate after reload.
- The shared upper-right speaker control is visible in opening/home/Play/modes, disabled before Enter, and uses text, decorative speaker SVG, an accessible action label and pressed state. It replaces the old footer/video-specific controls; there is one preference, not competing music/video mute states. localStorage key `aman.portfolio.muted` persists explicit choices, with guarded access when storage is unavailable.
- Mute immediately silences, fades internal volume to zero over 300 ms and pauses. Unmute resumes the same element/current position with a fade, without seeking/restarting. A normal stop supports the short fade; teardown cancels the frame, removes the error listener, silences/pauses immediately and releases the source because page teardown cannot wait for a fade. Fade frames update native volume directly, never React state.
- The same track continues through entrance, idle, homepage panels, Play introduction, modes and Back. All website video elements remain permanently muted so source audio cannot overlap music during transitions. Pausing visual motion leaves music running. No navigation logic, R3F rendering, engine, dependencies, game assets or gameplay changes.
- Native looping is enabled. Missing/undecodable audio and rejected play promises show a nonblocking status and preserve navigation; no automatic retry/unmute loop is used. Audio is independent of essential website loading and works with static/reduced-motion visuals.

### W3.0 verification

- TypeScript checking, 11/11 unit tests and production build passed. Website entry approximately 206.57 kB minified / 65.46 kB gzip; existing separate lab chunk-size warning remains. Unit coverage includes consent-gated start, 35% fade, mute/position resume, stale play promises, stop/cleanup and optional storage. A real-browser regression exposed an early requestAnimationFrame timestamp producing a negative fade value; clamped both ends of the fade ratio and added a unit check for it.
- `node tests/music-browser.mjs`: passed against the actual MP3/production preview. Verified no source/download/play before Enter, play inside active user activation, 35% volume, native loop wrap (seek near end), immediate keyboard mute and position-preserving unmute, persisted mute after refresh, exactly one element/play call across homepage/Play/modes/Back, touch sound control at 390×844, missing-file response, blocked audio play, unavailable localStorage and zero captured runtime errors. Screenshot: ignored `test-results/w3-audio-mobile.png`.
- `node tests/website-browser.mjs`, `node tests/play-browser.mjs` and `node tests/homepage-media-browser.mjs`: passed with the shared soundtrack policy. Existing tests now select/control music for sound while asserting videos remain muted. The delayed-idle test releases all metadata/range requests through one gate. Opening, mode readiness/Skip, keyboard/touch, video handoff, reduced motion, missing/rejected video, lab and asset-isolation checks remain intact.
- Exact existing branding and Enter/menu fit checked at 1440×900, 1366×768, 1024×600, 390×844, 375×667, 320×568 and 844×390 after adding the header control: no scrolling/hidden menu options at those sizes. Browser evidence is headless Chrome/software rendering and mobile viewport/touch emulation, not physical-device listening.
- Loop wrap is verified, but an inaudible MP3 seam/sound quality is not claimed. Physical iOS/Android playback, hardware volume behavior (native volume support varies), listening level and audible loop seam need manual review. Existing visual source-video discontinuities remain outside this audio task.
- Updated audio/media documentation and README. Stopped after W3.0; no new track, publication or later milestone work.

## W3.2 — Mobile Landscape Experience — 2026-11-10

- Read AGENTS.md, this log and W0–W3 opening/media/audio/Play implementation and tests. Added `useMobileLandscape.ts` and `OrientationGate.tsx`; updated Website, homepage/Play pause handling, responsive CSS and safe-area viewport metadata. Existing dependencies, story, source media, lazy lab boundary and gameplay remain unchanged. No publication or later milestone work.
- Mobile detection combines touch points, coarse-pointer media query and screen short side <=1024 CSS pixels; narrow desktop windows alone do not qualify. Orientation and capability media-query events update state only at matching changes, with no resize polling or per-frame React updates. This is a capability heuristic, not a claim to identify every hybrid device perfectly.
- Enter still starts the single persistent soundtrack synchronously in its user gesture. On mobile it makes one fullscreen request on the main application container when supported, then one landscape-lock attempt after fullscreen settles where fullscreen is a prerequisite; without fullscreen support, lock is invoked directly. Synchronous exceptions and rejected promises use manual rotation. No automatic repeated requests. Fullscreen exit unlocks orientation and preserves navigation/audio state.
- After Enter, mobile portrait opens a native modal dialog with an authored SVG rotation illustration, accessible heading/instructions, sound control and fullscreen exit where active. Native modal behavior makes underlying navigation inert. Videos and entrance/Play watchdogs pause while gated; entrance elements retain their position instead of remounting. Landscape dismisses the gate and resumes progression. Music remains independent and retains explicit mute preference. Escape or Continue in portrait selects a session-long simplified portrait layout and releases fullscreen/orientation lock.
- Welcome/loading remains available in either orientation. Mobile landscape places home content/menu on the left, uses a compact two-column menu, safe-area padding and viewport-height containment. Play intro is compact; modes use three columns, with additional small-height sizing for 568×320. Portrait fallback has a compact menu, intro and modes. No page scrolling at tested immersive sizes; content panels and the rotation dialog retain internal overflow for accessibility. Reduced motion retains static/no-video behavior and uses no animated rotation illustration.

### W3.2 verification and limitations

- `npm.cmd run typecheck`, `npm.cmd test` (12/12) and `npm.cmd run build`: passed. New unit coverage checks mobile capability combinations, portrait/landscape screen dimensions, tablets and desktop exclusion. Website entry approximately 209.95 kB minified / 66.44 kB gzip; separate lab chunk approximately 1,357.13 kB with its existing size warning. No dependencies added.
- `node tests/landscape-browser.mjs`: passed against production preview with real supplied entrance/idle/audio files. Covers portrait welcome, actual Enter activation, rejected/missing fullscreen and lock APIs, a successful fullscreen/lock/exit lifecycle simulated with API stubs, manual rotation, portrait return, entrance pause/current-time retention, gate held beyond the 15-second entrance watchdog, entrance-to-idle, audio continuity, gate mute preference, single audio identity, no repeated fullscreen request, Play/modes, Escape/portrait fallback and reduced motion. Layout bounds/no page overflow checked at 844×390, 568×320, 390×844 and 320×568 as applicable; narrow mouse desktop stays ungated. Zero captured runtime errors. Screenshots visually reviewed: ignored `test-results/w32-rotate.png`, `w32-home.png`, `w32-modes.png`.
- Existing `website-browser.mjs`, `play-browser.mjs`, `music-browser.mjs` and `homepage-media-browser.mjs`: passed. Play/mobile audio suites explicitly choose portrait continuation where their original scenarios need it; the audio suite restores desktop metrics after its touch check. Preserved desktop/menu/keyboard/media/error/reduced-motion behavior and lazy lab/game isolation checks. Existing media suite again verified supplied video decoding, delayed-idle handoff and two loop wraps at desktop/narrow viewport sizes. An initial browser run failed to launch its sandboxed GPU; verification used headless Chrome/software rendering. These are functional emulation checks, not physical-device or hardware performance measurements.
- Fullscreen requires browser permission/user activation, and orientation lock support and prerequisites vary. Fullscreen or lock rejection never blocks manual landscape use. iPhone/unsupported browsers use the available browser viewport; native iOS/Android fullscreen, orientation policies, safe-area/browser-toolbar changes and real-device listening still require manual checks. The successful API lifecycle test uses stubs and does not prove native mobile permissions. References: [Fullscreen activation and policy](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [orientation-lock prerequisites](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock).
- Existing visual limitations remain: entrance/idle skyline, character framing and exposure differ; idle has a visible loop reset and source watermarks remain. Portrait fallback intentionally crops more of the cinematic background. No source edits or matching/seamless-video claims. Extreme viewport sizes and large text/zoom may require internal content scrolling; physical-device composition review remains outstanding.
- Stopped after W3.2. No gameplay, engine work or cinematic story changes.

## W4.1 — 8-Second Silent Shadow Cinematic — 2026-11-10

- Read AGENTS.md, this log and the existing W0–W3 website, audio, media, Play, mobile gate and tests. Confirmed the required `public/media/website/play-intro.mp4` exists before changes. Enabled its path in the existing media manifest; no video was generated, substituted, edited or re-encoded. Extended the read-only MP4 inspection script to include this file.
- Supplied asset: 3,152,916 bytes, SHA-256 `0f5d39f14895bd5d4f5af8cab0e7b6fa7b62282460891aca1c5ccb6e8a1aa5c6`, decoded 1280×720, browser duration approximately 7.93 seconds. MP4 tracks: H.264/24 fps (190 frames, 7.916667 seconds) and AAC (7.972667 seconds). Its native audio remains muted; the one existing background-music element continues without a new play call, seek or restart.
- Play requests/plays the cinematic once, with `playsInline`, no loop and responsive `object-fit: cover`. Existing generic intro copy remains accessible but visually hidden during the supplied cinematic. Reduced motion and missing/rejected media retain the existing static/caption fallback. Back, mute preference, mode functionality, readiness-gated Skip and mobile fullscreen/orientation handling are preserved.
- The video layer fades in only after decoded data is available. On completion it pauses and holds its decoded final frame while a delayed mode module finishes; ready modes open automatically. On natural completion or Skip, the retained paused frame dissolves to the existing static mode backdrop rather than unmounting abruptly. The paused layer is released when leaving Play/modes. No homepage video remains playing behind the cinematic, and there is no additional audio instance. Destination failures retain Back/Reload recovery.

### W4.1 verification and limitations

- `npm.cmd run typecheck`, `npm.cmd test` (12/12), `npm.cmd run build`: passed. Website JS approximately 210.11 kB minified / 66.47 kB gzip. Existing separate lab chunk-size warning remains. No dependency, gameplay, R3F environment, rigging, mode-selection functionality or roadmap changes.
- `node tests/play-intro-media-browser.mjs`: passed with the actual asset, actual manifest and supplied soundtrack. Verified no intro download before Play, once-only natural ending, delayed destination/retained decoded final frame, Skip hidden until actual module readiness, automatic modes, early Skip, paused outgoing video, one audio element/play call and continuous audio position, About/Back navigation, landscape mobile at 844×390, portrait gate pausing/resuming the same cinematic element and music continuing, saved mute, no page overflow and no game/lab requests. Zero captured runtime errors. Desktop and landscape mobile screenshots visually reviewed; ignored artifacts: `test-results/w41-cinematic-desktop.png`, `w41-cinematic-mobile.png`, `w41-modes.png`, `w41-media.json`.
- `node tests/play-browser.mjs`: passed. Replaced this suite's generated test clip with the exact supplied MP4 bytes; it still intercepts delivery to exercise missing/rejected media, held/failed destination loading, fallback captions, keyboard/touch Skip, focus return and reduced-motion no-video behavior. No replacement media was authored for W4.1.
- `node tests/landscape-browser.mjs` and `node tests/music-browser.mjs`: passed after the W4.1 integration. Fullscreen exit/no repeated requests, orientation gates, small viewport layouts, actual music playback/loop/mute persistence, missing audio and blocked-playback/storage fallbacks remain intact. Native fullscreen/lock success remains simulated in the landscape suite; real phone/browser permissions require physical-device review.
- Functional verification used local production preview and headless Chrome/software rendering. No black/loading flash was observed in the local cinematic review; decoded final-frame retention was asserted under delayed mode loading. This is not a bandwidth, hardware-performance or cross-browser guarantee. `moov` follows `mdat` (not fast-start); no remux was performed. Cover framing preserves aspect ratio but crops peripheral image at differing viewport ratios. Native iOS/Android codec, toolbar/safe-area and fullscreen/orientation behavior remain manual checks. The existing 20-second Play watchdog is sufficient for this 8-second edit; revisit it when a longer story is separately authorized.
- Stopped after W4.1. Longer cinematic story and gameplay roadmap remain unchanged.

## W4.2 — Cinematic Transition to Shadow Mode Selection — 2026-11-10

- Read AGENTS.md, progress and W4.1 media/Play implementation. Confirmed `public/media/website/shadow-idle.mp4` exists before changes. Used this exact supplied asset; no Shadow Reveal video, replacement media, gameplay or roadmap changes. No new dependencies.
- Added `ShadowBackground.tsx` for the muted, inline looping nighttime backdrop. Its source is attached only when the shared transition starts after intro completion or accepted Skip, never during homepage/Enter. The intro and shadow media share the existing persistent soundtrack, with no added audio or music-start call.
- Natural completion, Skip and caption-fallback completion call the same synchronously guarded `requestModes`. Skip still requires the actual mode module and disables after acceptance; near-simultaneous Skip/ended calls cannot schedule another transition. A late mode module retains the outgoing final frame until ready, preserving existing destination-load failure recovery.
- Added an explicit intro → darkening → waiting → revealing → ready sequence: 450 ms application-wide fade to opaque near-black, incoming-frame readiness hold, 450 ms reveal, then the existing modes with a 250 ms opacity fade. The incoming video starts behind the overlay; a presented-frame callback (or playing/decoded-data fallback) gates reveal. A media error, rejected play or 8-second load watchdog uses the established static background. No reveal happens on an undecoded incoming frame.
- Modes and navigation remain unchanged. Added a restrained dark backing/text shadow for readability and retained aspect-ratio-preserving cover framing. Fullscreen/landscape state remains owned by Website; portrait gating pauses videos and transition timers while audio/preference remains independent. Reduced motion uses static mode visuals and minimizes transition duration, without requesting intro/shadow videos. Changing the preference live releases/reloads the background only when allowed and gates the new frame again.
- Timers and pending frame callbacks are canceled on navigation/unmount. Video elements pause, remove their source and release media resources on teardown; outgoing intro resources are released when the transition finishes. Returning home during the transition cannot later send the visitor back to modes.

### W4.2 verification and limitations

- `npm.cmd run typecheck`, `npm.cmd test` (12/12) and `npm.cmd run build`: passed. Website entry approximately 212.17 kB minified / 66.99 kB gzip. Existing separate lab chunk-size warning remains. No renderer, character rig, gameplay, mode availability or dependency changes.
- Supplied shadow asset: 4,479,162 bytes; SHA-256 `02a6b7b07350ba73cf23c48085d3aa37b410abeb249b2390fdb88a244350631c`. Browser decoding reports 1672×940. MP4 video-only H.264, 150 frames / 30 fps / 5 seconds; no source-audio track. Movie metadata follows media data (not fast-start); no remux, edit or seamless-loop claim. Inspection script includes the new asset.
- `node tests/shadow-modes-browser.mjs`: passed using the supplied files on production preview. Natural completion and Skip share one sequence; measured darkening approximately 459 ms and reveal 464 ms, with 250 ms option animation. Tested held incoming delivery/opaque frame gate, two loop wraps, Skip+ended in one turn (one transition), missing video, stalled-video timeout, reduced-motion no intro/shadow requests, live preference changes, one continuous music instance, portrait pause/resume, saved mute, no mobile page overflow, Back during a transition, and released video source after Back. Known canceled network interceptions from deliberate timeout/unmount are handled explicitly in the harness. Zero captured application runtime errors; no reveal/game/lab requests. Desktop and mobile screenshots visually reviewed: ignored `test-results/w42-modes-desktop.png`, `w42-modes-mobile.png`, `w42-dark-wait.png`; metadata/timing in `w42-results.json`.
- Regression browser suites `play-intro-media-browser.mjs`, `play-browser.mjs`, `landscape-browser.mjs` and `music-browser.mjs`: all passed on the final production build. Preserved actual intro completion, delayed destination readiness, ready-gated Skip, errors/reduced motion, navigation/focus, fullscreen exit/manual rotation/portrait fallback, music continuity, saved mute, blocked/missing audio and unavailable storage. Updated the W4.1 actual-file suite to assert that the outgoing intro is released after the shadow transition, rather than retained invisibly on modes. Native mobile fullscreen/lock success remains simulated, as before.
- Functional checks use local headless Chrome/software rendering; physical-device playback, native fullscreen/orientation permissions, toolbar/safe-area changes and loop art-direction review remain manual. Cover sizing may crop peripheral source content but does not distort the video.
- Stopped after W4.2. No separate reveal cinematic, longer story, publication or gameplay changes.

## W4.3 — Transparent Mode Selection UI Polish — 2026-11-10

- Read AGENTS.md and the existing mode markup, Play styling and W4.2 progress. Changed only `src/website/play.css` and this log. Mode content, application state, navigation, media assets, background video treatment, audio and gameplay remain unchanged. No dependencies added.
- Removed the approximately 66%-opaque backing on the whole mode list. Individual cards now use `rgba(7, 16, 29, 0.2)` with subtle translucent separators, warm off-white headings, slightly warmer/lighter description text and existing muted amber status accents. Removed the separate recruiter gradient fill.
- Fine-pointer hover increases navy opacity to 0.28 and adds an amber separator over 180 ms, with no translation or scaling. Focus-within receives the same treatment, and the existing focused Play section gains an amber list-edge cue. Cards remain informational previews with their existing semantics; no extra keyboard stops or navigation behavior were introduced. Existing reduced-motion styling suppresses transitions.
- Desktop mode content is capped at 600 px and 52% of available width, keeping it left of the shadow runner. Mobile landscape retains the responsive three-column layout; portrait fallback retains its stacked layout. Short-height spacing/type adjustments prevent clipping after narrowing the desktop cards. An initial 1024×600 overflow was corrected by reducing short-height card padding.
- Verification: `npm.cmd run typecheck`, `npm.cmd test` (12/12) and final production build passed. Website JS remains approximately 212.17 kB minified / 66.99 kB gzip; no runtime logic changes. Existing separate lab chunk-size warning remains.
- Production browser layout review passed at 1440×900, 1366×768, 1024×600, 844×390, 568×320, 390×844 and 320×568. All cards/Back controls fit, no page overflow, desktop card right edges stay within the left 60% of the viewport. Checked actual keyboard focus cue, 0.20 → 0.28 hover tint, amber separators and absence of movement. Desktop, mobile landscape and portrait screenshots visually reviewed for text readability and composition; this is visual contrast review, not a formal contrast guarantee over every moving frame. Artifacts: ignored `test-results/w43-{1440,1366,1024,844,568,390,320}.png` and `w43-layouts.json`.
- `node tests/shadow-modes-browser.mjs`: passed, covering natural completion/Skip, cinematic timing, incoming-frame readiness, video looping, load failure/timeout, reduced motion, audio continuity, mobile rotation, saved mute and Back/resource cleanup. Browser evidence is headless Chrome/software rendering with touch/viewport emulation; physical-device review remains manual.
- Stopped after W4.3. No media, gameplay or application-state changes.

## F2B.1 — Animated runner compatibility and export — 2026-11-10

- Read AGENTS.md, progress, the F2A contract/workflow, prior intake/validation and Blender scripts. All four required FBXs exist; hashes match the earlier available set and remain unchanged. F2B.1 explicitly authorized deliberate rest correction, resolving the previous stop-before-retargeting constraint. No website, cinematic, mode, audio, R3F environment, gameplay or dependency changes.
- Re-ran Blender 5.2.3 LTS intake: identical 65-bone trees/parents, but Hips rest offset approximately 0.015543 m plus thumb rest-axis differences. Idle alone has skinned geometry (two source shells); all others are animation-only. Source object axes/scales match. Each original action has 650 scalar slots; all 52 nonterminal joints have rotation keys, 13 terminal tips inherit rest/parent motion, no unexpected paths or animated scale. Source action names, ranges, source transforms/rest matrices and root/foot paths are recorded in private intake evidence.
- Added `scripts/build_runner.py`: uses Idle's canonical bind rig, maps armature-space rest-relative rotations, reconstructs canonical child offsets and uses Blender's local/pose conversion to bake corrected transforms. No name-only curve transplant or source inverse-bind copying. Uniformly normalized source neutral height 1.809234 m to 1.8 m, +Y-up/+Z-forward GLB and sole-centered identity CharacterRoot. Joined original body/joint shells, preserving skin and source materials. Maximum bake position error <0.003 mm; quaternion signs continuous and scale remains one.
- Delivered `public/assets/characters/runner/runner.glb`: 2,087,128 bytes / approximately 1.99 MiB, SHA-256 `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`. Exactly Idle 2.6 s, Run 0.633333 s, Jump 1 s, Land 1.033333 s, baked at 30 Hz, independently targeting one 65-joint skin. One glTF mesh, two opaque source-material primitives, 49,112 triangles, 28,374 exported seam-split vertices, at most three influences, no images/external resources/decoder requirements.
- **Motion/readiness distinction:** this F2B.1 artifact deliberately retains measured source root motion for technical validation; it does not pass or change F2A's in-place runtime policy. Normalized Run moves +3.729 m forward (~5.889 m/s), Jump +4.157 m with a 1.094 m hips-height range, and Land contains airborne descent/recovery (~0.931 m hips-height range). Object/container transforms are stationary but Hips is not. No root flattening, ballistic removal, phase/loop/contact edits or gameplay motion code. The high triangle count also needs review/optimization before runtime integration; no destructive decimation was performed.
- Added `scripts/validate-runner.mjs`: loads the actual staged/delivered GLB through installed Three r185 GLTFLoader, enforces four clips/one skin, checks buffers, hierarchy targets, weights/binds, neutral height, positive/unit scale and +Z toe direction. Independently evaluates each clip at 60 Hz (320 sample times), CPU-skinning every vertex and checking finite output. Weight-sum error <=4.47e-8, bind identity error <=7.79e-7. No new loader/runtime integration or GPU benchmark.
- Added `scripts/roundtrip_runner.py`: imports the GLB in a fresh Blender scene, compares bidirectional sampled deformed surfaces to the canonical bake and renders CPU Cycles pose sheets. Five times per clip match within 0.005 mm. Filtered out the glTF importer's custom bone-shape helper mesh when measuring character geometry. `-- --check-only` repeats numerical checks without rendering.
- Visually inspected five front and five side poses for each clip (40 rendered poses), finding no major twisting, exploding joints or detached skin in the samples. Evidence: ignored `test-results/runner/{idle,run,jump,land}-poses.png`. Review geometry is centered only for the sheets; output motion is retained. **Continuous normal/slow playback, rear/oblique review, support-foot locking/sliding, ten-cycle seams, phase/blend transitions and gameplay-scale readability are not fully validated.** This is the supplied temporary Mixamo Beta mannequin, not the finished cinematic shadow-runner design.
- Enhanced existing intake/channel reports and comparison output, added the missing root ignore rule for private runner sources/reports/Blender files, and updated asset provenance, validation, README and workflow with exact reproduction commands. Full private reports and canonical .blend are under `asset-source/runner/`; source bytes remain preserved. Exact source library titles/URLs/license/delivery evidence remain unconfirmed. User-authorized local export only; no publication.
- Verification: delivered-file GLTFLoader/CPU checks and fresh Blender numerical round trip passed. `npm.cmd run typecheck`, `npm.cmd test` (12/12) and production build passed. Runtime website/lab JS and CSS remain unchanged from W4.3; Vite copies the new public GLB without adding it to the homepage imports. Existing separate lab chunk-size warning remains. No browser/backend performance or final appearance claim.
- Stopped after F2B.1. The compatibility blocker is resolved for the supplied source set; in-place/contact/phase editing, budget/provenance review, final character art and separately authorized runtime/gameplay work remain outstanding.

## W4.4 - Concurrent cinematic loading and intro playback - 2026-11-10

- Inspected AGENTS.md, W4.1-W4.3 progress, PlayExperience, ShadowBackground, Website, resource loading, styling, installed dependencies and browser suites. No new dependencies or media edits.
- ModeSelection import and the single shadow video now prepare together immediately on Play. The existing presented-frame callback/decoded-playing fallback gates shadow readiness; the same element continues into modes. Both the module and visual destination (decoded video or established static fallback) must be ready before Skip appears or a completed intro starts darkening.
- Replaced the Play loading spinner with a bottom-aligned 2px progress bar and explicit 0/2, 1/2, 2/2 resource milestones. These represent module and visual readiness, not byte percentages. Skip fades in over 250 ms; loading completion never finishes the intro. Natural ended and Skip share the existing synchronous guard.
- A completed intro holds its decoded final frame and keeps the readiness indicator visible while preparation finishes. Preserved 450 ms darkening, incoming-frame readiness gate, 450 ms reveal and 250 ms mode-options fade. Retained caption/error/static fallbacks, Back cleanup, landscape gating, fullscreen ownership, mute persistence and the one continuous soundtrack.
- Current supplied intro differs from historical W4.1 metadata: 10,036,597 bytes, browser duration 40.673967 seconds. Media files were not changed. Replaced the previous 20-second absolute playback cutoff with a 20-second no-playback-progress watchdog; healthy longer playback now reaches its actual ended event. Shadow preparation has a 15-second failure watchdog from Play, paused by the orientation gate; timeout selects the existing static fallback rather than reporting fictitious download progress.
- Updated browser assertions for concurrent shadow requests, readiness-gated Skip, retained outgoing frame/no spinner, current media metadata and soundtrack looping during the longer cinematic. The held-shadow test seeks near the real media end before waiting for its native ended event; the actual-media suite plays the entire intro without seeking. Deliberately canceled stalled-request interception cleanup is handled by the harness.

- Verification: `npm.cmd run typecheck`, `npm.cmd test` (12/12) and final production build passed. Website JS 212.57 kB minified / 67.13 kB gzip; existing separate lab chunk warning remains. Final `shadow-modes-browser.mjs` passed: approximately 456 ms darkening / 455 ms reveal, discrete readiness, held final frame, Skip/ended race, failures/timeouts, loop wraps, reduced motion, mobile rotation, music and cleanup. `play-intro-media-browser.mjs` passed full 40.673967-second natural playback, held module readiness, Skip and mobile/audio continuity. `landscape-browser.mjs` and `music-browser.mjs` passed. Loading-bar screenshot visually reviewed; artifacts retain existing ignored W4.1/W4.2 names under `test-results/`.
- Browser evidence uses headless Chrome with software rendering and mobile emulation. Native iOS/Android playback, fullscreen permissions, safe-area changes and physical-device review remain outstanding. No media, gameplay, renderer or subsequent milestone changes.
- Final `play-browser.mjs` passed: caption fallback, full real-video completion with delayed destination, keyboard/touch Skip, missing/rejected playback, reduced motion, failed destination recovery and Back/focus. Stopped after W4.4; awaiting approval for any next milestone.

## GitHub repository preparation ? 2026-11-10

- User requested a new GitHub repository and project upload, and selected Public visibility. Intended repository: `amanzx-git/cinematic-portfolio`.
- Refreshed the existing README title, technology summary, current website status, development links and current Play video duration. No runtime code, dependencies or milestones changed.
- Intended repository description: Cinematic developer portfolio built with React, TypeScript and Three.js, featuring video transitions, ambient audio and a WebGPU/WebGL 2 rooftop rendering lab.
- Verification: TypeScript checking, all 12 unit tests and production build passed. Existing separate lab chunk-size warning remains. Ignored dependencies, build output, browser artifacts and private character sources stay outside the commit; no unignored file exceeds 50 MiB.
- Created public repository https://github.com/amanzx-git/cinematic-portfolio with the description above. The connected toolset lacks repository creation and GitHub CLI is unavailable; existing Git credentials work outside the sandbox. Initial project import pushed successfully to `main`; local `main` tracks `origin/main`. Existing whitespace check reports a pre-existing trailing blank line in tests/landscape-browser.mjs; left runtime/test files unchanged.

## F2B.2 - Animated Runner Playground - 2026-11-11

- Explicitly authorized F2B.2 supersedes the historical F0-only instruction for this task. Read AGENTS.md, this log, F2B.1 validation and the existing renderer/route architecture. Added only the isolated `/lab/runner` route, playground files and tests; no cinematic, media, gameplay or character-asset edits, dependencies, or future milestone work.
- Lazy-loaded RunnerLab reuses SceneCanvas and initialized WebGPURenderer with automatic WebGL 2 fallback and `?backend=webgl`. Loader and runner controls are outside homepage imports; Vite emits a separate runner chunk (51.09 kB minified / 15.96 kB gzip) and shared renderer chunk. Website entry is 212.91 kB / 67.23 kB gzip. Existing renderer chunk-size warning remains.
- One AnimationMixer owns all four repeating inspection clips. Idle/Run/Jump/Land controls use configurable 0-0.3 s crossfades, retire outgoing actions and handle interrupted fades. Transition test runs Idle -> Run -> Jump -> Land -> Idle, then continues Idle. Pause/resume, 0.1-2x speed and restart are available; transition timing follows animation time and pause/speed.
- Fixed front/side/back/three-quarter orthographic cameras, half-metre floor grid and colored origin axes support inspection. Diagnostics update four times per second, showing current clip, duration, time, speed, Hips displacement from clip time zero, approximate FPS, active actions and mixer count. No per-frame React state updates or postprocessing/shadow-map expense.
- Source root motion and the GLB remain intact. Explicit horizontal in-place mode offsets only the preview parent, retaining vertical motion and reporting original Hips displacement. All four clips repeat intentionally for inspection, including Jump/Land; production one-shot policy is not changed. Source travel resets at seams, Jump/Land phase mismatch, possible blend sliding/snaps, temporary mannequin appearance and 49,112 triangles are visibly disclosed.
- Lifecycle owns the loaded asset, mixer, skeleton/geometry/materials, grid/axes and renderer. Late loads are disposed; actions stop and mixer root bindings are uncached on unmount. GPU disposal follows the existing R3F root's deferred teardown. Missing assets/graphics failures and scene errors have readable messages.
- Verification: `npm.cmd run typecheck`, `npm.cmd test` (13/13) and production build passed. New real-GLB unit test covers interrupted fades settling to one action, measurable forward travel, the complete transition sequence, unchanged source animation data and mixer action/binding cleanup. No final motion/contact cleanup or gameplay integration is claimed.
- Desktop production browser suite `node tests/runner-browser.mjs`: passed in Chrome 157 at 1440x1000, automatic WebGPU and forced WebGL 2. Each clip ran across repeated cycles; controls, camera selection, pause/resume, paused restart, speed, full sequence, interrupted fades, in-place toggle and leaving the route passed; zero captured console errors/runtime exceptions. Captures and diagnostics are under ignored `test-results/runner-{auto,webgl}-*.png` and `runner-browser.json`.
- Reviewed front, side, rear and three-quarter captures: character, grid and origin render without obvious major deformation or unexpected scale/orientation changes in sampled poses. Repeated source travel and airborne Land are expected asset limitations; foot locking, phase quality and all-frame blend quality are not certified. Diagnostic samples were approximately 97-120 FPS; no instrumented CPU/GPU timings, long-run frame-pacing benchmark or performance budget approval was performed.
- Stopped after F2B.2. No gameplay integration, root-motion editing, optimization, new character art, asset publication or next milestone is authorized by this work.

## G0 - First Playable Auto-Runner Prototype - 2026-11-11

- Read AGENTS.md, progress, F2B.1 validation, F2B.2 playback and renderer/route code. The explicit G0 request authorizes this isolated gameplay prototype despite the historical F0-only instruction. Added `src/game/{simulation,input,animation,GameLab,game.css}`, a lazy `/lab/game` route and game tests. Existing homepage, cinematic, mode selection, audio, F2B.2 playground and GLB remain unchanged. No dependencies or physics engine added.
- Movement is a deterministic 120 Hz fixed-step simulation with 4.5 m/s +X travel, 20 m/s² gravity, 7.8 m/s jump velocity, point-foot support/descending top-plane landing tests, and a fixed Z=0 gameplay plane. Platforms span [-4,8] and [10.6,23] m; the 2.6 m gap is jumpable from near the amber takeoff guide. Green flag/finish line at x=19 stops the run. No enemies, collectibles, combat, procedural generation or level art.
- A 0.65 s ready period starts each run. One grounded jump request is consumed on a simulation tick; airborne requests and keyboard repeat cannot add jumps. Falling below -3.2 m freezes the failed run with a readable HUD message for 1.1 s before restarting. Manual restart and automatic restart increment the restart count. Pause freezes simulation and animation. Space/Up or the visible pointer/touch/keyboard Jump button jump; R or Restart resets. Input listeners are removed on unmount; blur/visibility changes clear queued input, and hidden tabs do not advance gameplay.
- Rendering interpolates consecutive simulation positions and uses an exponentially damped side-following orthographic camera with forward lookahead and viewport-based framing. Camera pans back on reset rather than snapping; a short reset pan can temporarily put the spawn outside frame. Forward play remains framed. Desktop and 844x390 landscape controls/HUD fit without horizontal overflow. Geometry is deliberately simple, with no shadows/postprocessing.
- Animation is presentation only: one separate mixer uses cloned runtime clips with every Hips position channel replaced by the same bind-position anchor. This explicitly removes source forward/lateral travel AND baked vertical arcs for G0 without modifying GLB/source tracks or the F2B.2 behavior. The world-position parent is owned only by simulation. Rotations/articulation remain intact; Run cadence is approximately matched to speed. Idle is used in ready/failed/finished states, Run on ground, Jump during flight (once/clamped through descent), Land recovery from source t=0.72 s for 0.22 s after actual contact, then Run. Transitions use deterministic 0.06 s fades with outgoing-action retirement; no source phase alignment is assumed.
- HUD shows current animation, grounded state, forward position, vertical velocity, restart count and phase/status. Inspectable output data also records jump/landing counts, simulated/rendered position and camera follow coordinate for browser verification. No per-frame React state writes. Asset load, graphics and render errors have readable fallbacks. Late loads, actions, mixer bindings, input listeners, skeleton/material/geometry and renderer are cleaned up; GPU disposal follows SceneCanvas's deferred R3F teardown.
- Checks: `npm.cmd run typecheck`, `npm.cmd test` (16/16) and production build passed. Three new real simulation/asset tests cover successful crossing at 30/60/144 Hz, no double jump, delayed fall reset, bounded 30-second spikes/non-finite delta, world-position continuity across states, constant presentation root translation, source-clip preservation, single settled action and mixer binding cleanup. GLB SHA-256 remains `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Desktop production browser checks passed in Chrome 157, actual WebGPU and forced WebGL 2: automatic travel, Space jump, airborne Up rejection, landing and finish, pause/resume, R restart, fall delay and automatic restart, interpolated position/follow-camera checks. An emulated 844x390 mobile landscape run used real CDP touchStart/touchEnd on Jump and completed the course. Zero captured console errors/runtime exceptions. Screenshots reviewed for desktop airborne framing and mobile finish/control readability. Evidence: ignored `test-results/game-{auto,webgl}-jump.png`, `game-mobile-finish.png`, `game-browser.json`; harness `node tests/game-browser.mjs` uses production preview :4173 and a CDP browser :9222.
- Limitations: technical 49,112-triangle mannequin, no final art or contact/phase authoring. Fixing all Hips translation keeps gameplay independent but loses pelvic bob; foot sliding, ground-contact offsets and pose pops can remain, especially around Land. Collision is a point-foot/top-plane prototype, not a full capsule/wall solver; no jump buffering/coyote-time assistance. Restart returns to spawn with a camera pan; long frame stalls deliberately drop excess elapsed time instead of catching up. Browser/viewport emulation does not replace physical mobile testing or an instrumented frame-pacing/GPU benchmark. Asset provenance and triangle-budget concerns from F2B.1 remain unchanged; no publication performed.
- Lazy output: game module approximately 8.97 kB minified / 3.63 kB gzip plus shared loader/renderer chunks; website entry approximately 213.25 / 67.31 kB. Existing renderer chunk-size warning remains. Stopped after G0; no cinematic integration or next milestone implemented.

## G0.1 - Refine Jump and Landing Animation Rules - 2026-11-11

- Read AGENTS.md, progress and G0 simulation, input, animation, rendering and tests. Implemented only the explicitly requested G0.1 refinement. Course geometry, auto-running/jump/restart/pause controls, camera following, lazy route, renderer fallback, F2B.2 playground, cinematic/homepage/modes/audio and GLB remain unchanged. No dependencies added.
- Normal jumps keep the Jump action active for all airborne motion, including descent (its one-shot tail stays clamped if the flight lasts longer than the clip). On ordinary contact the state goes directly Jump -> Run using the existing 0.06 s fade; it never selects Land.
- Hard impacts are classified by simulation contact, requiring BOTH configurable thresholds: peak-to-contact fall distance >=2.5 m AND downward impact speed >=10 m/s. Impact speed is evaluated at the actual ground-plane crossing from velocity/height before contact velocity is cleared. Defaults and the 0.38 s recovery duration live in `defaultLandingRules` in `src/game/simulation.ts`; Simulation accepts per-instance overrides. The current course has a y=0 landing plane, so fall distance is the flight's maximum height above that plane. A standard jump falls about 1.52 m at 7.8 m/s; the debug drop falls 3 m at about 10.95 m/s.
- A hard contact increments one hard-landing event and sets the recovery timer once. Forward motion and new jump requests are held during recovery; ground ticks cannot retrigger Land. Land remains LoopOnce and uses the existing source recovery region beginning at 0.72 s, with playback scaled to fit that entire region into the recovery interval, then returns to Run. Finish-state handling also waits for recovery. Restart explicitly clears recovery and flight measurements. Animation never writes the player parent/simulation coordinates; the existing runtime-only in-place cloned tracks preserve position and source animation data.
- Added a development-only `Test high drop` button on `/lab/game`: explicitly resets to x=0/y=3 above the existing starting platform and lets the same gravity/contact code produce the impact. No platform or actual course expansion. HUD adds measured impact/fall values, hard-landing recovery status and inspectable counters. Its reset is deliberate; normal animation transitions do not reset positions.
- Verification: TypeScript and production build passed; `npm.cmd test` passed 19/19. Added full-step assertions for normal Jump -> Run, descending Jump/no midair Run, hard Jump -> Land -> Run once, held world position and jump rejection throughout recovery, threshold overrides requiring both tests, restart clearing recovery and 30/60/144 Hz consistency. Existing root-anchor/source-clip immutability and cleanup tests still pass. GLB hash is unchanged: `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Existing source/contact limitations remain: fixed Hips translation removes pelvic bob and can leave foot offsets/sliding or pose pops; this is state-rule refinement, not new motion authoring. The debug drop may begin near/above the fixed camera's top edge before falling into view. Existing renderer chunk-size warning remains. Game chunk is approximately 10.42 kB minified / 4.01 kB gzip; no new render effects or performance claims.
- Final production browser suite `node tests/game-browser.mjs` passed on Chrome 157: actual WebGPU and forced WebGL 2 normal Jump -> Run with zero hard events, a 3 m physics drop -> one Land -> Run, held x through recovery, rejected recovery jump, pause/resume during Land, no repeated hard contacts, finish/fall/restart and mobile-landscape CDP touch completion. No captured console errors/runtime exceptions. Reviewed paused hard-landing screenshot; feet/contact offsets remain the previously disclosed presentation limitation. Evidence: ignored `test-results/game-{auto,webgl}-hard-land.png`, existing jump/mobile captures and updated `game-browser.json`. Desktop jump scheduling now uses an in-page keyboard event at the measured ledge position to avoid CDP round-trip timing flakiness; mobile continues to use actual CDP touch events. Physical-device testing and a GPU/frame-pacing benchmark remain outside these checks.
- Stopped after G0.1. No course expansion, new gameplay systems, source motion edits or next milestone work.

## G0.1.1 - Fix Hard Landing Animation Duration - 2026-11-11

- Read AGENTS.md, progress and G0.1 simulation/animation/tests. Inspected the actual delivered GLB using installed GLTFLoader and AnimationMixer; added reproducible read-only `node scripts/inspect-land.mjs`. No asset, playground, course, cinematic, website/modes/audio, renderer or dependency changes.
- **Actual Land duration: 1.0333333015441895 s.** The clip has 195 tracks; animated tracks have 32 samples spanning 0-1.033333 s at approximately 30 Hz, while constant tracks use two endpoint keys. Source Hips Y: 1.542 m at t=0, 0.855 at 0.30, minimum approximately 0.614 at 0.50, 0.878 at 0.72, 0.960 at 0.90 and 0.964 at the end. Foot-joint heights descend from approximately 1.14 m to stable ankle-height contact around 0.30 s. The meaningful ground section includes compression around 0.30-0.50 and recovery through approximately 0.90; the tail settles rather than containing a long inactive hold.
- **Root cause:** G0.1 explicitly started Land at t=0.72, skipping its impact and deepest compression. It played only the final 0.313333 s of source motion, stretched to a 0.38 s timer (approximately 0.82456x), so excessive playback speed was not the cause. The timer was approximately synchronized to that short tail, not cutting off the full 1.033 s clip midway. A 0.06 s crossfade was secondary; runtime suppression of all Hips Y articulation also erased the crouch's weight.
- Land now starts at measured contact t=0.30 and plays once at 1x to the real end: approximately 0.733333 s of contact/compression/recovery. It deliberately skips only the source airborne lead-in, which would replay a descent after gameplay contact. No original clip is edited. Runtime-only Land translation fixes X/Z while preserving Y compression relative to its settled pelvis anchor; this is local skin articulation, not movement of the gameplay parent. Other clips retain their previous in-place strategy. World coordinates and physics remain authoritative.
- Removed the fixed recovery duration from physics configuration. Hard contact creates a movement/jump lock; actual Land remaining time drives the diagnostic countdown. A filtered AnimationMixer `finished` event for this action permits Land -> Run, then an 0.08 s exit crossfade completes before the movement lock is released. Total protected time is approximately 0.813 s, rounded to simulation ticks, with no arbitrary extra hold. No forward sliding during compression or the exit blend. LoopOnce/clamp and explicit outgoing-action retirement prevent replay. Listener cleanup and restart interruption are handled; a stale/canceled action cannot complete a new landing.
- Kept normal Jump -> Run, hard-impact thresholds, high-drop control, pause/restart/touch, camera and both render backends. Diagnostics add Land time/duration, 1x speed and completion evidence, alongside actual fall/impact values. Pause freezes mixer time and the movement lock together; Restart intentionally cancels recovery.
- Verification: TypeScript and production build passed; `npm.cmd test` passed 20/20. Hard-landing tests at 30/60/144 Hz require exactly one completion at the actual final clip time, 1x playback, no early state change, fixed world position/jump rejection throughout motion and blend, and resumed Run after completion. Added restart-during-Land/new-landing/source-clip immutability coverage. Existing normal-jump, threshold, fall/restart and cleanup checks pass. GLB SHA-256 remains `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Existing renderer chunk warning remains; game module approximately 11.64 kB minified / 4.33 kB gzip. No benchmark claim. Source foot contacts/pose matching still have prototype offsets; this change restores the actual crouch but does not author new motion or certify foot locking. Ground contact starts at an inspected source sample, not a retargeted contact solution.
- Final `node tests/game-browser.mjs` passed in Chrome 157 with WebGPU and forced WebGL 2: native-speed Land reaches exactly 1.0333333015441895 s once before Run, recovery holds x, no repeated events/loops, pause freezes clip time and position, blend lock releases, normal jumps use Run on contact, and fall/restart plus mobile-landscape touch completion remain intact. Zero captured console errors/runtime exceptions. Reviewed `test-results/game-auto-hard-land.png` at source t approximately 0.50: visible deep compression with character on the platform. Evidence also includes WebGL capture, mobile finish and `game-browser.json` under ignored test-results. Physical-device visual feel/performance remains manual.
- Stopped after G0.1.1; no additional milestone or course changes.

## G0.2 - Movement, Collision and Camera Polish - 2026-11-11

- Read the attached G0.2 request, AGENTS.md, progress and G0/G0.1/G0.1.1 simulation, rendering, input, animation and tests. Explicit G0.2 authorization supersedes the historical F0-only milestone constraint. Changed only game collision/camera/presentation/HUD, relevant tests, a read-only inspection script and this log. No homepage, cinematic, modes, audio, `/lab/runner`, GLB or course layout changes; no dependencies/physics engine, new gameplay mechanics or level art.
- **Collision shape:** a feet-centred, axis-aligned rectangular body, width 0.44 m, standing height 1.8 m and debug depth 0.5 m. The body covers the neutral 1.8 m mannequin torso/standing height while animated limbs may extend outside it; it never changes shape with animation. Gameplay uses only XY and fixes Z=0. `collider` in `src/game/simulation.ts` is the explicit dimensions source. Collision surface is the body's bottom y; the animated visual is an independent child.
- Replaced point support with horizontal body-width overlap against the unchanged platform tops (both y=0, slabs extend to y=-1). A 0.00001 m contact tolerance rejects zero-width edge touches and keeps support stable. Grounded ticks snap only feet Y to the known supporting top; the centre may extend up to half-width past an edge while some foot area remains supported. Walking clear of that area starts gravity naturally, with no coyote time/double jump. Support identity is cleared in flight and restored only on a real descending top crossing.
- Swept top contact evaluates body overlap at the actual ballistic ground-plane crossing, not just the end-frame/body overlap. Swept front-face checks block forward travel against the platforms' solid sides while the body's vertical interval intersects the slab. They constrain travel at the face without pulling the character sideways/upward to a ledge. Rising overlap never creates a landing. Existing 120 Hz fixed steps and 0.1 s delta cap prevent catch-up spirals; high downward speeds are swept through platform tops rather than tunneling. No speed, gravity, jump velocity, hard-drop thresholds or course coordinates changed.
- Fixed an associated finish case: a runner that lands beyond the flag stops where it landed instead of teleporting backward to x=19. Grounded runs crossing the finish still stop at x=19. No new finish mechanic or course extension.
- **Restart camera:** added small numeric `FollowCamera` state in `src/game/camera.ts`. A changed restart counter immediately sets follow X to spawn/actor X+2.6, discarding old damping. Simulation already resets previous/current position and its accumulator together; rendering now synchronizes camera reset on that same render frame for manual, automatic and debug resets, including while paused. Normal exponential following, orthographic framing, lookahead, Y/Z orientation and desktop/mobile composition are retained. No return sweep across the course.
- **Foot presentation:** measured CPU-skinned sole bounds of gameplay's cloned clips at 30 Hz (`node scripts/inspect-game-contact.mjs`). Before visual correction, minimum sampled sole heights were about 0.00953 m Idle, 0.06462 m Run and 0.07008 m Land's validated contact section. Visual-only Y offsets are -0.0095/-0.0646/-0.0700 m respectively; Jump shares Run's offset for the takeoff/normal-touchdown blend. Offsets blend by actual scheduled action weights, never change collider/world position, require no skin readback at runtime and preserve the source asset. Run stride time is saved on leaving Run and restored on returning, avoiding a needless time-zero stride reset; deliberate restarts clear that phase.
- Approved animation rules remain: Jump throughout flight, ordinary Jump -> Run, hard Land once from 0.30 to 1.033333 s at 1x, mixer completion followed by 0.08 s exit blend and protected movement through recovery/blend. No new trimming, playback speed, crossfade, source root policy or procedural IK. Existing cleanup remains intact.
- HUD now includes collider width/height/depth, support platform (1/2 or none), feet Y relative to the course's y=0 platform tops and animation/grounded state; detailed landing counters/times remain inspectable. Added optional wireframe Collider checkbox, disabled by default. HUD avoids dumping inactive Land timing during normal running. Animation/geometry updates do not cause per-frame React renders; the lazy route and WebGPU/WebGL 2 architecture are preserved.
- Verification: TypeScript checking, `npm.cmd test` (28/28) and production build passed. New tests cover stable grounded ticks with tiny numerical offsets, body-width edge landings without X snapping, walking off support, rising/side overlaps, no extra airborne jump, high-speed swept landing and capped long spikes, immediate manual/automatic/debug camera resets with no stale damping, stride-phase preservation, presentation/world-position separation and finish overshoot. Existing normal/hard animation completion and 30/60/144 Hz consistency/cleanup/source-immutability tests pass. GLB SHA-256 remains `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Limitations: simple forward-only, upright body against the existing flat static course; no slopes, moving platforms, ceiling/overhang solver or general arbitrary-world physics. Exact zero-width edge touches are unsupported by design. Fixed visual corrections reduce offsets but do not lock individual feet; source stride lift/sliding and blend pose mismatch can remain. No complex IK or motion authoring. Physical mobile testing and instrumented frame-pacing/GPU benchmarking remain outstanding; the existing renderer chunk warning remains. Game module approximately 13.8 kB minified / 5.1 kB gzip, with no added expensive render effects.
- Final production `node tests/game-browser.mjs` passed on desktop Chrome 157 at 1440x900 with actual WebGPU and forced WebGL 2, plus 844x390 mobile landscape CDP touch. Checked optional collider display, support/feet diagnostics, Jump -> Run, full one-shot Land/native timing and protected blend, pause/restart, direct manual/automatic camera X=2.6 with actor X=0 and no stale follow state, finish and fall recovery. No captured console errors/runtime exceptions. Reviewed desktop collider/landing and mobile finish captures for feet/body alignment, HUD and controls; no horizontal overflow. Artifacts: ignored `test-results/game-{auto,webgl}-{jump,hard-land}.png`, `game-mobile-finish.png`, `game-browser.json`. Final inspection script confirms the sole-bound measurements above. Physical-device and longer subjective contact/frame-pacing review remain manual.
- Stopped after G0.2. No further milestone implemented or integrated into the cinematic flow.

## W4.5 - Cinematic Intro Audio Handoff - 2026-11-11

- Read AGENTS.md, progress W3.0-W4.4, BackgroundMusic/useBackgroundMusic/Website, PlayExperience, shared sound/orientation controls, media inspection and relevant regression suites. W4.5 explicitly authorizes this website audio refinement. No dependencies or edits to video/audio media, homepage/mode design, loading/Skip readiness logic, transition durations, gameplay/lab routes or runner assets.
- Verified the currently supplied `play-intro.mp4` with read-only MP4 inspection before editing code: 72,077,650 bytes, SHA-256 `6bf20909760eabc6a524356c3342646b5c4a182047b4e6911bd0d93e40b0b22f`, H.264 video 28.866667 s plus embedded AAC/mp4a audio 28.909333 s (1,356 audio samples). Chrome reports 1920x1080 and 28.867 s. This existing working-tree file differs from historical W4.4 media; it was preserved without modification/replacement. No substitute soundtrack was created. Ambient's current Chrome duration is 47.429569 s; its source is likewise unchanged.
- Extended the existing BackgroundMusic controller to coordinate ambient, intro and silent-transition ownership. There is still exactly one persistent ambient audio element. Play starts a cancellable 250 ms fade-out, then pauses/mutes ambient before the intro video starts playing its own embedded audio at volume 0.7. Picture/sound share the native video clock; no extraction, separate audio element, seek, playback-rate change or audio synchronization loop. Initial Enter behavior remains a 650 ms fade to ambient volume 0.35 with the existing mute/storage/consent policy.
- Removed the intro's unconditional JSX/effect mute. Global mute now immediately silences the active video and ambient; unmute retries only the appropriate source. All other decorative website videos stay muted. Explicit saved mute is never changed by navigation, fallback or autoplay recovery. Existing localStorage guards remain.
- Natural completion/Skip immediately silence intro and enter silent ownership. An early Skip also cancels/silences any unfinished ambient fade, so black cannot contain residual music. Neither loading 100%, Skip availability nor black/reveal phases resume ambient. At W4.4's existing MODE_SELECTION/fully revealed boundary, the same ambient element resumes its previous currentTime with a 500 ms fade-in. Back during intro/transition immediately stops video sound, cancels pending handoff callbacks and restores ambient on the homepage. Back from modes keeps the current ambient playback. No duplicate track instance or competing fade loop.
- Ambient revisions, video attempt revisions, element identity and owner checks cancel rapid Play/Back/Play and late native play resolutions. Video detachment, native pause/source teardown and controller disposal silence old elements; RAF callbacks and handoff waiters are canceled/released. Stable stage callback/ref identities avoid restarting visual transition timers on mute/status updates. Mobile orientation pause/resume continues using the same video/currentTime; audio cannot restart behind an orientation gate.
- Audible-video NotAllowedError falls back to muted moving video with a visible retry notice; sound off/on retries from the user gesture. This does not save a mute choice or start ambient during the intro. Full video-play failure still uses the established caption fallback. Ambient playback rejection retains the existing nonblocking retry guidance. Reduced motion/static fallbacks preserve their established navigation, with no invented intro audio.
- Verification: `npm.cmd run typecheck`, `npm.cmd test` (32/32) and final production build passed. Four added unit scenarios cover gated fade handoff and silent transitions, mute/source selection/position resume, stale navigation and late play callbacks, blocked audible-video fallback without preference override, plus the early-Skip cancellation edge case. Existing tests remain green. Website entry approximately 215.56 kB minified / 67.90 kB gzip; existing separate renderer chunk warning remains.
- New `tests/audio-handoff-browser.mjs` exercises actual supplied media, uninterrupted natural completion, Skip, loading-ready silence, native decoded audio, global mute/retry, Back during intro/transition, rapid navigation, blocked audible playback and a single persistent ambient element. First native run sampled 4,907 frames: no two audible sources and no audio during darkening/waiting/revealing; decoded AAC count 694,541 bytes at the natural end. Evidence is under ignored `test-results/w45-audio.json`. Native stream-clock/decoding and element-volume/mute state checks do not constitute a listening/subjective mix-quality review.
- Updated old browser expectations that all videos stayed muted or music played continuously across intro. Music, actual-intro-media, Play and homepage-media regressions passed, covering consent/persistence, missing/blocked media, reduced motion, held final frames/readiness, native completion, keyboard/touch Skip, load failures and no decoded-frame gap in homepage video handoffs. Browser harness maintenance recognizes expired CDP interceptions after source cancellation and lets landscape tests use DEBUG_PORT, matching the other suites.
- Limitations: physical iOS/Android audible autoplay, native volume/fade support, speaker/headphone loudness and perceived audio synchronization still need device/listening review. Browser denial may require the sound control gesture; it is reported, never bypassed by changing stored mute. Native mute/pause enforce exclusive ownership even where browsers ignore programmatic volume. No publication or later milestone work.
- Final verification after the early-Skip guard: 32/32 unit tests and production TypeScript/build passed. `audio-handoff-browser.mjs` passed with 5,035 sampled frames, zero overlapping audible sources, zero audio in darkening/waiting/revealing, 28.867 s uninterrupted native completion and 694,541 decoded audio bytes. Final shadow-modes suite passed readiness/held-frame/loop/failure/timeout/reduced-motion/race/cleanup checks (approximately 456 ms darkening and 456 ms reveal). Landscape suite passed rotation, rejection/missing native APIs, pause/resume, mute and mobile/desktop layout regressions. Earlier music, real-intro-media, Play and homepage-media suites also passed; canceled/expired CDP interception handling and the test debug-port setup were corrected before the final rerun. All captured runtime/console error lists were empty on passing runs.
- Stopped after W4.5. No media editing, gameplay integration, design changes, publication or subsequent milestone work.

## G1 - Cinematic Nighttime Rooftop Environment - 2026-11-11

- Read AGENTS.md, progress and G0-G0.2 simulation, animation, camera, rendering, instancing and browser tests. Reviewed the mode-selection nighttime screenshot for navy/amber atmosphere; no video/frame is used by gameplay. Explicit G1 authorization supersedes the historical F0-only instruction. Added `src/game/NightEnvironment.tsx`, deterministic `environment-data.ts` and environment tests; updated only GameLab presentation/comparison controls and this log. No changes to simulation, collision, input, approved animation rules, restart camera, homepage, cinematic/video assets, mode selection, audio or `/lab/runner`. No story events, enemies, cards, contact forms, new levels, mechanics, textures or dependencies.
- **Sky and city:** one static TSL sky draw blends blue-black/navy toward a hazier horizon, with an aspect-correct moon and restrained analytic halo. Three distance-colored corporate skyline layers at Z=-38/-23/-11 provide authored silhouettes, stepped crowns, spires/plant housings and sparse amber office strips. Haze is achieved through sky/palette separation, not volumetrics. Each layer has 12 tower designs repeated in three seamless tiles; 69 silhouette components per layer plus 510/381/246 small window instances respectively share one body draw and one optional window draw per layer. Layouts are deterministic, with no random/per-frame geometry generation.
- **Rooftops:** surfaces/facades derive directly from the unchanged collision spans [-4,8] and [10.6,23], with top exactly y=0. Blue-gray roof skin, moonlit front/rear/side coping, facade ribs and restrained office panels expose the gap and ledge boundaries. Reusable rear HVAC housings/louvers, eight-sided pipes and low conduits stay behind the clear Z=0 running lane. Facade depth is visual only; collision slab bounds remain G0.2's [-1,0]. Decorations do not enter simulation/collision and cannot become obstacles. The existing amber takeoff guide, green finish marker and mannequin remain intact.
- **Parallax:** background movement relative to the camera is 8%, 18% and 34% of camera travel; foreground roofs remain in world space. Numeric CityParallax accumulates travel only within the same restart generation, rebasing the layer groups when the camera intentionally returns to spawn, so the background retains its screen position instead of sweeping/snapping. Identical 48 m repeat tiles bound transforms through repeated runs without visible wrap seams. Explicit negative frame priorities update gameplay/camera first and parallax second, before the default render; no independent damped clock or one-frame reset lag. Moon/sky stay screen-relative.
- **Rendering/resources:** reused the existing StaticInstances helper, one shared box geometry and one eight-sided cylinder geometry. Materials/resources are cached and explicitly disposed; matrices upload only on batch changes, and only three layer-group positions change each frame. One cool ambient and one moon-directional light replace the previous two-light test setup. No shadow maps, additional lights, postprocessing, transparency effects, noise textures or media requests. The character's original materials retain contrast against the darker skyline; no asset recoloring/export.
- Preserved the HUD/collider toggle and added `Decorations`, which disables city windows, roof equipment, facade details/windows/pipes/louvers while retaining sky, skyline silhouettes, collision-aligned surfaces and essential edge trim. No floating equipment caps/louvers remain when disabled. Render diagnostics use the installed Three r185 scene-after-render callback (`info.render.drawCalls`, not its cumulative render-call counter), and restore the original callback on cleanup. Inspectable HUD data includes parallax/decorations/draw/triangle metrics without per-frame React state updates. `/lab/game` stays lazy-loaded; its module is approximately 18.32 kB minified / 6.95 kB gzip, with a shared instancing/TSL helper chunk. Existing renderer chunk-size warning remains.
- **Verification:** TypeScript and production build passed; unit tests pass 35/35. New tests enforce roof/top/ledge bounds with no decoration spanning the gap, above-ground equipment behind the running lane, deterministic city data, slower parallax, exact screen-relative continuity at reset, no paused drift and bounded repeat transforms over 200 simulated runs. Existing G0.2 and animation tests still cover collisions, no double jump, root/world-position continuity, normal Jump -> Run, one complete native-speed Land and 0.08 s protected exit, restart/cleanup and 30/60/144 Hz behavior. Runner GLB SHA-256 remains `be3588a89c7c21be84e3dc75bbb917df0ff0e3b0e781efc09111ce5babc7bec2`.
- Final production `node tests/game-browser.mjs` passed in desktop Chrome 157 on actual WebGPU and forced WebGL 2, plus 844x390 mobile-landscape touch: full course crossing, hard drop/complete Land, pause, restart, collider HUD, camera reset and navigation cleanup; no captured runtime/console errors. Desktop airborne and mobile finish captures were reviewed for roof alignment, visible gaps, character contrast and usable controls. `node tests/game-environment-browser.mjs` additionally passed both backends' decoration on/off rendering and exact before/after restart parallax offsets. Evidence: ignored `test-results/game-{auto,webgl}-{jump,hard-land}.png`, `game-mobile-finish.png`, `game-browser.json`, `g1-{auto,webgl}-{on,off}.png` and `g1-environment.json`.

### G1 performance observations

Production preview, desktop Chrome 157, 1440x900 viewport, emulated device DPR 1 (game cap 1.5), paused runner near spawn. Each comparison uses a one-second post-toggle warm-up followed by three seconds of all requestAnimationFrame intervals; no intervals were discarded. Counts include the unchanged 49,112-triangle runner. These short paused-scene scheduling samples are not GPU completion timings, gameplay stress tests or physical-mobile performance guarantees.

| Backend | Decorations | Draws | Triangles | Median ms | P95 ms |
|---|---|---:|---:|---:|---:|
| WebGPU | On | 18 | 66,507 | 8.4 | 17.0 |
| WebGPU | Off | 11 | 51,755 | 8.3 | 16.4 |
| WebGL 2 | On | 18 | 66,507 | 8.4 | 16.6 |
| WebGL 2 | Off | 11 | 51,755 | 8.3 | 16.4 |

- Visible finish/debug geometry can increase draw counts slightly (about 19-20 in gameplay captures). Decorative geometry adds approximately 14.8k triangles in this comparison, while the character remains the dominant mesh. No claim of a stable 60/120 FPS budget or independently identified hardware adapter. Longer moving-scene frame pacing, CPU/GPU timing and physical mobile thermal/readability review remain outstanding.
- Limitations: deliberately geometric/instanced architecture, palette-based atmospheric depth and a simple analytic moon; no final skyline art, clouds, physically simulated fog, reflections or baked lighting. Repeated city motifs may become apparent on long/repeated runs. Existing temporary character design, contact/phase imperfections, triangle/provenance concerns and the high-drop debug start near the camera's top edge remain unchanged. Decorative facade depth is not additional collision geometry. No story or website integration performed.
- Stopped after G1. No further milestone implemented or authorized.

## G1.1 - Cinematic Rooftop Environment Art Polish - 2026-11-11

- Inspected the working tree after the interrupted session. The untracked game files still contained G1. Reviewed the live G1 scene, its desktop and mobile captures, and the nighttime mode-selection reference before editing.
- Authored separate far, middle and near districts with five profiles spanning slab crowns, setbacks, split towers, terraces and roof plants. Projecting piers and cornices frame recessed glazing on the middle and near buildings. Selective antennas and uneven clusters of occupied floors use the existing instanced batches. The distant district uses softer colors and sparse detail. The near district uses deeper glazing and stronger silhouettes.
- The roofs now have 0.22 m visual skins, deeper cornices, recessed facade bays, rear parapets, ventilation housings, pipes and small drain grates. Cold-blue caps accent the ends of each roof. Walking surfaces follow the existing spans at y=0. Above-roof equipment sits behind the lane and leaves at least 0.5 m at both ledges. Drain grates sit 2 mm above the rear roof skin to avoid coplanar faces. The small capped post and narrow floor mark identify the existing finish trigger at x=19.
- Refined the static TSL sky with a hazier blue horizon, a broad analytic haze band, a softer lunar gradient and a left-of-center moon. The existing two-light setup provides cool illumination for the runner and roof. Reusable geometry and materials support the Decorations comparison without external textures or new dependencies.
- The G1 parallax model and its restart rebasing drive all three districts. The Decorations toggle removes lights and rooftop equipment while retaining the core architecture, parapets and ledge trim. The collider, HUD, keyboard and touch controls remain available for inspection. Unit coverage now checks rear clearance and ledge margins for above-roof trim and equipment.
- TypeScript checking, 35 unit tests and production build passed. The game module measured 20.14 kB minified / 7.85 kB gzip. The existing shared renderer chunk warning appeared. The environment comparison passed on WebGPU and forced WebGL 2. Before and after each restart, the recorded screen-relative far skyline offset matched exactly.

### G1.1 performance observations

Chrome desktop at 1440x900, device DPR 1. Each comparison uses a one-second warm-up and a three-second requestAnimationFrame sample with the runner paused near spawn. Triangle counts include the runner.

| Backend | Decorations | Draws | Triangles | Median ms | P95 ms |
|---|---|---:|---:|---:|---:|
| WebGPU | On | 18 | 64,731 | 8.3 | 8.7 |
| WebGPU | Off | 11 | 57,743 | 8.3 | 8.4 |
| WebGL 2 | On | 18 | 64,731 | 8.3 | 16.3 |
| WebGL 2 | Off | 11 | 57,743 | 8.4 | 16.8 |

- Compared with G1, the decorated scene uses the same 18 draws and 1,776 fewer triangles. The comparison view retains 5,988 more triangles because it keeps the expanded tower profiles and roof structure. These samples describe short paused-scene frame intervals. Longer moving-scene and physical mobile profiling are outstanding.
- Visual limitations include repeated districts over long runs and stylized geometric glazing and haze. The development runner still has the previously documented foot contact and pose limitations.
- Files edited for G1.1 include src/game/environment-data.ts, src/game/NightEnvironment.tsx, src/game/GameLab.tsx, tests/game-environment.test.mjs, tests/game-environment-browser.mjs and this log. Desktop comparison captures and metrics are in test-results/g11-{auto,webgl}-{on,off}.png and test-results/g11-environment.json.
- Final gameplay regression passed in desktop Chrome on WebGPU and forced WebGL 2 and with 844x390 mobile landscape touch emulation. It covered gap crossing, normal touchdown, full one-shot hard landing, pause, manual and automatic restart, and the finish at x=19. Reviewed the desktop and mobile captures for clear ledges, runner contrast and usable controls. Review captures are test-results/g11-desktop-jump.png and test-results/g11-mobile-finish.png. The runner asset hash matched the G1 value.
- G1.1 complete.

## G2 - Rooftop Escape Level Design - 2026-11-11

The route covers 64 m from spawn to finish, with seven roofs and six jumps. The buildings span x=-4 to x=67. Jump is the sole required action. Amber strips mark takeoffs and blue strips identify the receiving edges. The HUD reports the section and distance progress. A rear utility structure distinguishes the final roof, where the marker at x=64 ends the run.

| Section | Route | Gaps in order (m) | Receiving roof elevations (m) |
|---|---|---|---|
| Learning | x=0 to 23, two level roofs with a long opening approach | 2.60 | 0 |
| Traversal | x=23 to 46, three shorter roofs with rises and drops | 2.50, 2.70, 2.55 | +0.45, -0.25, +0.15 |
| Final escape | x=46 to 64, a longer downhill gap followed by an uphill finish approach | 3.35, 3.05 | -0.10, +0.25 |

Before placing platforms, calculated the limits from speed 4.5 m/s, launch velocity 7.8 m/s and gravity 20 m/s². The same-height flight lasts 0.780 s with 3.510 m of horizontal travel and a 1.521 m apex. The descending time to a roof at relative height h is (7.8 + sqrt(7.8² - 40h)) / 20. For the authored jumps, it ranges from 0.717 to 0.861 s and horizontal travel ranges from 3.228 to 3.876 m. The 0.44 m body contributes up to 0.22 m of overhang per edge subject to the 0.00001 m overlap tolerance. Each 120 Hz tick advances 0.0375 m. The tightest calculated window spans 0.685 m before discretization. Unit tests verify all marks with takeoffs 0.15 m early and late, as well as complete runs at 30, 60 and 144 Hz.

G2 parameterizes support, face blocking and landing impact by each platform top. It uses the established integration, overlap rule, one-jump gate and hard-landing thresholds. All planned jumps return from Jump to Run. The high-drop diagnostic exercises the existing Land recovery. The existing fall threshold and delay return the player to the beginning. The finish remains a stopped gameplay state. Rooftop geometry and guides derive their elevations from the course data and use the G1.1 batches and restart-stable skyline.

TypeScript, production build and 37 unit tests passed. Tests cover elevated landing and side contact, finish, fall and restart, jump timing, animation and skyline continuity. Build output retains the existing renderer chunk size warning.

Desktop Chrome comparison used a paused runner near spawn at 1440x900 with DPR 1, one second of warm-up and three seconds of frame intervals.

| Backend | Decorations | Draws | Triangles | Median ms | P95 ms |
|---|---|---:|---:|---:|---:|
| WebGPU | On | 18 | 67,331 | 8.3 | 8.4 |
| WebGPU | Off | 11 | 58,679 | 8.3 | 8.4 |
| WebGL 2 | On | 18 | 67,331 | 8.4 | 16.6 |
| WebGL 2 | Off | 11 | 58,679 | 8.3 | 8.5 |

Compared with G1.1, the decorated comparison adds 2,600 triangles for the extended architecture and keeps the same draw count. The sampled skyline offset matched exactly across restart on both backends. These figures describe short desktop samples. Physical mobile profiling and player timing feedback are outstanding. A missed jump still costs a full restart, and the current route uses static platforms and a simple finish marker.

Desktop Chrome completed the full route on WebGPU and forced WebGL 2, with normal touchdown at every authored elevation. The 844x390 mobile landscape emulation completed all six jumps using touch input. Browser checks also covered pause, restart, missed jumps, hard-drop recovery and renderer cleanup. The mobile finish capture showed 21 draws and 67,367 triangles. Evidence is in test-results/g2-game-browser.json, test-results/g2-game-mobile-finish.png and test-results/g2-environment.json.

G2 complete.

## G2.1 - Vertical Rooftop Parkour Course - 2026-11-11

The 75 m route crosses nine roofs with seven jumps and one step-off. Roof elevations run from -0.65 to +2.35 m, a 3.00 m range. The opening teaches the amber takeoff marks. Three rises lead to the high corporate roofs and a longer level crossing. Orange marks the maintenance drop. A longer downhill jump and short uphill jump lead to the final roof and the stop at x=75.

| Transition | Action | Gap (m) | Elevation change (m) | Flight (s) | Travel (m) | Calculated takeoff window (m) |
|---|---|---:|---:|---:|---:|---:|
| Opening | Jump | 2.60 | 0.00 | 0.780 | 3.510 | 1.350 |
| First rise | Jump | 2.20 | +0.95 | 0.629 | 2.830 | 1.070 |
| Second rise | Jump | 2.65 | +0.55 | 0.702 | 3.157 | 0.947 |
| Crest climb | Jump | 2.60 | +0.85 | 0.649 | 2.921 | 0.761 |
| High crossing | Jump | 3.25 | 0.00 | 0.780 | 3.510 | 0.700 |
| Maintenance drop | Walk off | 1.85 | -2.70 | 0.520 | 2.338 | Ledge step-off |
| Lower crossing | Jump | 3.30 | -0.30 | 0.817 | 3.675 | 0.815 |
| Final approach | Jump | 2.20 | +0.80 | 0.659 | 2.963 | 1.203 |

The G2 jump equations use 4.5 m/s run speed, 7.8 m/s launch velocity, 20 m/s² gravity and a 1.521 m apex. The table uses descending contact time and adds the 0.44 m collider width minus two contact tolerances when calculating each window. The tightest window is about 156 ms. A centimetre-spaced fixed-step sweep found a successful crest-crossing input range from 0.47 m before the edge to at least 0.21 m past it. Tests verify each mark at ±0.15 m. The step-off yields a 2.70 m fall and about 10.39 m/s impact. The 7.15 m receiving roof gives the approved Land sequence room to finish before running resumes.

The horizontal camera follow uses its established damping. Vertical framing eases toward the next roof starting 2.5 m before typical ledges and 4 m before the maintenance drop. The camera follows terrain height through a smoothed offset and resets both axes at spawn. The skyline keeps its screen-relative horizon and horizontal restart rebase. Projection tests cover the runner and destination ledges through the route.

High roofs have raised corporate housings and antenna details. The maintenance roof has a rear canopy with 1.20 m visual clearance. It reserves a future low-clearance route beside the clear running lane. All architecture uses the existing environment batches and remains presentation geometry. The original clips, hard-landing gate, controls, and HUD diagnostics support the route.

TypeScript, 38 unit tests, and the production build passed. Tests cover all platform arrivals at 30, 60, and 144 Hz, takeoff tolerances, framing, roof clearances, restart, and skyline stability. Current limitations include a full restart on failure, fixed forward speed, and a decorative canopy with future gameplay left for its own milestone. Physical mobile profiling and playtest feedback on the tighter timing remain outstanding.

Desktop Chrome completed the final route on WebGPU and forced WebGL 2. Mobile landscape emulation at 844x390 completed seven touch jumps and one step-off. Browser checks verified that the step-off enters Land, holds world X through recovery, and completes the clip before movement resumes. The debug drop, pause, restart, finish and renderer cleanup passed. The first final mobile attempt missed a touch timing window while polling through CDP. The passing run schedules the wait inside the page before sending each emulated touch event.

Desktop production samples at 1440x900 and DPR 1 used three seconds of frame intervals with the runner paused near spawn. Both backends measured 18 draws and 68,351 triangles with decorations on, an increase of 1,020 triangles over G2 at the same draw count. With decorations off, both measured 11 draws and 59,027 triangles. Median intervals were 8.3 ms and P95 ranged from 8.4 to 8.6 ms across comparisons. The mobile finish capture recorded 21 draws and 68,387 triangles. Restart parallax offsets matched in both desktop comparisons. The existing renderer chunk warning appeared during build.

Evidence is in test-results/g21-game-browser.json, test-results/g21-game-mobile-finish.png and test-results/g21-environment.json. G2.1 complete.

## G2.2 - Functional Slide Mechanic - 2026-11-11

The maintenance roof now has one solid duct across the active lane at x=51.70–53.65 m. Its underside is at y=0.85 m, or 1.20 m above the roof at y=-0.35 m. The top is at y=1.22 m. The beam uses its collision bounds for rendering and carries an amber stripe. The approach follows hard-drop recovery and leaves room before the next amber jump mark at x=55.75 m.

Hold ArrowDown or S on keyboard, or hold the Slide button with touch or a pointer. Each held source is tracked independently. Keyup, pointer release, cancellation and capture loss release their source. Blur, visibility change, pause and restart clear all held sources. A held input during flight can take effect on a later grounded tick, after any Land recovery. A slide suppresses jumping.

The feet-centred body measures 0.44 × 0.80 × 0.50 m during Slide, with the existing 4.5 m/s forward speed. Releasing Slide checks the full 1.80 m standing body on each fixed tick. The short body stays active while the standing volume intersects the duct, then stands when its trailing edge clears. A swept test checks the player's body through the duct's volume, including airborne approaches. A hit holds the last safe position, reports a duct hit and restarts after the existing 1.1 s delay.

The HUD reports movement, body height, held input, standing clearance and failure. The temporary teal box depicts the short collider while sliding. The game uses the existing animation controller for Run, Jump, Land and Idle. Slide presentation is a collider proxy. Collider and Decorations controls remain available, and the duct remains visible in the comparison view.

TypeScript, all 43 tests and the production build passed. Unit tests cover independent input sources, feet alignment, speed, headroom, airborne input, jumping, Land recovery, a swept duct hit and restart. The complete route and projection tests exercise the seven jumps, step-off and duct passage at the marked positions. The existing shared renderer chunk warning appeared during build.

Desktop Chrome passed the full route on WebGPU and forced WebGL 2. The checks exercised both keyboard slide bindings, blur and pause cleanup, release under the duct, normal jumps and the hard-drop lock. Mobile landscape emulation at 844x390 verified touch cancellation, hold and release, and finished all seven jumps and the step-off with zero restarts. The environment comparison waits for the restart counter to advance before reading camera and skyline state.

| Backend | Decorations | Draws | Triangles | Median ms | P95 ms |
|---|---|---:|---:|---:|---:|
| WebGPU | On | 18 | 68,363 | 8.3 | 8.4 |
| WebGPU | Off | 11 | 59,051 | 8.3 | 8.4 |
| WebGL 2 | On | 18 | 68,363 | 8.3 | 8.5 |
| WebGL 2 | Off | 11 | 59,051 | 8.3 | 8.4 |

Desktop measurements are three-second paused samples at 1440x900 and DPR 1. The decorated comparison adds 12 triangles over G2.1 at the same draw count. The mobile finish frame used 21 draws and 68,399 triangles. These measurements cover browser emulation and short desktop intervals. Physical mobile profiling and playtest feedback remain open. The course has one static duct and temporary slide presentation.

Artifacts are in test-results/g22-game-browser.json, test-results/g22-game-mobile-finish.png and test-results/g22-environment.json. G2.2 complete.

## G2.3 integration and G2.4 - Parkour Flow and Urban Redesign - 2026-11-11

The G2.4 request arrived while G2.3 integration was in progress. The saved changes were preserved and the five-clip integration was completed as a prerequisite. Slide is 1.533333 s at 30 Hz. It reuses the canonical 65-joint rig and F2B rest correction. Hash tests verify the original four clips, original binary prefix, mesh, materials, skin and node hierarchy. Source root motion remains in the GLB and the playground. Gameplay uses a cloned in-place Slide retaining vertical articulation. Detailed measurements and reproduction steps are in docs/runner-slide-validation.md.

The old 75 m course becomes a 147 m escape. Nine roofs and two 6 m bridge decks provide eleven supported surfaces. Five marked jumps, one substantial step-off and one timed slide alternate with longer running sections. The nighttime navy and restrained amber presentation retains the existing instanced batches. Railings, bridge beams, vertical supports, communication masts, a rear overhead pipe, duct supports and scaffolding give the route industrial structure. Decorative parts remain outside the movement lane. The bridges use the same platform-top collision system as roofs, with exact visible deck alignment and continuous supported joins.

| Surface | X bounds (m) | Length (m) | Top (m) |
|---|---|---:|---:|
| Opening roof | -4–16 | 20.00 | 0.00 |
| Higher office roof | 18.4–32 | 13.60 | 0.80 |
| Skybridge | 32–38 | 6.00 | 0.80 |
| Connected running roof | 38–53 | 15.00 | 0.80 |
| Drop roof | 55.5–65 | 9.50 | 1.40 |
| Landing and pipe corridor | 66.85–94 | 27.15 | -1.30 |
| Maintenance roof | 96.6–108 | 11.40 | -0.80 |
| Maintenance catwalk | 108–114 | 6.00 | -0.80 |
| Scaffold roof | 114–122 | 8.00 | -0.80 |
| Final jump roof | 124.6–133 | 8.40 | -0.40 |
| Finish approach | 135.5–151 | 15.50 | 0.00 |

The finish trigger is x=147. Physics stay at 4.5 m/s, 7.8 m/s jump impulse, 20 m/s² gravity, 0.44 m collider width and 0.50 m depth. Jump height remains 1.521 m. The five gaps are 2.4, 2.5, 2.6, 2.6 and 2.5 m with rises of 0.8, 0.6, 0.5, 0.4 and 0.4 m. Calculated descending flight times are 0.659, 0.693, 0.710, 0.725 and 0.725 s. Horizontal reaches are 2.963, 3.121, 3.193, 3.262 and 3.262 m. Geometric takeoff windows, including collider width and contact tolerance, span 1.003–1.202 m. Tests exercise each marker ±0.15 m and complete runs at 30, 60 and 144 Hz.

The 2.70 m drop preserves the full authored Land recovery from the approved 0.30 s contact pose to clip end at 1.033333 s. Previously movement remained locked for the remaining clip and exit blend, approximately 0.813 s analytically. Replaying that full-lock schedule at 120 Hz measures 0.816667 s until the first forward movement. Forward motion now starts gradually at clip time 0.82 s. Measured fixed-step full lock is 0.525 s after contact. Speed ramps linearly over the remaining 0.213333 s recovery and reaches normal run speed through the 0.08 s exit blend. Jump and Slide stay blocked until the full protected recovery ends, measured at 0.808333 s after contact. Total forward recovery travel is about 0.836 m, occurring in the late recovery and exit blend. Playback remains speed 1. Normal jumps retain Jump throughout flight and return directly to Run.

The old duct could fit the measured low pose but left insufficient roof for full Slide recovery before the required jump. G2.4 moves the challenge to x=81.0–82.6 on the long landing roof, preserving 1.20 m clearance. The pose-derived 0.80–1.80 m collider fits this clearance during clip time 0.26418–0.91726 s. Its valid activation interval is approximately x=78.692–79.591, a 0.899 m or 200 ms geometric window. The teal x=79 stripe indicates the press. Slide travels 6.90 m and finishes by x=86.491 across this interval, with at least 7.009 m before the next jump marker. Input is press-once on Down, S or the touch button. Recovery collisions fail without crouch extension.

The existing horizontal and terrain-based vertical camera remain sufficient for the new -1.30 to +1.40 m elevation range. Projection tests cover approaches, bridges and the drop. Restart resets the camera while preserving the skyline's view-relative parallax phase. The Collider, Decorations, pause, restart and high-drop diagnostics remain available.

TypeScript and production build pass. All 48 automated tests pass, including the five-clip baseline, runtime Slide skin envelope, entry/low/recovery collisions, press-once input, full animation-backed route at 30/60/144 Hz, bridge support, jump tolerances, recovery movement, camera framing and restart/parallax stability. The production build retains the existing large renderer-chunk warning.

Chrome completed the entire redesigned route on WebGPU and forced WebGL 2 with keyboard input. Chrome landscape touch emulation at 844×390 completed it through the Jump and Slide buttons. Each run finished with five jumps, six airborne landings, one full hard Land, one Slide and zero restarts. Separate checks cover pause during Land and Slide, restart while paused, automatic fall restart, input cleanup, route exit, decorations and skyline continuity. The animation playground independently passed all five clips, cameras, speed, pause/restart and original four-clip transition sequence on both backends.

The browser checks caught a paused-restart presentation problem where a Slide pose stayed visible until resume. Presentation now processes zero-time reset updates during pause. CPU-skinned runtime validation also caught a small vertical offset caused by using Land's pelvis anchoring on Slide. Slide now preserves its measured canonical Y articulation, and the measured collider encloses its skin through the entire clip.

Moving-route samples use requestAnimationFrame intervals after the first 120 frames and retain long intervals. Geometry counts below are the finish frame with decorations enabled.

| Backend / viewport | Draws | Triangles | Median ms | P95 ms | Maximum ms |
|---|---:|---:|---:|---:|---:|
| WebGPU, 1440×900 | 20 | 73,007 | 8.4 | 16.7 | 41.7 |
| WebGL 2, 1440×900 | 20 | 73,007 | 8.3 | 16.7 | 41.4 |
| WebGPU, 844×390 touch emulation | 20 | 73,007 | 8.3 | 8.5 | 58.7 |

A separate three-second paused-spawn comparison after one-second warm-up measured 17 draws and 72,971 triangles with decorations on, or 10 draws and 59,375 triangles with decorations off, on both backends. Median intervals were 8.3 ms, with P95 of 8.4 ms enabled and 8.5 ms disabled. Skyline offsets matched exactly across restart in both comparisons. Draw counts vary with the visible scene and renderer batching.

The architectural presentation remains stylized lightweight geometry. Existing runner contact sliding and pose differences remain visible, including about 0.836 m of late hard-landing recovery travel. The course uses static structures, fixed forward speed, and a full restart after failure. The timed slide has approximately 200 ms of geometric activation tolerance, reduced by input and fixed-step sampling. Browser samples contain occasional 41–59 ms frame intervals. Physical mobile validation and sustained device thermal/performance profiling remain open.

Evidence includes test-results/g24-game-browser.json, test-results/g24-environment.json, test-results/g24-tests.log, test-results/g24-build.log, test-results/g24-runner-browser.log and desktop/mobile captures. Visual review captures in test-results/g24-bridge.png, g24-slide.png and g24-scaffolding.png confirm connected bridge decks, readable duct clearance and rear scaffold placement. Existing website, cinematic and audio working-tree edits were preserved. G2.4 complete. Further milestones await approval.


## G2.5 - Movement Polish, Animation Synchronization and Gameplay Feel - 2026-11-11

### Diagnosis and stride correction

Run is a 0.633333 s source cycle with 3.729366 m of forward root travel, averaging 5.888472 m/s. The old 4.5 / 5.889 playback factor already matched the average closely. However, the source moves at approximately 4.935-7.128 m/s within the cycle. Removing that varying travel and playing at a constant rate left planted feet drifting. Freezing pelvis height at the bind pose also removed the source's 0.924-1.003 m vertical articulation. The old -0.0646 m visual offset left several centimetres of stance hovering.

Gameplay still owns all world movement at 4.5 m/s. The runtime Run clock now follows the inverse of the existing source forward-distance curve. The mean factor is 0.764205, with an approximately 0.631-0.912 instantaneous range and a 0.828748 s gameplay stride cycle. Source Run and Idle vertical articulation is preserved in cloned tracks. Offline 120 Hz skin measurements supply small interpolated sole lifts, up to 11.2 mm for Run and 20 mm for Slide. The source asset and all five original clips remain unchanged. The contact curves are baked offline and sampled from small arrays during clip construction.

| Measured planted interval | Before drift | After drift | Before sole RMS | After sole RMS |
|---|---:|---:|---:|---:|
| Left, source time 0.200-0.283 s | 46.2 mm | 3.3 mm | 35.6 mm | 3.1 mm |
| Right, source time 0.525-0.608 s | 24.9 mm | 6.1 mm | 18.0 mm | 5.4 mm |

These measurements use canonical toe positions, skinned sole bounds and authoritative forward distance over the specified contact intervals. They describe sampled stances. The authored running flight phases remain visible. Idle's measured sole range improved from 0.035-25.8 mm above the surface to 0.037-0.515 mm. Slide's worst measured penetration changed from 19.94 mm below the surface to a minimum of 0.023 mm above it. Its full skin still fits inside the existing pose-driven collider at every tested fixed tick.

### Transitions and contact

Jump entry retains its 0.06 s blend and immediate physics response. Jump remains active throughout ascent and descent. Normal touchdown blends into a planted Run contact over 0.08 s. It chooses the nearest measured contact phase, 0.2333 or 0.5500 s, relative to the saved stride phase. Tests cover level, uphill and a modest downhill fixture. Ordinary jumps return directly to Run.

Hard Land retains speed 1, its 0.30 s contact start and full completion at 1.033333 s. The 0.525 s movement lock and physics recovery ramp are preserved. Run begins blending during the moving final recovery from Land time 0.82 s through clip completion. The blend follows the existing recovery fraction, reducing stationary planted-foot drag during acceleration. Jump stays protected through the existing exit recovery. The incoming Run starts at its measured 0.20 s left-foot contact.

Slide remains a single-press 1.533333 s action with the same collider timing, failure sweeps and activation interval of approximately x=78.692-79.591. The source vertical pose receives only the measured small sole lift. Its exit uses Run time 0.60 s, matching the planted right foot and its fore-aft position. Entry and exit blends remain 0.06 s. Early, late and recovery collisions retain the 1.1 s failure/restart sequence.

The full runner.glb SHA-256 remains 4308e566184d7261a8cf5ab2fd29c6f2e87987ed674c0320d4bb2f3e4304e7b1. The 147 m layout, platform and duct collision bounds, gravity, jump impulse, hard-landing thresholds, camera system and website features retain their approved behavior.

### Environmental readability

Small reflective ledge caps clarify jump and drop edges. The receiving drop roof has three restrained landing-edge plates. Catwalk posts have muted amber reflectors, and the duct face has warning bands. Short floor dashes distinguish the existing Slide approach and its recovery exit. These details share the existing guide instance batch and material.

### Performance investigation

Before/after browser profiling uses an isolated headless Chrome profile on the same host with WebGPU and forced WebGL 2. Mobile validation uses 844x390 touch emulation. Early headed attempts were discarded because a minimized test window caused the intended visibility pause.

CPU profiles and browser long-task/long-animation-frame observers distinguish loading from the moving course. The baseline recorded 64-843 ms initialization tasks during asset processing and first rendering. WebGL samples include shader-program queries and initial buffer uploads. These tasks completed before the measured moving route. Source inspection confirms geometry and material allocation occurs during setup, camera vectors are reused, and the gameplay frame callback does not set React state. HUD writes occur every 0.05 s. Mixer actions and contact curves are created during loading.

The old browser harness repeatedly serialized the entire growing frame history. A mobile run using that polling reached 158.6 ms, while compact polling of the unchanged app reached 17.0 ms. This shows sensitivity to instrumentation and host load. The cause of individual earlier 41-59 ms intervals remains unresolved. Final comparisons use compact status polling, keep the complete frame series locally until completion, and retain long intervals. CPU sampling remains enabled in both compared runs.



### Validation and measured performance

TypeScript and production build pass. All 54 tests pass, retaining the existing 48 cases and adding six motion tests. The previous frozen-pelvis and cached-resume assertions now verify anchored horizontal travel, retained vertical articulation and planted contact-phase selection. New cases cover stride distance at 30/60/144 Hz, stance drift, late Land/Run blending, level/uphill/downhill contacts and the matched Slide exit. The Slide skin test additionally checks sole penetration throughout the clip.

The final production build completed all 147 m in headless Chrome on WebGPU and forced WebGL 2, and in 844x390 landscape touch emulation. Keyboard events and emulated touch buttons exercised the gameplay input handlers. Each route completed five jumps, both catwalks, the hard drop and Slide with zero restarts. Land completed once. Pause during Land and Slide, restart while paused, normal fall/restart and route cleanup passed. Decoration toggling and restart-relative skyline offsets passed on both backends. Bridge, Slide, scaffold and late hard-landing recovery captures were visually reviewed.

Moving-route frame intervals after the first 120 frames are summarized below. Both compared builds used CPU profiling and the compact polling harness. Samples reflect this host and browser configuration.

| Backend / viewport | Before median ms | After median ms | Before P95 ms | After P95 ms | Before max ms | After max ms |
|---|---:|---:|---:|---:|---:|---:|
| WebGPU, 1440x900 | 8.3 | 8.3 | 16.7 | 8.5 | 34.3 | 33.2 |
| WebGL 2, 1440x900 | 8.3 | 8.4 | 8.5 | 16.7 | 33.0 | 33.5 |
| WebGPU, 844x390 touch emulation | 8.3 | 8.3 | 8.4 | 8.4 | 17.0 | 16.6 |

The finish frame still reports 20 draws and 73,007 triangles. Peak counts along the decorated route are 21 draws and 73,619 triangles, including the added cue geometry when its existing batch is visible. Backend P95 variation persists across these short samples. There is insufficient evidence for a general frame-pacing improvement.

The final observers recorded zero JavaScript tasks over 50 ms during the moving route. Initialization still included tasks up to 1.482 s in the WebGL first-render path. CPU samples show substantial native shader-program queries and buffer uploads during setup. An additional 61 ms rendering-only observation at route completion had zero script attribution and blocking time. These observations leave GPU/browser scheduling outliers unresolved. Physical mobile and sustained thermal/performance validation remain open.

Sampled planted-foot contact improved substantially. Authored running flight, residual blend mismatch and some hard-landing recovery slip remain. The approved forward recovery continues through the source poses and the locomotion blend. The existing large renderer-chunk build warning remains.

Evidence includes test-results/g25-contact-comparison.json, g25-motion-before.json, g25-motion-after.json, g25-baseline-game-browser.json, g25-final-game-browser.json, g25-performance-comparison.json, g25-environment.json, g25-tests.log and g25-build.log. CPU profiles are stored as g25-baseline-*-cpu.json and g25-final-*-cpu.json. Render captures include g25-bridge.png, g25-slide.png, g25-scaffolding.png, g25-land-recovery.png and g25-final-*-finish.png.

The offline inspection tool is scripts/analyze-runner-motion.mjs. Its output contains canonical and runtime pose samples and reproducible 30 Hz sole-lift tables. Browser scripts accept TEST_BASE_URL, TEST_CDP_PORT and TEST_ARTIFACT_PREFIX. PROFILE_GAME=1 enables CPU and long-frame collection, and TEST_HEADLESS=1 selects the headless window workflow.

G2.5 complete. Work stops at this milestone.


## G3.0 - Cinematic Gameplay Presentation Foundation - 2026-11-11

### Atmosphere and composition

The three skyline layers now use restrained depth-weighted blending toward the horizon color. Distant towers are softer and less saturated, with clearer separation from nearby architecture. The sky has a cooler horizon, a softer lunar halo and slightly stronger low haze. Existing sparse amber windows remain. Roof surfaces have three subtle static tint variations, while moonlit illumination is slightly restrained. These changes use the existing geometry, materials and instance batches.

The established horizontal and vertical follow system remains. A spatially eased look-ahead grows from 2.60 to at most 3.05 m before required gaps, the drop and the duct. Upward roof framing begins 3.2 m before the edge, and drop framing begins 4.6 m before it. The finish gently reduces forward composition to 1.70 m over its final 6 m. Zoom and view pitch remain fixed. Projection and continuity tests cover the complete route and the minimum 14 by 6 m gameplay view used by desktop and landscape framing.

### Event-driven feedback and preferences

A fixed pool of sixteen small translucent hexagonal puffs shares one geometry and material. Physics hard-landing counters trigger six short impact puffs. A single Slide activation is observed from simulation state, with friction puffs emitted only while the actual collider is low. Entering the fallen phase produces four small puffs and a short, subdued viewport-edge response. Entering the finished phase emits six restrained completion motes. Event detection reads simulation counters, phases and collider state.

The pool updates at the existing deterministic simulation step. Pause freezes its lifetime. Restart clears particles, emission cursors, the failure pulse and event diagnostics. Route cleanup clears the pool, disposes its geometry, material and instance resources, and removes the stage response. Particle transforms and colors reuse objects allocated at setup.

The Effects checkbox independently controls this optional presentation. Keeping its zero-area inactive instances in the enabled batch compiles the material during initial rendering and avoids deferring its first use to an impact. Disabling Effects removes its draw. Reduced-motion preferences suppress the puffs and viewport response, retain a steady 2.60 m composition lead, and freeze secondary skyline travel. Essential terrain tracking and gameplay continue. The media-query listener is cleaned up on route exit. Decorations remains independent.

The 147 m platforms, existing geometry positions, five jumps, two catwalks, hard drop and duct collision are preserved. Speed, jump physics, 0.525 s landing lock, 1.533333 s Slide, all animation synchronization and strict failure rules retain their G2.5 implementation. The canonical runner.glb remains byte-identical with SHA-256 4308e566184d7261a8cf5ab2fd29c6f2e87987ed674c0320d4bb2f3e4304e7b1.

### Validation

TypeScript and production build pass. All 62 tests pass, including the existing 54 cases and eight presentation tests. Added coverage checks camera continuity and bounds, elevated framing, actual hard-impact/slide/failure/finish events, fixed-pool reuse, disabled-effect behavior, pause, restart cleanup, reduced-motion skyline behavior and the complete asset hash.

Headless Chrome completed the full course with Effects and Decorations enabled on WebGPU, forced WebGL 2 and 844x390 touch emulation. Each run completed all five jumps, both catwalks, the hard drop, the slide and the finish with zero restarts. Diagnostics confirmed one impact, one Slide activation and one finish event. Separate browser checks exercise both toggles, dynamic reduced-motion changes, unchanged jumping and sliding, frozen feedback during pause, failure response, restart and leaving the route while impact particles are active. Decoration and restart-parallax comparisons pass on both backends.

### Performance observations

The fixed effects batch adds one peak draw and 96 triangles. Peak decorated-route counts changed from 21 draws / 73,619 triangles to 22 draws / 73,715 triangles. A paused comparison verifies that disabling Effects removes exactly one draw. The finish-frame counts vary with camera composition and frustum culling.

Moving-route intervals after the first 120 frames use the same headless Chrome host and CPU-profiling harness as G2.5. Complete histories are retained, including long intervals.

| Backend / viewport | G2.5 median ms | G3.0 median ms | G2.5 P95 ms | G3.0 P95 ms | G2.5 max ms | G3.0 max ms |
|---|---:|---:|---:|---:|---:|---:|
| WebGPU, 1440x900 | 8.3 | 8.3 | 8.5 | 8.4 | 33.2 | 275.0 |
| WebGL 2, 1440x900 | 8.4 | 8.4 | 16.7 | 16.8 | 33.5 | 49.8 |
| WebGPU, 844x390 touch emulation | 8.3 | 8.3 | 8.4 | 8.4 | 16.6 | 10.0 |

The initial WebGPU run recorded one 275 ms interval with a rendering-only long-frame observation and zero script attribution or blocking time. Its cause remains unresolved. A second complete WebGPU route with slow-frame event timestamps measured an 8.3 ms median, 8.4 ms P95 and 9.1 ms maximum. It recorded zero intervals above 25 ms, including all feedback events. Both measurements are retained. The profiled full routes recorded zero JavaScript tasks over 50 ms during gameplay. First-render and asset initialization costs remain separately visible in the raw profiles, with measured initialization tasks of 178 ms on WebGPU, 625 ms on WebGL 2 and 125 ms in touch emulation.

These samples support a small bounded rendering cost for the pooled feedback. Occasional GPU/browser scheduling outliers and first-render initialization remain limitations. The existing large renderer-chunk build warning remains. Physical mobile and sustained thermal/performance validation are still open. Dust is deliberately small and stylized, and the temporary mannequin retains the G2.5 contact and blend limitations.

Evidence includes test-results/g30-game-browser.json, g30-repeat-game-browser.json, g30-performance-comparison.json, g30-presentation-browser.json, g30-environment.json, g30-tests.log and g30-build.log. CPU profiles are stored under g30-*-cpu.json and g30-repeat-*-cpu.json. Impact and failure captures cover both backends, with visually reviewed route captures for the skyline, catwalk and slide.

G3.0 complete. Work stops at this milestone.


## G3.1 - Gameplay HUD, Start Sequence and Finish Experience - 2026-11-11

### Gameplay interface

The level now uses a slim navy/white HUD with a restrained amber progress line, Pause, Restart and Back. The stage fills the available space between the header and movement controls. Desktop hints identify Space/Up for Jump, S/Down for Slide and R for Restart. Touch controls use separate 44 px targets below the stage at the right edge. Keyboard hints are replaced with touch guidance for coarse pointers. The existing camera algorithms adapt through their established resize handling.

Technical values and the renderer label are inside a closed-by-default Debug disclosure. It retains Collider, Decorations, Effects and Test high drop. Opening Debug exposes the existing live diagnostics without an accessibility announcement stream. Debug closes on Start, pause and completion. Player-facing progress uses a native labelled progress element updated from actual forward position. Progress updates avoid per-frame React state changes.

### Ready, pause, failure and completion

A presentation-only GameSession gates the existing Simulation. Loading prepares graphics and the asset through the existing pipeline. Once ready, the character remains at the origin and Idle plays while the player reads the controls. Physics stays stopped until Start. Start begins running immediately, bypassing the old initial 0.65 s ready timer. It requires no additional countdown or loading gate.

Pause presents Resume, Restart and Back. Escape pauses from the playfield and resumes the pause dialog. Restart during pause resets the route while retaining pause until Resume. Active manual restarts retain the existing 0.65 s reset recovery. Automatic failure still waits 1.1 s before resetting, followed by the existing 0.65 s ready recovery. A short contextual indication distinguishes a missed roof from a duct collision. The non-modal indication follows the existing retry timing.

Reaching the existing finish stops movement through the approved Simulation state and retains the G3.0 completion motes. A restrained Route complete dialog offers Replay and Back. Replay resets and starts a new run immediately. Back links to /lab, keeping this isolated development route separate from the website and mode-selection flow. The UI screen model makes failure and completion mutually exclusive.

### Input and accessibility

Start and Replay receive focus when shown. Starting, resuming and replaying return focus to the labelled playfield. Pause and completion dialogs contain keyboard focus, including ordinary Tab navigation, Shift-Tab wrapping and their Back actions. Background controls are inert and visually subdued while a modal is open. Buttons and links use visible focus indicators. Primary touch actions and navigation have minimum 44 px targets.

Movement key handling yields to buttons, links, form controls, editable content and the Debug summary. Native button activation starts or replays without queuing a jump. The existing one-press Slide and grounded jump rules remain authoritative. Reduced-motion preferences continue to control the G3.0 effects and camera options, with static interface transitions. Settings remain available through Debug.

### Preserved systems and validation

The route, speed, jump physics, hard-Land recovery, Slide timing and collision rules retain their approved implementation. Camera logic, environment geometry, pooled effects, audio and website features are preserved. The full runner.glb hash remains 4308e566184d7261a8cf5ab2fd29c6f2e87987ed674c0320d4bb2f3e4304e7b1.

TypeScript and production build pass. All 68 tests pass, including the existing 62 cases and six new session tests covering explicit Start, paused input, manual restart, automatic failure recovery, mutually exclusive completion, Replay and the high-drop debug action.

Headless Chrome completed the full Start-to-Finish route on WebGPU and forced WebGL 2, plus 844x390 landscape touch emulation. All five jumps, both catwalks, the hard drop and Slide passed with zero restarts. Progress reached its actual endpoint and the completion dialog received Replay focus. Native keyboard Replay, native touch Replay and the completion Back link target passed. The preserved completion effect fired once.

Separate browser checks verify a stationary Ready state, native Space and touch Start, zero accidental jumps during UI activation, ordinary Tab and focus wrapping, Escape pause/resume, frozen position while paused, failure indication, automatic restart, native Back navigation, visible Debug settings, reduced-motion behavior and touch-control bounds. Decorations, Effects and restart-parallax comparisons pass. Ready and completion layouts were visually reviewed on desktop and mobile landscape.

The browser harness now supplies native Enter key codes and its character event for keyboard activation. An earlier incomplete Enter event failed to activate Replay in automation. The corrected native sequence passed on both desktop backends.

### Performance and remaining limitations

Moving-course samples use the same headless Chrome host, CPU profiling and compact-polling harness. The first 120 moving frames are excluded from the summary, while long intervals remain in the retained histories. The redesigned stage occupies more viewport area than G3.0, so the pixel workloads differ.

| Backend / viewport | Median ms | P95 ms | Maximum ms |
|---|---:|---:|---:|
| WebGPU, 1440x900 | 8.4 | 16.9 | 33.5 |
| WebGL 2, 1440x900 | 8.4 | 17.1 | 33.6 |
| WebGPU, 844x390 touch emulation | 8.3 | 8.6 | 16.0 |

Peak 3D rendering remains 22 draws and 73,715 triangles. The interface uses HTML and CSS around the existing scene. The measured moving routes recorded zero JavaScript tasks above 50 ms. Initialization tasks reached 273 ms on WebGPU, 1.169 s on WebGL 2 and 189 ms in touch emulation. Start remains immediate once the loaded Ready state is shown.

An earlier interface run recorded a 75.3 ms maximum in mobile emulation. That outlier was absent from the final run. The existing large renderer-chunk warning, initialization cost and GPU/browser frame-time variability remain. Physical mobile and sustained thermal/performance validation remain open. The temporary character retains the approved animation/contact limitations. Replay keeps the existing cumulative debug counters while resetting gameplay position and presentation state.

Evidence includes test-results/g31-final-game-browser.json, g31-interface-browser.json, g31-environment.json, g31-performance-comparison.json, g31-tests.log, g31-typecheck.log and g31-build.log. CPU profiles use the g31-final-*-cpu.json prefix. Desktop and mobile captures cover Ready and the completion overlay.

G3.1 complete. Work stops at this milestone.

## G3.2 - Recruiter Mode Integration - 2026-11-11

- Connected the recruiter card to /play/recruiter using the shared lazy-loaded GameLab. Back and browser Back return directly to mode selection at /play. /lab/game retains diagnostics and its /lab Back destination. Other mode cards retain their behavior.
- Reused the website audio controller and cleanup. Menu audio stops for gameplay, then restores mute and in-document playback position on return. Gameplay remains silent. Cold mode visits can enable sound through the existing control.
- Changed main routing, recruiterNavigation.ts, ModeSelection, Website/PlayExperience, the audio hook/SoundControl and configurable game Back links.
- Passed TypeScript, 14 targeted navigation/session/audio tests, one production build and one quick browser smoke covering modes, recruiter, Start, Back, audio restoration, mute, browser Back and /lab/game. Replay passed its existing state-harness test.
- Limits include browser autoplay policy and in-memory playback restoration. Cold reloads require a fresh sound gesture. Full-course, mobile/backend matrices and profiling were outside this fast pass. The existing renderer bundle warning remains.

G3.2 complete.


## G3.3 - Recruiter Gameplay Transition Polish - 2026-11-11

- Added a cancellable 180 ms navy route curtain for recruiter entry and return. The outgoing screen stays mounted through darkening. Loading stays covered until the first rendered game frame or mode-selection background readiness. Reduced motion removes fade timing. Start receives focus after reveal and physics remain in Ready.
- Preserved the existing audio ownership, mute preference, direct mode-selection Back and lab route. Added zero-size resize protection during delayed R3F cleanup after the smoke exposed detached-canvas WebGPU validation errors. Rendering/load failures reveal their existing error feedback.
- Passed final TypeScript and 14 targeted navigation/session/audio tests. The quick Chrome smoke passed entry, Start, Back, repeated navigation, rapid browser Back/Forward cancellation, rendered Ready, focus, mute/audio restoration, reduced motion and /lab/game with no console errors. Evidence is test-results/g33-smoke.json and tests/recruiter-smoke.mjs.
- One production build passed with the existing renderer chunk-size warning. Final cleanup/cancellation refinements were checked through TypeScript and the development-server smoke. No second build, full-course playthrough, device/backend matrix or profiling was run. Physical mobile and additional browser verification remain outside this fast pass.

G3.3 complete.


## G4.0 - Recruiter Story Flow Foundation - 2026-11-11

- Added a lazy Recruiter-specific wrapper for Opening → Gameplay Ready → Escape → Reunion → Completion, reusing GameLab. Expected assets are /media/recruiter/opening.mp4 and /media/recruiter/reunion.mp4. Completion Replay restarts the story at Opening and then waits at Ready. Back retains direct mode selection. The shared lab flow retains its defaults.
- Optional videos use native synchronized audio, the existing mute preference/volume utilities, Skip, autoplay retry and playback cleanup. Missing files, HTML fallback responses, failed probes and playback errors bypass the cinematic. Availability probes are cached for the document lifetime. Reduced motion bypasses both optional cinematics. Gameplay input is detached during Reunion and story Completion while the finished scene remains mounted for existing feedback.
- Passed TypeScript, 21 targeted story/navigation/session/audio tests and one production build. Tests simulate successful escape for Reunion, Completion and Replay, and cover duplicate completion/Skip events, missing-file caching, autoplay rejection, mute and Back cleanup. The quick production-preview Chrome smoke passed missing Opening → Ready → Start, Back, cached re-entry and browser Back with no console errors. Evidence is test-results/g40-smoke.json.
- Actual story video playback awaits the supplied assets. Hosting should serve MP4 paths with video/* content types and support HEAD. Browser autoplay may require Play cinematic. No full-course, device/backend matrix or profiling was run. The existing renderer chunk-size warning remains.

G4.0 complete.


## G5.0 - Multi-Zone Escape Level Foundation - 2026-11-11

- Extracted course.ts from simulation.ts. One active Corporate Rooftops zone retains all 11 platforms, six gaps, takeoffs, bridge indices, sections, duct bounds, 147 m finish and 4.5 m/s speed. Simulation exports remain compatible with existing callers. Zones use explicit contiguous world bounds, local bridge indices and world-coordinate geometry. connectZones assembles shared collision/render/camera arrays and derives gaps, including cross-zone gaps.
- Added planned Corporate → Construction → Electrical → Underground → Final progression metadata without adding route length or inactive collision surfaces. Zones own obstacles and optional non-colliding box decorations, rendered through the existing detail batch. Stable zone IDs are available in debug diagnostics. No enemy systems or speculative enemy fields were added.
- Parameterized the existing -3.2 m fall boundary per zone so future underground floors can sit below rooftop elevation. The current value and failure behavior are preserved. Existing height-based camera framing supports higher platforms, descent and return to rooftop elevation, so camera behavior required no change.
- Passed TypeScript and 26 targeted course, collision, slide, animation-flow and environment regression tests. Synthetic connected-zone and elevation tests cover seams, gap derivation, index remapping, shared data, invalid bounds and camera restart. Existing deterministic animation/course coverage passed at 30/60/144 Hz. One quick development-server Chrome smoke passed lab Ready, auto-run, jump/landing, pause/resume, restart and recruiter Ready with no console errors. Evidence is test-results/g50-smoke.json.
- Future environments still need authored geometry, presentation and reachability validation. The controller remains forward-only with static platforms and barriers. No new ceiling or multi-floor collision behavior was introduced. No production build, full browser/device matrix, profiling or browser full-route playthrough was run in this data-only fast pass.

G5.0 complete.


## G5.1 - Construction Site Escape - 2026-11-11

- Extended the finish from 147 m to 223 m. The original 11 rooftop platforms remain unchanged. Construction occupies x=151–227 m with five new platforms, a 19 m opening deck, two ascending jumps, a 7 m supported suspended catwalk, a controlled 2.8 m step-down and a long recovery runway. The existing speed, jump/slide physics, animation timing, story flow and effects remain in use.
- New deck ranges/heights are 151–170/0, 172.2–183/0.8, 183–190/0.8, 192.3–203/1.4 and 204.5–227/-1.4 m. Ascending gaps are 2.2 and 2.3 m. Descending flight times are 0.659 and 0.693 s, with 2.963 and 3.121 m horizontal reach. Analytical takeoff windows including the 0.44 m body are approximately 169.017–170.220 and 188.959–190.220 m, or 267/280 ms. Authored markers are 169.35 and 189.35 m. Fixed-step tests validate early/late offsets. The step-down gap is 1.5 m versus approximately 2.381 m airborne step-off travel, triggering one hard Land with over 17 m remaining before Finish.
- Added exposed steel supports, scaffold braces, deck grating, rear work barriers, pipes/cables, amber warning lights and a distant crane. Geometry reuses existing instanced batches/materials and the decorations toggle. Lane and collision surfaces remain clear. Added a lab-only Test construction button for direct validation. Course metadata drives the existing progress HUD and new finish marker.
- Passed TypeScript, 34 targeted course/reachability/collision/animation/environment tests and one production build. Existing deterministic route coverage passes at 30/60/144 Hz with seven total jumps and two completed hard landings. One construction-only Chrome smoke used the debug entry and reached x=223 across all five new platforms with two jumps, full hard-Land recovery, correct progress/completion UI and no console errors. Screenshot inspected at test-results/g51-construction.png. Structured evidence is test-results/g51-smoke.json. The initial smoke attempt used the preceding build while compilation was still finishing, then passed against the completed build.
- Limits include static box-based construction scenery and the existing renderer bundle warning. No moving machinery, additional slide obstacle or ceiling/multi-floor collision was introduced. Full backend/mobile matrices and performance profiling were skipped. Broader device readability and sustained performance remain unverified.

G5.1 complete.


## G5.2 - Electrical Hazard Zone - 2026-11-11

- Extended Finish to 279 m with a 56 m electrical yard at x=227–283. Three continuous slabs preserve the rooftop/construction geometry and existing movement, Slide duration, animations, HUD controls, story and audio flow. Added utility cabinets, exposed conduits, damaged junction silhouettes and industrial frames using existing instanced materials.
- Added a jump cable at 239–239.5 m, a pose-timed Slide conduit at 253–254.1 m and a pulsing arc at 268–268.45 m. Existing swept obstacle collision and automatic retry handle electrical contact. Essential hazard geometry, footprint bands and approach cues remain visible with decorations disabled. Blue-white discharge geometry and small sparks use no dynamic lights or audio. Reduced motion suppresses spark movement while preserving hazard states and warning cues.
- The arc uses a zone-local 120 Hz simulation clock, reset on Restart/Replay and frozen by Pause. Its cycle is 1.4 s active, 2.6 s inactive, with 0.65 s amber advance warning and a 1 s phase offset. Normal autorun crosses at approximately 9.06–9.26 s inside the 8.4–11.0 s inactive window. This deliberate phase alignment preserves fairness without adding a wait mechanic. Swept contacts are intersected with active intervals, including activation/deactivation within a tick.
- Passed TypeScript and 39 distinct targeted electrical/course/collision/Slide/construction/animation/environment checks, including safe and failing timing cases at 30/60/144 Hz, Pause, automatic retry, Restart and Replay. One electrical-only development-server Chrome smoke used Test electrical and passed Jump, Slide, all pulse states, safe crossing, frozen pause time, reduced motion and Finish without console errors. Evidence is test-results/g52-smoke.json and the inspected test-results/g52-electrical.png capture.
- Scenery remains simple geometry. Standard arrival is intentionally synchronized to a safe arc phase. Real-device/backend matrices, performance profiling and a production build were skipped in this fast pass. The screenshot was captured while paused and covers part of the arc with the existing Pause panel. Actual motion, state progression and completion were checked by the smoke.

G5.2 complete.


## G5.3 - Underground Maintenance Escape - 2026-11-11

- Extended Finish to 355 m with five platforms across x=283–359. The existing 279 m route is preserved. New progression includes a controlled 2.6 m hard-Land descent, a 25.5 m tunnel floor, a low-pipe Slide at 303–303.8 m, a 2.1 m drainage jump, two 1.3 m exit ascents and over 14 m of surface runway. Existing speed, Slide timing, physics, electrical timing, story flow, audio and HUD remain in use. Added Test underground to the lab diagnostics.
- Reused instanced concrete, pipes, fans, cable trays, drainage grates, amber lamps, blue shaft panels and static steam wisps. Rear walls and ceiling scenery conceal the skyline and open toward the exit. A rear closure spans the drain while its floor remains a real gap. Foreground fixtures leave the character clear. The pipe uses the existing localized swept obstacle collision, with visible underside clearance. The existing camera required no changes.
- Descending jump reach is 3.51 m for the drainage crossing and approximately 2.424 m for each 1.3 m ascent against 1.7 m gaps. Targeted tests validate input offsets of ±0.25 m, protected hard-Land completion, fixed Slide recovery, collision surfaces and full jump clearance under the visual ceiling.
- Passed TypeScript, 40 distinct targeted checks and one production build. Actual runner animation, camera and route regressions pass at 30/60/144 Hz. One underground-only browser smoke completed descent, Slide, drainage, both ascents and x=355 Finish with no console errors. Follow-up visual inspection corrected the shaft-panel tint and checked pipe readability. Evidence is test-results/g53-smoke.json, g53-tunnel-final.png and g53-exit.png.
- Steam wisps, fans and light panels are static scenery. Full backend/mobile matrices and performance profiling were skipped. The existing renderer chunk-size warning remains.

G5.3 complete.


## G5.4 - Hunter Robot Pursuit - 2026-11-11

- Added a scripted Hunter on the final continuous surface runway. It stays dormant until x=344 m, appears 2.2 m behind the runner, alerts for 0.25 s and then pursues at the existing 4.5 m/s. Successful running keeps approximately 3.3 m separation. Finish disengages pursuit. Pause freezes its fixed-step state, and Restart/Replay reset it. The 355 m course, player physics, camera, electrical timing, story and audio remain unchanged.
- The procedural armored quadruped reuses one box geometry and three materials, with four articulated two-segment legs and red front/side optics. Feet remain on the final platform. Reduced motion uses a stationary leg pose. Geometry and materials are disposed on route exit. Added a lab-only Test Hunter entry and debug state/position fields.
- Capture requires horizontal body-region and vertical overlap using the player collider width and current standing/Slide height. It reuses the existing 1.1 s failure/restart flow and shows Caught by security. Tests inject stationary contact to exercise capture without adding a slowdown mechanic.
- Passed TypeScript, 21 targeted Hunter/session/collision tests and one production build. Tests cover spawn, Alert, pursuit, physical contact boundaries, capture retry, Pause, Restart, Replay and Finish, with matching successful outcomes at 30/60/144 Hz. One Hunter-only development-server browser smoke passed all chase states, visible separation/grounding, Pause, reduced motion, Finish disengagement and Replay reset without console errors. Evidence is test-results/g54-smoke.json and the inspected test-results/g54-hunter.png.
- This Hunter is confined to the final flat runway. Pursuit pressure is visual because the current autorun has no meaningful slowdown. Procedural leg motion is approximate. Full browser/device matrices and profiling were skipped. The existing renderer bundle-size warning remains.

G5.4 complete.


## G5.5 - Corporate Surveillance Drones - 2026-11-11

- Added zone-authored drones at x=160 m in construction and x=234 m in the electrical district. The existing 355 m course, platforms, obstacles, physics, electrical timing, Hunter behavior, camera, story and audio remain unchanged. Both aircraft sit above the full player jump envelope and share procedural geometry/materials.
- Idle → Scanning → Alert → Reset uses encounter-local fixed simulation time. Each 4 s cycle has a harmless 0.6 s amber warning followed by 0.5 s active scanning. Other phases are harmless. Normal body overlap occurs around 1.37–1.74 s and 1.28–1.65 s, inside the inactive window after 1.1 s. The scripted arrival alignment makes standard autorun survivable without stopping or new controls.
- Transparent rectangular beams match the actual 1.2 m-wide scan regions. Confirmed player overlap during an active scan shows a brief red Alert and Surveillance detected, using the existing 1.1 s failure/restart flow. Pause freezes scan time. Restart/Replay reset both drones. Reduced motion suppresses hovering/rotors while gameplay timing continues. Shared resources are disposed on leaving gameplay.
- Passed TypeScript and 20 targeted drone/Hunter/session tests, including both safe encounters and active detection at 30/60/144 Hz, collider boundaries, warning safety, automatic retry, Pause and resets. The focused construction-drone browser smoke passed all scan phases, frozen pause time, reduced-motion timing, inactive crossing and Restart with no console errors. Browser-frame sampling handles the short active phase. Evidence is test-results/g55-smoke.json and the inspected test-results/g55-drone.png capture.
- Encounters use fixed positions and phase-aligned safe crossings. No general AI or variable stealth approach was introduced. Full-route browser playthroughs, device/backend matrices, profiling and production build were skipped for this fast pass.

G5.5 complete.


## G5.6 - Chase Balancing and Gameplay Flow - 2026-11-11

- Finish is now 384 m, giving a 40 m Hunter chase from x=344. Earlier pursuit would cross exit gaps/steps, so a 29 m flat service apron connects at x=359. The previous four zones retain their geometry. A low pipe at 366–366.8 m adds one required Slide, with 1.2 m clearance for the 1.05 m Hunter and over 13 m of post-Slide runway. Player speed and physical-contact capture remain in use.
- Improved armor/sensor contrast and added a small red warning beneath the nearby Hunter. Reduced motion uses a steady indicator. Finish smoothly dims the sensor, fades the warning and settles the legs over 0.4 s. The camera required no changes and both actors remain visible through the pipe approach.
- Drone and electrical timing reviews passed their existing schedules. Cable-jump landing leaves approximately 10 m before the electrical Slide input. Full Slide recovery leaves approximately 10 m before the arc. Drone crossing windows remain inside inactive scan phases. The new final Slide tolerates tested input offsets of ±0.3 m.
- Passed TypeScript, 36 targeted Hunter/drone/electrical/course/reachability/pacing tests and one production build. Coverage includes safe runs at 30/60/144 Hz, capture, Pause/reset, recovery, camera framing and smooth disengagement. One focused browser smoke completed the 40 m chase, Slide, Finish fade and Replay with no console errors. Evidence is test-results/g56-smoke.json and the inspected test-results/g56-chase.png.
- Pursuit pressure remains proximity-based, with the pipe supplying the required chase action. Capture is tested through injected contact because flawless fixed-speed running preserves separation. Device/browser matrices and profiling were skipped. The existing renderer chunk-size warning remains.

G5.6 complete.


## G6.0 - Hold-to-Sprint Mechanic - 2026-11-11

- Added momentary Shift and Sprint-button controls. Normal autorun is 4.5 m/s and Sprint targets 6 m/s, using fixed-step acceleration of 12.5 m/s² and deceleration of 15 m/s², approximately 125/100 ms at 120 Hz. Multiple held sources release independently. Pointer cancellation, capture loss, focus loss, hiding, Pause, failure and route cleanup release held input. Restart/Replay restore normal speed. The minimal HUD highlights held Sprint and Ready explains its controls.
- Run retains the G2.5 travel-curve synchronization, now driven by actual per-tick displacement, including acceleration and recovery. Platform face/contact sweeps use actual horizontal travel. Gravity and vertical impulse retain their approved values. Fully sprinting gives approximately 4.68 m level-jump travel and 9.2 m Slide travel versus 3.51/6.9 m normally. Slide remains exactly 1.533 s with the existing pose collider and clips.
- Passed TypeScript and 36 targeted Sprint/input/animation/Jump/Slide/collision/session checks. Tests include 30/60/144 Hz acceleration, both-speed obstacle and authored-gap contacts, active electrical sweeps, Run stride matching, input cleanup and Hunter separation. One focused browser smoke passed Shift/release, Jump, fixed Slide, emulated touch hold/cancel, focus release, indicator and Pause without console errors. Test setup waits for the touch-layout update before dispatching coordinates. Evidence is test-results/g60-smoke.json and g60-sprint.png.
- Hazard limits remain explicit. Sustained Sprint reaches active drone scans at 160/234 m. Releasing during the early warning restores safe crossing in tests. Mixed-speed drone/arc arrivals need later balancing, and faster Slides need appropriate takeoff timing. Sprint opens the Hunter gap while the robot retains 4.5 m/s. Course geometry and hazard schedules were preserved. Production build, full route playthroughs, device/backend matrices and profiling were skipped for this fast pass.

G6.0 complete.


## G6.1 - Slide Obstacle Readability - 2026-11-11

- Unified all four Slide obstacles at 81, 253, 303 and 366 m with instanced dark-steel bodies, amber diagonal warning paint, steady unlit amber strips/beacons and restrained edge trim. Pipe cradles show their existing collision envelope. Supports sit behind the runner, ahead of obscuring rooftop trim, and outside the collision lane. The electrical conduit shares the same body treatment with subdued blue sparks.
- Teal timing markers retain their positions 2 m before each obstacle. Ready now distinguishes amber floor jump marks from teal Slide timing. The existing camera frames the warning beacons from approximately 7.5 m away, giving 1.25 s preview at 6 m/s. Course obstacle positions/dimensions and simulation/animation timing were preserved.
- Passed TypeScript and 19 targeted visual-data/Slide/collision checks. Every obstacle clears from its timing mark at 4.5 and 6 m/s. Releasing Sprint halfway through Slide preserves the exact 184-tick, 1.533 s duration and collision at 30/60/144 Hz. Tests also cover upright impact failure and unobstructed support placement.
- The focused final-pipe browser smoke passed a 6 m/s approach, Slide, Sprint release during Slide and return to standing with no console errors. The final preview was inspected for body contrast, hatch visibility and support grounding. Evidence is test-results/g61-smoke.json and g61-slide.png.
- Full-course playthroughs, device/backend matrices, profiling and production build were skipped. Mixed-speed drone/arc balancing remains tracked under G6.0.

G6.1 complete.

## G6.2 - Drone Sprint Counterplay - 2026-11-11
- Drone 1 at 160 m now warns for 1.4 s, then activates for 0.6 s, rewarding early held Sprint. Drone 2 at 234 m retains its schedule and rewards releasing Sprint during its early warning.
- Scan beams and sensors show amber warning, red active danger and teal-green safe states with stronger visibility. Existing overlap collision, pause and reset logic are preserved.
- Passed one TypeScript check and all 8 focused drone tests, including counterplay at 30/60/144 Hz, detection, pause, restart and Replay. Adjacent schedule expectations were updated.
- Browser/full-route checks were skipped as requested. Timing remains scripted and late speed changes can miss the safe window.

## G6.3 - Construction Vertical Parkour - 2026-11-11
- Raised steelwork at 172.2–183 m and catwalk at 183–190 m from 0.8 to 1.1 m; upper scaffold at 192.3–203 m rises from 1.4 to 2.2 m. Existing exit at 204.5–227 m remains -1.4 m, creating a controlled 3.6 m descent.
- Takeoff markers move from 169.35/189.35 m to 169.6/189.7 m. Existing steelwork rendering follows the surfaces; 384 m Finish, physics, drones and hazards are preserved.
- Passed one TypeScript check and 13 construction/collision tests, including one added Sprint ascent/descent test. Run and Sprint clear both ascents at marker offsets -0.2/0/+0.3 m and safely land the descent.
- Browser automation, full-route checks, profiling and builds were skipped as requested. Visual framing remains unverified in-browser.

## G6.4 - Vertical Camera Follow - 2026-11-11
- Drops over 3 m now begin the existing terrain blend 6.4 m before the edge; interpolated player feet limit the target to at least feet minus 2 m, retaining headroom during descent. Horizontal framing and smoothing rates are unchanged.
- Four focused camera/reset/parallax checks pass, including one new construction ascent/descent framing test at Run and Sprint speeds. Player and near-edge landing ledges fit the minimum 6 m vertical frame with bounded camera steps.
- TypeScript passed once before the final camera edits; it was not repeated under the once-only validation constraint. Browser framing was blocked because computer-use could not verify Chrome’s URL. No full-route checks, matrices, profiling or builds were run.

G6.4.1 verification - 2026-11-11: TypeScript passed once against the final G6.4 code, and all four focused camera/reset/parallax tests passed. No code fixes were needed.

## G6.5 - Underground Vertical Parkour - 2026-11-11
- Raised the 318.1–327 m maintenance walkway from -4 to -3 m. Split the former 328.7–339 m platform into a -4 m landing at 328.7–332 m and the original -2.7 m exit step at 333.4–339 m, adding a 1 m controlled descent and 1.4 m ascent gap.
- Takeoffs are now 315.5, step-off, 331.4 and 338.6 m. Existing industrial scenery follows platform heights; low pipe and original gaps, final -1.4 m surface, 384 m Finish, camera, physics and enemy schedules are preserved.
- Passed TypeScript once after final code edits and 14 underground/collision tests, including one added Run/Sprint traversal and framing test. Normal-speed ascending jumps tolerate tested takeoff offsets of ±0.25 m; both speeds complete the raised walkway, descent and exit steps without failures or blocked contacts.
- Browser automation, full-course playthroughs, device matrices, profiling and builds were skipped. Visual appearance remains unverified in-browser.

## G7.0 - Monochrome Visual Foundation - 2026-11-11
- Converted gameplay architecture, tunnels, scaffolds and skyline instance tints to neutral grays. Pale platform tops, dark trim/Slide steel and three separated gray skyline layers replace the dominant navy palette; enemy armor is neutral with colored sensors retained.
- Reused the existing sky material with a light-gray gradient and plain moon, removing haze and halo. Neutral white lighting and rougher steel reduce color cast/gloss; movement dust opacity drops from 0.26 to 0.12. Gameplay already has no fog/bloom postprocessing. Amber/red/teal hazard cues remain.
- Passed TypeScript once after final edits and six existing environment/parallax/Slide rendering-data checks. Geometry, physics, camera, enemy schedules, routes and website systems are preserved.
- Browser checks, full-route tests, matrices, profiling and builds were skipped as requested. Actual runner contrast in enclosed areas and colored hazard brightness against pale surfaces still need visual review.

## G7.1 - White Room Architectural Prototype - 2026-11-11
- Construction scenery now uses pale decks/rear panels, charcoal edges and rails, sparse rectangular frames and a large rear portal. Existing box geometry/material batches replace industrial braces, hanging cables, crane lattice and catwalk grating with negative space.
- Playable surfaces, collision, 384 m Finish, hazard indicators and gameplay systems are preserved. Existing neutral lighting is reused. Corrected the invalid shared detail-material roughness of 16 introduced in G7.0 to 1.
- Passed TypeScript once after final edits and four existing construction-scene/platform-alignment/parallax rendering checks. Browser automation, full-route checks, profiling and builds were skipped; pale-panel separation and runner contrast still need visual review.

## G7.1 - Vector-Style Minimalist Visual Overhaul - 2026-11-11
- Supersedes the White Room prototype with a shared flat grayscale hierarchy across all zones. Runtime near-black runner material restores/disposes on unmount; medium-gray architecture, charcoal trim and pale skyline layers provide separation. Removed White Room rear panels/portal, small rendered window/vent details and shaft-light accents.
- Slide warning paint, active drone scans, electrical danger indicators/arcs and Hunter warnings use #E53935. Main obstacle/enemy bodies remain grayscale; drone amber warning and teal safe states retain their existing timing.
- Passed TypeScript once after final edits and seven existing rendering checks covering construction scenery, collision-aligned surfaces, parallax and Slide warnings. Gameplay course, camera, simulation and story/navigation systems are preserved.
- Browser automation, full-route checks, profiling and builds were skipped as requested. Runtime silhouette rendering, tunnel contrast and translucent scan contrast still require visual review.

## G7.1 - Vector-Style Corporate City - 2026-11-11
- Darkened playable architecture and pipes to flat charcoal, with contrasting rims and lighter tunnel back walls behind the existing near-black runner. Red danger paint and pale Slide clearance edges retain existing hazard collision/state timing.
- Restored three slate/steel-blue skyline layers and sparse warm windows. Selected middle-distance rooftops carry Amazon, Microsoft and Capgemini signs drawn with system text into disposable runtime canvas textures; names repeat with existing city tiles.
- Added one distant procedural helicopter behind playable structures, with slow wrapped travel and rotor motion. Reduced motion freezes flight/rotor animation; the Decorations toggle hides signs and helicopter. No assets, lights or shaders were added.
- Passed TypeScript once after final edits and seven existing rendering checks. Browser checks, full-route tests, profiling and builds were skipped; tunnel silhouette contrast, sign legibility and translucent scans still need visual review.

## G7.2 - Vector-Style Visual Clarity Rebuild - 2026-11-11
- Replaced ornate foreground trim with one thin neutral front rim per platform, lifted charcoal top-surface contrast and suppressed small fixtures/front panels/excess supports. Retained collision-aligned slabs and functional hazards; underground back walls are pale blue-gray and rear maintenance pipes lighter to distinguish scenery from obstacles.
- Brightened the light-blue sky and three blue/slate skyline layers. Amazon, Microsoft and Capgemini now use transparent lettering directly on selected taller building facades, with billboard panels/posts removed. Warm windows and the reduced-motion-aware helicopter remain. Only background tower heights changed.
- Added a narrow red accent within the existing ground cable bounds; dark Slide bodies retain red danger paint and pale clearance edges. Course geometry, camera, physics, animation, schedules, Hunter logic and story/navigation are preserved.
- Passed TypeScript after the final review fixes and eight existing rendering checks. Focused browser review covered rooftops, construction and underground; it exposed a pale construction beam and an overly dark rear pipe, both corrected and visually rechecked. No device matrices, full-route testing, profiling or production build.
- Evidence is test-results/g72-underground.png. Small facade lettering remains secondary and can be partially occluded by nearer architecture; obstacle visibility during the entire route has not been visually reviewed.

G7.2 verification: Confirmed the saved implementation and prior rooftop/construction/underground browser review evidence. TypeScript and all eight focused rendering tests passed again. Re-inspected the saved tunnel screenshot for runner/ground separation.

## G7.2.1 - Yellow Decoration Cleanup & Sky Continuity - 2026-11-11
- Removed clustered window-box generation and its skyline draw batch/material, which produced the unwanted gold rectangles. Building silhouettes, blue-gray body colors, facade lettering and functional hazard indicators are preserved.
- The 400 m sky plane was fixed at world x=0, exposing black renderer clear space after the camera passed its right edge near x=200. The same existing plane now follows camera X/Y, retaining the approved shared light-blue gradient across the course.
- Passed TypeScript once after final edits and three existing environment/rendering tests, including an updated empty-window-pattern assertion. Browser review at the late Hunter section beyond 344 m confirmed continuous sky, clean building faces and no captured console errors. Evidence is test-results/g721-sky.png.

## G8.0 - CEO-Style Recruiter Character - 2026-11-11
- Added public/assets/characters/recruiter/recruiter.glb, an authored contour-based humanoid with dark jacket/trousers, white shirt/collar/cuffs, narrow black tie, shaped human head/hands and close-cut hair. The validated foot surface/weights form the dark dress-shoe base. Asset is 542,944 bytes, 3,110 vertices and 5,401 triangles, generated reproducibly by scripts/build_recruiter.mjs.
- Gameplay now loads the Recruiter asset and preserves its untextured flat materials. All clothing is skinned to the original 65-joint rig; all five source clips and inverse binds match, preserving Sprint distance synchronization, 1.533 s Slide and landing recovery. SHA-256 confirms runner.glb is byte-identical; /lab/runner continues using it.
- Passed TypeScript once, 11 character/animation tests and one production build (existing renderer chunk-size warning). Focused browser preview inspected Idle, Run and Slide, with evidence in test-results/g80-recruiter-run.png and g80-recruiter-slide.png.
- The separate pre-existing game-slide-skin test fails sole-penetration assertions against the untouched original runner. Recruiter comparison tests confirm no worsening of sampled source sole contact within 3 mm and no Slide height-envelope violation. Brief source contact clipping remains; no animation/physics calibration was changed. Hands/hair are deliberately simplified and the tie is subtle from the strict side view.

## G8.1 - Security Robot Visual Integration - 2026-11-11
- Replaced procedural quadruped rendering with the unchanged original runner.glb, loaded once alongside the separate playable Recruiter through the existing route loader. Runtime charcoal armor/dark joints and one Head-bone-attached red sensor preserve its android identity.
- SecurityRobot presentation uses one mixer with cloned Idle/Run clips, explicit in-place root anchoring and the existing RunStride/runSoleLift calibration. Run phase follows actual Hunter displacement; Idle/finish fades use simulation clocks, preserving pause/reset behavior. Mixers, sensor/material resources and both loaded characters are cleaned up through the existing lifecycle.
- Hunter simulation remains unchanged, including 344 m activation, 40 m chase, capture, proximity warnings and finish disengagement. Passed TypeScript once and 11 Hunter/character tests. Focused browser chase preview passed with no captured console errors; evidence is test-results/g81-security-robot.png.
- The 1.8 m humanoid visual deliberately retains the legacy 1.2 m wide by 1.05 m high capture region. Source animation contact remains approximate. Full-route tests, matrices, profiling and production builds were skipped.

## G8.2 - Continuous Security Robot Pursuit - 2026-11-11
- Pursuit activates at gameplay start with a configurable 3.2 m safe spawn gap and 0.25 s alert. Player speeds remain 4.5/6 m/s; robot base speed is 4.8 m/s, closing normal-speed separation by 0.3 m/s. Beyond 7 m, speed blends toward 6.4 m/s over a 3 m range to recover off-screen separation smoothly, without position snapping or a hard distance cap.
- Minimal traversal fallback records the player’s proven X/Y/ground/Slide poses in a pruned queue. Robot movement samples this path and reuses original Jump/Slide clips alongside Idle/Run, avoiding independent pathfinding. Grounded waits and 0.45 s recovery grace protect mandatory landing recovery. Capture requires grounded body overlap, clear intervening terrain and no separating solid obstacle.
- Grounded fatal obstacle/drone hits now show a Security closing in phase before existing failure/retry. Robot approaches continuously at a configurable 12 m/s, with a 0.45 s minimum presentation and 1.1 s maximum, then the existing 1.1 s retry. Airborne impacts and falls retain the existing failure path as the safe fallback. Pause/Restart/Replay/Finish reset or freeze the sequence deterministically; final-chase debug entry remains available.
- Passed TypeScript once after final edits and 13 focused Hunter/robot tests, covering normal/Sprint spacing, jump traversal, protected recovery, bounded obstacle approach, capture, pause/reset, finish and animation distance matching. Browser preview confirmed opening-rooftop pursuit and grounded capture approach with no captured console errors. Evidence is test-results/g82-start.png and g82-capture.png.
- Traversal replays the player’s route with retimed airborne/Slide poses, rather than independently simulated robot physics. Long separation or unsafe contact can end the bounded obstacle sequence before physical contact; fatal-obstacle retry still follows its original cause. Full-route browser automation, matrices, profiling and builds were skipped.

## W5.0 - Cinematic Portfolio Navigation Foundation - 2026-11-11
- Homepage navigation now links Play/About/Skills/Projects/Contact to /play, /about, /skills, /projects and /contact. Informational routes share a lazy SectionPage foundation with explicit placeholder copy, consistent navigation, focused headings, Back to Home, responsive layout and reduced-motion styles. The existing Website shell stays mounted across these pages, retaining ambient audio and idle-background ownership.
- Generalized the existing route curtain into one readiness-based transition with motion/identity-scan/system/blueprint/signal CSS identities. Navigation switches immediately, with no minimum loader duration or fabricated percentages. Abort-aware loadAssets resources coordinate module readiness, ignore stale navigation, expose failures and provide Retry via current-route reload plus Home recovery. Existing video/frame presentation callbacks gate Play/Recruiter reveal.
- Informational code is a separate small shared chunk; game/lab/Recruiter chunks remain lazy. The reusable AssetResource contract can accept future media/mode tasks. Aman remains Coming Soon with no registered asset-readiness claim. Existing Recruiter and laboratory routes remain connected.
- Passed TypeScript once after final edits, 13 targeted navigation/story/loading tests and one production build, retaining the existing renderer chunk-size warning. Focused browser review covered Enter/Skip opening, all four pages, heading focus, Home return, mute/audio handoff, natural Play completion, Recruiter Ready and Back to modes. Final browser logs captured no errors; original preview sound preference was restored. Evidence is test-results/w50-about.png.
- Page content remains clearly marked placeholder material. Retry currently reloads the destination; dynamic imports can finish downloading after cancellation, while their stale completion is ignored. Full browser matrices and profiling were skipped.

## W5.1 - Cinematic About Page, The Origin - 2026-11-11
- Replaced /about placeholder content with five chapters using the supplied identity, B.Tech/IoT education (ITM Gwalior, 2022–2026), Career Craftly internship (January–July 2025), GDG leadership (10+ workshops, 15 volunteers, 500+ students), and an aspirational closing. Shared navigation and Back to Home remain integrated with the persistent Website shell.
- Added 21 CSS building silhouettes in three blue-gray depth layers, restrained scroll-linked lighting, native chapter anchors and a small active-chapter rail. Mobile renders two layers with reduced travel; reduced motion uses static scenery and immediately visible text. Existing homepage background video pauses while the About city is visible; audio ownership is unchanged.
- Reusable useScrollStory schedules at most one RAF per scroll/resize, reveals via IntersectionObserver and cleans up listeners/observers/frames. About loads in its own lazy chunk and releases the existing route curtain only after mounting. The router now ignores same-path hash history changes, preventing chapter Back navigation from opening a stale curtain.
- Passed TypeScript once after final edits, nine focused About/navigation/loading tests and one production build (existing renderer chunk warning). About adds approximately 2.24 kB gzipped JS and 1.67 kB CSS. Focused browser review checked chapter content/progress, parallax, leadership metrics, in-page Back and Home return with no captured console errors. Evidence is test-results/w51-origin.png and w51-leadership.png.
- Mobile/reduced-motion fallbacks are implemented but were not exercised as a device matrix. No heavy 3D scene, new media assets, dependencies or gameplay changes were introduced; Skills and Projects remain their W5.0 foundations.

## W5.1.1 - Quick Cinematic & Audio Fix - 2026-11-11
- Fresh Home loads require ENTER before entrance.mp4 and idle.mp4; in-session Home returns retain the idle five-option menu.
- Informational pages reuse ambient.mp3 at 0.07 volume with 500 ms fades on the existing audio instance, preserving mute, playback position and intro ownership.
- Passed all 10 relevant audio/navigation tests. TypeScript was invoked once, but its final result could not be recovered from tool output. Build and browser checks were skipped as requested.

## W5.2 - Skills, The Systems - 2026-11-11
- Replaced /skills placeholder with a lazy-loaded blue-gray control center, Engineering Core circuitry and five expandable departments containing the supplied technologies.
- Reused shared navigation, Home link and useScrollStory parallax. Native buttons expose expanded states and labeled panels, with a vertical mobile layout and static reduced-motion treatment.
- Validation passed seven existing navigation/loading and shared scroll tests. TypeScript result recorded below after completion. Browser automation and production build omitted as requested.
- TypeScript ran once against the final code and completed successfully with exit code 0. Interactive visual behavior remains unverified in a browser.

## W5.3 - Projects, The City - 2026-11-12
- Replaced /projects placeholder with a lazy-loaded blue-gray skyline and three selectable architectural facilities using the supplied project descriptions and technology tags. Splitter and Cinematic Portfolio are marked In Development.
- Reused useScrollStory for scroll reveals/parallax, with native keyboard buttons, labeled detail panels, mobile sizing, reduced-motion fallback and shared Back to Home navigation. Facility selection shifts skyline layers with short CSS transitions.
- Portfolio GitHub link is verified against the repository entry in this document. Other project URLs and RecipeApp completion status remain unspecified.
- Seven existing navigation/loading and shared scroll tests passed. Browser automation and production build omitted as requested.
- TypeScript ran once after final edits and passed with exit code 0. Interactive presentation remains unverified in a browser.

## W5.4 - Contact, The Transmission - 2026-11-12
- Replaced /contact placeholder with a lazy-loaded blue-gray communications terminal, architectural frames, subtle SVG signal lines, shared scroll parallax and a short entrance transition.
- Added supplied mailto, LinkedIn and GitHub links, Copy Email with polite success/error feedback and a manual-copy fallback message, plus shared Back to Home navigation. Native controls provide visible focus, mobile layout and reduced-motion support.
- Seven existing navigation/loading and shared scroll tests passed. Browser automation and production build omitted as requested. Clipboard permission behavior and visual presentation remain unverified in a browser.
- TypeScript ran once after final edits and passed with exit code 0.

## W5.5 - Smart Play Resource Preloading - 2026-11-12
- Entering /play prepares the Recruiter module and both required character GLBs through loadAssets. Successful module/source-byte promises are shared with gameplay entry, preventing duplicate downloads while each mounted game owns and disposes its parsed scenes.
- Recruiter entry waits for resources before mounting and retains the existing themed curtain until presentation. Failed cache entries are evicted for retry, with the existing route Retry reload available on entry failure. Background preload failures do not block mode selection.
- Renderer creation, game loops and audio remain mount-driven. Aman/Friend availability is preserved. Cancellation discards stale consumers while shared requests may complete into cache after leaving Play.
- TypeScript ran once and passed with exit code 0. All six existing navigation/loading/Recruiter navigation tests passed. Browser automation and production build omitted as requested.

## W5.5.1 - Global Sticky Header - 2026-11-12
- Extracted the existing wordmark and SoundControl into SiteHeader. About, Skills, Projects, Contact and Play selection share fixed translucent blue-gray navigation with active-section highlighting and the existing audio state.
- Removed duplicate section navigation. Reserved header space and restored natural mobile section height, with native expandable mobile navigation, visible focus and Escape-to-close support. Homepage/intro retain the original compact header layout.
- All 10 existing navigation/loading and audio tests passed. Browser automation and production build omitted as requested, so visual/mobile positioning remains unverified in a browser.
- TypeScript ran once and passed with exit code 0.

## W6 - Cinematic Website Enhancement - 2026-11-12
- Refined About, Skills, Projects, Contact and Play selection with shared editorial typography, responsive spacing, architectural depth and restrained interaction contrast. Reused useScrollStory for additional reveals and selection parallax, with reduced-motion and keyboard-focus visibility.
- Added reusable VideoBackground supporting muted ambient loops, scroll-driven seeking, viewport/visibility pausing, deferred source loading, dark overlay, optional poster/CSS fallback, playback-error handling and navigation cleanup.
- Wired explicit empty video configurations into the four informational backgrounds. Available footage belongs to existing homepage/Play cinematics, so dedicated server-room, communications-room and other section footage remains unavailable. Existing CSS environments and Play footage remain in use.
- All seven existing navigation/loading and About/shared-scroll tests passed. Browser automation and production build omitted as requested. New playback modes and visual refinements remain browser-unverified.
- TypeScript ran once and passed with exit code 0.

## W6.2 - Fully Transparent Header - 2026-11-12
- Removed the fixed header background, border, blur and box shadow, plus sound/fullscreen control surfaces. Added subtle text shadows for contrast while retaining existing positioning, navigation and active indicators.
- Mobile dropdown retains a solid blue-gray panel for readability. No scroll-driven header surface behavior exists.
- Production build and browser automation omitted as requested. Visual contrast remains browser-unverified.
- TypeScript ran once and passed with exit code 0.

## W7.0 - Homepage Character Awaiting Supplied Asset - 2026-11-12
- No newly supplied character model was found in public assets or attachments. Existing runner/recruiter GLBs contain only Idle, Jump, Land, Run and Slide, with no Wave or requested menu gestures.
- Homepage character integration awaits the user-supplied model. Runtime files were left untouched.
- TypeScript ran once and passed with exit code 0. All four existing website navigation/loading tests passed.

## W7.1 - Existing Homepage Character - 2026-11-12
- Added a menu-only lazy R3F character using T-Pose.glb and runtime-named Idle/Walk/Run/Sit clips from the four supplied GLBs. Source bytes and extracted clips are cached, while mounted character scenes own disposal. Soft lighting, transparent canvas and eye-level framing retain the gray material.
- Menu hover/focus selects Run, Sit, Idle/rotation, Walk and Idle/rotation respectively. A single mixer blends over 0.22 s, retires previous actions and suppresses repeated triggers. Sit completes once before Idle. Runtime track copies hold horizontal hips stationary, preserving vertical poses and original GLBs.
- Added responsive character placement, non-intercepting canvas, static reduced-motion pose, pause/visibility guards and delayed renderer/scene cleanup matching SceneCanvas. No Wave clip is used.
- TypeScript ran once and passed. All five existing runner/navigation tests passed. Direct character harnesses passed interrupted fades, in-place motion, stable Idle, one-shot Sit including held focus, and source-clip preservation. Browser automation/build omitted as requested, so visual framing and gray-material appearance remain unverified.

## W7.1 Reverted - Original Homepage Restored - 2026-11-12
- Removed the homepage character mount, reaction handlers, model loading/playback components and character-only positioning stylesheet, restoring the existing five-option menu styling and interactions.
- Preserved all supplied character GLBs and unrelated website/gameplay work.
- TypeScript ran once and passed with exit code 0. All 10 existing navigation/loading and audio tests passed. Build and browser automation omitted as requested.

## G9.0 - Recruiter Selection Blocked by FBX Retargeting - 2026-11-12
- Inspected male.fbx (53.9 MB, seven skinned meshes) and female.fbx (59.3 MB, six skinned meshes). Both contain only a one-frame mixamo.com clip and zero-duration Take 001, with centimetre-scale geometry, different rest rotations and multiple partial skin skeletons. Existing Recruiter uses a canonical 65-joint rig.
- Male has 37 repeated canonical bone names and female has 24, including duplicate Hips nodes. A direct SkeletonUtils.retargetClip Run probe generated only partial tracks (male first skin has no hip track, female first skin has 15 tracks). This does not establish complete, correctly scaled animation across all body/clothing skins or approved Slide/contact alignment.
- Reliable replacement requires explicit reconstruction/mapping of the shared deform hierarchy and validation of per-mesh bind poses, scale and contact offsets. Selection integration is deferred under the requested fallback, retaining the current playable Recruiter. FBX originals and runtime files remain untouched.
- TypeScript ran once and passed. All six existing Recruiter character/animation and navigation tests passed. Browser automation and production build omitted as requested. Texture image decoding was stubbed during headless rig inspection, so FBX texture appearance is unverified.

## G9.1 - Recruiter Replacement Asset Inspection - 2026-11-12
- Recruiter directory currently contains male.glb and recruiter.glb. Listed Jump.fbx, Land.fbx, Run.fbx and Slide.fbx were not found in public character assets or attachments. The separate runner/Slide.fbx belongs to the existing robot pipeline.
- male.glb embeds Idle (8.800000 s), Jump (0.933333 s), Land (2.133333 s), Run (0.566667 s), Slide (1.566667 s) and duplicate idle mixamo.com. It has a 65-joint mixamorig7 rig, centimetre-scale Armature rotated 90 degrees about X, with forward translation on local Y and vertical motion on local Z. Current controller expects canonical hip naming, metre-space Y-up/Z-forward root motion and old measured contact phases.
- Embedded Slide differs from fixed 1.533333 s gameplay timing. Replacement is deferred pending the listed clips or authorization to adapt the embedded clips with root-axis normalization and contact/timing calibration. Current playable fallback and runtime files remain intact.
- TypeScript ran once and passed. Targeted tests passed 8/9, including all four Recruiter character tests. Existing game-slide test at line 44 failed its restart-count assertion (0 versus 1), with no runtime edits in this milestone. Build/browser automation omitted as requested.

## G9.2 - Male Recruiter Activated - 2026-11-12
- Gameplay now attempts male.glb using its embedded Idle, Run, Jump, Land and Slide clips. Added the Draco decoder distributed with installed Three.js (251 kB combined) and retained recruiter.glb as a load/controller-validation fallback. Existing Play preparation shares cached model bytes.
- Runtime Armature normalization preserves mesh/bone world transforms, converts only hip keys to metre-space Y-up/Z-forward, renames the hip binding and fits the visual to 1.8 m with grounded origin. Existing actor rotation faces positive gameplay X. Slide keys are scaled from 1.566667 s to exactly 46/30 s, with source assets untouched.
- Existing controller retains transitions, root anchoring and stride-distance Run playback. Male-specific Jump/Land anchor corrections replace old character sole offsets. CPU skin sampling places Land impact at frame 20 and movement recovery at frame 50 of its 2.133333 s clip. Security Robot continues using its existing asset/controller.
- Headless Draco/skin checks verified normalized height, finite poses, Run travel (2.906926 m per cycle, average playback rate 0.877215 at 4.5 m/s), fixed Slide completion with sampled skin below collider height, and one complete hard Land returning to Run. Texture decoding was stubbed for these checks. Browser appearance, contact quality and the 56.3 MB model's device load cost remain unverified.
- Existing tests passed 16/17. The unchanged game-slide restart-count failure expects 1.1 s immediately after barrier failure, while simulation enters capturing before a separate 1.1 s fallen retry delay. This is unrelated to character integration and was reported separately.
- TypeScript ran once and reported TS2339 on texture.source.data.close. Corrected cleanup using an ImageBitmap type and function guard afterward, without repeating the requested single TypeScript check. Build and browser automation omitted as requested.
