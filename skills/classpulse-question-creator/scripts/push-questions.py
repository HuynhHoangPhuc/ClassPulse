#!/usr/bin/env python3
"""Push questions to ClassPulse API from a JSON file.

Usage:
    python3 push-questions.py --url <api_url> --key <api_key> --file <questions.json>
    python3 push-questions.py --url <api_url> --key <api_key> --stdin  # read from stdin

The JSON file should contain an array of question objects:
[
    {
        "content": "---\\ncomplexity: 2\\n...---\\n\\nQuestion?\\n\\n[x] A\\n[ ] B",
        "image": "data:image/png;base64,..."  // optional
    }
]

Environment variables (fallbacks):
    CLASSPULSE_API_URL — API base URL
    CLASSPULSE_API_KEY — API key with ai:questions:write scope
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def push_questions(api_url: str, api_key: str, questions: list[dict]) -> dict:
    """Push questions to ClassPulse API. Returns parsed response."""
    url = f"{api_url.rstrip('/')}/api/questions/ai"
    payload = json.dumps({"questions": questions}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": f"HTTP {e.code}: {body}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def main():
    parser = argparse.ArgumentParser(description="Push questions to ClassPulse API")
    parser.add_argument("--url", default=os.environ.get("CLASSPULSE_API_URL", ""), help="API base URL")
    parser.add_argument("--key", default=os.environ.get("CLASSPULSE_API_KEY", ""), help="API key")
    parser.add_argument("--file", help="Path to JSON file with questions array")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin")
    args = parser.parse_args()

    if not args.url:
        print("Error: --url or CLASSPULSE_API_URL required", file=sys.stderr)
        sys.exit(1)
    if not args.key:
        print("Error: --key or CLASSPULSE_API_KEY required", file=sys.stderr)
        sys.exit(1)

    if args.stdin:
        raw = sys.stdin.read()
    elif args.file:
        with open(args.file) as f:
            raw = f.read()
    else:
        print("Error: --file or --stdin required", file=sys.stderr)
        sys.exit(1)

    questions = json.loads(raw)
    if not isinstance(questions, list):
        print("Error: JSON must be an array of question objects", file=sys.stderr)
        sys.exit(1)

    # Batch in groups of 50 (API limit)
    total_created = 0
    total_failed = 0
    all_tags_created = []
    all_results = []

    for i in range(0, len(questions), 50):
        batch = questions[i : i + 50]
        print(f"Pushing batch {i // 50 + 1} ({len(batch)} questions)...", file=sys.stderr)
        result = push_questions(args.url, args.key, batch)

        if "error" in result and "created" not in result:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)

        total_created += result.get("created", 0)
        total_failed += result.get("failed", 0)
        all_tags_created.extend(result.get("tagsCreated", []))
        all_results.extend(result.get("questions", []))

    output = {
        "created": total_created,
        "failed": total_failed,
        "questions": all_results,
        "tagsCreated": list(set(all_tags_created)),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
