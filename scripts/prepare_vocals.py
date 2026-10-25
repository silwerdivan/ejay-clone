"""Convert the four CC0 Soulful House Vocals bars to the PULSE/08 format.

Usage: python3 scripts/prepare_vocals.py /path/to/source-wavs
The source pack is C minor at 126 BPM. Circular WSOLA stretches each bar to
120 BPM without changing pitch, then writes mono 22.05 kHz 16-bit PCM.
Only Python's standard library is required.
"""
import argparse
import math
from pathlib import Path
import struct
import wave

RATE = 22050
FRAMES = RATE * 2
VOICES = {
    "feel-the-night": "SHV - C minor - 126 BPM - Would You Like to Dance.wav",
    "dont-stop": "SHV - C minor - 126 BPM - No No No.wav",
    "higher": "SHV - C minor - 126 BPM - Come With Me.wav",
    "echo-chop": "SHV - C minor - 126 BPM - Oh Oh Oh Oh.wav",
}


def read_mono(path):
    with wave.open(str(path), "rb") as wav:
        if wav.getparams()[:4] != (2, 3, 44100, 84000):
            raise ValueError(f"Expected stereo 24-bit 44.1 kHz, 84,000 frames: {path}")
        raw = wav.readframes(84000)
    samples = []
    for offset in range(0, len(raw), 12):
        frame = [int.from_bytes(raw[offset + i:offset + i + 3], "little", signed=True) / 8388608 for i in (0, 3, 6, 9)]
        # Averaging adjacent source frames also filters the downsampled signal.
        samples.append(((frame[0] + frame[1]) * .25 + (frame[2] + frame[3]) * .25))
    return samples


def stretch(samples):
    synthesis_hop = 256
    window_size = synthesis_hop * 4
    window = [.5 - .5 * math.cos(2 * math.pi * i / (window_size - 1)) for i in range(window_size)]
    output = [0.0] * (FRAMES + window_size)
    weights = [0.0] * len(output)
    length = len(samples)

    def sample(index):
        return samples[index % length]

    out_start = 0
    while out_start < FRAMES:
        expected = round(out_start * length / FRAMES)
        best = expected
        best_score = -1.0
        overlap = min(window_size, len(output) - out_start)
        for offset in range(-96, 97, 4):
            candidate = expected + offset
            dot = energy = reference = 0.0
            for i in range(overlap):
                value = sample(candidate + i)
                dot += value * output[out_start + i]
                energy += value * value
                reference += output[out_start + i] ** 2
            score = dot / math.sqrt(energy * reference + 1e-12)
            if score > best_score:
                best_score = score
                best = candidate
        for i, gain in enumerate(window):
            output[out_start + i] += sample(best + i) * gain
            weights[out_start + i] += gain
        out_start += synthesis_hop

    result = [output[i] / weights[i] if weights[i] > 1e-8 else 0.0 for i in range(FRAMES)]
    peak = max(.001, max(abs(value) for value in result))
    gain = .88 / peak
    return [math.tanh(value * gain) for value in result]


def write(path, samples):
    pcm = bytearray()
    for i, value in enumerate(samples):
        edge = min(1, i / 80, (FRAMES - 1 - i) / 80)
        pcm.extend(struct.pack("<h", round(max(-1, min(1, value * edge)) * 32767)))
    with wave.open(str(path), "wb") as wav:
        wav.setparams((1, 2, RATE, FRAMES, "NONE", "not compressed"))
        wav.writeframes(pcm)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Directory containing the four original Soulful House Vocals WAVs")
    args = parser.parse_args()
    out = Path(__file__).resolve().parents[1] / "public" / "audio"
    out.mkdir(parents=True, exist_ok=True)
    for loop_id, filename in VOICES.items():
        write(out / f"{loop_id}.wav", stretch(read_mono(args.source / filename)))
        print(f"Prepared {loop_id}.wav")


if __name__ == "__main__":
    main()
