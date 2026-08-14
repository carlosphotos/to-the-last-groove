#!/usr/bin/env python3
"""Build the approved master catalog without publishing incomplete records.

The generated files are intentionally separate from data/albums.json and
data/songs.json. The visible site keeps using the current catalog until every
new record has verified artwork, direct streaming links and a trilingual note.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CATALOG_DIR = DATA / "catalog"
EDITIONS_DIR = DATA / "editions"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.casefold().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def record_key(record: dict) -> str:
    return f"{normalize(record['artist'])}|{normalize(record['title'])}"


def numeric_id(record_id: str) -> int:
    return int(record_id.rsplit("-", 1)[1])


def existing_editorial_ids(albums: list[dict]) -> set[str]:
    ids = {record["id"] for record in albums if record.get("editorial")}
    notes_path = DATA / "editorial-notes.json"
    if notes_path.exists():
        ids.update(note["id"] for note in load_json(notes_path))
    return ids


def previous_registry_ids() -> dict[str, str]:
    path = CATALOG_DIR / "id-registry.json"
    if not path.exists():
        return {}
    registry = load_json(path)
    return {
        entry["key"]: entry["id"]
        for entry in registry.get("records", [])
        if entry.get("key") and entry.get("id")
    }


def build_format(
    approved_records: list[dict],
    current_records: list[dict],
    record_type: str,
    edition_id: str,
    editorial_ids: set[str],
    preserved_ids: dict[str, str],
) -> tuple[list[dict], list[dict], dict]:
    current_by_key = {record_key(record): record for record in current_records}
    used_ids = {record["id"] for record in current_records}
    used_ids.update(preserved_ids.values())
    next_number = max((numeric_id(value) for value in used_ids if value.startswith(f"{record_type}-")), default=0) + 1

    master_records = []
    matched_ids = set()
    created_ids = []

    for approved in approved_records:
        key = record_key(approved)
        current = current_by_key.get(key)
        record_id = current["id"] if current else preserved_ids.get(f"{record_type}:{key}")
        if not record_id:
            while f"{record_type}-{next_number:03d}" in used_ids:
                next_number += 1
            record_id = f"{record_type}-{next_number:03d}"
            used_ids.add(record_id)
            created_ids.append(record_id)
            next_number += 1
        if current:
            matched_ids.add(current["id"])

        cover_ready = bool(current and current.get("coverUrl"))
        editorial_ready = record_id in editorial_ids
        statuses = {
            "metadata": "curated",
            "cover": "existing-to-verify" if cover_ready else "pending",
            "streaming": "pending-direct-links",
            "editorial": "existing-to-review" if editorial_ready else "pending-three-languages",
            "essentialReason": "existing-to-review" if current else "pending-three-languages",
        }

        master_records.append({
            "id": record_id,
            "type": record_type,
            "artist": approved["artist"],
            "title": approved["title"],
            "year": approved["year"],
            "decade": str(approved["year"] // 10 * 10),
            "country": approved["country"],
            "genre": approved["genre"],
            "selectionLayer": approved["layer"],
            "monthlyRole": approved["monthlyRole"],
            "sourceRoute": approved["sourceRoute"],
            "editionIntroduced": edition_id,
            "legacyCatalogId": current["id"] if current else None,
            "status": statuses,
            "publishable": False,
        })

    retired = [
        {
            "id": record["id"],
            "type": record_type,
            "key": f"{record_type}:{record_key(record)}",
            "artist": record["artist"],
            "title": record["title"],
            "status": "legacy-not-in-edition",
        }
        for record in current_records
        if record["id"] not in matched_ids
    ]

    stats = {
        "approved": len(master_records),
        "preservedExistingIds": len(matched_ids),
        "newStableIds": len(created_ids),
        "legacyIdsReserved": len(retired),
        "roles": dict(Counter(record["monthlyRole"] for record in master_records)),
    }
    return master_records, retired, stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("selection", type=Path, help="Approved selection JSON")
    args = parser.parse_args()

    selection = load_json(args.selection)
    if selection.get("status") != "approved":
        raise SystemExit("The selection must have status=approved")

    current_albums = load_json(DATA / "albums.json")
    current_songs = load_json(DATA / "songs.json")
    editorials = existing_editorial_ids(current_albums)
    prior_ids = previous_registry_ids()

    albums, retired_albums, album_stats = build_format(
        selection["albums"], current_albums, "album", selection["editionId"], editorials,
        {key: value for key, value in prior_ids.items() if key.startswith("album:")},
    )
    songs, retired_songs, song_stats = build_format(
        selection["songs"], current_songs, "song", selection["editionId"], editorials,
        {key: value for key, value in prior_ids.items() if key.startswith("song:")},
    )

    master = {
        "schemaVersion": 1,
        "editionId": selection["editionId"],
        "approvedAt": selection["approvedAt"],
        "releaseStatus": "draft-enrichment",
        "publicationRule": "A record is publishable only with verified metadata, optimized local cover, exact streaming links, essential reason and a reviewed editorial note in ES/EN/FR.",
        "records": albums + songs,
    }

    registry_records = [
        {
            "id": record["id"],
            "type": record["type"],
            "key": f"{record['type']}:{record_key(record)}",
            "artist": record["artist"],
            "title": record["title"],
            "status": "active-draft",
        }
        for record in master["records"]
    ] + retired_albums + retired_songs

    edition = {
        "schemaVersion": 1,
        "id": selection["editionId"],
        "label": {"es": "Edición inaugural", "en": "Inaugural edition", "fr": "Édition inaugurale"},
        "releaseStatus": "draft-enrichment",
        "rules": {
            "perFormat": {"anchors": 70, "rotation": 20, "monthlyFocus": 10},
            "rotationRestMonths": 3,
            "archiveEveryEdition": True,
            "replaceListenedImmediately": True,
        },
        "focus": {
            "id": "less-obvious-routes",
            "title": {"es": "Rutas menos obvias", "en": "Less obvious routes", "fr": "Chemins moins évidents"},
        },
        "microSelections": [{
            "id": "france-chanson-french-touch",
            "title": {"es": "Chanson y French Touch", "en": "Chanson and French Touch", "fr": "Chanson et French Touch"},
            "rule": "Present across the edition without forcing an artificial quota.",
        }],
        "albums": [{"id": record["id"], "role": record["monthlyRole"]} for record in albums],
        "songs": [{"id": record["id"], "role": record["monthlyRole"]} for record in songs],
    }

    vault_rules = {
        "schemaVersion": 1,
        "storageKey": "tlg-vault-v1",
        "legacyStorageKey": "tlg-collection",
        "distinction": {
            "saved": "Stays in My Collection and may remain recommendable.",
            "listened": "Moves to the personal Vault and is excluded from recommendations by default.",
        },
        "vaultRecord": ["id", "type", "artist", "title", "listenedAt", "editionId", "snapshot"],
        "replacementRule": "Use a reserve of the same format and, when possible, the same decade or genre.",
        "editionArchiveIsSeparate": True,
    }

    write_json(CATALOG_DIR / "master.json", master)
    write_json(CATALOG_DIR / "id-registry.json", {
        "schemaVersion": 1,
        "note": "IDs are permanent. Legacy IDs are reserved and must never be reused for another work.",
        "records": sorted(registry_records, key=lambda item: (item["type"], numeric_id(item["id"]))),
    })
    write_json(CATALOG_DIR / "vault-rules.json", vault_rules)
    write_json(EDITIONS_DIR / f"{selection['editionId']}.json", edition)
    write_json(DATA / "selections" / f"{selection['editionId']}-approved.json", selection)
    write_json(DATA / "source-registry.json", {
        "schemaVersion": 1,
        "verificationStatus": "routes-to-contrast",
        "sources": selection["sources"],
    })

    report = {"edition": selection["editionId"], "albums": album_stats, "songs": song_stats}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
