#!/usr/bin/env python3
"""Validate the complete runtime catalog before delivery or publication."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LANGUAGES = ("es", "en", "fr")


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


albums = load(DATA / "albums.json")
songs = load(DATA / "songs.json")
records = albums + songs
notes = {item["id"]: item["editorial"] for item in load(DATA / "editorial-notes.json")}
reasons = {item["id"]: item["whyEssential"] for item in load(DATA / "essential-reasons.json")}
errors = []

if len(albums) != 100 or len(songs) != 100:
    errors.append(f"Expected 100 albums and 100 songs; got {len(albums)} and {len(songs)}")
ids = [record["id"] for record in records]
if len(set(ids)) != 200:
    errors.append("Runtime IDs are not unique")
if set(notes) != set(ids):
    errors.append("Editorial IDs do not exactly match runtime IDs")
if set(reasons) != set(ids):
    errors.append("Essential-reason IDs do not exactly match runtime IDs")

service_counts = Counter()
source_counts = Counter()
for record in records:
    record_id = record["id"]
    cover = ROOT / record.get("coverUrl", "")
    if not cover.is_file():
        errors.append(f"{record_id}: cover missing")
    elif cover.stat().st_size > 120 * 1024:
        errors.append(f"{record_id}: cover exceeds 120 KB")

    for language in LANGUAGES:
        if not record.get("description", {}).get(language):
            errors.append(f"{record_id}: missing {language} description")
        if not reasons.get(record_id, {}).get(language):
            errors.append(f"{record_id}: missing {language} essential reason")
        content = notes.get(record_id, {}).get(language, {})
        if not content.get("review") or not content.get("listenFor") or not content.get("entryPoint", {}).get("title"):
            errors.append(f"{record_id}: incomplete {language} editorial")

    if not notes.get(record_id, {}).get("sources"):
        errors.append(f"{record_id}: editorial sources missing")
    recognition = record.get("recognition") or {}
    if not recognition.get("url") or not recognition.get("source"):
        errors.append(f"{record_id}: recognition source missing")
    else:
        source_counts[recognition["source"]] += 1

    for service_name, service in (record.get("streaming") or {}).items():
        if service.get("status") == "unavailable":
            service_counts[f"{service_name}:unavailable"] += 1
            continue
        url = service.get("url", "")
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        if "search" in parsed.path.casefold() or "search" in query:
            errors.append(f"{record_id}: {service_name} uses a search URL")
        if service_name == "spotify":
            expected = "/album/" if record["type"] == "album" else "/track/"
            valid = parsed.netloc == "open.spotify.com" and expected in parsed.path
        elif service_name == "appleMusic":
            if record["type"] == "album":
                valid = parsed.netloc == "music.apple.com" and "/album/" in parsed.path and not query.get("i")
            else:
                valid = parsed.netloc == "music.apple.com" and ("/song/" in parsed.path or ("/album/" in parsed.path and query.get("i")))
        else:
            expected = "/browse/" if record["type"] == "album" else "/watch"
            valid = parsed.netloc == "music.youtube.com" and expected in parsed.path
        if not valid:
            errors.append(f"{record_id}: invalid direct {service_name} entity URL")
        service_counts[f"{service_name}:direct"] += 1

print(json.dumps({
    "albums": len(albums),
    "songs": len(songs),
    "editorials": len(notes),
    "essentialReasons": len(reasons),
    "serviceLinks": dict(sorted(service_counts.items())),
    "recognitionSources": dict(sorted(source_counts.items())),
}, ensure_ascii=False, indent=2))

if errors:
    print("\n".join(errors))
    raise SystemExit(f"Validation failed with {len(errors)} error(s)")
print("Publishable catalog validation passed.")
