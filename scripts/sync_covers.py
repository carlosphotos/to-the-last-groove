#!/usr/bin/env python3
"""Download and validate the local cover library for To the Last Groove."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATHS = (
    ROOT / "data" / "albums.json",
    ROOT / "data" / "songs.json",
)
COVER_DIR = ROOT / "assets" / "covers"
COVER_SIZES = (500, 250)
USER_AGENT = (
    "ToTheLastGrooveCoverSync/1.0 "
    "(https://github.com/carlosphotos/to-the-last-groove)"
)
FRONT_PATTERN = re.compile(
    r"/front(?:-(?:250|500|1200))?(?=$|[?#])"
)


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


def get_source_url(record: dict) -> str:
    source_url = record.get("coverSourceUrl") or record.get("coverUrl", "")

    if not source_url.startswith(("https://", "http://")):
        raise ValueError(
            f"{record.get('id', 'registro sin id')} no conserva una URL "
            "externa válida para su portada."
        )

    return source_url


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
        with urllib.request.urlopen(request, timeout=90) as response:
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
    total_files = len(all_records) * len(COVER_SIZES)
    source_cache: dict[str, Path] = {}
    localized_catalogs: list[tuple[Path, list[dict]]] = []

    with tempfile.TemporaryDirectory(
        prefix="tlg-covers-", dir=ROOT
    ) as temporary_directory:
        staging_dir = Path(temporary_directory)
        processed_files = 0

        for record in all_records:
            record_id = record["id"]
            source_url = get_source_url(record)

            for size in COVER_SIZES:
                processed_files += 1
                sized_url = get_sized_url(source_url, size)
                staged_path = staging_dir / f"{record_id}-{size}.jpg"
                existing_path = COVER_DIR / staged_path.name
                prefix = f"[{processed_files:02d}/{total_files:02d}]"

                if not force and is_jpeg(existing_path):
                    print(f"{prefix} Conservando {existing_path.name}")
                    shutil.copy2(existing_path, staged_path)
                elif sized_url in source_cache:
                    print(f"{prefix} Reutilizando {staged_path.name}")
                    shutil.copy2(source_cache[sized_url], staged_path)
                else:
                    print(f"{prefix} Descargando {staged_path.name}")
                    download_jpeg(sized_url, staged_path)
                    source_cache[sized_url] = staged_path
                    time.sleep(0.15)

        for path, records in catalogs:
            localized_catalogs.append(
                (
                    path,
                    [
                        localized_record(record, get_source_url(record))
                        for record in records
                    ],
                )
            )

        COVER_DIR.mkdir(parents=True, exist_ok=True)
        for staged_path in staging_dir.glob("*.jpg"):
            os.replace(staged_path, COVER_DIR / staged_path.name)

        for path, records in localized_catalogs:
            write_catalog(path, records)

    if not validate_catalogs(localized_catalogs):
        raise RuntimeError("La validación final no fue satisfactoria.")


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
            "El catálogo no se cambió. Revisa tu conexión y vuelve a intentarlo.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
