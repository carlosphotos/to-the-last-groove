#!/usr/bin/env python3
"""Validate the draft master catalog, edition and permanent ID registry."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"ERROR: {message}")


master = load(DATA / "catalog" / "master.json")
edition = load(DATA / "editions" / f"{master['editionId']}.json")
registry = load(DATA / "catalog" / "id-registry.json")
records = master["records"]

require(len(records) == 200, f"expected 200 master records, found {len(records)}")
require(len({record['id'] for record in records}) == 200, "active IDs are not unique")
require(len({(record['type'], record['artist'].casefold(), record['title'].casefold()) for record in records}) == 200, "active works are duplicated")

active_ids = {record["id"] for record in records}
registry_ids = [record["id"] for record in registry["records"]]
require(len(registry_ids) == len(set(registry_ids)), "an ID appears twice in the registry")
require(active_ids.issubset(set(registry_ids)), "an active ID is missing from the registry")

for record_type, edition_key in (("album", "albums"), ("song", "songs")):
    selected = [record for record in records if record["type"] == record_type]
    require(len(selected) == 100, f"expected 100 {record_type} records")
    roles = Counter(record["monthlyRole"] for record in selected)
    require(roles == Counter({"Ancla": 70, "Rotación": 20, "Foco mensual": 10}), f"invalid {record_type} roles: {dict(roles)}")
    artists = Counter(record["artist"] for record in selected)
    require(max(artists.values()) <= 2, f"more than two {record_type} works by one artist")
    edition_ids = {item["id"] for item in edition[edition_key]}
    require(edition_ids == {record["id"] for record in selected}, f"edition {edition_key} do not match master")

required_statuses = {"metadata", "cover", "streaming", "editorial", "essentialReason"}
for record in records:
    require(set(record["status"]) == required_statuses, f"incomplete status block: {record['id']}")
    if master.get("releaseStatus") == "ready-for-publication":
        require(record["publishable"] is True, f"ready record is not publishable: {record['id']}")
    else:
        require(record["publishable"] is False, f"draft record was marked publishable: {record['id']}")

print("OK: 200 records, stable IDs, 70/20/10 roles per format, edition references and publication gates validated.")
