# Homepage video integration — W3.1

## W4.2 Shadow mode-selection backdrop — 2026-11-10

Used the supplied `shadow-idle.mp4` unchanged: 4,479,162 bytes, SHA-256 `02a6b7b07350ba73cf23c48085d3aa37b410abeb249b2390fdb88a244350631c`. Browser decoding reports 1672×940 and 5 seconds. H.264-only MP4, 150 video frames at 30 fps, no audio track, and non-fast-start metadata. No separate Shadow Reveal asset was created or requested.

Real-file tests verify shared natural/Skip transition, approximately 450 ms fade down and 450 ms reveal, an opaque hold for a delayed first renderable frame, 250 ms options fade, two native loop wraps, rejected/missing/stalled-media fallback, reduced-motion static visuals, live motion preference changes, soundtrack continuity, mobile rotation, and media/timer cleanup on Back. Desktop 1440×900 and landscape mobile 844×390 screenshots were visually reviewed for readable modes and undistorted framing. Source looping is functional; no seamless edit, bandwidth or physical-device playback guarantee is claimed. The older W4.1 static mode background described below has been replaced by this loop (static remains the error/reduced-motion fallback).

## W4.1 Play cinematic — 2026-11-10

Enabled the supplied `play-intro.mp4`: 3,152,916 bytes; SHA-256 `0f5d39f14895bd5d4f5af8cab0e7b6fa7b62282460891aca1c5ccb6e8a1aa5c6`. Decoded Chrome dimensions 1280×720, browser duration 7.93 seconds; MP4 H.264 video has 190 frames at 24 fps (7.916667 s), with an AAC track (7.972667 s) that remains muted. Metadata follows media data (not fast-start). Source bytes are preserved; no generation, substitution or re-encoding.

The actual-file W4.1 browser suite verifies once-only playback, retained decoded final frame during delayed destination loading, automatic modes, readiness-gated Skip, soundtrack continuity/single identity, landscape rotation pause/resume and saved mute. Screenshots reviewed at 1440×900 and 844×390. Reduced motion, playback errors and failed destination recovery pass in the Play regression suite using the delivered file. See [progress](../../../docs/progress.md) for details and physical-device limitations.

The W3.1 homepage observations below are historical. The current workspace's homepage source hashes/sizes differ from that intake; W4.1 did not replace or edit those files. Use `node scripts/inspect-website-media.mjs` to inspect the currently supplied sources.

## Historical W3.1 intake

W3.0 audio update (2026-11-10): all video elements now remain muted. The single shared `ambient.mp3` soundtrack owns Enter consent and persisted mute across homepage/Play. Earlier source-audio checks below are historical; see [audio behavior](../audio/README.md) for the current policy. Video framing/transition code is otherwise preserved.

Inspected 2026-11-10. Source files are unchanged. User explicitly confirmed entrance was already reversed and must remain arm down → raised. FFmpeg/ffprobe were not available on PATH or the checked common installation paths; no reversal or re-encoding was needed or performed.

| Source | Bytes | Browser dimensions | Duration | Tracks / samples |
|---|---:|---|---|---|
| entrance.mp4 | 6,084,945 | 1920×1080 | 5.000 s | H.264 (`avc1`), 150 frames / 30 fps; no audio track |
| idle.mp4 | 794,224 | 1024×592 | 5.041667 s video | H.264 (`avc1`), 121 frames / 24 fps; AAC (`mp4a`) audio, 5.032 s |

- Entrance SHA-256: `0f9719b7fef02647983802c816c6231f609d42feb36c93eb098f77b2ed8fbdae`.
- Idle SHA-256: `c38bf5ed2462af3d054ec09499e3c04ab61b093beb055dfa3e54e2b60cc8c427`.
- Both files have `moov` after `mdat` (not fast-start). Chrome/Vite range delivery worked locally. Slow-network startup has not been benchmarked; a future lossless fast-start remux could improve metadata delivery. No such processing is claimed here.
- Metadata can be reproduced with `node scripts/inspect-website-media.mjs`; it reads the MP4 boxes without altering media. Dimensions were measured from decoded videos in Chrome.

## Playback and presentation

The flow remains LOADING → AWAITING_ENTER → ENTRANCE_ANIMATION → HOME_MENU. No video is attached/downloaded before Enter. Idle preloads after Enter without playing, and entrance plays exactly once. The final entrance frame stays visible while idle prepares. A presented-frame callback gates the 450 ms idle dissolve; outgoing video/audio is stopped before idle starts. Reduced motion avoids video requests and uses the existing static design. W2 and the rendering laboratory remain separate.

Real-file browser checks cover 1440×900 and 390×844, two idle loop wraps, muted startup, retained explicit unmute, subsequent mute, keyboard menu/panel controls and no character/lab downloads. The test also holds the idle network request past entrance completion to verify the retained final frame. Functional failure checks use the existing fixture suite for missing media, rejected playback and reduced motion. No black flash was observed at the entrance handoff; decoded-layer coverage was measured until the first loop. Browser readyState briefly lowers during native loop seeking, which alone is not evidence of a black frame. Screenshots and samples are in ignored `test-results/w3-*` files.

## Known source discontinuities and limits

- Entrance depicts a detailed, cloudy sunset skyline; idle starts with a flatter illustrated skyline and clearer sky. The raised-arm poses are similar but the figure, exposure and framing differ. A dissolve softens the change but does not make the shots match.
- Idle's camera/skyline changes substantially during its five seconds. Its end does **not** match its start, so native looping has a visible framing/skyline reset. This is not a seamless source loop. No frame interpolation, loop edit or replacement generation was performed.
- Source watermarks remain visible: DeeVid AI in entrance, PixVerse.ai in idle. They were not removed.
- Desktop retains the character on the right behind the full-viewport cover layer. Portrait framing retains head/torso with a right-biased crop; parts of the raised arm and landscape are necessarily cropped. The shaded text/menu remains usable. A dedicated portrait edit is needed to retain the full landscape composition on phones.
- Local headless Chrome/software decoding is functional evidence, not a physical-device or bandwidth benchmark. Audible sound quality and the AAC loop seam require manual listening on target devices. No broad performance or cross-browser guarantee is made.
