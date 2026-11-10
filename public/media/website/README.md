# Website media — W3.1

The supplied `entrance.mp4`, `idle.mp4` and temporary 8-second Silent Shadow `play-intro.mp4` are enabled in `media.json`. The entrance is already reversed, confirmed by the user: arm down → raised. Do not reverse it again. The included static SVG remains the fallback. See [VALIDATION.md](VALIDATION.md) for verified source details and visible continuity limitations.

To enable videos, place these files here and update `media.json`:

```json
{
  "entrance": "/media/website/entrance.mp4",
  "idle": "/media/website/idle.mp4",
  "playIntro": "/media/website/play-intro.mp4"
}
```

- `entrance.mp4`: short non-looping entrance, ideally 3–8 seconds. Match its final frame to the start of the idle. A 15-second stall/length watchdog continues to the menu; visitors can skip immediately.
- `idle.mp4`: seamless atmospheric loop. Both should share framing, aspect ratio and color grade. Use broadly supported H.264 MP4 with fast-start metadata and optional AAC audio; test actual codecs on target browsers. Keep the subject out of the left text area. Prefer a modest compressed 1080p source; measure bandwidth before raising resolution.
- `play-intro.mp4`: optional once-only Play introduction, requested only after clicking Play. Prefer a short atmospheric edit under 15 seconds, without essential instructions conveyed only through video/audio. Use the same codec and modest resolution guidance above. A 20-second failure/stall watchdog switches to the caption fallback; Skip is available as soon as the mode-selection module is ready. This video stays muted; the shared background music continues through Play.
- `city-poster.svg`: supplied 1671×941 sunset skyline PNG embedded in an SVG container (approximately 1.94 MB). Existing loading, background and video-poster references retain this path. Keep the fallback available even with videos.

Initial loading waits for the manifest response, poster load and document fonts (system fonts, no external requests). It shows indeterminate progress without percentages or minimum delay. Errors or an 8-second essential-network timeout permit a static fallback; visitors can also explicitly continue with static visuals. After Enter, entrance plays once while idle preloads paused/muted in a second layer. At the handoff, entrance is paused first. Its final frame remains until idle presents a decoded frame, then idle fades over it for 450 ms. The menu is available even if idle is still loading. All video source audio stays muted: the single [ambient soundtrack](../audio/README.md) owns sound, Enter consent and the persisted mute preference across the handoff and W2. Missing/unplayable videos fall back to static visuals/menu; rejected playback never blocks navigation. Reduced-motion users skip both homepage videos and their downloads entirely; the shared music remains available after Enter. The motion control pauses only the visual idle loop. Both layers use object-fit cover with a right-biased portrait crop to retain the character's head/torso; peripheral arm/scene cropping is expected from landscape media.

Play uses a small separately loaded website mode-selection module, never a game import. If `playIntro` is null, missing, or playback fails, an atmospheric placeholder shows three short captions at 2.2 seconds each. This is editorial presentation pacing, not loading progress or canonical gameplay story. Reduced motion shows all captions statically with Skip intro available once ready, without requesting the video or advancing captions automatically. If the introduction completes before the module arrives, a genuine indeterminate loading message appears. Failed destination loading offers Back and Reload; no Skip to an unavailable screen is shown. Back/Escape returns to the homepage with focus on Play. Recruiter is explicitly in development; Aman and Friend are Coming Soon. None launches gameplay.

W4.1 uses the supplied approximately 7.93-second, 1280×720 MP4 without source modification. It plays once after Play and stays muted, including its embedded AAC track. The decoded final frame remains while modes load; Skip also pauses the outgoing frame. Generic intro copy is hidden visually while the video is available. The mobile orientation gate pauses/resumes the same video. To replace this temporary introduction later, replace the file or change only the manifest path; review the 20-second watchdog in `PlayExperience.tsx` if the authorized replacement is longer. `node tests/play-intro-media-browser.mjs` checks the actual configured media/audio and transitions.

W4.2 mode selection uses exactly `shadow-idle.mp4` (no separate Shadow Reveal asset). Both natural intro completion and Skip fade the application to near-black for 450 ms, prepare the muted shadow loop, hold the overlay until a frame is renderable, reveal it for 450 ms, then fade in existing modes over 250 ms. Incoming failure or an 8-second stall uses the existing static fallback. The shadow source is attached only after the transition starts. Portrait gating pauses the loop; reduced motion uses static visuals. Back cancels timers and releases media, and music remains continuous. Run `node tests/shadow-modes-browser.mjs` for actual-file timing/readiness, loop, race, failure, reduced-motion, mobile and cleanup checks.

The route `/lab` remains the development rendering laboratory. Production hosting must serve `index.html` for `/lab` (SPA fallback). No backend or hosting changes are included here. Content under About, Projects and Contact is explicitly provisional.
