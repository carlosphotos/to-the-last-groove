#!/usr/bin/env python3
"""Resolve Apple Music, YouTube Music and optimized cover drafts for all records.

Spotify URLs are merged from data/catalog/spotify-links.json when available.
Every match keeps its score and remains a draft until the catalog validator
confirms all three direct services and a local cover.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import io
import json
import re
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image
from ytmusicapi import YTMusic


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MASTER = DATA / "catalog" / "master.json"
OUTPUT = DATA / "catalog" / "service-links-draft.json"
COVER_DIR = ROOT / "assets" / "covers-master"
USER_AGENT = "ToTheLastGroove/0.1 catalog enrichment"
THREAD_LOCAL = threading.local()


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalize(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.casefold().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def similarity(expected: str, actual: str) -> float:
    left, right = normalize(expected), normalize(actual)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    left_tokens, right_tokens = set(left.split()), set(right.split())
    return len(left_tokens & right_tokens) / max(len(left_tokens), 1)


def artist_similarity(expected: str, actual: str) -> float:
    stopwords = {"the", "and", "feat", "featuring", "with", "y", "et"}
    left = {token for token in normalize(expected).split() if token not in stopwords}
    right = {token for token in normalize(actual).split() if token not in stopwords}
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return len(left & right) / len(left)


def score(record: dict, title: str, artist: str, year: int | str | None) -> float:
    title_score = similarity(record["title"], title)
    artist_score = artist_similarity(record["artist"], artist)
    year_score = 0.0
    if year:
        try:
            difference = abs(record["year"] - int(str(year)[:4]))
            year_score = 1.0 if difference == 0 else 0.5 if difference <= 1 else 0.0
        except ValueError:
            pass
    return round(title_score * 0.55 + artist_score * 0.35 + year_score * 0.10, 4)


def get_json(url: str, params: dict | None = None, attempts: int = 4):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def apple_match(record: dict) -> tuple[dict | None, list[dict]]:
    entity = "album" if record["type"] == "album" else "song"
    candidates = []
    seen = set()
    for country in ("MX", "US"):
        for term in (f"{record['artist']} {record['title']}", record["title"]):
            payload = get_json("https://itunes.apple.com/search", {
                "term": term, "entity": entity, "limit": 35, "country": country,
            })
            for item in payload.get("results", []):
                item_id = item.get("collectionId") if entity == "album" else item.get("trackId")
                if item_id in seen:
                    continue
                seen.add(item_id)
                title = item.get("collectionName") if entity == "album" else item.get("trackName")
                if entity == "album":
                    expected_title = normalize(record["title"])
                    candidate_title = normalize(title)
                    disallowed_editions = {"live", "instrumental", "karaoke", "tribute", "remix", "ep"}
                    if any(
                        token in candidate_title.split() and token not in expected_title.split()
                        for token in disallowed_editions
                    ):
                        continue
                artist_match = artist_similarity(record["artist"], item.get("artistName", ""))
                if artist_match < 0.45:
                    continue
                candidate_score = score(record, title or "", item.get("artistName", ""), item.get("releaseDate"))
                candidates.append((candidate_score, country, item))
    candidates.sort(key=lambda pair: pair[0], reverse=True)
    if not candidates:
        return None, []
    best_score, country, best = candidates[0]
    if best_score < 0.68:
        return None, []

    tracklist = []
    if entity == "album" and best.get("collectionId"):
        lookup = get_json("https://itunes.apple.com/lookup", {
            "id": best["collectionId"], "entity": "song", "country": "MX",
        })
        tracklist = [
            {
                "title": item.get("trackName"),
                "number": item.get("trackNumber"),
                "durationMs": item.get("trackTimeMillis"),
            }
            for item in lookup.get("results", [])
            if item.get("wrapperType") == "track"
        ]

    artwork = best.get("artworkUrl100")
    if artwork:
        artwork = re.sub(r"/\d+x\d+bb\.", "/1200x1200bb.", artwork)
    direct_url = best.get("collectionViewUrl") if entity == "album" else best.get("trackViewUrl")
    if direct_url:
        direct_url = direct_url.replace("&uo=4", "").replace("?uo=4", "")
    result = {
        "url": direct_url,
        "score": best_score,
        "artist": best.get("artistName"),
        "title": best.get("collectionName") if entity == "album" else best.get("trackName"),
        "collectionTitle": best.get("collectionName"),
        "year": str(best.get("releaseDate", ""))[:4] or None,
        "collectionId": best.get("collectionId"),
        "trackId": best.get("trackId"),
        "durationMs": best.get("trackTimeMillis"),
        "artworkSource": artwork,
        "marketResolved": country,
    }
    return result, tracklist


def youtube_match(ytmusic: YTMusic, record: dict) -> dict | None:
    result_filter = "albums" if record["type"] == "album" else "songs"
    candidates = []
    seen = set()
    searches = [
        (f"{record['artist']} {record['title']}", result_filter),
        (record["title"], result_filter),
    ]
    if record["type"] == "song":
        searches.append((f"{record['artist']} {record['title']}", "videos"))
    for query, search_filter in searches:
        for item in ytmusic.search(query, filter=search_filter, limit=20):
            item_id = item.get("browseId") or item.get("videoId")
            if not item_id or item_id in seen:
                continue
            seen.add(item_id)
            artists = " & ".join(artist.get("name", "") for artist in item.get("artists", []))
            if artist_similarity(record["artist"], artists) < 0.40:
                continue
            candidate_score = score(record, item.get("title", ""), artists, item.get("year"))
            candidates.append((candidate_score, item, artists))
    candidates.sort(key=lambda candidate: candidate[0], reverse=True)
    if not candidates or candidates[0][0] < 0.64:
        return None
    best_score, best, artists = candidates[0]
    if record["type"] == "album":
        direct_url = f"https://music.youtube.com/browse/{best['browseId']}"
    else:
        direct_url = f"https://music.youtube.com/watch?v={best['videoId']}"
    return {
        "url": direct_url,
        "score": best_score,
        "artist": artists,
        "title": best.get("title"),
        "year": best.get("year"),
        "browseId": best.get("browseId"),
        "videoId": best.get("videoId"),
        "thumbnailSource": (best.get("thumbnails") or [{}])[-1].get("url"),
    }


def thread_youtube() -> YTMusic:
    if not hasattr(THREAD_LOCAL, "ytmusic"):
        THREAD_LOCAL.ytmusic = YTMusic()
    return THREAD_LOCAL.ytmusic


def optimize_cover(source_url: str | None, destination: Path, max_bytes: int) -> dict:
    if not source_url:
        return {"status": "missing-source"}
    request = urllib.request.Request(source_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=40) as response:
        raw = response.read()
    with Image.open(io.BytesIO(raw)) as image:
        image = image.convert("RGB")
        image.thumbnail((720, 720), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        # Service thumbnails can legitimately be 300 px. They are still large
        # enough for the compact card and must not be rejected just for being
        # below the preferred 720 px source size.
        while image.width >= 160:
            quality = 82
            while quality >= 50:
                buffer = io.BytesIO()
                image.save(buffer, format="WEBP", quality=quality, method=6)
                if buffer.tell() <= max_bytes:
                    destination.write_bytes(buffer.getvalue())
                    return {
                        "status": "optimized",
                        "path": str(destination.relative_to(ROOT)),
                        "bytes": buffer.tell(),
                        "width": image.width,
                        "height": image.height,
                        "quality": quality,
                    }
                quality -= 4
            image = image.resize(
                (round(image.width * 0.9), round(image.height * 0.9)),
                Image.Resampling.LANCZOS,
            )
    return {"status": "failed"}


def enrich_record(record: dict, spotify_entry: dict | None, max_cover_bytes: int) -> dict:
    entry = {"id": record["id"], "type": record["type"]}
    errors = []
    try:
        apple, tracklist = apple_match(record)
        entry["appleMusic"] = apple
        entry["tracklist"] = tracklist
    except Exception as error:
        entry["appleMusic"] = None
        entry["tracklist"] = []
        errors.append(f"apple:{type(error).__name__}")
    try:
        entry["youtubeMusic"] = youtube_match(thread_youtube(), record)
    except Exception as error:
        entry["youtubeMusic"] = None
        errors.append(f"youtube:{type(error).__name__}")
    entry["spotify"] = spotify_entry
    try:
        artwork_sources = []
        if entry.get("appleMusic"):
            artwork_sources.append(entry["appleMusic"].get("artworkSource"))
        if entry.get("youtubeMusic"):
            artwork_sources.append(entry["youtubeMusic"].get("thumbnailSource"))
        if entry.get("spotify"):
            artwork_sources.append(entry["spotify"].get("thumbnailSource"))
        artwork_sources = list(dict.fromkeys(source for source in artwork_sources if source))
        entry["cover"] = {"status": "missing-source"}
        cover_errors = []
        for artwork in artwork_sources:
            try:
                candidate = optimize_cover(
                    artwork,
                    COVER_DIR / f"{record['id']}.webp",
                    max_cover_bytes,
                )
                if candidate.get("status") == "optimized":
                    entry["cover"] = candidate
                    break
                cover_errors.append(candidate.get("status", "failed"))
            except Exception as error:
                cover_errors.append(type(error).__name__)
        if entry["cover"].get("status") != "optimized" and cover_errors:
            entry["cover"]["errors"] = cover_errors
    except Exception as error:
        entry["cover"] = {"status": "failed", "error": type(error).__name__}
    if errors:
        entry["errors"] = errors
    return entry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-cover-kb", type=int, default=120)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--ids", help="Comma-separated record IDs to refresh")
    args = parser.parse_args()

    records = load(MASTER)["records"]
    previous = {entry["id"]: entry for entry in load(OUTPUT).get("records", [])} if OUTPUT.exists() else {}
    spotify_path = DATA / "catalog" / "spotify-links.json"
    spotify = {entry["id"]: entry for entry in load(spotify_path).get("records", [])} if spotify_path.exists() else {}
    selected = records[args.start: args.start + args.limit if args.limit else None]
    if args.ids:
        requested = set(args.ids.split(","))
        selected = [record for record in records if record["id"] in requested]

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(
                enrich_record,
                record,
                spotify.get(record["id"]),
                args.max_cover_kb * 1024,
            ): record
            for record in selected
        }
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            record = futures[future]
            completed += 1
            try:
                previous[record["id"]] = future.result()
            except Exception as error:
                previous[record["id"]] = {
                    "id": record["id"], "type": record["type"],
                    "appleMusic": None, "youtubeMusic": None,
                    "spotify": spotify.get(record["id"]),
                    "cover": {"status": "failed"},
                    "errors": [f"worker:{type(error).__name__}"],
                }
            print(
                f"[{completed}/{len(selected)}] {record['id']} · {record['artist']} — {record['title']}",
                flush=True,
            )
            if completed % 10 == 0 or completed == len(selected):
                write(OUTPUT, {
                    "schemaVersion": 1,
                    "market": "MX",
                    "status": "draft-requires-validation",
                    "records": [previous[item["id"]] for item in records if item["id"] in previous],
                })

    print(f"Saved {len(previous)} records to {OUTPUT}")


if __name__ == "__main__":
    main()
