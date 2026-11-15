"""Synthesize an original background track for the video (no licensing questions). numpy only.

100 BPM, Am7 - Fmaj7 - Cmaj7 - G6. A circling arpeggio (the "roundabout" motif) over warm pads;
soft drums and a sub bass enter with the reveal (~22 s), a short breakdown sits under the
architecture scene, and the last chord rings out under the ending.
Writes public/music/bed.wav. Run from video/:  python scripts/music.py
"""
import pathlib
import wave

import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
LENGTH = 152.0
N = int(LENGTH * SR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t0, gain=1.0, pan=0.0):
    s = int(t0 * SR)
    if s >= N:
        return
    e = min(N, s + len(sig))
    seg = sig[: e - s] * gain
    L[s:e] += seg * (1 - max(0.0, pan))
    R[s:e] += seg * (1 + min(0.0, pan))


def env(n, attack=0.004, decay=0.25):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def tone(freq, dur, harmonics=((1, 1.0),), attack=0.004, decay=0.25, detune=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * k * t) for k, a in harmonics)
    if detune:
        s = 0.5 * s + 0.5 * sum(a * np.sin(2 * np.pi * freq * (1 + detune) * k * t) for k, a in harmonics)
    return s * env(n, attack, decay)


def lowpass(x, cutoff_hz, taps=127):
    """Windowed-sinc FIR low-pass (vectorized)."""
    fc = cutoff_hz / SR
    m = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * fc * m) * np.blackman(taps)
    h /= h.sum()
    return np.convolve(x, h, mode="same")


# ---------- drums ----------
def kick():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = 46 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) * 0.9


def rim():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    body = np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 60)
    return ((noise - lowpass(noise, 2500, 63)) * np.exp(-t * 45) * 0.5 + body * 0.35) * 0.6


def hat(open_=False):
    n = int((0.25 if open_ else 0.045) * SR)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass(noise, 7000, 63)
    return noise * np.exp(-t * (8 if open_ else 80)) * 0.2


KICK, RIM, HAT, OHAT = kick(), rim(), hat(), hat(True)

# Am7 - Fmaj7 - Cmaj7 - G6: (bass root, pad voicing, arpeggio notes)
PROG = [
    (45, [57, 60, 64, 67], [69, 72, 76, 79, 76, 72]),
    (41, [57, 60, 64, 65], [65, 69, 72, 76, 72, 69]),
    (36, [55, 59, 60, 64], [67, 71, 72, 76, 72, 71]),
    (43, [55, 59, 62, 64], [67, 71, 74, 76, 74, 71]),
]

bars = int(LENGTH // BAR)
DRUMS_FROM = 9           # ≈ 21.6 s, under the reveal
BREAK = range(52, 55)    # ≈ 125-132 s, a breath before the architecture scene settles
OUTRO_FROM = bars - 4

for b in range(bars):
    t_bar = b * BAR
    root, pad, arp = PROG[b % 4]
    groove = DRUMS_FROM <= b < OUTRO_FROM and b not in BREAK
    outro = b >= OUTRO_FROM

    # pads: always, softer in the groove so the voice sits on top
    for i, n_ in enumerate(pad):
        p = tone(hz(n_), BAR + 0.8, ((1, 1), (2, 0.22), (3, 0.06)), 0.6, 2.2, detune=0.003)
        add(p, t_bar, 0.075 if groove else 0.1, pan=(-0.35 if i % 2 else 0.35))

    # the circling arpeggio: sixteenth-ish pattern that goes round and round
    if not outro or b == OUTRO_FROM:
        step = BEAT / 2
        for e in range(8):
            n_ = arp[e % len(arp)] + (12 if (b % 8 >= 4 and e in (3, 7)) else 0)
            pl = tone(hz(n_), 0.5, ((1, 1), (2, 0.45), (3, 0.2), (5, 0.06)), 0.002, 0.2)
            pan = np.sin((b * 8 + e) / 8 * 2 * np.pi) * 0.45  # the sound circles left↔right
            add(pl, t_bar + e * step, 0.16 if b >= 4 else 0.1, pan=pan)

    if groove:
        add(KICK, t_bar, 0.5)
        add(KICK, t_bar + 2 * BEAT, 0.45)
        add(KICK, t_bar + 2.75 * BEAT, 0.18)
        for beat in (1, 3):
            add(RIM, t_bar + beat * BEAT, 0.35, pan=-0.15)
        for s16 in range(16):
            add(HAT, t_bar + s16 * BEAT / 4, 0.45 if s16 % 2 else 0.2, pan=0.25)
        add(OHAT, t_bar + 3.5 * BEAT, 0.3, pan=0.25)
        # sub bass: root on 1, a fifth pickup at the end of the bar
        bass = tone(hz(root - 12), BEAT * 2.8, ((1, 1), (2, 0.25)), 0.01, 1.2)
        add(bass, t_bar, 0.32)
        fifth = tone(hz(root - 5), BEAT * 0.9, ((1, 1), (2, 0.2)), 0.01, 0.35)
        add(fifth, t_bar + 3 * BEAT, 0.2)

# final ringing A minor add9
end_t = OUTRO_FROM * BAR + BAR
for i, n_ in enumerate([45, 57, 64, 67, 71, 72]):
    add(tone(hz(n_), 7.0, ((1, 1), (2, 0.25)), 0.02, 2.4), end_t, 0.08, pan=(-0.2 if i % 2 else 0.2))

# glue: a soft stereo room and a gentle low-pass on the whole mix
mix = np.stack([L, R], axis=1)
for d_s, g in ((0.17, 0.2), (0.31, 0.13), (0.47, 0.08)):
    d = int(d_s * SR)
    wet = np.zeros_like(mix)
    wet[d:] = mix[:-d] * g
    mix += wet[:, ::-1]
for c in range(2):
    mix[:, c] = lowpass(mix[:, c], 9000)

fade_in, fade_out = int(2 * SR), int(5 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.5 / np.max(np.abs(mix))

path = pathlib.Path(__file__).resolve().parent.parent / "public" / "music" / "bed.wav"
path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(path), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", path, f"{LENGTH:.0f}s @ {BPM} BPM")
