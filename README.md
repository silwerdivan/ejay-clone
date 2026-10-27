# PULSE/08

A local-first, eight-bar browser loop studio built with React, TypeScript, Vite, Tone.js, Tailwind CSS, and dnd-kit.

```sh
npm install
npm run dev
```

## Verify

```sh
npx playwright install chromium
npm run build
npm test
```

The app has no backend or runtime external requests. Arrangements are saved in `localStorage`, with visible feedback if saving is unavailable. All 16 one-bar, 120 BPM, C-minor loops are bundled in `public/audio`: 12 original synthesized instruments and four prerecorded CC0 vocal edits. See `public/audio/LICENSE.md` for sources and licenses.

## Deploy

In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. Pushes to `main` then deploy automatically to GitHub Pages; you can also start the **Deploy to GitHub Pages** workflow manually.

Regenerate the instruments with `python3 scripts/generate_audio.py` (this leaves vocals unchanged). To rebuild the vocals, place the four Soulful House Vocals source WAVs listed in the license in one directory and run `python3 scripts/prepare_vocals.py /path/to/source-wavs`. Both scripts use only Python's standard library.

## Controls

Click a library loop to add it to the first free bar in its lane, or drag it to a specific empty bar. Drag timeline blocks to move them. Select a block for duplicate/delete controls; `Delete` also removes a focused block. Transport controls are Play/Pause, Restart, and Reset demo.
