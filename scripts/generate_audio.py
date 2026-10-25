"""Generate the original PULSE/08 demo pack: 16 mono 22.05 kHz WAV loops.

No samples or third-party recordings are used. Run with Python's standard library.
"""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 22050
DURATION = 2.0  # one 4/4 bar at 120 BPM
N = int(RATE * DURATION)
OUT = Path(__file__).resolve().parents[1] / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(8)


def silence():
    return [0.0] * N


def add_tone(buf, start, duration, freq, amp, decay=5.0, harmonics=(1.0,)):
    first = int(start * RATE)
    count = min(int(duration * RATE), N - first)
    for j in range(max(0, count)):
        t = j / RATE
        env = min(1.0, t / 0.004) * math.exp(-decay * t / max(duration, .01))
        value = sum(weight * math.sin(2 * math.pi * freq * (h + 1) * t) for h, weight in enumerate(harmonics))
        buf[first + j] += amp * env * value


def add_noise(buf, start, duration, amp, decay=12.0, highpass=False):
    first = int(start * RATE)
    count = min(int(duration * RATE), N - first)
    previous = 0.0
    for j in range(max(0, count)):
        t = j / RATE
        white = random.uniform(-1, 1)
        value = white - previous if highpass else white
        previous = white
        env = min(1.0, t / .001) * math.exp(-decay * t / max(duration, .01))
        buf[first + j] += amp * env * value


def kick(buf, start, amp=.8):
    first = int(start * RATE)
    for j in range(min(int(.38 * RATE), N - first)):
        t = j / RATE
        phase = 2 * math.pi * (48 * t + 7 * (1 - math.exp(-28 * t)))
        buf[first + j] += amp * math.sin(phase) * math.exp(-10 * t)


def drums(name):
    b = silence()
    four = name in ("night-drive", "soft-focus")
    kicks = [0, .5, 1, 1.5] if four else [0, .625, 1, 1.375, 1.75]
    if name == "silver-break": kicks = [0, .375, .75, 1.25, 1.625]
    for t in kicks: kick(b, t, .72 if name != "soft-focus" else .58)
    for t in ([.5, 1.5] if name != "silver-break" else [.5, 1.5, 1.875]):
        add_noise(b, t, .22, .22, 7)
        add_tone(b, t, .16, 185, .13, 9, (1, .5, .2))
    hat_steps = range(16) if name != "soft-focus" else range(0, 16, 2)
    for step in hat_steps:
        if name == "after-hours" and step in (3, 7, 11, 15): continue
        add_noise(b, step * .125, .055 if step % 2 else .085, .075 if step % 2 else .11, 16, True)
    if name == "silver-break":
        for t in (.25, 1.75): add_noise(b, t, .12, .08, 9, True)
    return b


NOTES = {"A1": 55, "C2": 65.406, "D2": 73.416, "E2": 82.407, "F2": 87.307, "G2": 97.999, "A2": 110}


def bass(name):
    b = silence()
    patterns = {
        "low-end-theory": [(0, .7, "A1"), (.75, .55, "A1"), (1.25, .6, "C2")],
        "roller": [(0, .22, "A1"), (.375, .22, "A1"), (.75, .22, "E2"), (1, .22, "A1"), (1.375, .22, "G2"), (1.75, .2, "E2")],
        "elastic": [(0, .32, "A1"), (.5, .22, "C2"), (.875, .25, "E2"), (1.25, .35, "D2"), (1.625, .28, "G2")],
        "sub-current": [(0, .85, "A1"), (1, .85, "C2")],
    }
    for start, length, note in patterns[name]:
        add_tone(b, start, length, NOTES[note], .47, 3, (1, .3, .08))
        add_tone(b, start, .035, NOTES[note] * 2, .1, 20)
    return b


CHORDS = [("A2", 220), ("C3", 261.626), ("E3", 329.628), ("G3", 391.995)]


def synth(name):
    b = silence()
    if name == "slow-orbit":
        events = [(0, 1.9, [220, 261.626, 329.628])]
    elif name == "neon-arc":
        events = [(0, .2, [220, 329.628]), (.5, .2, [261.626, 391.995]), (1, .2, [220, 329.628]), (1.5, .3, [196, 293.665])]
    elif name == "polaroid":
        events = [(t, .38, [f]) for t, f in zip((0, .25, .5, .75, 1, 1.25, 1.5, 1.75), (220, 329.628, 440, 329.628, 261.626, 391.995, 523.251, 391.995))]
    else:
        events = [(0, .4, [220, 261.626, 329.628]), (.75, .4, [174.614, 220, 261.626]), (1.25, .55, [196, 246.942, 293.665])]
    for start, length, freqs in events:
        for freq in freqs:
            add_tone(b, start, length, freq, .13 if name == "slow-orbit" else .16, 2.2 if name == "slow-orbit" else 5, (1, .22, .1, .04))
            if name == "glass-city": add_tone(b, start, length, freq * 2, .035, 6)
    # A tiny built-in room reflection, keeping everything local and sample-free.
    dry = b[:]
    delay = int(.1875 * RATE)
    for i in range(delay, N): b[i] += dry[i - delay] * .18
    return b


VOWELS = {
    "ah": (750, 1200, 2500), "ee": (300, 2200, 3000),
    "oh": (450, 850, 2400), "eh": (500, 1800, 2600),
}


def vocal_phrase(buf, start, length, freq, vowel, amp=.3):
    first = int(start * RATE)
    count = min(int(length * RATE), N - first)
    formants = VOWELS[vowel]
    weights = []
    for harmonic in range(1, 27):
        hz = freq * harmonic
        resonance = sum(math.exp(-.5 * ((hz - formant) / (100 + formant * .08)) ** 2) for formant in formants)
        weights.append((.08 / harmonic + resonance * .65) / harmonic ** .25)
    for j in range(max(0, count)):
        t = j / RATE
        env = min(1, t / .035) * min(1, (length - t) / .07) * (.86 + .14 * math.sin(math.pi * t / length))
        vibrato = 1 + .006 * math.sin(2 * math.pi * 5.2 * t)
        value = sum(w * math.sin(2 * math.pi * freq * (h + 1) * vibrato * t + h * .12) for h, w in enumerate(weights))
        buf[first + j] += amp * env * value
    add_noise(buf, start, .025, .035, 20, True)


def vocals(name):
    b = silence()
    phrases = {
        "feel-the-night": [(0, .34, 220, "ah"), (.38, .3, 261.626, "ee"), (.78, .48, 329.628, "oh"), (1.35, .5, 261.626, "ah")],
        "dont-stop": [(0, .22, 220, "oh"), (.25, .2, 220, "ah"), (.6, .22, 329.628, "ee"), (1, .2, 261.626, "oh"), (1.25, .45, 220, "ah")],
        "higher": [(0, .45, 220, "ah"), (.5, .42, 261.626, "ah"), (1, .75, 329.628, "ee")],
        "echo-chop": [(0, .18, 261.626, "eh"), (.25, .18, 261.626, "eh"), (.5, .3, 329.628, "oh"), (1.1, .18, 220, "ah"), (1.35, .4, 261.626, "ee")],
    }
    for event in phrases[name]: vocal_phrase(b, *event)
    dry = b[:]
    for seconds, gain in ((.25, .22), (.5, .1)):
        delay = int(seconds * RATE)
        for i in range(delay, N): b[i] += dry[i - delay] * gain
    return b


def write(name, samples):
    peak = max(.001, max(abs(value) for value in samples))
    gain = .88 / peak
    pcm = bytearray()
    for i, value in enumerate(samples):
        edge = min(1, i / 80, (N - 1 - i) / 80)
        value = math.tanh(value * gain * 1.15) * .85 * edge
        pcm.extend(struct.pack("<h", int(max(-1, min(1, value)) * 32767)))
    with wave.open(str(OUT / f"{name}.wav"), "wb") as wav:
        wav.setparams((1, 2, RATE, N, "NONE", "not compressed"))
        wav.writeframes(pcm)


for name in ("night-drive", "after-hours", "silver-break", "soft-focus"): write(name, drums(name))
for name in ("low-end-theory", "roller", "elastic", "sub-current"): write(name, bass(name))
for name in ("glass-city", "neon-arc", "slow-orbit", "polaroid"): write(name, synth(name))
for name in ("feel-the-night", "dont-stop", "higher", "echo-chop"): write(name, vocals(name))
print(f"Generated 16 original loops in {OUT}")
