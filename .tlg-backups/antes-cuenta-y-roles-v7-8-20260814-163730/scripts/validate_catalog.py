#!/usr/bin/env python3
"""Validate the To the Last Groove catalogue without using the network."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {"es", "en", "fr"}
GENRES = {
    "rock", "pop", "jazz", "blues", "soul", "hip-hop",
    "electronic", "folk", "latin", "global",
}


def load(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, list):
        raise ValueError(f"{path.name} debe contener una lista.")
    return value


def validate_record(record: dict, expected_type: str, errors: list[str]) -> None:
    record_id = record.get("id", "sin-id")
    required = {
        "id", "type", "artist", "title", "year", "decade", "genre", "genreDetail",
        "duration", "catalogue", "coverClass", "coverUrl",
        "description",
    }
    missing = sorted(required - record.keys())
    if missing:
        errors.append(f"{record_id}: faltan {', '.join(missing)}")
    if record.get("type") != expected_type:
        errors.append(f"{record_id}: type debe ser {expected_type}")
    if record.get("genre") not in GENRES:
        errors.append(f"{record_id}: género no reconocido")
    if str(int(record.get("year", 0)) // 10 * 10) != record.get("decade"):
        errors.append(f"{record_id}: década y año no coinciden")
    if set(record.get("description", {})) != LANGUAGES:
        errors.append(f"{record_id}: la descripción debe incluir ES, EN y FR")
    if not all(str(value).strip() for value in record.get("description", {}).values()):
        errors.append(f"{record_id}: hay una descripción vacía")

    cover_url = record.get("coverUrl", "")
    has_resolvable_cover = bool(
        cover_url.startswith(("http://", "https://", "assets/"))
        or record.get("coverSearchTitle")
    )
    if not has_resolvable_cover:
        errors.append(f"{record_id}: no hay portada ni búsqueda de portada")


def duplicates(records: list[dict], field: str) -> list[str]:
    counts = Counter(record.get(field) for record in records)
    return sorted(str(value) for value, count in counts.items() if count > 1)


def main() -> int:
    errors: list[str] = []
    albums = load(ROOT / "data" / "albums.json")
    songs = load(ROOT / "data" / "songs.json")
    notes = load(ROOT / "data" / "editorial-notes.json")

    for record in albums:
        validate_record(record, "album", errors)
    for record in songs:
        validate_record(record, "song", errors)

    records = albums + songs
    for field in ("id", "catalogue"):
        repeated = duplicates(records, field)
        if repeated:
            errors.append(f"{field} duplicados: {', '.join(repeated)}")

    record_ids = {record["id"] for record in records}
    note_ids = [note.get("id") for note in notes]
    note_ids.extend(
        record["id"]
        for record in records
        if record.get("editorial")
    )
    unknown_notes = sorted(set(note_ids) - record_ids)
    if unknown_notes:
        errors.append(f"Notas sin recomendación: {', '.join(unknown_notes)}")
    repeated_notes = sorted(value for value, count in Counter(note_ids).items() if count > 1)
    if repeated_notes:
        errors.append(f"Notas duplicadas: {', '.join(repeated_notes)}")

    if len(albums) != 100 or len(songs) != 100:
        errors.append(
            f"Se esperaban 100 álbumes y 100 canciones; hay {len(albums)} y {len(songs)}."
        )

    if errors:
        print("El catálogo tiene problemas:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    decade_counts = Counter(record["decade"] for record in records)
    genre_counts = Counter(record["genre"] for record in records)
    print(f"Catálogo válido: {len(albums)} álbumes + {len(songs)} canciones.")
    print("Décadas: " + ", ".join(f"{key}: {decade_counts[key]}" for key in sorted(decade_counts)))
    print("Géneros: " + ", ".join(f"{key}: {genre_counts[key]}" for key in sorted(genre_counts)))
    print(f"Notas editoriales disponibles: {len(note_ids)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
