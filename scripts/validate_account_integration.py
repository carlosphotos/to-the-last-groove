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
styles = (ROOT / "styles.css").read_text(encoding="utf-8")
rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
config = (ROOT / "firebase-config.js").read_text(encoding="utf-8")

required_ids = {
    "headerAccount", "headerAccountAvatar", "headerAccountLabel",
    "collectionSync", "collectionSyncAvatar", "collectionSyncEyebrow",
    "collectionSyncTitle", "collectionSyncDescription", "collectionSignIn",
    "collectionSignOut", "collectionSyncStatus",
    "collectionServicePreference", "collectionServiceEyebrow",
    "collectionServiceTitle", "collectionServiceDescription",
    "collectionServiceOptions",
}
html_ids = re.findall(r'\bid="([^"]+)"', html)
for element_id in required_ids:
    require(html_ids.count(element_id) == 1, f"missing or repeated #{element_id}")

script_order = [
    'href="styles.css?v=8.3"',
    'src="translations.js?v=8.3"',
    'src="firebase-config.js?v=8.3"',
    'src="app.js?v=8.3"',
    'type="module" src="account.js?v=8.3"',
]
positions = [html.find(fragment) for fragment in script_order]
require(all(position >= 0 for position in positions), "account scripts are incomplete")
require(positions == sorted(positions), "account scripts load in the wrong order")
require(
    html.find('class="platform-links"') < html.find('id="openListeningNote"'),
    "the primary listening action must appear before the editorial note",
)

for fragment in (
    "tlg-collection-anonymous",
    "tlg-collection-user-${userId}",
    "tlg-progress-change",
    "useUserCollection",
    "useAnonymousCollection",
    "openListeningNoteForRecord",
    "getQuickListenDestination",
    "renderListeningPreference",
    "collection-choose-service",
    "getMatchingRecords",
    "getCycleProgressIds",
    "syncRecommendationCycleWithCollection",
    "getSpotifyAppUri",
    "renderRecommendationStreamingHierarchy",
    "isCompleteCollectionRecord",
):
    require(fragment in app, f"progress adapter is missing {fragment!r}")

for fragment in (
    'const FIREBASE_SDK_VERSION = "12.16.0"',
    "signInWithPopup",
    "browserLocalPersistence",
    "onAuthStateChanged",
    "onSnapshot",
    '"users"',
    "mergeProgress",
    "cleanedProgress",
):
    require(fragment in account, f"account integration is missing {fragment!r}")

require("signInWithRedirect" not in account, "mobile auth still forces redirect sign-in")
require("Curated listening" not in html, "the old logo kicker is still visible")
require('class="logo-rule"' in html, "the logo rule is missing")
for fragment in (
    ".collection-item {",
    "flex-direction: column;",
    ".collection-listen-action {",
    ".logo-rule {",
    ".platform-link.is-primary {",
    "overflow-x: hidden;",
    ".recommendation-area.is-song .record-stage {",
    "width: 270px;",
):
    require(fragment in styles, f"layout polish is missing {fragment!r}")

require(translations.count("signedOutTitle") == 3, "account copy is not trilingual")
require(translations.count("headerSignIn") == 3, "header account copy is not trilingual")
require(translations.count("openNoteLabel") == 3, "collection note copy is not trilingual")
require(translations.count("quickListenLabel") == 3, "collection listening copy is not trilingual")
require(translations.count("preferenceTitle") == 3, "service preference copy is not trilingual")
require(translations.count("chooseServiceLabel") == 3, "service chooser copy is not trilingual")
require(translations.count("primaryListen") == 3, "primary listening action is not trilingual")
require("window.TLG_FIREBASE_CONFIG" in config, "Firebase config hook is missing")
require("request.auth.uid == userId" in rules, "Firestore rules do not isolate users")
require("collection.size() <= 200" in rules, "Firestore rules do not cap progress")

print("OK: optional Google sign-in, namespaced local progress, trilingual UI and per-user Firestore rules validated.")
