#!/usr/bin/env python3
"""Static checks for optional Firebase progress synchronization."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"ERROR: {message}")


html = (ROOT / "index.html").read_text(encoding="utf-8")
app = (ROOT / "app.js").read_text(encoding="utf-8")
account = (ROOT / "account.js").read_text(encoding="utf-8")
translations = (ROOT / "translations.js").read_text(encoding="utf-8")
rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
config = (ROOT / "firebase-config.js").read_text(encoding="utf-8")

required_ids = {
    "headerAccount", "headerAccountAvatar", "headerAccountLabel",
    "collectionSync", "collectionSyncAvatar", "collectionSyncEyebrow",
    "collectionSyncTitle", "collectionSyncDescription", "collectionSignIn",
    "collectionSignOut", "collectionSyncStatus",
}
html_ids = re.findall(r'\bid="([^"]+)"', html)
for element_id in required_ids:
    require(html_ids.count(element_id) == 1, f"missing or repeated #{element_id}")

script_order = [
    'src="translations.js?v=7.8"',
    'src="firebase-config.js?v=7.8"',
    'src="app.js?v=7.8"',
    'type="module" src="account.js?v=7.8"',
]
positions = [html.find(fragment) for fragment in script_order]
require(all(position >= 0 for position in positions), "account scripts are incomplete")
require(positions == sorted(positions), "account scripts load in the wrong order")

for fragment in (
    "tlg-collection-anonymous",
    "tlg-collection-user-${userId}",
    "tlg-progress-change",
    "useUserCollection",
    "useAnonymousCollection",
):
    require(fragment in app, f"progress adapter is missing {fragment!r}")

for fragment in (
    'const FIREBASE_SDK_VERSION = "12.16.0"',
    "signInWithPopup",
    "signInWithRedirect",
    "onAuthStateChanged",
    "onSnapshot",
    '"users"',
    "mergeProgress",
):
    require(fragment in account, f"account integration is missing {fragment!r}")

require(translations.count("signedOutTitle") == 3, "account copy is not trilingual")
require(translations.count("headerSignIn") == 3, "header account copy is not trilingual")
require("window.TLG_FIREBASE_CONFIG" in config, "Firebase config hook is missing")
require("request.auth.uid == userId" in rules, "Firestore rules do not isolate users")
require("collection.size() <= 200" in rules, "Firestore rules do not cap progress")

print("OK: optional Google sign-in, namespaced local progress, trilingual UI and per-user Firestore rules validated.")
