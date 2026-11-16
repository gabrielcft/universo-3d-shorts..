"""Gera uma trilha ambiente "espacial" original (sem direitos autorais).

Camadas: pads de acordes com reverb longo, grave profundo, sinos suaves com eco,
"vento cósmico" e (opcional) um pulso grave tipo batida de coração.

Uso: python3 tools/music.py <saida.wav> <duracao_s> [humor] [semente] [pulso 0|1]
Humores: cosmos (misterioso), warm (dourado), epic (grandioso), dark (tenso)
"""
import sys
import wave

import numpy as np

SR = 48000

# Progressões (notas MIDI). Cada acorde dura um "compasso".
MOODS = {
    "cosmos": {"bar": 4.0, "chords": [
        [38, 50, 57, 60, 64, 65], [34, 46, 53, 57, 62, 65], [41, 48, 57, 60, 64, 67], [36, 48, 55, 62, 64, 67]]},
    "warm": {"bar": 4.0, "chords": [
        [41, 53, 57, 60, 64, 69], [45, 52, 57, 60, 64, 67], [38, 50, 57, 62, 65, 69], [34, 46, 53, 58, 62, 69]]},
    "epic": {"bar": 3.5, "chords": [
        [36, 48, 55, 60, 64, 67], [43, 47, 55, 59, 62, 67], [45, 52, 57, 60, 64, 69], [41, 48, 57, 60, 65, 69]]},
    "dark": {"bar": 4.5, "chords": [
        [36, 48, 55, 60, 62, 63], [32, 44, 51, 55, 60, 63], [41, 48, 53, 56, 60, 63], [43, 50, 55, 59, 62, 65]]},
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def envelope(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    e[n - r:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def pad_note(freq, n, rng):
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, det in enumerate((-0.11, 0.0, 0.12)):  # 3 osciladores levemente desafinados
        f = freq * 2 ** (det / 12)
        ph = rng.uniform(0, 2 * np.pi)
        w = np.zeros(n)
        for h in range(1, 7):  # "dente de serra" suave (poucos harmônicos)
            w += np.sin(2 * np.pi * f * h * t + ph * h) / h ** 1.6
        pan = (k - 1) * 0.6
        out[:, 0] += w * (1 - pan) * 0.5
        out[:, 1] += w * (1 + pan) * 0.5
    # leve "respiração" do volume
    out *= (0.8 + 0.2 * np.sin(2 * np.pi * rng.uniform(0.08, 0.2) * t + rng.uniform(0, 6)))[:, None]
    return out


def fft_filter(x, lo, hi):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    mask = ((f >= lo) & (f <= hi)).astype(float)
    # bordas suaves
    mask = np.convolve(mask, np.hanning(301) / np.hanning(301).sum(), mode="same")
    return np.fft.irfft(X * mask[:, None], n=x.shape[0], axis=0)


def reverb(x, seconds=4.0, rng=None):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (seconds / 4.5))[:, None]
    ir[:200] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    size = 1 << int(np.ceil(np.log2(x.shape[0] + n)))
    y = np.fft.irfft(np.fft.rfft(x, size, axis=0) * np.fft.rfft(ir, size, axis=0), size, axis=0)
    return y[: x.shape[0]]


def main(out, dur, mood="cosmos", seed=1, pulse=0):
    dur, seed, pulse = float(dur), int(seed), int(pulse)
    rng = np.random.default_rng(seed)
    cfg = MOODS.get(mood, MOODS["cosmos"])
    n = int(dur * SR)
    bar = cfg["bar"]
    chords = cfg["chords"][seed % len(cfg["chords"]):] + cfg["chords"][: seed % len(cfg["chords"])]

    pads = np.zeros((n, 2))
    bass = np.zeros((n, 2))
    bells = np.zeros((n, 2))
    i, start = 0, 0.0
    while start < dur:
        ch = chords[i % len(chords)]
        s = int(start * SR)
        length = int((bar + 2.5) * SR)
        e = envelope(length, 1.8, 2.6)
        seg = np.zeros((length, 2))
        for m in ch[1:]:
            seg += pad_note(hz(m), length, rng) * 0.11
        seg *= e[:, None]
        end = min(n, s + length)
        pads[s:end] += seg[: end - s]
        # grave: fundamental do acorde
        tt = np.arange(length) / SR
        b = np.sin(2 * np.pi * hz(ch[0]) * tt) * 0.22 + np.sin(2 * np.pi * hz(ch[0] + 12) * tt) * 0.05
        bass[s:end] += (b * e)[: end - s, None]
        # sinos: notas agudas do acorde em tempos aleatórios
        beat = bar / 8
        for k in range(8):
            if rng.random() < 0.45:
                bt = start + k * beat + rng.uniform(-0.03, 0.03)
                bs = int(bt * SR)
                if bs >= n or bs < 0:
                    continue
                m = ch[rng.integers(2, len(ch))] + 24
                bl = int(3.0 * SR)
                t2 = np.arange(bl) / SR
                tone = (np.sin(2 * np.pi * hz(m) * t2) + 0.25 * np.sin(2 * np.pi * hz(m) * 2.76 * t2) * np.exp(-t2 * 3))
                tone *= np.exp(-t2 * 1.6) * 0.07 * rng.uniform(0.5, 1.0)
                pan = rng.uniform(-0.8, 0.8)
                be = min(n, bs + bl)
                bells[bs:be, 0] += tone[: be - bs] * (1 - pan) / 2
                bells[bs:be, 1] += tone[: be - bs] * (1 + pan) / 2
        start += bar
        i += 1

    # eco pingue-pongue nos sinos
    d = int(0.375 * SR)
    for rep in range(1, 5):
        g = 0.45 ** rep
        side = rep % 2
        bells[d * rep:, side] += bells[: n - d * rep, 1 - side] * g

    # vento cósmico: ruído filtrado com volume ondulando
    wind = fft_filter(rng.standard_normal((n, 2)), 250, 1400)
    tt = np.arange(n) / SR
    wind *= (0.025 + 0.02 * np.sin(2 * np.pi * 0.05 * tt + 1))[:, None]

    mix = pads + bass + bells + wind
    if pulse:  # batida de coração grave
        p = np.zeros(n)
        period = 60 / 66
        for k in range(int(dur / period) + 1):
            for off, amp in ((0.0, 1.0), (0.22, 0.6)):
                ps = int((k * period + off) * SR)
                pl = int(0.5 * SR)
                if ps >= n:
                    continue
                t3 = np.arange(pl) / SR
                hit = np.sin(2 * np.pi * (45 * t3 + 40 * (1 - np.exp(-t3 * 30)) / 30)) * np.exp(-t3 * 9) * amp
                pe = min(n, ps + pl)
                p[ps:pe] += hit[: pe - ps]
        mix += p[:, None] * 0.28

    wet = reverb(mix, 4.5, rng)
    mix = mix * 0.6 + wet * 0.9

    # fade in/out e normalização
    fi, fo = int(1.2 * SR), int(1.8 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.89

    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    main(*sys.argv[1:6])
