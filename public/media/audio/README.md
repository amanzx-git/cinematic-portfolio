# Background soundtrack — W3.0

The supplied `ambient.mp3` (1,740,651 bytes; Chrome duration approximately 56.75 seconds) is the only soundtrack. No music was downloaded, generated or modified. Replace it at this path to change the score.

- One native HTMLAudioElement lives for the website session, including Play/mode selection. It has no source and makes no request before Enter. Enter calls play synchronously in the user gesture; a saved mute choice prevents playback/download until explicitly unmuted.
- A new visitor hears a 650 ms fade to volume 0.35 after Enter. The upper-right speaker button is keyboard/mouse/touch accessible. It controls the same state everywhere, including reduced-motion/static and missing-video fallbacks.
- Mute silences immediately, saves the choice and fades the internal volume to zero over 300 ms before pausing. Unmute resumes the current position, with a fade back to 35%; it does not seek to zero. localStorage key: `aman.portfolio.muted`. Storage failures are tolerated. Saved unmute still requires a fresh Enter click after reload.
- All website videos stay muted, so video changes never layer source audio over music. Pausing visual motion does not pause the soundtrack. The same track continues into Play, modes and Back.
- Native `loop` is enabled. Browser looping was checked by seeking near the end; this verifies a wrap, not an inaudible MP3 seam. No crossfade/edit/padding correction is claimed. Listen on target devices to approve the exact loop and sound quality.
- Missing/unplayable music and rejected play promises show a nonblocking status; visuals/navigation continue. Toggle sound to retry after a blocked attempt. No retry loop or forced unmute runs automatically.
- Fades use requestAnimationFrame directly without React updates. Listener/frame/source cleanup silences immediately on component teardown; page teardown cannot wait for an audible fade. Native media volume behavior varies on mobile, so a physical iOS/Android listening/volume check remains required. Chrome touch/viewport emulation is not physical-device verification.

Run unit checks with `npm test`. `node tests/music-browser.mjs` uses the production preview and dedicated Chrome/CDP on port 9224 (TEST_URL/DEBUG_PORT overrides supported). It tests the actual MP3, consent/user activation, volume, looping, track identity through navigation, keyboard/touch mute, preference reload, missing audio, denied playback and unavailable localStorage. No soundtrack is a prerequisite for core navigation.
