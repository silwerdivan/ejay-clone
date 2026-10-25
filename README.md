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

The app has no backend or runtime external requests. Arrangements are saved in `localStorage`. All 16 original one-bar, 120 BPM loops are bundled in `public/audio`; see `public/audio/LICENSE.md` for their CC0 dedication. Regenerate them with `python3 scripts/generate_audio.py`.

## Controls

Click a library loop to add it to the first free bar in its lane, or drag it to a specific empty bar. Drag timeline blocks to move them. Select a block for duplicate/delete controls; `Delete` also removes a focused block. Transport controls are Play/Pause, Restart, and Reset demo.
