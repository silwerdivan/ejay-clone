# PULSE/08 loop pack licenses

All 16 bundled WAVs are mono, 22.05 kHz, 16-bit, two-second bars at 120 BPM. The application never downloads audio at runtime.

## Instrument loops

The 12 drum, bass, and synth WAVs were created for PULSE/08 with `scripts/generate_audio.py`. They contain original synthesized instrumentation, with no third-party recordings. To the extent permitted by law, these generated assets are dedicated to the public domain under **CC0 1.0 Universal**.

## Recorded vocals

The four vocal WAVs are pitch-preserving, time-stretched and downmixed edits of prerecorded vocals from **Soulful House Vocals**, part of the **Producer Space CC0 sample library**. These recordings are not original PULSE/08-generated assets. Producer Space states that its samples are CC0/public domain; the edited recordings here remain under **CC0 1.0 Universal**.

| Local loop ID | Source phrase |
| --- | --- |
| `feel-the-night` | Would You Like to Dance |
| `dont-stop` | No No No |
| `higher` | Come With Me |
| `echo-chop` | Oh Oh Oh Oh |

Sources:

- Producer Space: https://producerspace.com/
- Archive item: https://archive.org/details/producer-space-cc0-sample-library
- Source directory: https://archive.org/download/producer-space-cc0-sample-library/Producer%20Space/Packs/Soulful%20House%20Vocals/
- CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/

Use `scripts/prepare_vocals.py` with the four source WAVs to reproduce the local vocal edits. The sources are C minor at 126 BPM; the bundled edits are one bar at 120 BPM without pitch changes.
