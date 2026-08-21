#!/usr/bin/env python3
"""Static checks for optional Firebase progress synchronization."""

from __future__ import annotations

import re
import json
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
pwa = (ROOT / "pwa.js").read_text(encoding="utf-8")
service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))

required_ids = {
    "headerAccount", "headerAccountAvatar", "headerAccountLabel",
    "collectionSync", "collectionSyncAvatar", "collectionSyncEyebrow",
    "collectionSyncTitle", "collectionSyncDescription", "collectionSignIn",
    "collectionSignOut", "collectionSyncStatus",
    "collectionServicePreference", "collectionServiceEyebrow",
    "collectionServiceTitle", "collectionServiceDescription",
    "collectionServiceOptions",
    "installApp", "installAppLabel", "favoriteButton",
    "addToPlaylistButton", "reactionActions",
    "collectionListenedTab", "collectionFavoritesTab",
    "collectionPlaylistsTab", "playlistDialog", "playlistCreateForm",
    "playlistName", "playlistOptions", "aboutListeningTitle",
    "aboutListeningSummary", "pwaInstallDialog", "closePwaInstall",
    "mobileCollection", "mobileCollectionCount", "editionLabel",
    "shareRecordButton", "reactionPanel", "reactionPrompt",
    "shareDialog", "sharePosterCanvas", "sharePosterButton",
    "downloadPosterButton", "copyShareLinkButton", "shareStatus",
    "listeningNoteScreenSection", "listeningNoteScreenTitle",
    "listeningNoteScreenAppearances",
}
html_ids = re.findall(r'\bid="([^"]+)"', html)
for element_id in required_ids:
    require(html_ids.count(element_id) == 1, f"missing or repeated #{element_id}")

script_order = [
    'href="styles.css?v=8.9"',
    'src="translations.js?v=8.9"',
    'src="firebase-config.js?v=8.9"',
    'src="app.js?v=8.9"',
    'src="pwa.js?v=8.9"',
    'type="module" src="account.js?v=8.9"',
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
    "tlg-profile-change",
    "tlg-profile-anonymous",
    "useUserCollection",
    "useAnonymousCollection",
    "useUserProfile",
    "useAnonymousProfile",
    "clearAnonymousProfile",
    "getProfile",
    "toggleFavorite",
    "setRecordRating",
    "createPlaylist",
    "renderPlaylistOverview",
    "renderAboutListeningStats",
    "openListeningNoteForRecord",
    "getQuickListenDestination",
    "renderListeningPreference",
    "collection-choose-service",
    "getMatchingRecords",
    "getCycleProgressIds",
    "syncRecommendationCycleWithCollection",
    "renderRecommendationStreamingHierarchy",
    "isCompleteCollectionRecord",
    "getRequestedCatalogRecord",
    "getShareUrl",
    "renderSharePoster",
    "shareCurrentPoster",
    "navigator.canShare",
    "screenAppearancesById",
    "screen-appearances.json",
):
    require(fragment in app, f"progress adapter is missing {fragment!r}")

for fragment in (
    'const FIREBASE_SDK_VERSION = "12.16.0"',
    "signInWithPopup",
    "browserLocalPersistence",
    "onAuthStateChanged",
    "onSnapshot",
    '"users"',
    "mergeProfiles",
    "profileSignature",
    "writeRemoteProfile",
    "pendingProfile",
    'schemaVersion: 2',
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
    ".recommendation-personal-actions {",
    ".collection-tabs {",
    ".playlist-dialog,",
    ".about-listening-plan {",
    ".header-install {",
    ".header-collection {",
    ".share-dialog {",
    ".reaction-panel {",
    ".listening-note-main {",
    ".listening-note-screen-footer[hidden] {",
    ".screen-appearance-item {",
):
    require(fragment in styles, f"layout polish is missing {fragment!r}")

require(translations.count("signedOutTitle") == 3, "account copy is not trilingual")
require(translations.count("headerSignIn") == 3, "header account copy is not trilingual")
require(translations.count("openNoteLabel") == 3, "collection note copy is not trilingual")
require(translations.count("quickListenLabel") == 3, "collection listening copy is not trilingual")
require(translations.count("preferenceTitle") == 3, "service preference copy is not trilingual")
require(translations.count("chooseServiceLabel") == 3, "service chooser copy is not trilingual")
require(translations.count("primaryListenAlbum") == 3, "album listening action is not trilingual")
require(translations.count("primaryListenSong") == 3, "song listening action is not trilingual")
require(translations.count("favoritesTab") == 3, "favorites copy is not trilingual")
require(translations.count("playlistsTab") == 3, "playlist copy is not trilingual")
require(translations.count("ratingLike") == 6, "rating copy is not trilingual")
require(translations.count("albumCadence") == 3, "listening cadence copy is not trilingual")
require(translations.count("installLabel") == 3, "PWA copy is not trilingual")
require(translations.count("shareText") == 3, "sharing copy is not trilingual")
require(translations.count("reactionPrompt") == 3, "post-listen copy is not trilingual")
require(translations.count("screenAppearances") == 3, "screen appearance copy is not trilingual")
require(
    'class="listening-note-screen-footer listening-note-section"' in html,
    "screen appearances do not share the listening-note visual language",
)
require(
    "content.href = appearance.sourceUrl" not in app,
    "screen appearances expose a source link in the interface",
)
require(
    'title.textContent = `${appearance.title} ↗`' not in app,
    "screen appearances still show a link arrow",
)
require("window.TLG_FIREBASE_CONFIG" in config, "Firebase config hook is missing")
require("request.auth.uid == userId" in rules, "Firestore rules do not isolate users")
require("collection.size() <= 200" in rules, "Firestore rules do not cap progress")
require("favorites.size() <= 200" in rules, "Firestore rules do not cap favorites")
require("ratings.size() <= 200" in rules, "Firestore rules do not cap ratings")
require("playlists.size() <= 20" in rules, "Firestore rules do not cap playlists")
require("request.resource.data.schemaVersion == 2" in rules, "Firestore rules are not on profile schema v2")

require('rel="manifest" href="manifest.webmanifest?v=8.9"' in html, "PWA manifest is not linked")
require("beforeinstallprompt" in pwa, "PWA install prompt is missing")
require("serviceWorker.register" in pwa, "service worker registration is missing")
require('const CACHE_VERSION = "tlg-v8.9"' in service_worker, "service worker cache is stale")
require(manifest.get("display") == "standalone", "PWA does not use standalone display")
icon_sizes = {icon.get("sizes") for icon in manifest.get("icons", [])}
require({"192x192", "512x512"} <= icon_sizes, "PWA install icons are incomplete")
for icon in manifest.get("icons", []):
    require((ROOT / icon["src"]).is_file(), f"missing PWA icon {icon['src']}")

print("OK: installable PWA, trilingual profile, namespaced local progress and per-user Firestore rules validated.")
