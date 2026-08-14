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
STOPWORDS = {
    "es": set("a al algo ante bajo con como contra cual cuando de del desde donde durante el ella ellos en entre era es esa ese esta este esto fue ha hacia hasta la las le les lo los más muy ni no para pero por porque que se sin sobre su sus un una unos unas y ya".split()),
    "en": set("a an and are as at be been but by for from had has have he her his how in into is it its more most no not of on or our she so than that the their them they this to was were when where which while who with without you".split()),
    "fr": set("a au aux avec ce ces cette comme dans de des du elle en entre est et il la le les leur lui mais ne ni non ou par pas plus pour que qui sa se ses son sous sur un une".split()),
}


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalized_tokens(value: str, language: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zà-ÿ0-9]+", value.casefold())
        if len(token) > 2 and token not in STOPWORDS[language]
    }


def scrub_titles(value: str, record: dict, editorial: dict) -> str:
    result = value
    protected = [record["title"], record["artist"], *(editorial.get("trackMentions") or [])]
    for title in sorted(set(filter(None, protected)), key=len, reverse=True):
        result = re.sub(re.escape(title), " ", result, flags=re.IGNORECASE)
    return result


def overlap_ratio(first: str, second: str, language: str) -> tuple[float, set[str]]:
    first_tokens = normalized_tokens(first, language)
    second_tokens = normalized_tokens(second, language)
    shared = first_tokens & second_tokens
    denominator = min(len(first_tokens), len(second_tokens))
    return (len(shared) / denominator if denominator else 0.0), shared


albums = load(DATA / "albums.json")
songs = load(DATA / "songs.json")
records = albums + songs
notes = {item["id"]: item["editorial"] for item in load(DATA / "editorial-notes.json")}
with (DATA / "editorial-albums-manual.tsv").open("r", encoding="utf-8", newline="") as handle:
    manual_album_ids = {row["id"].strip() for row in csv.DictReader(handle, delimiter="\t")}
with (DATA / "editorial-songs-manual.tsv").open("r", encoding="utf-8", newline="") as handle:
    manual_song_ids = {row["id"].strip() for row in csv.DictReader(handle, delimiter="\t")}
with (DATA / "editorial-card-copy.tsv").open("r", encoding="utf-8", newline="") as handle:
    approved_card_copy = {
        row["id"].strip(): {language: row[language].strip() for language in LANGUAGES}
        for row in csv.DictReader(handle, delimiter="\t")
    }
errors = []

if len(albums) != 100 or len(songs) != 100:
    errors.append(f"Expected 100 albums and 100 songs; got {len(albums)} and {len(songs)}")
ids = [record["id"] for record in records]
if len(set(ids)) != 200:
    errors.append("Runtime IDs are not unique")
if set(notes) != set(ids):
    errors.append("Editorial IDs do not exactly match runtime IDs")
if set(approved_card_copy) != set(ids):
    errors.append("Approved card-copy IDs do not exactly match runtime IDs")
song_ids = {record["id"] for record in songs}
album_ids = {record["id"] for record in albums}
expected_manual_album_ids = album_ids - CURATED_EDITORIAL_IDS
expected_manual_song_ids = song_ids - CURATED_EDITORIAL_IDS
if manual_album_ids != expected_manual_album_ids:
    errors.append("Manual album editorial IDs do not exactly cover every non-legacy album")
if manual_song_ids != expected_manual_song_ids:
    errors.append("Manual song editorial IDs do not exactly cover every non-legacy song")

service_counts = Counter()
source_counts = Counter()
review_texts = {language: Counter() for language in LANGUAGES}
listening_pairs = {language: Counter() for language in LANGUAGES}
card_descriptions = {language: Counter() for language in LANGUAGES}
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
            if record["description"][language] != approved_card_copy.get(record_id, {}).get(language):
                errors.append(f"{record_id}: runtime {language} description is not the approved independent copy")
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
                ]
            )
            for phrase in FORBIDDEN_EDITORIAL_PHRASES:
                if phrase.casefold() in combined_editorial.casefold():
                    errors.append(f"{record_id}: forbidden generic phrase in {language}: {phrase}")

            protected_values = [record["title"], record["artist"], *(notes[record_id].get("trackMentions") or [])]
            prose_without_titles = combined_editorial
            for protected_value in sorted(set(filter(None, protected_values)), key=len, reverse=True):
                prose_without_titles = re.sub(
                    re.escape(protected_value),
                    " ",
                    prose_without_titles,
                    flags=re.IGNORECASE,
                )
            if re.search(r"\s*:\s+", prose_without_titles):
                errors.append(f"{record_id}: prose colon remains in {language}")

            layers = {
                "card description": scrub_titles(record["description"][language], record, notes[record_id]),
                "review": scrub_titles(review_text, record, notes[record_id]),
                "first observation": scrub_titles(listen_for[0], record, notes[record_id]),
                "second observation": scrub_titles(listen_for[1], record, notes[record_id]),
            }
            overlap_limits = (
                ("card description", "review", 0.55),
                ("card description", "first observation", 0.60),
                ("card description", "second observation", 0.60),
                ("review", "first observation", 0.65),
                ("review", "second observation", 0.65),
                ("first observation", "second observation", 0.65),
            )
            for first_label, second_label, limit in overlap_limits:
                ratio, shared = overlap_ratio(
                    layers[first_label],
                    layers[second_label],
                    language,
                )
                if ratio >= limit and len(shared) >= 3:
                    errors.append(
                        f"{record_id}: {language} {first_label} overlaps {second_label} "
                        f"({ratio:.0%}: {', '.join(sorted(shared))})"
                    )
            opening_words = []
            for bullet in listen_for:
                match = re.search(r"[\wÀ-ÿ]+", bullet, flags=re.UNICODE)
                if match:
                    opening_words.append(match.group(0).casefold())
            if len(opening_words) > 1 and len(set(opening_words)) == 1:
                errors.append(f"{record_id}: every {language} listening bullet starts with the same word")
            if record["type"] == "song":
                title_pattern = re.compile(
                    rf"(?<!\w){re.escape(record['title'])}(?!\w)",
                    flags=re.IGNORECASE,
                )
                title_mentions = len(title_pattern.findall(" ".join(listen_for)))
                if title_mentions > 1:
                    errors.append(f"{record_id}: {language} listening bullets repeat the song title {title_mentions} times")
            if content.get("entryPoint", {}).get("reason"):
                errors.append(f"{record_id}: entry point should not repeat editorial prose")

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
    "serviceLinks": dict(sorted(service_counts.items())),
    "recognitionSources": dict(sorted(source_counts.items())),
}, ensure_ascii=False, indent=2))

if errors:
    print("\n".join(errors))
    raise SystemExit(f"Validation failed with {len(errors)} error(s)")
print("Publishable catalog validation passed.")
