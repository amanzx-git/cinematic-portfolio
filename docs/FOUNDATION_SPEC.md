# Foundation Technical Specification — Draft 0.1

## 1. Goal and non-goals
**Goal:** demonstrate a premium-looking, responsive 2.5D side-view scene in a browser with a stable render loop, layered skyline, subtle atmospheric shaders, and eventually a real animated character. Build incrementally; quality-gate each stage.

**Not in scope:** gameplay story, recruiter chase, follower AI, multiplayer, Django backend, authentication, portfolio pages, menu video, loading cinematics, complex physics, levels, production deployment. These may be considered after the foundation is validated.

## 2. Stack
- Vite + React + TypeScript.
- Three.js + React Three Fiber (R3F) + Drei as needed.
- Three.js WebGPURenderer / TSL for selectively authored effects, with tested WebGL 2 fallback. Confirm package-version-specific API and compatibility against installed documentation; don't blindly copy older examples.
- CSS for diagnostics and UI overlays; no UI framework required.
- Use a small, maintainable dependency set. Do not add Rapier, Zustand, GSAP, Howler, or backend packages unless a milestone specifically needs them.

## 3. Architecture boundaries
- `src/app/`: entry, app shell, feature flags, fallback and error handling.
- `src/scene/`: scene composition, environment, camera and lighting.
- `src/rendering/`: renderer setup, backend selection, capability checks, TSL effects, quality settings.
- `src/game/`: future deterministic movement/input, separate from React UI state.
- `src/character/`: future model loading, animation state machine, controls.
- `src/ui/`: performance panel, loading/error messages, accessibility controls.
- `public/assets/`: optimized GLB, images, audio, with licenses tracked.

Treat these as logical boundaries, not a mandate to create empty folders or excessive abstractions. Keep per-frame mutable simulation out of React setState. Avoid allocations and shader recompilation in frame loops. Properly dispose of resources.

## 4. Rendering strategy
- WebGPU preferred only when functional; explicitly test WebGL 2 fallback in the same build. If a specific TSL node/effect is unsupported on fallback, provide a simpler fallback or disable it.
- Never make the site inaccessible merely because WebGPU is unavailable. Include a readable error for unsupported graphics.
- Prefer simple geometry for collision surfaces; planes/billboards or instancing for distant buildings. Use depth layers and haze instead of modeling entire city blocks.
- Start with a sky gradient, one sun direction, ambient fill, and simple depth fog. Add one effect at a time and measure impact.
- No screen-space reflections, volumetric ray marching, expensive full-resolution postprocessing, or high-poly assets in foundation.
- Use device pixel ratio caps and user-selectable quality modes. Adaptive resolution is optional and must use measured performance with hysteresis; never fluctuate resolution every frame.

## 5. Motion and performance
- Target 60 FPS at a representative desktop resolution on the owner's laptop, but do not promise universal 60 FPS. Measure median and 1% low FPS, frame-time spikes, CPU/GPU cost where available, and loading time.
- Frame-rate-independent camera damping and movement; avoid using raw per-frame increments.
- Keep input latency low and movement predictable. Physics/simulation should use a fixed timestep or otherwise stable delta handling when introduced.
- Separate a baseline without postprocessing from effects-enabled measurements.
- Test at least Chrome/Edge with WebGPU and WebGL fallback when possible, plus a weaker-quality setting.

## 6. Visual direction
- Dark or near-black silhouette subject, clear readable pose, detailed but efficient rooftop geometry.
- Atmospheric skyline built with layered planes and restrained parallax.
- Strong composition, contrast, gradients, subtle haze and controlled highlights.
- Cinematic does not mean maximal bloom, motion blur, particles or expensive materials.
- Keep the character framed in a primarily side-on camera. Scripted camera movement remains deferred.

## 7. Asset constraints
- Do not create a humanoid from primitive cubes/spheres as the approved character.
- Prefer one appropriately licensed, rigged GLB/FBX humanoid with idle/run/jump/land clips. If clips come from another skeleton, retarget and verify in Blender.
- The character must be silhouette-readable at game camera distance.
- Optimize model and texture size only after validating animations; avoid destroying deformation quality.
- Keep an asset manifest with source URL, author, license, attribution, modifications, and export settings.

## 8. Acceptance gates
F0: working app, renderer diagnostics, backend selection/fallback, resize/error handling, clean build.
F1: appealing static cinematic environment; no character; measurable performance.
F2: genuine rigged character with idle/run/jump/land; no foot sliding at idle; animation blending demonstrated.
F3: keyboard movement, jump, simple collisions, smooth side-view camera; no visible jitter.
F4: restrained TSL effects, measured quality settings, performance report, fallback check, polish pass.

## 9. Rules for Codex
- Implement ONLY the currently approved milestone.
- Before changing files, summarize the plan and list files to touch.
- Use current package docs and inspect installed API signatures; report uncertainty instead of inventing imports.
- Keep changes small and easy to review. No unrelated features or refactors.
- After changes run typecheck, lint (if configured), build, and relevant tests; report exact results and failures.
- Provide run instructions, screenshots or recordings when possible, performance measurements with machine/browser details, and a short handoff.
- Stop after each milestone; wait for explicit approval to continue.
