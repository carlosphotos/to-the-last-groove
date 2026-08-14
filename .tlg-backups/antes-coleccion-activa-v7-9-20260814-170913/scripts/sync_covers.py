#!/usr/bin/env python3
"""Download and validate the local cover library for To the Last Groove."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATHS = (
    ROOT / "data" / "albums.json",
    ROOT / "data" / "songs.json",
)
COVER_DIR = ROOT / "assets" / "covers"
SOURCE_CACHE_PATH = COVER_DIR / ".source-cache.json"
COVER_SIZES = (500, 250)
USER_AGENT = (
    "ToTheLastGrooveCoverSync/1.0 "
    "(https://github.com/carlosphotos/to-the-last-groove)"
)
FRONT_PATTERN = re.compile(
    r"/front(?:-(?:250|500|1200))?(?=$|[?#])"
)
MUSICBRAINZ_SEARCH_URL = "https://musicbrainz.org/ws/2/release-group/"
MUSICBRAINZ_INTERVAL = 1.25
TRANSIENT_HTTP_CODES = {429, 500, 502, 503, 504}
MAX_REQUEST_ATTEMPTS = 7


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Descarga las portadas de Cover Art Archive y actualiza "
            "el catálogo para usar archivos locales."
        )
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="solo valida el catálogo y los archivos existentes",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="vuelve a descargar incluso las portadas existentes",
    )
    return parser.parse_args()


def read_catalog(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError(f"{path.name} no contiene una lista JSON.")

    return data


def open_with_retries(
    request: urllib.request.Request,
    label: str,
):
    last_error = None

    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        try:
            return urllib.request.urlopen(request, timeout=90)
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in TRANSIENT_HTTP_CODES:
                raise

            retry_after = error.headers.get("Retry-After", "")
            wait = (
                int(retry_after)
                if retry_after.isdigit()
                else min(60, 3 * 2 ** (attempt - 1))
            )
            if attempt == MAX_REQUEST_ATTEMPTS:
                break
            print(
                f"{label}: servicio temporalmente ocupado ({error.code}). "
                f"Nuevo intento en {wait} s…",
                file=sys.stderr,
            )
            time.sleep(wait)
        except urllib.error.URLError as error:
            last_error = error
            wait = min(60, 3 * 2 ** (attempt - 1))
            if attempt == MAX_REQUEST_ATTEMPTS:
                break
            print(
                f"{label}: conexión interrumpida. Nuevo intento en {wait} s…",
                file=sys.stderr,
            )
            time.sleep(wait)

    raise RuntimeError(
        f"{label}: no respondió después de {MAX_REQUEST_ATTEMPTS} intentos: "
        f"{last_error}"
    ) from last_error


def get_source_url(record: dict) -> str:
    source_url = record.get("coverSourceUrl") or record.get("coverUrl", "")

    if not source_url.startswith(("https://", "http://")):
        raise ValueError(
            f"{record.get('id', 'registro sin id')} no conserva una URL "
            "externa válida para su portada."
        )

    return source_url


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(
        character
        for character in value
        if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def source_cache_key(record: dict) -> str:
    artist = normalized(record.get("coverSearchArtist") or record["artist"])
    title = normalized(record.get("coverSearchTitle") or record["title"])
    year = int(record.get("coverSearchYear") or record["year"])
    return f"{artist}|{title}|{year}"


def read_source_cache() -> dict[str, str]:
    if not SOURCE_CACHE_PATH.is_file():
        return {}

    try:
        with SOURCE_CACHE_PATH.open("r", encoding="utf-8") as handle:
            cache = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(cache, dict):
        return {}

    return {
        str(key): value
        for key, value in cache.items()
        if isinstance(value, str) and value.startswith("https://")
    }


def write_source_cache(cache: dict[str, str]) -> None:
    SOURCE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = SOURCE_CACHE_PATH.with_suffix(".json.tmp")
    content = json.dumps(cache, ensure_ascii=False, indent=2) + "\n"
    temporary_path.write_text(content, encoding="utf-8")
    os.replace(temporary_path, SOURCE_CACHE_PATH)


def musicbrainz_query(record: dict) -> str:
    title = record.get("coverSearchTitle") or record["title"]
    artist = record.get("coverSearchArtist") or record["artist"]
    escaped_title = re.sub(r'([+\-!(){}\[\]^"~*?:\\/])', r'\\\1', title)
    escaped_artist = re.sub(r'([+\-!(){}\[\]^"~*?:\\/])', r'\\\1', artist)
    return f'releasegroup:"{escaped_title}" AND artist:"{escaped_artist}"'


def candidate_score(candidate: dict, record: dict) -> int:
    wanted_title = normalized(record.get("coverSearchTitle") or record["title"])
    wanted_artist = normalized(record.get("coverSearchArtist") or record["artist"])
    wanted_year = int(record.get("coverSearchYear") or record["year"])
    candidate_title = normalized(candidate.get("title", ""))
    candidate_artist = normalized(
        " ".join(
            credit.get("artist", {}).get("name", "")
            for credit in candidate.get("artist-credit", [])
        )
    )
    candidate_year = candidate.get("first-release-date", "")[:4]

    score = int(candidate.get("score", 0))
    if candidate_title == wanted_title:
        score += 100
    elif wanted_title in candidate_title or candidate_title in wanted_title:
        score += 35
    if candidate_artist == wanted_artist:
        score += 80
    elif wanted_artist in candidate_artist or candidate_artist in wanted_artist:
        score += 25
    if candidate_year.isdigit():
        difference = abs(int(candidate_year) - wanted_year)
        score += max(0, 30 - difference * 8)
    if candidate.get("primary-type") == "Album":
        score += 8
    return score


def has_front_cover(release_group_id: str) -> bool:
    url = (
        "https://coverartarchive.org/release-group/"
        f"{release_group_id}/front-250"
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/jpeg,image/*;q=0.8",
        },
    )

    try:
        with open_with_retries(request, "Cover Art Archive") as response:
            return response.read(3) == b"\xff\xd8\xff"
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return False
        raise RuntimeError(
            f"Cover Art Archive no pudo comprobar una portada: {error}"
        ) from error


def search_release_groups(query: str) -> list[dict]:
    parameters = urllib.parse.urlencode(
        {"query": query, "fmt": "json", "limit": 12}
    )
    request = urllib.request.Request(
        f"{MUSICBRAINZ_SEARCH_URL}?{parameters}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )

    try:
        with open_with_retries(request, "MusicBrainz") as response:
            payload = json.load(response)
    except (urllib.error.URLError, json.JSONDecodeError) as error:
        raise RuntimeError(f"MusicBrainz no pudo completar la búsqueda: {error}") from error

    return payload.get("release-groups", [])


def resolve_source_url(record: dict) -> str:
    candidates = search_release_groups(musicbrainz_query(record))
    if not candidates:
        title = record.get("coverSearchTitle") or record["title"]
        escaped_title = re.sub(
            r'([+\-!(){}\[\]^"~*?:\\/])',
            r'\\\1',
            title,
        )
        time.sleep(MUSICBRAINZ_INTERVAL)
        candidates = search_release_groups(f'releasegroup:"{escaped_title}"')

    candidates.sort(key=lambda item: candidate_score(item, record), reverse=True)
    candidate = next(
        (
            item
            for item in candidates
            if has_front_cover(item["id"])
        ),
        None,
    )

    if not candidate:
        raise RuntimeError(
            f"No se encontró una portada frontal para {record['artist']} — "
            f"{record.get('coverSearchTitle') or record['title']}."
        )

    return (
        "https://coverartarchive.org/release-group/"
        f"{candidate['id']}/front-500"
    )


def resolve_sources(records: list[dict]) -> dict[str, str]:
    resolved: dict[str, str] = {}
    search_cache = read_source_cache()

    for record in records:
        try:
            resolved[record["id"]] = get_source_url(record)
            continue
        except ValueError:
            pass

        key = source_cache_key(record)
        if key in search_cache:
            print(f"Resolviendo {record['id']}: recuperando avance guardado")
            resolved[record["id"]] = search_cache[key]
            continue

        print(
            f"Resolviendo {record['id']}: "
            f"{record['artist']} — {record.get('coverSearchTitle') or record['title']}"
        )
        source_url = resolve_source_url(record)
        search_cache[key] = source_url
        write_source_cache(search_cache)
        resolved[record["id"]] = source_url
        time.sleep(MUSICBRAINZ_INTERVAL)

    return resolved


def get_sized_url(source_url: str, size: int) -> str:
    sized_url, replacements = FRONT_PATTERN.subn(
        f"/front-{size}", source_url, count=1
    )

    if replacements != 1:
        raise ValueError(
            f"No se pudo obtener la versión de {size}px desde {source_url}"
        )

    return sized_url


def is_jpeg(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            signature = handle.read(3)
        return path.stat().st_size > 1024 and signature == b"\xff\xd8\xff"
    except OSError:
        return False


def download_jpeg(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/jpeg,image/*;q=0.8",
        },
    )

    try:
        with open_with_retries(request, "Cover Art Archive") as response:
            payload = response.read()
    except urllib.error.URLError as error:
        raise RuntimeError(f"No se pudo descargar {url}: {error}") from error

    if len(payload) <= 1024 or not payload.startswith(b"\xff\xd8\xff"):
        raise RuntimeError(f"La respuesta no parece una imagen JPEG válida: {url}")

    destination.write_bytes(payload)


def localized_record(record: dict, source_url: str) -> dict:
    record_id = record["id"]
    updated = {}

    for key, value in record.items():
        if key in {"thumbnailUrl", "coverSourceUrl"}:
            continue

        if key == "coverUrl":
            updated["coverUrl"] = f"assets/covers/{record_id}-500.jpg"
            updated["thumbnailUrl"] = f"assets/covers/{record_id}-250.jpg"
            updated["coverSourceUrl"] = source_url
        else:
            updated[key] = value

    return updated


def write_catalog(path: Path, records: list[dict]) -> None:
    temporary_path = path.with_suffix(".json.tmp")
    content = json.dumps(records, ensure_ascii=False, indent=2) + "\n"
    temporary_path.write_text(content, encoding="utf-8")
    os.replace(temporary_path, path)


def validate_catalogs(catalogs: list[tuple[Path, list[dict]]]) -> bool:
    errors = []
    record_count = 0

    for path, records in catalogs:
        for record in records:
            record_count += 1
            record_id = record.get("id", "registro sin id")
            expected_cover = f"assets/covers/{record_id}-500.jpg"
            expected_thumbnail = f"assets/covers/{record_id}-250.jpg"

            if record.get("coverUrl") != expected_cover:
                errors.append(f"{record_id}: coverUrl no es local")
            if record.get("thumbnailUrl") != expected_thumbnail:
                errors.append(f"{record_id}: falta thumbnailUrl local")
            if not record.get("coverSourceUrl", "").startswith("http"):
                errors.append(f"{record_id}: falta coverSourceUrl")

            for relative_path in (expected_cover, expected_thumbnail):
                image_path = ROOT / relative_path
                if not is_jpeg(image_path):
                    errors.append(f"{record_id}: archivo inválido {relative_path}")

    if errors:
        print("La biblioteca de portadas tiene problemas:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return False

    print(
        f"Biblioteca verificada: {record_count} recomendaciones y "
        f"{record_count * len(COVER_SIZES)} imágenes locales."
    )
    return True


def sync_covers(
    catalogs: list[tuple[Path, list[dict]]], force: bool
) -> None:
    all_records = [
        record
        for _, records in catalogs
        for record in records
    ]
    resolved_sources = resolve_sources(all_records)
    total_files = len(all_records) * len(COVER_SIZES)
    source_cache: dict[str, Path] = {}
    localized_catalogs: list[tuple[Path, list[dict]]] = []
    processed_files = 0
    COVER_DIR.mkdir(parents=True, exist_ok=True)

    for record in all_records:
        record_id = record["id"]
        source_url = resolved_sources[record_id]

        for size in COVER_SIZES:
            processed_files += 1
            sized_url = get_sized_url(source_url, size)
            destination = COVER_DIR / f"{record_id}-{size}.jpg"
            prefix = f"[{processed_files:03d}/{total_files:03d}]"

            if not force and is_jpeg(destination):
                print(f"{prefix} Conservando {destination.name}")
                source_cache.setdefault(sized_url, destination)
            elif sized_url in source_cache:
                print(f"{prefix} Reutilizando {destination.name}")
                shutil.copy2(source_cache[sized_url], destination)
            else:
                print(f"{prefix} Descargando {destination.name}")
                partial_path = destination.with_suffix(".jpg.part")
                download_jpeg(sized_url, partial_path)
                os.replace(partial_path, destination)
                source_cache[sized_url] = destination
                time.sleep(0.15)

    for path, records in catalogs:
        localized_catalogs.append(
            (
                path,
                [
                    localized_record(
                        record,
                        resolved_sources[record["id"]],
                    )
                    for record in records
                ],
            )
        )

    for path, records in localized_catalogs:
        write_catalog(path, records)

    if not validate_catalogs(localized_catalogs):
        raise RuntimeError("La validación final no fue satisfactoria.")

    SOURCE_CACHE_PATH.unlink(missing_ok=True)


def main() -> int:
    args = parse_args()

    try:
        catalogs = [
            (path, read_catalog(path))
            for path in CATALOG_PATHS
        ]

        if args.check:
            return 0 if validate_catalogs(catalogs) else 1

        sync_covers(catalogs, args.force)
        print("Las portadas ya están listas para probarse y agregarse a Git.")
        return 0
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        print(
            "El catálogo no se cambió. El avance disponible quedó guardado; "
            "vuelve a ejecutar el mismo comando.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
