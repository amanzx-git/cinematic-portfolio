# Codex Project Instructions

## Project Overview

We are building a cinematic 2.5D parkour experience for a developer portfolio.

The project prioritizes smooth gameplay, stable frame pacing, cinematic presentation, and maintainable architecture.

## Technology

- React + TypeScript + Vite
- React Three Fiber and Three.js
- Three.js Shading Language (TSL)
- WebGPU with WebGL 2 fallback
- Drei for useful R3F utilities

Additional libraries should only be introduced when required by an approved milestone.

## Development Rules

1. Implement only the currently authorized milestone.
2. Do not implement future features without approval.
3. Read only documentation relevant to the current task.
4. Prefer simple, modular, understandable code.
5. Avoid unnecessary abstractions and dependencies.
6. Prioritize smooth rendering and consistent frame pacing.
7. Do not use expensive effects unless they provide measurable visual benefits.
8. Keep the game independent of the portfolio website where practical.
9. Do not create placeholder characters from primitive shapes as final character assets.
10. Do not silently change major architectural decisions.

## Workflow

Before implementation:
- Inspect existing code and relevant documentation.
- Identify the files that need changes.
- Check compatibility with installed dependencies.

After implementation:
- Run TypeScript checking and the production build.
- Run relevant tests where available.
- Update `docs/progress.md`.
- Summarize changes and verification results.
- Stop and wait for approval before the next milestone.

## Current Milestone

F0 — Rendering Foundation.

Do not implement F1 or later milestones until explicitly approved.