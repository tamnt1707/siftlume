#!/usr/bin/env python3
"""Turns meeting.txt into two WAV files, one per Chrome window, that take turns.

While A speaks, B's file is silent for the same time, and the other way round, so the two fake
microphones never talk over each other. Uses macOS `say` (voices Samantha and Daniel by default).

    python3 scripts/meet-test/make-audio.py [meeting.txt] [out-dir] [voice-a] [voice-b]
"""
import os
import subprocess
import sys
import tempfile
import wave

here = os.path.dirname(os.path.abspath(__file__))
script = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'meeting.txt')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/meet-test')
voices = {'A': sys.argv[3] if len(sys.argv) > 3 else 'Samantha', 'B': sys.argv[4] if len(sys.argv) > 4 else 'Daniel'}
RATE = 48000
GAP = 1.2  # seconds of silence between turns
TAIL = 30  # seconds of silence at the end: Chrome loops the file, stop recording before it restarts

os.makedirs(out, exist_ok=True)
turns = []
for line in open(script, encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    who, _, words = line.partition(':')
    if who.strip() not in voices:
        sys.exit(f'Bad line (start with "A:" or "B:"): {line}')
    turns.append((who.strip(), words.strip()))

tracks = {'A': bytearray(), 'B': bytearray()}
silence = lambda seconds: b'\x00\x00' * int(RATE * seconds)
with tempfile.TemporaryDirectory() as tmp:
    for i, (who, words) in enumerate(turns):
        path = os.path.join(tmp, f'{i}.wav')
        subprocess.run(
            ['say', '-v', voices[who], '--file-format=WAVE', f'--data-format=LEI16@{RATE}', '-o', path, words],
            check=True,
        )
        with wave.open(path) as w:
            frames = w.readframes(w.getnframes())
        other = 'B' if who == 'A' else 'A'
        tracks[who] += frames + silence(GAP)
        tracks[other] += b'\x00' * len(frames) + silence(GAP)

for who, data in tracks.items():
    data += silence(TAIL)
    path = os.path.join(out, f'speaker-{who.lower()}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(data))
    print(f'{path}  {len(data) / 2 / RATE:.0f} s')
