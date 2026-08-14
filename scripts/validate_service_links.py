#!/usr/bin/env python3
"""Reject search URLs, wrong entity types, missing covers and incomplete records."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "catalog"
MAX_COVER_BYTES = 120 * 1024
UNAVAILABLE = "unavailable-original"


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fail(errors: list[str], record_id: str, message: str) -> None:
    errors.append(f"{record_id}: {message}")


def validate_direct_url(record: dict, service: str, payload: dict | None, errors: list[str]) -> str:
    record_id, record_type = record["id"], record["type"]
    if not payload:
        fail(errors, record_id, f"{service} is missing")
        return "missing"
    if payload.get("status") == UNAVAILABLE:
        if not payload.get("reason"):
            fail(errors, record_id, f"{service} unavailable status lacks a reason")
        return UNAVAILABLE

    url = payload.get("url", "")
    parsed = urlparse(url)
    path = parsed.path.casefold()
    query = parse_qs(parsed.query)
    if not url.startswith("https://") or "search" in path or "search" in query:
        fail(errors, record_id, f"{service} is not a direct HTTPS entity URL: {url}")
        return "invalid"

    if service == "spotify":
        expected = "/album/" if record_type == "album" else "/track/"
        valid = parsed.netloc == "open.spotify.com" and expected in path
    elif service == "appleMusic":
        if record_type == "album":
            valid = parsed.netloc == "music.apple.com" and "/album/" in path and "i" not in query
        else:
            valid = parsed.netloc == "music.apple.com" and (
                "/song/" in path or ("/album/" in path and bool(query.get("i")))
            )
    else:
        if record_type == "album":
            valid = parsed.netloc == "music.youtube.com" and "/browse/" in path
        else:
            valid = parsed.netloc == "music.youtube.com" and "/watch" in path and bool(query.get("v"))

    if not valid:
        fail(errors, record_id, f"{service} URL has the wrong entity type: {url}")
        return "invalid"
    return "direct"


master = load(DATA / "master.json")["records"]
services = {entry["id"]: entry for entry in load(DATA / "service-links-draft.json")["records"]}
errors: list[str] = []
counts = Counter()

if len(master) != 200:
    errors.append(f"master: expected 200 records, got {len(master)}")
if len(services) != 200:
    errors.append(f"services: expected 200 records, got {len(services)}")

for record in master:
    entry = services.get(record["id"])
    if not entry:
        fail(errors, record["id"], "service record is missing")
        continue
    for service in ("spotify", "appleMusic", "youtubeMusic"):
        outcome = validate_direct_url(record, service, entry.get(service), errors)
        counts[f"{service}:{outcome}"] += 1

    cover = entry.get("cover") or {}
    cover_path = ROOT / cover.get("path", "")
    if cover.get("status") != "optimized" or not cover_path.is_file():
        fail(errors, record["id"], "optimized local cover is missing")
    else:
        size = cover_path.stat().st_size
        counts["covers"] += 1
        if size > MAX_COVER_BYTES:
            fail(errors, record["id"], f"cover is {size} bytes; maximum is {MAX_COVER_BYTES}")

print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False, indent=2))
if errors:
    print("\n".join(errors))
    raise SystemExit(f"Validation failed with {len(errors)} error(s)")
print("Validated 200 records: direct entity links only and optimized local covers.")
