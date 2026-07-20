"""Timestamped transcription for VERA's traceability pipeline.

Takes an audio file, runs it through faster-whisper, and prints a single JSON
object to stdout: segment- and word-level timestamps that later get used to
anchor each generated user story back to the moment in the recording it came
from. Anything that isn't the final JSON result must go to stderr, never
stdout, since the Node API route parses stdout as JSON.

Usage:
    python whisper_transcribe.py <audio_path> [--model small] [--language en]
"""

import argparse
import json
import sys


def transcribe(audio_path: str, model_size: str, language: str | None, device: str, compute_type: str) -> dict:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )

    segments = []
    for seg in segments_iter:
        words = [
            {
                "word": w.word.strip(),
                "start": round(w.start, 3),
                "end": round(w.end, 3),
                "probability": round(w.probability, 4),
            }
            for w in (seg.words or [])
        ]
        segments.append({
            "id": seg.id,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": words,
        })

    return {
        "engine": "faster-whisper",
        "model": model_size,
        "language": info.language,
        "language_probability": round(info.language_probability, 4),
        "duration": round(info.duration, 3),
        "segments": segments,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="small", help="faster-whisper model size (tiny, base, small, medium, large-v3)")
    parser.add_argument("--language", default=None, help="force a language code; omit to auto-detect")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8", help="int8 is fastest on CPU; use float16 with a GPU device")
    args = parser.parse_args()

    try:
        result = transcribe(args.audio_path, args.model, args.language, args.device, args.compute_type)
    except Exception as exc:  # noqa: BLE001 - report every failure back to the caller
        print(json.dumps({"error": str(exc)}), file=sys.stdout)
        print(f"whisper_transcribe failed: {exc!r}", file=sys.stderr)
        return 1

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
