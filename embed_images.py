#!/usr/bin/env python3
"""Generate Gemini image embeddings for First Alert reference images."""

import base64
import glob
import json
import os
import sys
import time
import urllib.parse
import urllib.request

FOLDER = r"C:\Users\jackl\OneDrive\Desktop\Safe Steps\Equipment\Attempt 2"
OUTPUT = os.path.join(FOLDER, "reference-embeddings.json")
GITHUB_BASE = "https://raw.githubusercontent.com/jacklimongelli/safesteps-wizard/main"
GITHUB_DIR = "reference-images v2"
ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-embedding-2:embedContent?key={key}"
)
DELAY = 0.3

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY environment variable is not set.")
    sys.exit(1)


def embed_image(model, image_bytes):
    """Call Gemini embedContent and return the embedding vector."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "content": {
            "parts": [
                {"text": f"task: search_document | Fire safety device reference image: First Alert {model}"},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
            ]
        },
        "outputDimensionality": 768,
    }
    req = urllib.request.Request(
        ENDPOINT.format(key=API_KEY),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["embedding"]["values"]


def main():
    paths = sorted(glob.glob(os.path.join(FOLDER, "firstalert_*.jpg")))
    total = len(paths)
    print(f"Found {total} images in:\n  {FOLDER}\n")

    results = []
    failures = []

    for i, path in enumerate(paths, start=1):
        filename = os.path.basename(path)
        # everything after "firstalert_" and before ".jpg"
        model = filename[len("firstalert_"):-len(".jpg")]
        print(f"[{i}/{total}] Embedding {model}...", flush=True)

        try:
            with open(path, "rb") as f:
                image_bytes = f.read()
            embedding = embed_image(model, image_bytes)

            encoded_dir = urllib.parse.quote(GITHUB_DIR)
            encoded_file = urllib.parse.quote(filename)
            image_url = f"{GITHUB_BASE}/{encoded_dir}/{encoded_file}"

            results.append({
                "brand": "First Alert",
                "model": model,
                "imageUrl": image_url,
                "embedding": embedding,
            })
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            msg = f"HTTP {e.code}: {e.reason} {body}".strip()
            print(f"    FAILED: {msg}", flush=True)
            failures.append((model, filename, msg))
        except Exception as e:
            msg = f"{type(e).__name__}: {e}"
            print(f"    FAILED: {msg}", flush=True)
            failures.append((model, filename, msg))

        time.sleep(DELAY)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 50)
    print(f"Done. {len(results)}/{total} succeeded, {len(failures)} failed.")
    print(f"Saved: {OUTPUT}")
    if failures:
        print("\nFailures:")
        for model, filename, msg in failures:
            print(f"  - {model} ({filename}): {msg}")


if __name__ == "__main__":
    main()
