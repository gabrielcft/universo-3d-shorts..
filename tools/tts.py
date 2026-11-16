"""Gera a fala de uma frase com voz neural (edge-tts) e os tempos de cada palavra.

Uso: python3 tools/tts.py "<texto>" <voz> <velocidade> <saida.mp3> <saida.json>
"""
import asyncio
import json
import os
import sys

import edge_tts


async def main(text, voice, rate, out_mp3, out_json):
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or None
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary", proxy=proxy)
    words = []
    with open(out_mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append({"w": ch["text"], "s": round(s, 3), "e": round(s + ch["duration"] / 1e7, 3)})
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:6]))
