#!/usr/bin/env python3
"""Validate the complete runtime catalog before delivery or publication."""

from __future__ import annotations

import json
import re
import csv
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LANGUAGES = ("es", "en", "fr")
CURATED_EDITORIAL_IDS = {
    "album-002", "album-003", "album-005", "album-006", "album-007",
    "album-009", "album-011", "album-012", "album-013", "album-014",
    "album-015", "album-016", "album-017", "album-018", "album-019",
    "album-020", "album-021", "album-022", "album-023", "album-025",
    "album-027", "album-028", "album-029", "album-030", "song-001",
}
FORBIDDEN_EDITORIAL_PHRASES = (
    "Una ruta útil", "A useful route", "Un parcours utile",
    "La ruta de entrada es", "The entry route is", "La porte d’entrée est",
    "Una escucha guiada por", "A listen shaped by", "Une écoute portée par",
    "Presenta la conversación", "It introduces the conversation",
    "Le morceau présente le dialogue",
)


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


albums = load(DATA / "albums.json")
songs = load(DATA / "songs.json")
records = albums + songs
notes = {item["id"]: item["editorial"] for item in load(DATA / "editorial-notes.json")}
reasons = {item["id"]: item["whyEssential"] for item in load(DATA / "essential-reasons.json")}
with (DATA / "song-listening-keys.tsv").open("r", encoding="utf-8", newline="") as handle:
    song_keys = {
        row["id"]: {language: row[language].strip() for language in LANGUAGES}
        for row in csv.DictReader(handle, delimiter="\t")
    }
with (DATA / "editorial-albums-manual.tsv").open("r", encoding="utf-8", newline="") as handle:
    manual_album_ids = {row["id"].strip() for row in csv.DictReader(handle, delimiter="\t")}
with (DATA / "editorial-songs-manual.tsv").open("r", encoding="utf-8", newline="") as handle:
    manual_song_ids = {row["id"].strip() for row in csv.DictReader(handle, delimiter="\t")}
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
song_ids = {record["id"] for record in songs}
album_ids = {record["id"] for record in albums}
expected_manual_album_ids = album_ids - CURATED_EDITORIAL_IDS
expected_manual_song_ids = song_ids - CURATED_EDITORIAL_IDS
if manual_album_ids != expected_manual_album_ids:
    errors.append("Manual album editorial IDs do not exactly cover every non-legacy album")
if manual_song_ids != expected_manual_song_ids:
    errors.append("Manual song editorial IDs do not exactly cover every non-legacy song")
if set(song_keys) != song_ids:
    errors.append("Song-listening-key IDs do not exactly match runtime song IDs")
for language in LANGUAGES:
    localized_keys = [values.get(language, "") for values in song_keys.values()]
    if any(not value for value in localized_keys):
        errors.append(f"Song listening keys are incomplete in {language}")
    if len(set(localized_keys)) != len(localized_keys):
        errors.append(f"Song listening keys are not unique in {language}")

service_counts = Counter()
source_counts = Counter()
review_texts = {language: Counter() for language in LANGUAGES}
listening_pairs = {language: Counter() for language in LANGUAGES}
card_descriptions = {language: Counter() for language in LANGUAGES}
essential_texts = {language: Counter() for language in LANGUAGES}
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
        else:
            card_descriptions[language][record["description"][language]] += 1
        if not reasons.get(record_id, {}).get(language):
            errors.append(f"{record_id}: missing {language} essential reason")
        else:
            essential_texts[language][reasons[record_id][language]] += 1
        content = notes.get(record_id, {}).get(language, {})
        if not content.get("review") or not content.get("listenFor") or not content.get("entryPoint", {}).get("title"):
            errors.append(f"{record_id}: incomplete {language} editorial")
        else:
            listen_for = content["listenFor"]
            review_text = " ".join(content["review"])
            review_texts[language][review_text] += 1
            listening_pairs[language]["\n".join(listen_for)] += 1
            combined_editorial = " ".join(
                [
                    review_text,
                    *listen_for,
                    content.get("entryPoint", {}).get("reason", ""),
                    record.get("description", {}).get(language, ""),
                    reasons.get(record_id, {}).get(language, ""),
                ]
            )
            for phrase in FORBIDDEN_EDITORIAL_PHRASES:
                if phrase.casefold() in combined_editorial.casefold():
                    errors.append(f"{record_id}: forbidden generic phrase in {language}: {phrase}")
            opening_words = []
            for bullet in listen_for:
                match = re.search(r"[\wÀ-ÿ]+", bullet, flags=re.UNICODE)
                if match:
                    opening_words.append(match.group(0).casefold())
            if len(opening_words) > 1 and len(set(opening_words)) == 1:
                errors.append(f"{record_id}: every {language} listening bullet starts with the same word")
            if record["type"] == "song":
                expected_key = song_keys.get(record_id, {}).get(language)
                if content.get("entryPoint", {}).get("reason") != expected_key:
                    errors.append(f"{record_id}: {language} listening key is not the approved song-specific text")
                title_pattern = re.compile(
                    rf"(?<!\w){re.escape(record['title'])}(?!\w)",
                    flags=re.IGNORECASE,
                )
                title_mentions = len(title_pattern.findall(" ".join(listen_for)))
                if title_mentions > 1:
                    errors.append(f"{record_id}: {language} listening bullets repeat the song title {title_mentions} times")
            elif content.get("entryPoint", {}).get("reason"):
                errors.append(f"{record_id}: album entry point should contain only the recommended track")

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

for language in LANGUAGES:
    for label, counter in (
        ("editorial review", review_texts[language]),
        ("listening-note pair", listening_pairs[language]),
        ("card description", card_descriptions[language]),
        ("essential thesis", essential_texts[language]),
    ):
        duplicates = [text for text, count in counter.items() if count > 1]
        if duplicates:
            errors.append(
                f"Duplicate {language} {label} copy detected ({len(duplicates)} duplicate text(s))"
            )

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
