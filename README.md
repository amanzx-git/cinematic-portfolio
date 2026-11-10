# Cinematic Portfolio

Cinematic website at `/`: real essential-resource loading, Enter, optional entrance/idle video playback, and Play/About/Projects/Contact menu. Play opens a cinematic introduction and three mode previews. The authored static city illustration and caption introduction work without final media. Recruiter is in development; Aman and Friend are Coming Soon. No gameplay or backend is included.

The existing 2.5D rooftop rendering laboratory is preserved at `/lab`, including its renderer diagnostics, quality presets, loading/error UI and environment. Its code is loaded separately from the website.

## Technology

React 19, TypeScript, Vite, React Three Fiber and Three.js, with WebGPU rendering and a WebGL 2 fallback in the laboratory.

## Project status

The website includes cinematic entrance and idle playback, continuous background music, mobile orientation handling, and concurrent loading for the Play cinematic and Shadow mode selection. Gameplay and backend services are not implemented. The runner asset is a technical export awaiting runtime acceptance; see [asset provenance](public/assets/ASSETS.md).

Development history and verification are recorded in [docs/progress.md](docs/progress.md). Generated builds, dependencies, browser test artifacts and private character source files are excluded from Git.

## Run

Use Node.js 22.12+ (verified with 26.7.0):

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 for the website or http://127.0.0.1:5173/lab for the laboratory. In PowerShell with scripts disabled, use `npm.cmd` instead of `npm`.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Preview serves the build at http://127.0.0.1:4173. No lint task is configured.

## Website media and checks

The supplied `entrance.mp4`, `idle.mp4` and Silent Shadow `play-intro.mp4` (approximately 40.67 seconds in the current supplied file) in `public/media/website/` are enabled in `media.json`. Entrance is already reversed (user confirmed), so its bytes are preserved. Idle preloads after Enter, stays paused during entrance, then dissolves over the retained final entrance frame once it presents a decoded frame. Play runs its cinematic once and automatically continues to modes; Skip waits for mode resources. All videos stay muted; the supplied `public/media/audio/ambient.mp3` is the single continuous soundtrack. Enter starts it at 35% with a short fade unless the visitor saved mute. The upper-right speaker control preserves mute preference, and no audio loads/plays before Enter. See [audio behavior](public/media/audio/README.md), [media instructions](public/media/website/README.md) and [validation/known discontinuities](public/media/website/VALIDATION.md). No game resources are loaded by the website flow.

Run `node tests/website-browser.mjs` against production preview with dedicated Chrome on local debugging port 9224 (`DEBUG_PORT` and `TEST_URL` can override). This uses existing CDP tooling and generates its video fixture locally. It verifies real loading readiness, keyboard Enter/menu/panel focus, entrance-to-idle playback, mute/pause/skip, missing resources, rejected autoplay, reduced motion, desktop/mobile overflow, network isolation and the preserved WebGL 2 lab. Screenshots go to ignored `test-results/website-home.png` and `website-mobile.png`. Close the test browser afterward. Production hosts need an index.html SPA fallback for `/lab`.

Run `node tests/play-browser.mjs` with the same setup for Play regressions. It uses the supplied MP4 and checks caption/video completion against a genuinely held mode-module request, readiness-gated Skip, keyboard/touch activation, Back/Escape/focus return, unavailable mode labels, retained mute preference, missing/rejected video, reduced motion, module failure recovery and network isolation. Mode screenshots go to ignored `test-results/w2-modes-desktop.png` and `w2-modes-mobile.png`. Run `node tests/play-intro-media-browser.mjs` for W4.1's actual manifest, once-only cinematic, final-frame retention, automatic modes, continuous soundtrack and landscape/mobile rotation checks. Physical-device/codec/audio review remains manual.

Run `node tests/homepage-media-browser.mjs` with production preview/Chrome for the actual supplied W3.1 files: desktop/mobile entrance handoff, idle preload/loop wraps, retained frame during a delayed idle request, sound/keyboard controls, reduced motion and network isolation. `node scripts/inspect-website-media.mjs` reports local MP4 metadata and source hashes without changing the files.

W3.2 mobile: welcome works in portrait or landscape. Enter attempts fullscreen/landscape lock once where available; manual rotation works when either is unsupported or rejected. A portrait rotation dialog pauses visual progression while preserving music and playback position. Continue in portrait (or Escape) offers a simplified layout; fullscreen has an explicit exit control. Run `node tests/landscape-browser.mjs` on production preview with dedicated Chrome on port 9224 for gate, rotation, media continuity, fallback and small-screen checks. API permission success is simulated; native iPhone/Android behavior needs device review.

W4.2: natural Play completion and ready-gated Skip share a 450 ms fade to near-black, renderable-frame gate for `shadow-idle.mp4`, 450 ms nighttime reveal and 250 ms mode-options fade. The supplied shadow video loops muted behind modes; music continues independently. Errors/timeouts and reduced motion use the existing static fallback. Back releases videos and cancels transitions. Run `node tests/shadow-modes-browser.mjs` for the actual-file transition, loop, race, failure, mobile and cleanup checks.

Run `node tests/music-browser.mjs` in the same setup for the actual ambient MP3: gesture consent, 35% fade, loop wrap, immediate mute/position-preserving unmute, preference reload, one track across homepage/Play/modes, mobile touch, missing track, blocked playback and unavailable storage. Final listening and physical mobile browser volume checks remain manual.

## Renderer compatibility

Pinned React/DOM 19.2.0, R3F 9.6.1, Three.js 0.185.1 and @types/three 0.185.0. TypeScript 5.9.3 and Vite 8.3.7. The lockfile records all resolved versions. F1.1 adds no dependencies.

WebGPURenderer from `three/webgpu` initializes before R3F mounts. Three automatically selects its WebGPU or WebGL 2 backend. An initialization exception retries forced WebGL 2 on a fresh canvas. The diagnostic reads the actual initialized backend. A custom R3F root mounts that same canvas and observes resizing.

Use `/lab?backend=webgl` to force WebGL 2. WebGPU requires a secure context (HTTPS or localhost) and working browser/driver support. WebGL 1 is unsupported. Both backends failing produces readable error UI. Automatic recovery from later GPU device loss is not implemented. Future TSL effects need independent fallback validation.

Low/Balanced/High cap DPR at 1/1.5/2. Diagnostics show half-second averages of R3F frame intervals, excluding gaps over 250 ms; they are not GPU timings or benchmark percentiles. The orthographic camera preserves the full rooftop width on narrow screens. There is no camera following.

Atmospheric drift switches between two cached TSL materials: a static sky baseline and the same sky plus two slowly moving sine bands. Both share an aspect-correct glow and small sun, in one sky draw. Both compile on WebGPU and WebGL 2; no backend-specific shader syntax, textures, postprocessing, shadows or volumetrics are used. Geometry/materials are reused and disposed on unmount. Authored stepped towers and industrial rooflines use one instanced draw per depth layer; rooftop details use seven instanced batches (11 scene draws total before culling). Nothing updates React state per frame.

The future run corridor stays clear at z=-1.7 to +1.7. Vents, rear railings and the mast occupy the service ledge behind it; conduits and louvers are attached below the roofline. Foreground brackets remain below foot level. These are visual details with no collision or gameplay systems.

API references: [R3F renderer setup](https://r3f.docs.pmnd.rs/api/canvas), [Three WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer). Installed source/types were also inspected.

## Browser smoke checks

Start Vite and separate headless Chrome with `--headless=new --remote-debugging-port=9222 --user-data-dir=<temporary-profile>`, then run `node tests/browser.mjs` with Node 22+. It uses built-in WebSocket/CDP support to check real backends, desktop/narrow resize, all quality DPR caps, effects/diagnostics toggles, unsupported graphics and console errors. Set `TEST_URL` to override the default http://127.0.0.1:5173 (for example to test production preview). Screenshots and `measurements.json` go to ignored `test-results/`. Keep the debug port local and close the test browser afterward.

The browser script records three-second requestAnimationFrame samples after warmup for Balanced drift off/on and Low drift on. It reports median/p99/max intervals and 1% low FPS (1000 divided by the mean of the slowest 1% of intervals). These are short browser scheduling measurements, not GPU timings or a guarantee of stable 60 FPS. See the progress log for results and hardware limitations.

See `docs/progress.md` for results and limitations.

## Longer performance baseline

Build and serve production with `npm run build` and `npm run preview`. Launch a dedicated Chrome with a temporary profile and local debugging port 9223, keeping the measurement tab visible. Then run:

```sh
node tests/performance.mjs
```

`DEBUG_PORT`, `TEST_URL` (default http://127.0.0.1:4173) and `PERF_OUTPUT` override the browser port, source and output file. By default, results go to `test-results/f1-1-baseline.json`. Chrome can also run headless for automation, but label those results accordingly. Normal application code contains no benchmark instrumentation.

Each backend gets a fresh navigation with 0–5 second startup and 5–15 second warm-up windows. Each material/quality switch then gets a separate five-second warm-up, excluded from steady samples. Balanced drift off/on is measured for 30 seconds each, in opposite orders across backends. Low drift on is measured for 15 seconds. All raw frame intervals, median/P95/P99/max, long tasks, coarse main-thread duration deltas, viewport, drawing-buffer size, actual DPR, quality, backend and browser/GPU diagnostics are saved. Long intervals are retained, unlike the lightweight HUD. A visibility change invalidates the sample.

For an empty-tab scheduling control, run the same script with `CONTROL_ONLY=1` and a different `PERF_OUTPUT` (in PowerShell use `$env:CONTROL_ONLY='1'`, and remove it afterward). This records 30 seconds without the scene. Do not run scene and control measurements concurrently.

GPU diagnostics identify the browser's ANGLE renderer; they do not necessarily identify the separate WebGPU adapter. These are browser scheduling measurements, not GPU-completion timestamps. Compare longer visible-browser runs on the intended hardware before claiming stable 60 FPS or attributing a regression to a shader. Shader caches, power state, thermal state and OS scheduling are not controlled by this script.
