#!/usr/bin/env python3
"""Merge validated direct service links into the 200-record service catalog."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "catalog"


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write(path: Path, payload) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


master = load(DATA / "master.json")["records"]
draft_path = DATA / "service-links-draft.json"
draft = load(draft_path)
entries = {entry["id"]: entry for entry in draft["records"]}

spotify = {entry["id"]: entry for entry in load(DATA / "spotify-links.json")["records"]}
apple_manual = {entry["id"]: entry for entry in load(DATA / "apple-links-manual.json")["records"]}
youtube_manual = {entry["id"]: entry for entry in load(DATA / "youtube-links-manual.json")["records"]}

for record in master:
    entry = entries[record["id"]]
    spotify_entry = spotify.get(record["id"])
    if spotify_entry:
        if spotify_entry.get("status") == "unavailable-original":
            entry["spotify"] = {
                "status": "unavailable-original",
                "reason": spotify_entry["reason"],
            }
        elif spotify_entry.get("status") == "validated-title-artist":
            entry["spotify"] = spotify_entry

    manual = apple_manual.get(record["id"])
    if manual:
        if manual.get("status") == "unavailable-original":
            entry["appleMusic"] = {
                "status": "unavailable-original",
                "reason": manual["reason"],
            }
        else:
            current = entry.get("appleMusic") or {}
            entry["appleMusic"] = {
                **current,
                "url": manual["url"],
                "marketResolved": manual["marketResolved"],
                "status": "manually-verified-exact-entity",
            }

    manual = youtube_manual.get(record["id"])
    if manual:
        if manual.get("status") == "unavailable-original":
            entry["youtubeMusic"] = {
                "status": "unavailable-original",
                "reason": manual["reason"],
            }
        else:
            current = entry.get("youtubeMusic") or {}
            entry["youtubeMusic"] = {
                **current,
                "url": manual["url"],
                "status": "manually-verified-exact-entity",
            }

draft["status"] = "merged-direct-links-requires-final-validation"
draft["records"] = [entries[record["id"]] for record in master]
write(draft_path, draft)
print(f"Merged exact links for {len(master)} records")
