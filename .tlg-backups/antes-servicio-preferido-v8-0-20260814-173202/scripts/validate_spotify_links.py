#!/usr/bin/env python3
"""Validate Spotify search candidates through the public oEmbed endpoint."""

from __future__ import annotations

import concurrent.futures
import html
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "catalog"

# Public oEmbed occasionally returns the release title in its original script.
# These are exact-title aliases, not fuzzy exceptions for unrelated releases.
TITLE_ALIASES = {
    "album-067": ["風街ろまん"],
}
ARTIST_ALIASES = {
    "album-059": ["Various Artists"],
    "song-058": ["Fairouz"],
}


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write(path: Path, payload) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def title_match(expected: str, actual: str) -> float:
    left, right = normalize(expected), normalize(actual)
    if left == right:
        return 1.0
    left_tokens, right_tokens = set(left.split()), set(right.split())
    if not left_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens)


def artist_match(expected: str, actual: str) -> float:
    stopwords = {"the", "and", "feat", "featuring", "with", "y", "et"}
    left = {token for token in normalize(expected).split() if token not in stopwords}
    right = {token for token in normalize(actual).split() if token not in stopwords}
    if not left or not right:
        return 0.0
    return len(left & right) / len(left)


def embed_entity(iframe_url: str) -> dict:
    request = urllib.request.Request(iframe_url, headers={"User-Agent": "Mozilla/5.0 ToTheLastGroove/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        page = response.read().decode("utf-8", "ignore")
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        page,
        flags=re.S,
    )
    if not match:
        raise ValueError("Spotify embed metadata not found")
    payload = json.loads(html.unescape(match.group(1)))
    return payload["props"]["pageProps"]["state"]["data"]["entity"]


def validate(entry: dict, record: dict) -> dict:
    if entry.get("status") == "unavailable-original":
        return entry
    endpoint = "https://open.spotify.com/oembed?" + urllib.parse.urlencode({"url": entry["url"]})
    request = urllib.request.Request(endpoint, headers={"User-Agent": "ToTheLastGroove/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        metadata = json.loads(response.read().decode("utf-8"))
    entity = embed_entity(metadata["iframe_url"])
    expected_titles = [record["title"], *TITLE_ALIASES.get(record["id"], [])]
    match = max(title_match(title, entity.get("name", "")) for title in expected_titles)
    actual_artists = (
        " & ".join(artist.get("name", "") for artist in entity.get("artists", []))
        if entity.get("artists")
        else entity.get("subtitle", "")
    )
    expected_artists = [record["artist"], *ARTIST_ALIASES.get(record["id"], [])]
    artist_score = max(artist_match(artist, actual_artists) for artist in expected_artists)
    valid = match >= 0.60 and artist_score >= 0.45
    return {
        **entry,
        "oembedTitle": metadata.get("title"),
        "entityTitle": entity.get("name"),
        "entityArtists": actual_artists,
        "thumbnailSource": metadata.get("thumbnail_url"),
        "titleMatch": round(match, 4),
        "artistMatch": round(artist_score, 4),
        "status": "validated-title-artist" if valid else "rejected-metadata-mismatch",
    }


master = load(DATA / "master.json")["records"]
records = {record["id"]: record for record in master}
path = DATA / "spotify-links.json"
payload = load(path)
retry_path = DATA / "spotify-links-retries.json"
if retry_path.exists():
    merged = {entry["id"]: entry for entry in payload["records"]}
    merged.update({entry["id"]: entry for entry in load(retry_path)["records"]})
    payload["records"] = [merged[record["id"]] for record in master if record["id"] in merged]
manual_path = DATA / "spotify-links-manual.json"
if manual_path.exists():
    merged = {entry["id"]: entry for entry in payload["records"]}
    merged.update({entry["id"]: entry for entry in load(manual_path)["records"]})
    payload["records"] = [merged[record["id"]] for record in master if record["id"] in merged]
validated = {
    entry["id"]: entry
    for entry in payload["records"]
    if entry.get("status") in {"validated-title-artist", "unavailable-original"}
}
pending = [entry for entry in payload["records"] if entry["id"] not in validated]

with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
    futures = {
        executor.submit(validate, entry, records[entry["id"]]): entry
        for entry in pending
    }
    for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
        original = futures[future]
        try:
            validated[original["id"]] = future.result()
        except Exception as error:
            validated[original["id"]] = {
                **original,
                "status": "validation-error",
                "error": type(error).__name__,
            }
        if index % 25 == 0:
            print(f"Spotify metadata: {index}/{len(futures)}", flush=True)

payload["status"] = "validated-title-requires-final-artist-review"
payload["records"] = [validated[record["id"]] for record in master if record["id"] in validated]
write(path, payload)

counts = {}
for entry in payload["records"]:
    counts[entry["status"]] = counts.get(entry["status"], 0) + 1
print(json.dumps(counts, ensure_ascii=False, indent=2))
