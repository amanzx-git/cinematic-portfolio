# Codex Milestone Cards — Foundation Only

## F0 — Renderer and diagnostics
**Implement:** Vite/React/TS; minimal R3F canvas; compatible Three.js WebGPURenderer setup; WebGL 2 fallback; viewport resize; loading/error UI; simple floor and camera; FPS/frame-time display toggle; quality selector; README instructions. **Do not add a character or city.**
**Verify:** `npm run build`; typecheck; test backend selection in supported/unsupported WebGPU conditions; browser console clean; diagnostics show active backend and DPR. Record versions and fallback limitations.
**Stop and ask for approval.**

## F1 — Cinematic environment
**Implement:** one short rooftop platform, foreground edge, distant skyline layers using instancing/planes, sky gradient, haze, controlled sunlight; one simple TSL effect where compatible. Add a comparison toggle for effects. **No character yet.**
**Verify:** visual review at 16:9 and narrow viewport; no clipping or obvious z-fighting; performance baseline with effects off/on; WebGL fallback works.
**Stop and ask for approval.**

## F2 — Rigged character
**Prerequisite:** user supplies or approves a licensed, rigged character and animation files. Codex should not fake this prerequisite by making a primitive humanoid.
**Implement:** GLB loader, animation mixer/state transitions, silhouette material, idle/run/jump/land preview controls, animation debug info; preserve original asset licenses.
**Verify:** correct scale, facing direction, foot contact, no broken skinning, smooth transitions; reasonable draw calls and model size.
**Stop and ask for approval.**

## F3 — Playable controls
**Implement:** A/D or arrows, Space jump, simple grounded state and collision with rooftop, side camera follow with frame-rate-independent damping, pause/restart. Keep movement independent from rendering state.
**Verify:** consistent behavior across 30/60/120 Hz conditions, no double jump unless intentional, no camera jitter, no game-breaking edge cases.
**Stop and ask for approval.**

## F4 — Polish and benchmark
**Implement:** one or two measured TSL enhancements, stable quality presets, optional adaptive resolution only if useful, subtle camera/animation polish. No new game mechanics.
**Verify:** side-by-side quality comparison, real FPS/frame-time report on user's hardware, memory/asset size report, WebGPU/WebGL comparison, documented bottlenecks and next decisions.
**Stop and ask for approval.**

## What is NOT authorized
Do not implement recruiter mode, Aman follower, enemies, story, multiplayer, Django, homepage, portfolio pages, game levels, menu screens, or production asset purchases during F0–F4.
