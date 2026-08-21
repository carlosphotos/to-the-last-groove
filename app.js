const translations = window.TLG_TRANSLATIONS;
const catalogVersion = "9.0";

const languageOrder = ["es", "en", "fr"];
const coverColors = {
  "cover-blue": "#2946a8",
  "cover-red": "#d95838",
  "cover-green": "#28574e",
  "cover-yellow": "#c89117",
  "cover-purple": "#67284d"
};
const editorialRoleKeys = {
  "Ancla": "anchor",
  "Rotación": "rotation",
  "Foco mensual": "focus"
};
const legacyCollectionStorageKey = "tlg-collection";
const anonymousCollectionStorageKey = "tlg-collection-anonymous";
const anonymousProfileStorageKey = "tlg-profile-anonymous";
const listeningPlatformStorageKey = "tlg-listening-platform";
const ratingValues = new Set(["like", "meh", "dislike"]);
const listeningPlatformOrder = [
  "spotify",
  "appleMusic",
  "youtubeMusic"
];
const listeningPlatformNames = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtubeMusic: "YouTube Music"
};
let activeCollectionStorageKey = anonymousCollectionStorageKey;
let activeProfileStorageKey = anonymousProfileStorageKey;
let resolveCatalogReady;
const catalogReady = new Promise((resolve) => {
  resolveCatalogReady = resolve;
});

const savedProfile = getSavedProfile();
const state = {
  language: getSavedLanguage(),
  format: "album",
  records: [],
  current: null,
  recommendationQueue: [],
  seenRecommendationsByFilter: new Map(),
  currentFilterKey: null,
  completedCycle: null,
  lastFilterChanged: "decade",
  collection: getSavedCollection(),
  favorites: savedProfile.favorites,
  ratings: savedProfile.ratings,
  playlists: savedProfile.playlists,
  collectionView: "listened",
  activePlaylistId: null,
  playlistDialogRecordId: null
};

const coverPreloadImages = new Map();
const maxPreloadedCovers = 50;
const recommendationQueueSize = 3;
let fixedStackScheduled = false;
let collectionRenderSignature = "";
let sharePosterCache = {
  key: null,
  blob: null
};

const elements = {
  metaDescription: document.querySelector('meta[name="description"]'),
  mainNav: document.querySelector(".main-nav"),
  navLinks: [...document.querySelectorAll(".nav-link")],
  languageOptions: [
    ...document.querySelectorAll(".language-option")
  ],

  eyebrow: document.querySelector(".discovery-controls .eyebrow"),
  question: document.querySelector(".discovery-controls h1"),
  formatSelector: document.querySelector(".format-selector"),
  formatButtons: [...document.querySelectorAll(".format-button")],

  filterLabels: [...document.querySelectorAll(".filter-field > span")],
  decadeFilter: document.querySelector("#decadeFilter"),
  genreFilter: document.querySelector("#genreFilter"),
  discoverButton: document.querySelector("#discoverButton"),
  filterMessage: document.querySelector("#filterMessage"),

  recommendationArea: document.querySelector(".recommendation-area"),
  recommendationCard: document.querySelector(".recommendation-card"),
  featuredRecord: document.querySelector("#featuredRecord"),
  stackCovers: [...document.querySelectorAll(".stack-cover")],
  coverArt: document.querySelector("#coverArt"),
  coverImage: document.querySelector("#coverImage"),
  coverArtist: document.querySelector("#coverArtist"),
  coverTitle: document.querySelector("#coverTitle"),
  coverYear: document.querySelector("#coverYear"),
  catalogueNumber: document.querySelector("#catalogueNumber"),

  staffPick: document.querySelector(".staff-pick"),
  editionLabel: document.querySelector("#editionLabel"),
  recommendationCycle: document.querySelector("#recommendationCycle"),
  recommendationCycleLabel: document.querySelector(
    "#recommendationCycleLabel"
  ),
  recommendationCycleCount: document.querySelector(
    "#recommendationCycleCount"
  ),
  recommendationCycleTrack: document.querySelector(
    "#recommendationCycleTrack"
  ),
  recommendationCycleProgress: document.querySelector(
    "#recommendationCycleProgress"
  ),
  recommendationCycleMessage: document.querySelector(
    "#recommendationCycleMessage"
  ),
  recommendationTitle: document.querySelector("#recommendationTitle"),
  recommendationArtist: document.querySelector("#recommendationArtist"),
  recommendationDetails: document.querySelector("#recommendationDetails"),
  recommendationDescription: document.querySelector(
    "#recommendationDescription"
  ),
  openListeningNote: document.querySelector("#openListeningNote"),
  listeningNoteDialog: document.querySelector("#listeningNoteDialog"),
  closeListeningNote: document.querySelector("#closeListeningNote"),
  listeningNoteEyebrow: document.querySelector("#listeningNoteEyebrow"),
  listeningNoteReadTime: document.querySelector("#listeningNoteReadTime"),
  listeningNoteTitle: document.querySelector("#listeningNoteTitle"),
  listeningNoteArtist: document.querySelector("#listeningNoteArtist"),
  listeningNoteCoverImage: document.querySelector(
    "#listeningNoteCoverImage"
  ),
  listeningNoteReview: document.querySelector("#listeningNoteReview"),
  listeningNoteRoleSection: document.querySelector(
    "#listeningNoteRoleSection"
  ),
  listeningNoteRoleTitle: document.querySelector(
    "#listeningNoteRoleTitle"
  ),
  listeningNoteRoleLabel: document.querySelector(
    "#listeningNoteRoleLabel"
  ),
  listeningNoteRoleDescription: document.querySelector(
    "#listeningNoteRoleDescription"
  ),
  listeningNoteListenForTitle: document.querySelector(
    "#listeningNoteListenForTitle"
  ),
  listeningNoteListenFor: document.querySelector("#listeningNoteListenFor"),
  listeningNoteEntrySection: document.querySelector(
    "#listeningNoteEntrySection"
  ),
  listeningNoteEntryTitle: document.querySelector("#listeningNoteEntryTitle"),
  listeningNoteEntryTrack: document.querySelector("#listeningNoteEntryTrack"),
  listeningNoteEntryReason: document.querySelector("#listeningNoteEntryReason"),
  listeningNoteListenLabel: document.querySelector(
    "#listeningNoteListenLabel"
  ),
  listeningNotePlatforms: document.querySelector(
    "#listeningNotePlatforms"
  ),
  listeningNoteSpotify: document.querySelector("#listeningNoteSpotify"),
  listeningNoteAppleMusic: document.querySelector(
    "#listeningNoteAppleMusic"
  ),
  listeningNoteYouTubeMusic: document.querySelector(
    "#listeningNoteYouTubeMusic"
  ),
  listeningNoteSourcesTitle: document.querySelector(
    "#listeningNoteSourcesTitle"
  ),
  listeningNoteSources: document.querySelector("#listeningNoteSources"),
  listeningNoteSourcesSection: document.querySelector(
    ".listening-note-sources"
  ),
  listeningNoteScreenSection: document.querySelector(
    "#listeningNoteScreenSection"
  ),
  listeningNoteScreenTitle: document.querySelector(
    "#listeningNoteScreenTitle"
  ),
  listeningNoteScreenAppearances: document.querySelector(
    "#listeningNoteScreenAppearances"
  ),

  platformLabel: document.querySelector("#platformLabel"),
  platformLinks: document.querySelector(".platform-links"),
  spotifyLink: document.querySelector("#spotifyLink"),
  appleMusicLink: document.querySelector("#appleMusicLink"),
  youtubeMusicLink: document.querySelector("#youtubeMusicLink"),
  heardButton: document.querySelector("#heardButton"),
  anotherButton: document.querySelector("#anotherButton"),
  favoriteButton: document.querySelector("#favoriteButton"),
  addToPlaylistButton: document.querySelector("#addToPlaylistButton"),
  shareRecordButton: document.querySelector("#shareRecordButton"),
  reactionPanel: document.querySelector("#reactionPanel"),
  reactionPrompt: document.querySelector("#reactionPrompt"),
  reactionActions: document.querySelector("#reactionActions"),
  ratingButtons: [...document.querySelectorAll("[data-rating]")],

  openCollection: document.querySelector("#openCollection"),
  mobileCollection: document.querySelector("#mobileCollection"),
  mobileCollectionLabel: document.querySelector("#mobileCollectionLabel"),
  mobileCollectionCount: document.querySelector("#mobileCollectionCount"),
  closeCollection: document.querySelector("#closeCollection"),
  collectionDialog: document.querySelector("#collectionDialog"),
  collectionGrid: document.querySelector("#collectionGrid"),
  collectionCount: document.querySelector("#collectionCount"),
  collectionEyebrow: document.querySelector(".collection-header .eyebrow"),
  collectionTitle: document.querySelector(".collection-header h2"),
  collectionServicePreference: document.querySelector(
    "#collectionServicePreference"
  ),
  collectionServiceEyebrow: document.querySelector(
    "#collectionServiceEyebrow"
  ),
  collectionServiceTitle: document.querySelector(
    "#collectionServiceTitle"
  ),
  collectionServiceDescription: document.querySelector(
    "#collectionServiceDescription"
  ),
  collectionServiceOptions: document.querySelector(
    "#collectionServiceOptions"
  ),
  listeningPlatformButtons: [
    ...document.querySelectorAll("[data-listening-platform]")
  ],
  collectionTabs: [...document.querySelectorAll("[data-collection-view]")],
  collectionTabsLabel: document.querySelector(".collection-tabs"),
  collectionListenedCount: document.querySelector("#collectionListenedCount"),
  collectionFavoritesCount: document.querySelector("#collectionFavoritesCount"),
  collectionPlaylistsCount: document.querySelector("#collectionPlaylistsCount"),

  playlistDialog: document.querySelector("#playlistDialog"),
  closePlaylistDialog: document.querySelector("#closePlaylistDialog"),
  playlistDialogEyebrow: document.querySelector("#playlistDialogEyebrow"),
  playlistDialogTitle: document.querySelector("#playlistDialogTitle"),
  playlistDialogRecord: document.querySelector("#playlistDialogRecord"),
  playlistCreateForm: document.querySelector("#playlistCreateForm"),
  playlistName: document.querySelector("#playlistName"),
  playlistNameLabel: document.querySelector("#playlistNameLabel"),
  createPlaylistButton: document.querySelector("#createPlaylistButton"),
  playlistOptions: document.querySelector("#playlistOptions"),
  playlistDialogNote: document.querySelector("#playlistDialogNote"),

  shareDialog: document.querySelector("#shareDialog"),
  closeShareDialog: document.querySelector("#closeShareDialog"),
  shareDialogEyebrow: document.querySelector("#shareDialogEyebrow"),
  shareDialogTitle: document.querySelector("#shareDialogTitle"),
  shareDialogDescription: document.querySelector("#shareDialogDescription"),
  sharePosterCanvas: document.querySelector("#sharePosterCanvas"),
  sharePosterButton: document.querySelector("#sharePosterButton"),
  downloadPosterButton: document.querySelector("#downloadPosterButton"),
  copyShareLinkButton: document.querySelector("#copyShareLinkButton"),
  shareStatus: document.querySelector("#shareStatus"),
  shareHint: document.querySelector("#shareHint"),

  openAbout: document.querySelector("#openAbout"),
  openAboutFooter: document.querySelector("#openAboutFooter"),
  closeAbout: document.querySelector("#closeAbout"),
  aboutDialog: document.querySelector("#aboutDialog"),
  aboutEyebrow: document.querySelector("#aboutEyebrow"),
  aboutTitle: document.querySelector("#aboutTitle"),
  aboutIntro: document.querySelector("#aboutIntro"),
  aboutBody: document.querySelector("#aboutBody"),
  aboutMethod: document.querySelector("#aboutMethod"),
  aboutNote: document.querySelector("#aboutNote"),
  aboutListeningTitle: document.querySelector("#aboutListeningTitle"),
  aboutListeningSummary: document.querySelector("#aboutListeningSummary"),
  aboutSongCadence: document.querySelector("#aboutSongCadence"),
  aboutAlbumCadence: document.querySelector("#aboutAlbumCadence"),

  footerAbout: document.querySelector("#openAboutFooter"),
  footerPhrase: document.querySelector(".site-footer p:last-child")
};

const filterOptionValues = {
  decades: [...elements.decadeFilter.options]
    .slice(1)
    .map((option) => option.value),
  genres: [...elements.genreFilter.options]
    .slice(1)
    .map((option) => option.value)
};

function getSavedLanguage() {
  const requestedLanguage = new URLSearchParams(
    window.location.search
  ).get("lang");

  if (languageOrder.includes(requestedLanguage)) {
    return requestedLanguage;
  }

  const savedLanguage = localStorage.getItem("tlg-language");

  return languageOrder.includes(savedLanguage)
    ? savedLanguage
    : "es";
}

function getSavedCollection() {
  const readCollection = (storageKey) => {
    const rawValue = localStorage.getItem(storageKey);

    if (rawValue === null) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  };

  try {
    const savedCollection = readCollection(
      activeCollectionStorageKey
    );

    if (savedCollection !== null) {
      return savedCollection;
    }

    const legacyCollection = readCollection(
      legacyCollectionStorageKey
    ) || [];

    localStorage.setItem(
      anonymousCollectionStorageKey,
      JSON.stringify(legacyCollection)
    );

    return legacyCollection;
  } catch (error) {
    console.error("No se pudo recuperar la colección:", error);
    return [];
  }
}

function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  const parsedDate = Date.parse(value || "");
  return Number.isFinite(parsedDate)
    ? new Date(parsedDate).toISOString()
    : fallback;
}

function isCatalogRecordId(value) {
  return /^(album|song)-\d{3}$/.test(String(value || ""));
}

function normalizeProfilePayload(profile = {}) {
  const favorites = [...new Set(
    (Array.isArray(profile.favorites) ? profile.favorites : [])
      .filter(isCatalogRecordId)
  )].slice(0, 200);
  const ratingsById = new Map();

  (Array.isArray(profile.ratings) ? profile.ratings : []).forEach((entry) => {
    if (!isCatalogRecordId(entry?.id) || !ratingValues.has(entry?.value)) {
      return;
    }

    const normalized = {
      id: entry.id,
      value: entry.value,
      updatedAt: normalizeIsoDate(entry.updatedAt)
    };
    const previous = ratingsById.get(entry.id);

    if (!previous || normalized.updatedAt >= previous.updatedAt) {
      ratingsById.set(entry.id, normalized);
    }
  });

  const playlistsById = new Map();
  (Array.isArray(profile.playlists) ? profile.playlists : []).forEach(
    (playlist) => {
      const name = String(playlist?.name || "").trim().slice(0, 60);
      const id = String(playlist?.id || "");

      if (!id.startsWith("playlist-") || !name) {
        return;
      }

      const normalized = {
        id,
        name,
        recordIds: [...new Set(
          (Array.isArray(playlist.recordIds) ? playlist.recordIds : [])
            .filter(isCatalogRecordId)
        )].slice(0, 200),
        createdAt: normalizeIsoDate(playlist.createdAt),
        updatedAt: normalizeIsoDate(playlist.updatedAt)
      };
      const previous = playlistsById.get(id);

      if (!previous || normalized.updatedAt >= previous.updatedAt) {
        playlistsById.set(id, normalized);
      }
    }
  );

  return {
    favorites,
    ratings: [...ratingsById.values()]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .slice(0, 200),
    playlists: [...playlistsById.values()]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .slice(0, 20)
  };
}

function getSavedProfile() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(activeProfileStorageKey) || "{}"
    );
    return normalizeProfilePayload(stored);
  } catch (error) {
    console.error("No se pudo recuperar el perfil musical:", error);
    return normalizeProfilePayload();
  }
}

function getProfileProgress() {
  return {
    schemaVersion: 2,
    collection: getCollectionProgress(),
    favorites: [...state.favorites],
    ratings: state.ratings.map((entry) => ({ ...entry })),
    playlists: state.playlists.map((playlist) => ({
      ...playlist,
      recordIds: [...playlist.recordIds]
    }))
  };
}

function persistProfile({ notify = false } = {}) {
  localStorage.setItem(
    activeProfileStorageKey,
    JSON.stringify({
      favorites: state.favorites,
      ratings: state.ratings,
      playlists: state.playlists
    })
  );

  if (notify) {
    window.dispatchEvent(new CustomEvent(
      "tlg-profile-change",
      { detail: getProfileProgress() }
    ));
  }
}

function readProfileFromStorage(profileStorageKey, collectionStorageKey) {
  let storedProfile = {};

  try {
    storedProfile = JSON.parse(
      localStorage.getItem(profileStorageKey) || "{}"
    );
  } catch (error) {
    console.error("No se pudo recuperar el perfil guardado:", error);
  }

  return {
    schemaVersion: 2,
    collection: readProgressFromStorage(collectionStorageKey),
    ...normalizeProfilePayload(storedProfile)
  };
}

function replaceProfileProgress(profile, {
  profileStorageKey,
  collectionStorageKey
} = {}) {
  if (profileStorageKey) {
    activeProfileStorageKey = profileStorageKey;
  }

  const normalized = normalizeProfilePayload(profile);
  state.favorites = normalized.favorites;
  state.ratings = normalized.ratings;
  state.playlists = normalized.playlists;

  replaceCollectionProgress(
    Array.isArray(profile?.collection) ? profile.collection : [],
    collectionStorageKey
  );
  persistProfile();
  collectionRenderSignature = "";
  updatePersonalActions();
  renderCollection();

  return getProfileProgress();
}

function persistCollection({ notify = false } = {}) {
  localStorage.setItem(
    activeCollectionStorageKey,
    JSON.stringify(state.collection)
  );

  if (notify) {
    window.dispatchEvent(new CustomEvent(
      "tlg-progress-change",
      { detail: getCollectionProgress() }
    ));
  }
}

function getCollectionProgress() {
  return state.collection.map((record) => ({
    id: record.id,
    listenedAt: record.listenedAt
  }));
}

function isCompleteCollectionRecord(record) {
  return Boolean(
    record?.id &&
    record?.title &&
    record?.artist &&
    record?.type &&
    record?.year
  );
}

function readProgressFromStorage(storageKey) {
  try {
    const records = JSON.parse(
      localStorage.getItem(storageKey) || "[]"
    );

    return Array.isArray(records)
      ? records.map((record) => ({
          id: record.id,
          listenedAt: record.listenedAt
        }))
      : [];
  } catch (error) {
    console.error("No se pudo recuperar el progreso:", error);
    return [];
  }
}

function replaceCollectionProgress(progress, storageKey) {
  if (storageKey) {
    activeCollectionStorageKey = storageKey;
  }

  const uniqueProgress = new Map();

  (Array.isArray(progress) ? progress : []).forEach((entry) => {
    if (!entry?.id || uniqueProgress.has(entry.id)) {
      return;
    }

    uniqueProgress.set(entry.id, {
      id: entry.id,
      listenedAt: entry.listenedAt || new Date().toISOString()
    });
  });

  state.collection = [...uniqueProgress.values()].flatMap((entry) => {
    const currentRecord = state.records.find(
      (record) => record.id === entry.id
    );

    return currentRecord
      ? [{ ...currentRecord, listenedAt: entry.listenedAt }]
      : [];
  });

  persistCollection();
  updateHeardButton();
  updatePersonalActions();
  renderCollection();
  syncRecommendationCycleWithCollection({
    replaceListenedCurrent: true
  });

  return getCollectionProgress();
}

function getText() {
  return translations[state.language];
}

function replaceDirectText(element, text) {
  const textNode = [...element.childNodes].find(
    (node) =>
      node.nodeType === Node.TEXT_NODE &&
      node.textContent.trim()
  );

  if (textNode) {
    textNode.textContent = ` ${text} `;
  }
}

function interpolateText(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPreferredListeningPlatform() {
  const savedPlatform = localStorage.getItem(
    listeningPlatformStorageKey
  );

  return listeningPlatformOrder.includes(savedPlatform)
    ? savedPlatform
    : null;
}

function rememberListeningPlatform(platform) {
  if (listeningPlatformOrder.includes(platform)) {
    localStorage.setItem(listeningPlatformStorageKey, platform);
    renderListeningPreference();
  }
}

function renderListeningPreference() {
  const text = getText().collection;
  const preferredPlatform = getPreferredListeningPlatform();

  elements.collectionServiceEyebrow.textContent =
    text.preferenceEyebrow;
  elements.collectionServiceTitle.textContent =
    text.preferenceTitle;
  elements.collectionServiceDescription.textContent =
    text.preferenceDescription;
  elements.collectionServiceOptions.setAttribute(
    "aria-label",
    text.preferenceLabel
  );

  elements.listeningPlatformButtons.forEach((button) => {
    const isSelected =
      button.dataset.listeningPlatform === preferredPlatform;

    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  if (state.current) {
    renderRecommendationStreamingHierarchy();
  }
}

function renderRecommendationStreamingHierarchy(
  record = state.current
) {
  const text = getText().recommendation;
  const preferredPlatform = getPreferredListeningPlatform();
  const links = [
    [elements.spotifyLink, "spotify"],
    [elements.appleMusicLink, "appleMusic"],
    [elements.youtubeMusicLink, "youtubeMusic"]
  ].filter(([link, platform]) =>
    Boolean(record?.streaming?.[platform]?.url) && !link.hidden
  );
  const primaryEntry =
    links.find(([, platform]) => platform === preferredPlatform) ||
    links[0];

  elements.platformLabel.textContent =
    text.listenNow || text.listenOn;
  elements.platformLabel.hidden = links.length === 0;
  elements.platformLinks.hidden = links.length === 0;
  elements.platformLinks.classList.toggle(
    "has-alternatives",
    links.length > 1
  );
  elements.platformLinks.dataset.alternativeLabel =
    text.alsoOn || text.listenOn;

  [
    [elements.spotifyLink, "spotify"],
    [elements.appleMusicLink, "appleMusic"],
    [elements.youtubeMusicLink, "youtubeMusic"]
  ].forEach(([link, platform]) => {
    const isPrimary = primaryEntry?.[1] === platform;

    link.classList.toggle("is-primary", isPrimary);
    link.classList.toggle(
      "is-alternative",
      !link.hidden && !isPrimary
    );
    const primaryTemplate = record?.type === "song"
      ? text.primaryListenSong
      : text.primaryListenAlbum;
    link.textContent = isPrimary
      ? interpolateText(
          primaryTemplate || text.primaryListen || `${text.listenOn} {platform}`,
          { platform: listeningPlatformNames[platform] }
        )
      : listeningPlatformNames[platform];
  });
}

function getQuickListenDestination(record) {
  const preferredPlatform = getPreferredListeningPlatform();

  if (!preferredPlatform) {
    return null;
  }

  const orderedPlatforms = [
    preferredPlatform,
    ...listeningPlatformOrder.filter(
      (platform) => platform !== preferredPlatform
    )
  ];

  for (const platform of orderedPlatforms) {
    const url = record?.streaming?.[platform]?.url;

    if (url) {
      return {
        platform,
        platformName: listeningPlatformNames[platform],
        url
      };
    }
  }

  return null;
}

function updateDiscoverButtonLabel() {
  const discoveryText = getText().discovery;
  const labelsByFormat = {
    album: discoveryText.button,
    song: discoveryText.songButton,
    surprise: discoveryText.surpriseButton
  };

  elements.discoverButton.textContent =
    labelsByFormat[state.format] || discoveryText.button;
}

function updateEditorialRoleLabel(record = state.current) {
  const text = getText().recommendation;
  const roleKey = editorialRoleKeys[record?.monthlyRole] || "anchor";

  elements.staffPick.textContent =
    text.roles?.[roleKey] || text.essential;
  elements.staffPick.dataset.shortLabel =
    text.rolesShort?.[roleKey] || text.essentialShort;
  elements.staffPick.classList.remove(
    "role-anchor",
    "role-rotation",
    "role-focus"
  );
  elements.staffPick.classList.add(`role-${roleKey}`);
}

function formatEditionDate(editionId) {
  const match = String(editionId || "").match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(getText().locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function renderEditionLabel(record = state.current) {
  if (!elements.editionLabel) {
    return;
  }

  const editionDate = formatEditionDate(record?.editionId);
  elements.editionLabel.hidden = !editionDate;
  elements.editionLabel.textContent = editionDate
    ? interpolateText(getText().recommendation.edition, {
        date: editionDate
      })
    : "";
}

function renderListeningNoteRole(record = state.current) {
  const text = getText();
  const roleKey = editorialRoleKeys[record?.monthlyRole] || "anchor";

  elements.listeningNoteRoleTitle.textContent =
    text.editorial.selectionRole;
  elements.listeningNoteRoleLabel.textContent =
    text.recommendation.roles?.[roleKey] ||
    text.recommendation.essential;
  elements.listeningNoteRoleDescription.textContent =
    text.editorial.roleDescriptions?.[roleKey] || "";
  elements.listeningNoteRoleSection.classList.remove(
    "role-anchor",
    "role-rotation",
    "role-focus"
  );
  elements.listeningNoteRoleSection.classList.add(`role-${roleKey}`);
}

function applyTranslations() {
  const text = getText();

  document.documentElement.lang = state.language;
  document.title = "To the Last Groove";
  elements.metaDescription.content = text.metaDescription;
  elements.mainNav.setAttribute(
    "aria-label",
    text.accessibility.mainNavigation
  );
  elements.formatSelector.setAttribute(
    "aria-label",
    text.accessibility.recommendationType
  );

  replaceDirectText(elements.navLinks[0], text.nav.discover);
  replaceDirectText(elements.navLinks[1], text.nav.collection);
  replaceDirectText(elements.navLinks[2], text.nav.about);
  elements.mobileCollectionLabel.textContent = text.nav.collection;
  elements.mobileCollection.setAttribute("aria-label", text.nav.collection);

  elements.languageOptions.forEach((button) => {
    const isActive =
      button.dataset.language === state.language;

    button.classList.toggle("active", isActive);
    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });

  elements.eyebrow.textContent = text.discovery.eyebrow;
  elements.question.textContent = text.discovery.question;

  replaceDirectText(
    elements.formatButtons[0],
    text.discovery.album
  );

  replaceDirectText(
    elements.formatButtons[1],
    text.discovery.song
  );

  replaceDirectText(
    elements.formatButtons[2],
    text.discovery.surprise
  );

  elements.filterLabels[0].textContent =
    text.discovery.decade;

  elements.filterLabels[1].textContent =
    text.discovery.genre;

  elements.decadeFilter.options[0].textContent =
    text.discovery.allDecades;

  elements.genreFilter.options[0].textContent =
    text.discovery.allGenres;

  [...elements.genreFilter.options].slice(1).forEach(
    (option) => {
      option.textContent =
        text.genres[option.value] || option.textContent;
    }
  );

  if (state.records.length > 0) {
    updateFilterAvailability();
  }

  updateDiscoverButtonLabel();

  updateEditorialRoleLabel();

  updateAnotherButtonLabel();

  elements.collectionEyebrow.textContent =
    text.collection.eyebrow;

  elements.collectionTitle.textContent =
    text.collection.title;

  elements.collectionTabsLabel.setAttribute(
    "aria-label",
    text.collection.viewsLabel
  );
  replaceDirectText(
    elements.collectionTabs[0],
    text.collection.listenedTab
  );
  replaceDirectText(
    elements.collectionTabs[1],
    text.collection.favoritesTab
  );
  replaceDirectText(
    elements.collectionTabs[2],
    text.collection.playlistsTab
  );

  elements.playlistDialogEyebrow.textContent =
    text.collection.playlistEyebrow;
  elements.playlistDialogTitle.textContent =
    text.collection.playlistTitle;
  elements.playlistNameLabel.textContent =
    text.collection.playlistNameLabel;
  elements.createPlaylistButton.textContent =
    text.collection.playlistCreate;
  elements.playlistDialogNote.textContent =
    text.collection.playlistDialogNote;
  elements.closePlaylistDialog.setAttribute(
    "aria-label",
    text.collection.playlistCloseLabel
  );

  elements.reactionActions.setAttribute(
    "aria-label",
    text.recommendation.reactionLabel
  );
  elements.reactionPrompt.textContent = text.recommendation.reactionPrompt;
  elements.ratingButtons.forEach((button) => {
    const labelByValue = {
      like: text.recommendation.ratingLike,
      meh: text.recommendation.ratingMeh,
      dislike: text.recommendation.ratingDislike
    };
    button.textContent = labelByValue[button.dataset.rating];
  });

  renderListeningPreference();

  elements.closeCollection.setAttribute(
    "aria-label",
    text.collection.closeLabel
  );

  elements.closeListeningNote.setAttribute(
    "aria-label",
    text.accessibility.closeListeningNote
  );

  elements.shareDialogEyebrow.textContent = text.share.eyebrow;
  elements.shareDialogTitle.textContent = text.share.title;
  elements.shareDialogDescription.textContent = text.share.description;
  elements.sharePosterCanvas.setAttribute("aria-label", text.share.previewLabel);
  elements.sharePosterButton.textContent = text.share.shareImage;
  elements.downloadPosterButton.textContent = text.share.downloadImage;
  elements.copyShareLinkButton.textContent = text.share.copyLink;
  elements.shareHint.textContent = text.share.instagramHint;
  elements.closeShareDialog.setAttribute("aria-label", text.share.closeLabel);

  elements.aboutEyebrow.textContent =
    text.about.eyebrow;

  elements.aboutTitle.textContent =
    text.about.title;

  elements.aboutIntro.textContent =
    text.about.intro;

  elements.aboutBody.textContent =
    text.about.body;

  elements.aboutMethod.textContent =
    text.about.method;

  elements.aboutNote.textContent =
    text.about.note;

  elements.aboutListeningTitle.textContent =
    text.about.listeningTitle;
  elements.aboutSongCadence.textContent =
    text.about.songCadence;
  elements.aboutAlbumCadence.textContent =
    text.about.albumCadence;
  renderAboutListeningStats();

  elements.closeAbout.setAttribute(
    "aria-label",
    text.about.closeLabel
  );

  elements.footerAbout.textContent =
    text.footer.about;

  elements.footerPhrase.textContent =
    text.footer.phrase;

  renderRecommendation();
  renderCollection();
  renderPlaylistDialog();
}

function recordDurationInMinutes(record) {
  if (record.type === "album") {
    const minutes = Number.parseInt(record.duration, 10);
    return Number.isFinite(minutes) ? minutes : 0;
  }

  const match = String(record.duration || "").match(/^(\d+):(\d{2})$/);
  return match
    ? (Number(match[1]) * 60 + Number(match[2])) / 60
    : 0;
}

function renderAboutListeningStats() {
  if (!elements.aboutListeningSummary) {
    return;
  }

  const albums = state.records.filter((record) => record.type === "album");
  const songs = state.records.filter((record) => record.type === "song");

  if (albums.length === 0 || songs.length === 0) {
    elements.aboutListeningSummary.textContent = "";
    return;
  }

  const albumHours = albums.reduce(
    (total, record) => total + recordDurationInMinutes(record),
    0
  ) / 60;
  const songHours = songs.reduce(
    (total, record) => total + recordDurationInMinutes(record),
    0
  ) / 60;
  const formatHours = new Intl.NumberFormat(getText().locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });

  elements.aboutListeningSummary.textContent = interpolateText(
    getText().about.listeningSummary,
    {
      songHours: formatHours.format(songHours),
      albumHours: formatHours.format(albumHours),
      totalHours: formatHours.format(albumHours + songHours)
    }
  );
}

function getRequestedCatalogRecord() {
  const requestedId = new URLSearchParams(window.location.search).get("pick");

  if (!isCatalogRecordId(requestedId)) {
    return null;
  }

  return state.records.find((record) => record.id === requestedId) || null;
}

function renderRequestedCatalogRecord(record) {
  if (!record) {
    return false;
  }

  state.format = record.type;
  state.recommendationQueue = [];
  state.completedCycle = null;
  elements.formatButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.format === record.type);
  });
  elements.decadeFilter.value = "all";
  elements.genreFilter.value = "all";
  updateFilterAvailability();
  updateDiscoverButtonLabel();
  state.current = record;
  state.currentFilterKey = getRecommendationFilterKey();
  getSeenRecommendationIds(state.currentFilterKey).add(record.id);
  clearRecommendationCycleFeedback();
  renderRecommendation();
  return true;
}

function clearRequestedCatalogRecord() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("pick")) {
    return;
  }

  url.searchParams.delete("pick");
  window.history.replaceState({}, "", url);
}

async function loadCatalog() {
  try {
    const [
      albumResponse,
      songResponse,
      editorialResponse,
      screenAppearanceResponse
    ] = await Promise.all([
      fetch(`data/albums.json?v=${catalogVersion}`),
      fetch(`data/songs.json?v=${catalogVersion}`),
      fetch(`data/editorial-notes.json?v=${catalogVersion}`),
      fetch(`data/screen-appearances.json?v=${catalogVersion}`)
    ]);

    if (
      !albumResponse.ok ||
      !songResponse.ok ||
      !editorialResponse.ok ||
      !screenAppearanceResponse.ok
    ) {
      throw new Error("No se pudieron cargar los archivos JSON.");
    }

    const albums = await albumResponse.json();
    const songs = await songResponse.json();
    const editorialNotes = await editorialResponse.json();
    const screenAppearances = await screenAppearanceResponse.json();
    const editorialById = new Map(
      editorialNotes.map((note) => [note.id, note.editorial])
    );
    const screenAppearancesById = new Map(
      screenAppearances.map((entry) => [entry.id, entry.appearances])
    );

    state.records = [...albums, ...songs].map((record) => ({
      ...record,
      editorial: record.editorial || editorialById.get(record.id),
      screenAppearances: screenAppearancesById.get(record.id) || []
    }));

    syncCollectionWithCatalog();
    renderAboutListeningStats();
    normalizeFilterCombination(state.lastFilterChanged);
    updateFilterAvailability();

    if (!renderRequestedCatalogRecord(getRequestedCatalogRecord())) {
      chooseRecord(false);
    }
    resolveCatalogReady();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);

    const messages = {
      es: "No se pudo cargar el catálogo. Abre el sitio mediante un servidor local.",
      en: "The catalogue could not be loaded. Open the site through a local server.",
      fr: "Le catalogue n’a pas pu être chargé. Ouvrez le site avec un serveur local."
    };

    elements.filterMessage.textContent =
      messages[state.language];
  }
}

function recordMatchesFormat(record) {
  return (
    state.format === "surprise" ||
    record.type === state.format
  );
}

function getCatalogRecordsForCurrentFormat() {
  return state.records.filter(recordMatchesFormat);
}

function hasCatalogMatch(decade, genre) {
  return getCatalogRecordsForCurrentFormat().some((record) => {
    const matchesDecade =
      decade === "all" || record.decade === decade;
    const matchesGenre =
      genre === "all" || record.genre === genre;

    return matchesDecade && matchesGenre;
  });
}

function normalizeFilterCombination(
  preferredFilter = state.lastFilterChanged
) {
  if (state.records.length === 0) {
    return;
  }

  const selectedDecade = elements.decadeFilter.value;
  const selectedGenre = elements.genreFilter.value;

  if (hasCatalogMatch(selectedDecade, selectedGenre)) {
    return;
  }

  const canKeepDecade = hasCatalogMatch(selectedDecade, "all");
  const canKeepGenre = hasCatalogMatch("all", selectedGenre);

  if (preferredFilter === "genre" && canKeepGenre) {
    elements.decadeFilter.value = "all";
    return;
  }

  if (preferredFilter === "decade" && canKeepDecade) {
    elements.genreFilter.value = "all";
    return;
  }

  if (canKeepDecade) {
    elements.genreFilter.value = "all";
    return;
  }

  if (canKeepGenre) {
    elements.decadeFilter.value = "all";
    return;
  }

  elements.decadeFilter.value = "all";
  elements.genreFilter.value = "all";
}

function updateFilterAvailability() {
  if (state.records.length === 0) {
    return;
  }

  normalizeFilterCombination(state.lastFilterChanged);

  const selectedDecade = elements.decadeFilter.value;
  const selectedGenre = elements.genreFilter.value;
  const formatRecords = getCatalogRecordsForCurrentFormat();
  const text = getText();
  const decadeRecords = formatRecords.filter((record) => (
    selectedGenre === "all" || record.genre === selectedGenre
  ));
  const genreRecords = formatRecords.filter((record) => (
    selectedDecade === "all" || record.decade === selectedDecade
  ));
  const decadeCounts = decadeRecords.reduce((counts, record) => {
    counts.set(record.decade, (counts.get(record.decade) || 0) + 1);
    return counts;
  }, new Map());
  const genreCounts = genreRecords.reduce((counts, record) => {
    counts.set(record.genre, (counts.get(record.genre) || 0) + 1);
    return counts;
  }, new Map());

  const decadeOptions = [
    new Option(`${text.discovery.allDecades} · ${decadeRecords.length}`, "all"),
    ...filterOptionValues.decades
      .filter((value) => decadeCounts.has(value))
      .map((value) => new Option(`${value} · ${decadeCounts.get(value)}`, value))
  ];
  const genreOptions = [
    new Option(`${text.discovery.allGenres} · ${genreRecords.length}`, "all"),
    ...filterOptionValues.genres
      .filter((value) => genreCounts.has(value))
      .map((value) => new Option(
        `${text.genres[value] || value} · ${genreCounts.get(value)}`,
        value
      ))
  ];

  elements.decadeFilter.replaceChildren(...decadeOptions);
  elements.genreFilter.replaceChildren(...genreOptions);
  elements.decadeFilter.value = decadeCounts.has(selectedDecade)
    ? selectedDecade
    : "all";
  elements.genreFilter.value = genreCounts.has(selectedGenre)
    ? selectedGenre
    : "all";
}

function getMatchingRecords() {
  const selectedDecade = elements.decadeFilter.value;
  const selectedGenre = elements.genreFilter.value;

  return state.records.filter((record) => {
    const matchesFormat = recordMatchesFormat(record);

    const matchesDecade =
      selectedDecade === "all" ||
      record.decade === selectedDecade;

    const matchesGenre =
      selectedGenre === "all" ||
      record.genre === selectedGenre;

    return (
      matchesFormat &&
      matchesDecade &&
      matchesGenre
    );
  });
}

function getFilteredRecords() {
  const listenedIds = new Set(
    state.collection.map((record) => record.id)
  );

  return getMatchingRecords().filter(
    (record) => !listenedIds.has(record.id)
  );
}

function getRecommendationFilterKey() {
  return [
    state.format,
    elements.decadeFilter.value,
    elements.genreFilter.value
  ].join("|");
}

function getSeenRecommendationIds(filterKey) {
  if (!state.seenRecommendationsByFilter.has(filterKey)) {
    state.seenRecommendationsByFilter.set(filterKey, new Set());
  }

  return state.seenRecommendationsByFilter.get(filterKey);
}

function getCycleProgressIds(filterKey) {
  return new Set([
    ...getSeenRecommendationIds(filterKey),
    ...state.collection.map((record) => record.id)
  ]);
}

function formatCycleMessage(template, current, total) {
  return template
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

function updateRecommendationCycleProgress() {
  if (!elements.recommendationCycle) {
    return;
  }

  const filterKey = getRecommendationFilterKey();
  const matchingRecords = getMatchingRecords();
  const total = matchingRecords.length;

  if (total === 0) {
    elements.recommendationCycle.hidden = true;
    return;
  }

  const progressIds = getCycleProgressIds(filterKey);
  const current = matchingRecords.filter(
    (record) => progressIds.has(record.id)
  ).length;
  const cycleIsComplete =
    state.completedCycle?.filterKey === filterKey;
  const text = getText().recommendation;
  const progressText = formatCycleMessage(
    text.cycleProgress,
    current,
    total
  );
  const progressPercentage = Math.min(
    100,
    Math.max(0, (current / total) * 100)
  );

  elements.recommendationCycle.hidden = false;
  elements.recommendationCycle.classList.toggle(
    "is-complete",
    cycleIsComplete
  );
  elements.recommendationCycleLabel.textContent = cycleIsComplete
    ? text.cycleCompleteLabel
    : text.cycleLabel;
  elements.recommendationCycleCount.textContent =
    `${current}/${total}`;
  elements.recommendationCycleProgress.style.width =
    `${progressPercentage}%`;
  elements.recommendationCycleTrack.setAttribute(
    "aria-valuemax",
    String(total)
  );
  elements.recommendationCycleTrack.setAttribute(
    "aria-valuenow",
    String(current)
  );
  elements.recommendationCycleTrack.setAttribute(
    "aria-valuetext",
    progressText
  );
  elements.recommendationCycleMessage.textContent =
    text.cycleComplete;
  elements.recommendationCycleMessage.hidden = !cycleIsComplete;
}

function updateAnotherButtonLabel() {
  const text = getText();
  const filterKey = getRecommendationFilterKey();
  const cycleIsComplete =
    state.completedCycle?.filterKey === filterKey;

  elements.anotherButton.textContent = cycleIsComplete
    ? text.recommendation.restart
    : text.recommendation.another;
  elements.anotherButton.dataset.shortLabel = cycleIsComplete
    ? text.recommendation.restartShort
    : text.recommendation.anotherShort;
  elements.anotherButton.classList.toggle(
    "cycle-complete",
    cycleIsComplete
  );
  updateRecommendationCycleProgress();
}

function markRecommendationCycleComplete(filterKey, seenCount) {
  state.completedCycle = {
    filterKey,
    count: seenCount
  };

  elements.filterMessage.textContent = "";
  updateAnotherButtonLabel();
}

function clearRecommendationCycleFeedback() {
  state.completedCycle = null;
  elements.filterMessage.textContent = "";
  updateAnotherButtonLabel();
}

function syncRecommendationCycleFeedback() {
  const filterKey = getRecommendationFilterKey();
  const matchingRecords = getMatchingRecords();
  const availableRecords = getFilteredRecords();
  const seenIds = getSeenRecommendationIds(filterKey);
  const hasUnseenRecords = availableRecords.some(
    (record) => !seenIds.has(record.id)
  );

  if (matchingRecords.length > 0 && !hasUnseenRecords) {
    markRecommendationCycleComplete(
      filterKey,
      matchingRecords.length
    );
    return true;
  }

  clearRecommendationCycleFeedback();
  return false;
}

function restartRecommendationCycle() {
  const filterKey = getRecommendationFilterKey();
  const seenIds = getSeenRecommendationIds(filterKey);
  const availableRecords = getFilteredRecords();

  seenIds.clear();
  state.recommendationQueue = [];
  state.completedCycle = null;

  if (
    availableRecords.length > 1 &&
    availableRecords.some((record) => record.id === state.current?.id)
  ) {
    seenIds.add(state.current.id);
  }

  elements.filterMessage.textContent = "";
  updateAnotherButtonLabel();
  chooseRecord(true);
}

function configureStreamingDestination(
  element,
  platform,
  url
) {
  element.href = url;
  element.dataset.platform = platform;
  element.dataset.webUrl = url;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
}

function configureStreamingLink(
  element,
  service,
  ariaLabel,
  platform
) {
  const url = service?.url;

  element.hidden = !url;

  if (!url) {
    element.removeAttribute("href");
    element.removeAttribute("aria-label");
    element.removeAttribute("data-platform");
    element.removeAttribute("data-web-url");
    return false;
  }

  configureStreamingDestination(element, platform, url);
  element.setAttribute("aria-label", ariaLabel);
  return true;
}

function recommendationWeight(record) {
  return {
    "Foco mensual": 4,
    "Rotación": 2,
    "Ancla": 1
  }[record.monthlyRole] || 1;
}

function weightedRandomIndex(records) {
  const totalWeight = records.reduce(
    (total, record) => total + recommendationWeight(record),
    0
  );
  let cursor = Math.random() * totalWeight;

  for (let index = 0; index < records.length; index += 1) {
    cursor -= recommendationWeight(records[index]);
    if (cursor < 0) {
      return index;
    }
  }

  return Math.max(0, records.length - 1);
}

function chooseRecord(animate = true) {
  clearRequestedCatalogRecord();
  const availableRecords = getFilteredRecords();
  const text = getText();
  const filterKey = getRecommendationFilterKey();
  const seenIds = getSeenRecommendationIds(filterKey);

  if (availableRecords.length === 0) {
    if (getMatchingRecords().length > 0) {
      markRecommendationCycleComplete(
        filterKey,
        getMatchingRecords().length
      );
    } else {
      clearRecommendationCycleFeedback();
      elements.filterMessage.textContent =
        text.discovery.noResults;
    }
    return;
  }

  if (
    state.currentFilterKey !== filterKey &&
    availableRecords.some((record) => record.id === state.current?.id)
  ) {
    seenIds.add(state.current.id);
  }

  const candidates = availableRecords.filter(
    (record) => !seenIds.has(record.id)
  );

  if (candidates.length === 0) {
    markRecommendationCycleComplete(
      filterKey,
      getMatchingRecords().length
    );
    return;
  }

  const queuedIndex = state.recommendationQueue.findIndex(
    (queuedRecord) => candidates.some(
      (candidate) => candidate.id === queuedRecord.id
    )
  );

  const selectedRecord = queuedIndex >= 0
    ? state.recommendationQueue.splice(queuedIndex, 1)[0]
    : candidates[weightedRandomIndex(candidates)];

  seenIds.add(selectedRecord.id);
  state.currentFilterKey = filterKey;

  const remainingCount = availableRecords.filter(
    (record) => !seenIds.has(record.id)
  ).length;

  if (remainingCount === 0) {
    markRecommendationCycleComplete(
      filterKey,
      getMatchingRecords().length
    );
  } else {
    clearRecommendationCycleFeedback();
  }

  if (animate && state.current) {
    elements.featuredRecord.classList.add("is-changing");

    window.setTimeout(() => {
      state.current = selectedRecord;
      renderRecommendation();

      requestAnimationFrame(() => {
        elements.featuredRecord.classList.remove(
          "is-changing"
        );
      });
    }, 260);
  } else {
    state.current = selectedRecord;
    renderRecommendation();
  }
}

function renderRecommendation() {
  if (!state.current) {
    return;
  }

  const record = state.current;
  const text = getText();
  const localizedGenre =
    text.genres[record.genre] || record.genre;

  updateEditorialRoleLabel(record);
  renderEditionLabel(record);

  elements.coverArtist.textContent = record.artist;
  elements.coverTitle.textContent = record.title;
  elements.coverYear.textContent = record.year;
  elements.catalogueNumber.textContent =
    record.catalogue;

  Object.keys(coverColors).forEach((coverClass) => {
    elements.coverArt.classList.remove(coverClass);
  });
  elements.coverArt.classList.add(record.coverClass);

  elements.featuredRecord.classList.toggle(
    "is-single",
    record.type === "song"
  );
  elements.recommendationArea.classList.toggle(
    "is-song",
    record.type === "song"
  );
  elements.recommendationCard.classList.toggle(
    "is-song",
    record.type === "song"
  );

  renderCoverImage(record);
  renderEditorialAvailability(record);

  elements.recommendationTitle.textContent =
    record.title;

  elements.recommendationArtist.textContent =
    record.artist;

  elements.recommendationDetails.textContent =
    `${record.year} · ${localizedGenre} · ${record.duration}`;

  elements.recommendationDescription.textContent =
    record.description[state.language] ||
    record.description.es;

  const accessibleTitle = `${record.title} — ${record.artist}`;
  const availablePlatforms = [
    configureStreamingLink(
      elements.spotifyLink,
      record.streaming?.spotify,
      `${text.recommendation.listenOn} Spotify: ${accessibleTitle}`,
      "spotify"
    ),
    configureStreamingLink(
      elements.appleMusicLink,
      record.streaming?.appleMusic,
      `${text.recommendation.listenOn} Apple Music: ${accessibleTitle}`,
      "appleMusic"
    ),
    configureStreamingLink(
      elements.youtubeMusicLink,
      record.streaming?.youtubeMusic,
      `${text.recommendation.listenOn} YouTube Music: ${accessibleTitle}`,
      "youtubeMusic"
    )
  ];
  renderRecommendationStreamingHierarchy(record);

  updateHeardButton();
  updatePersonalActions();
}

function getEditorialContent(record = state.current) {
  const editorial = record?.editorial;
  const content =
    editorial?.[state.language] ||
    editorial?.es;

  if (!editorial || !content?.review?.length) {
    return null;
  }

  return { editorial, content };
}

function renderEditorialAvailability(record) {
  const editorialData = getEditorialContent(record);

  if (!editorialData) {
    elements.openListeningNote.hidden = true;
    return;
  }

  const { editorial } = editorialData;
  const minutes = editorial.readTime || 1;

  elements.openListeningNote.textContent =
    getText().recommendation.listeningNoteButton.replace(
      "{minutes}",
      minutes
    );
  elements.openListeningNote.hidden = false;
}

function renderListeningNote(record = state.current) {
  const editorialData = getEditorialContent(record);

  if (!editorialData || !record) {
    return false;
  }

  const text = getText();
  const { editorial, content } = editorialData;
  const minutes = editorial.readTime || 1;

  elements.listeningNoteEyebrow.textContent =
    text.editorial.eyebrow;
  elements.listeningNoteReadTime.textContent =
    text.editorial.readTime.replace("{minutes}", minutes);
  elements.listeningNoteTitle.textContent = record.title;
  elements.listeningNoteArtist.textContent = record.artist;
  elements.listeningNoteCoverImage.src =
    record.resolvedCoverUrl ||
    record.coverUrl ||
    record.coverSourceUrl ||
    "";
  elements.listeningNoteCoverImage.style.objectPosition =
    editorial.headerPosition || "center";
  renderListeningNoteRole(record);
  elements.listeningNoteListenForTitle.textContent =
    text.editorial.listenFor;
  const showEntryPoint = record.type === "album";
  elements.listeningNoteEntrySection.hidden = !showEntryPoint;
  elements.listeningNoteEntryTitle.textContent =
    text.editorial.entryPoint;
  elements.listeningNoteSourcesTitle.textContent =
    text.editorial.sources;
  elements.listeningNoteScreenTitle.textContent =
    text.editorial.screenAppearances;

  elements.listeningNoteReview.replaceChildren();
  content.review.forEach((paragraphText) => {
    const paragraph = document.createElement("p");
    appendHighlightedText(
      paragraph,
      paragraphText,
      editorial.trackMentions
    );
    elements.listeningNoteReview.appendChild(paragraph);
  });

  elements.listeningNoteListenFor.replaceChildren();
  (content.listenFor || []).forEach((itemText) => {
    const item = document.createElement("li");
    appendHighlightedText(
      item,
      itemText,
      editorial.trackMentions
    );
    elements.listeningNoteListenFor.appendChild(item);
  });

  const entryTitle = content.entryPoint?.title || "";
  elements.listeningNoteEntryTrack.hidden = !entryTitle;
  const entryDescription =
    `${record.title} — ${record.artist}`;

  elements.listeningNoteEntryTrack.textContent = entryTitle;
  const entryReason = content.entryPoint?.reason || "";
  elements.listeningNoteEntryReason.textContent = entryReason;
  elements.listeningNoteEntryReason.hidden = !entryReason;
  elements.listeningNoteListenLabel.textContent =
    text.editorial.listenNow;
  const listeningPlatforms = [
    configureStreamingLink(
      elements.listeningNoteSpotify,
      record.streaming?.spotify,
      `${text.editorial.listenNow} — Spotify: ${entryDescription}`,
      "spotify"
    ),
    configureStreamingLink(
      elements.listeningNoteAppleMusic,
      record.streaming?.appleMusic,
      `${text.editorial.listenNow} — Apple Music: ${entryDescription}`,
      "appleMusic"
    ),
    configureStreamingLink(
      elements.listeningNoteYouTubeMusic,
      record.streaming?.youtubeMusic,
      `${text.editorial.listenNow} — YouTube Music: ${entryDescription}`,
      "youtubeMusic"
    )
  ];
  const hasListeningPlatform = listeningPlatforms.some(Boolean);
  elements.listeningNoteListenLabel.hidden =
    !showEntryPoint || !entryTitle || !hasListeningPlatform;
  elements.listeningNotePlatforms.hidden =
    !showEntryPoint || !entryTitle || !hasListeningPlatform;

  elements.listeningNoteSources.replaceChildren();
  (editorial.sources || []).forEach((source) => {
    const item = document.createElement("li");
    const link = document.createElement("a");

    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const sourceName =
      source.name?.[state.language] ||
      source.name?.es ||
      source.name;

    link.textContent = `${sourceName} ↗`;
    item.appendChild(link);
    elements.listeningNoteSources.appendChild(item);
  });

  elements.listeningNoteSourcesSection.hidden =
    elements.listeningNoteSources.children.length === 0;

  elements.listeningNoteScreenAppearances.replaceChildren();
  (record.screenAppearances || []).forEach((appearance) => {
    const item = document.createElement("li");
    const content = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");

    content.className = "screen-appearance-item";
    title.className = "screen-appearance-title";
    title.textContent = appearance.title;
    meta.className = "screen-appearance-meta";
    meta.textContent = [
      text.editorial.screenTypes?.[appearance.type] || appearance.type,
      appearance.year
    ].filter(Boolean).join(" · ");
    content.append(title, meta);

    if (appearance.track) {
      const track = document.createElement("span");
      track.className = "screen-appearance-track";
      track.textContent = interpolateText(text.editorial.screenTrack, {
        track: appearance.track
      });
      content.appendChild(track);
    }

    item.appendChild(content);
    elements.listeningNoteScreenAppearances.appendChild(item);
  });
  elements.listeningNoteScreenSection.hidden =
    elements.listeningNoteScreenAppearances.children.length === 0;

  return true;
}

function openListeningNoteForRecord(record = state.current) {
  if (
    renderListeningNote(record) &&
    !elements.listeningNoteDialog.open
  ) {
    elements.listeningNoteDialog.showModal();
    return true;
  }

  return false;
}

function appendHighlightedText(container, value, highlights = []) {
  const validHighlights = highlights
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);

  if (validHighlights.length === 0) {
    container.textContent = value;
    return;
  }

  const escapedHighlights = validHighlights.map((highlight) =>
    highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(
    `(${escapedHighlights.join("|")})`,
    "g"
  );
  const highlightSet = new Set(validHighlights);

  value.split(pattern).forEach((part) => {
    if (!part) {
      return;
    }

    if (highlightSet.has(part)) {
      const strong = document.createElement("strong");
      strong.textContent = part;
      container.appendChild(strong);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function renderCoverImage(record) {
  const requestId = Symbol(record.id);
  renderCoverImage.currentRequest = requestId;
  const candidateUrls = [
    record.coverUrl,
    record.coverSourceUrl
  ].filter((url, index, urls) => url && urls.indexOf(url) === index);

  if (candidateUrls.length === 0) {
    elements.coverImage.alt = "";
    elements.coverImage.removeAttribute("src");
    elements.coverArt.classList.remove("has-real-cover");
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
    return;
  }

  elements.coverArt.classList.add("is-loading");
  elements.coverArt.setAttribute("aria-busy", "true");

  const revealCover = (expectedUrl) => {
    if (renderCoverImage.currentRequest !== requestId) {
      return;
    }

    record.resolvedCoverUrl = expectedUrl;
    elements.coverImage.src = expectedUrl;
    elements.coverImage.alt = `${record.title} — ${record.artist}`;
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.classList.add("has-real-cover");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
  };

  const showFallbackArtwork = () => {
    if (renderCoverImage.currentRequest !== requestId) {
      return;
    }

    delete record.resolvedCoverUrl;
    elements.coverImage.alt = "";
    elements.coverImage.removeAttribute("src");
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.classList.remove("has-real-cover");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
  };

  const tryCandidate = (candidateIndex) => {
    if (candidateIndex >= candidateUrls.length) {
      showFallbackArtwork();
      return;
    }

    const expectedUrl = candidateUrls[candidateIndex];
    const pendingImage = new Image();

    pendingImage.onload = () => {
      if (typeof pendingImage.decode === "function") {
        pendingImage.decode()
          .catch(() => {})
          .finally(() => revealCover(expectedUrl));
      } else {
        revealCover(expectedUrl);
      }
    };

    pendingImage.onerror = () => {
      if (renderCoverImage.currentRequest !== requestId) {
        return;
      }

      tryCandidate(candidateIndex + 1);
    };

    pendingImage.decoding = "async";
    pendingImage.fetchPriority = "high";
    pendingImage.src = expectedUrl;
  };

  tryCandidate(0);
}

renderCoverImage.currentRequest = null;

function hasDataSavingConnection() {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  return Boolean(
    connection?.saveData ||
    ["slow-2g", "2g"].includes(connection?.effectiveType)
  );
}

function getCoverThumbnailUrl(recordOrUrl, size = 250) {
  const record = typeof recordOrUrl === "object"
    ? recordOrUrl
    : null;
  const coverUrl = record?.coverUrl || recordOrUrl;

  if (!coverUrl) {
    return "";
  }

  if (size === 250 && record?.thumbnailUrl) {
    return record.thumbnailUrl;
  }

  return coverUrl
    .replace(
      /\/front-(250|500|1200)(?=$|[?#])/,
      `/front-${size}`
    )
    .replace(
      /-(250|500|1200)\.(jpe?g|webp|png)(?=$|[?#])/i,
      `-${size}.$2`
    );
}

function scheduleIdleTask(callback, timeout = 1200) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    window.setTimeout(callback, Math.min(timeout, 600));
  }
}

function preloadCover(coverUrl) {
  if (
    !coverUrl ||
    coverPreloadImages.has(coverUrl) ||
    hasDataSavingConnection()
  ) {
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = coverUrl;
  coverPreloadImages.set(coverUrl, image);

  if (coverPreloadImages.size > maxPreloadedCovers) {
    const oldestUrl = coverPreloadImages.keys().next().value;
    coverPreloadImages.delete(oldestUrl);
  }
}

function prepareRecommendationQueue() {
  if (!state.current || hasDataSavingConnection()) {
    return;
  }

  const filterKey = getRecommendationFilterKey();
  const seenIds = getSeenRecommendationIds(filterKey);
  const candidates = getFilteredRecords().filter(
    (record) => !seenIds.has(record.id)
  );
  const candidateIds = new Set(
    candidates.map((record) => record.id)
  );

  state.recommendationQueue = state.recommendationQueue.filter(
    (record) => candidateIds.has(record.id)
  );

  const queuedIds = new Set(
    state.recommendationQueue.map((record) => record.id)
  );
  const remainingCandidates = candidates.filter(
    (record) => !queuedIds.has(record.id)
  );

  while (
    state.recommendationQueue.length < recommendationQueueSize &&
    remainingCandidates.length > 0
  ) {
    const randomIndex = weightedRandomIndex(remainingCandidates);
    const [nextRecord] = remainingCandidates.splice(randomIndex, 1);

    state.recommendationQueue.push(nextRecord);
  }

  state.recommendationQueue.forEach((record) => {
    preloadCover(record.coverUrl);
  });
}

function scheduleFixedStackCovers() {
  if (fixedStackScheduled || state.records.length === 0) {
    return;
  }

  fixedStackScheduled = true;
  scheduleIdleTask(renderFixedStackCovers, 1600);
}

function renderFixedStackCovers() {
  elements.stackCovers.forEach((image) => {
    const stackRecord = state.records.find(
      (record) => record.id === image.dataset.recordId
    );
    const sleeve = image.parentElement;

    if (!stackRecord?.coverUrl || image.dataset.loaded === "true") {
      return;
    }

    image.onload = () => {
      image.hidden = false;
      image.dataset.loaded = "true";
      sleeve.classList.add("has-real-cover");
    };

    image.onerror = () => {
      image.hidden = true;
      sleeve.classList.remove("has-real-cover");
    };

    image.src = getCoverThumbnailUrl(stackRecord, 250);
  });
}

function getRecordById(recordId) {
  return state.records.find((record) => record.id === recordId) || null;
}

function getRecordRating(recordId) {
  return state.ratings.find((entry) => entry.id === recordId) || null;
}

function updatePersonalActions() {
  const text = getText().recommendation;
  const record = state.current;
  const isFavorite = Boolean(
    record && state.favorites.includes(record.id)
  );
  const rating = record ? getRecordRating(record.id)?.value : null;
  const alreadyListened = Boolean(
    record && state.collection.some((entry) => entry.id === record.id)
  );

  elements.favoriteButton.textContent = isFavorite
    ? `★ ${text.favorited}`
    : `☆ ${text.favorite}`;
  elements.favoriteButton.classList.toggle("is-active", isFavorite);
  elements.favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  elements.favoriteButton.disabled = !record;

  elements.addToPlaylistButton.textContent = `＋ ${text.addToPlaylist}`;
  elements.addToPlaylistButton.disabled = !record;

  elements.shareRecordButton.textContent = `↗ ${text.share}`;
  elements.shareRecordButton.disabled = !record;

  elements.reactionPanel.hidden = !record || (!alreadyListened && !rating);
  elements.reactionPrompt.textContent = text.reactionPrompt;

  elements.ratingButtons.forEach((button) => {
    const isSelected = button.dataset.rating === rating;
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = !record || (!alreadyListened && !rating);
  });
}

function toggleFavorite(record = state.current) {
  if (!record) {
    return;
  }

  if (state.favorites.includes(record.id)) {
    state.favorites = state.favorites.filter((id) => id !== record.id);
  } else {
    state.favorites = [record.id, ...state.favorites].slice(0, 200);
  }

  persistProfile({ notify: true });
  collectionRenderSignature = "";
  updatePersonalActions();
  renderCollection();
}

function setRecordRating(value, record = state.current) {
  if (!record || !ratingValues.has(value)) {
    return;
  }

  const previous = getRecordRating(record.id);
  state.ratings = state.ratings.filter((entry) => entry.id !== record.id);

  if (previous?.value !== value) {
    state.ratings.unshift({
      id: record.id,
      value,
      updatedAt: new Date().toISOString()
    });
  }

  persistProfile({ notify: true });
  collectionRenderSignature = "";
  updatePersonalActions();
  renderCollection();
}

function createPlaylistId() {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?.replaceAll("-", "")
    .slice(0, 10) || Math.random().toString(36).slice(2, 12);
  return `playlist-${Date.now().toString(36)}-${randomPart}`;
}

function toggleRecordInPlaylist(playlistId, recordId) {
  const playlist = state.playlists.find((item) => item.id === playlistId);
  if (!playlist || !isCatalogRecordId(recordId)) {
    return;
  }

  const alreadyIncluded = playlist.recordIds.includes(recordId);
  playlist.recordIds = alreadyIncluded
    ? playlist.recordIds.filter((id) => id !== recordId)
    : [...playlist.recordIds, recordId].slice(0, 200);
  playlist.updatedAt = new Date().toISOString();
  state.playlists = [...state.playlists].sort(
    (first, second) => second.updatedAt.localeCompare(first.updatedAt)
  );

  persistProfile({ notify: true });
  collectionRenderSignature = "";
  renderPlaylistDialog();
  renderCollection();
}

function createPlaylist(name, recordId = state.playlistDialogRecordId) {
  const cleanName = String(name || "").trim().slice(0, 60);
  if (!cleanName || state.playlists.length >= 20) {
    return false;
  }

  const timestamp = new Date().toISOString();
  state.playlists.unshift({
    id: createPlaylistId(),
    name: cleanName,
    recordIds: isCatalogRecordId(recordId) ? [recordId] : [],
    createdAt: timestamp,
    updatedAt: timestamp
  });
  persistProfile({ notify: true });
  collectionRenderSignature = "";
  renderPlaylistDialog();
  renderCollection();
  return true;
}

function deletePlaylist(playlistId) {
  const playlist = state.playlists.find((item) => item.id === playlistId);
  if (!playlist) {
    return;
  }

  const message = interpolateText(
    getText().collection.playlistDeleteConfirm,
    { name: playlist.name }
  );
  if (!window.confirm(message)) {
    return;
  }

  state.playlists = state.playlists.filter((item) => item.id !== playlistId);
  state.activePlaylistId = null;
  persistProfile({ notify: true });
  collectionRenderSignature = "";
  renderCollection();
}

function openPlaylistDialogForRecord(record = state.current) {
  if (!record) {
    return;
  }

  state.playlistDialogRecordId = record.id;
  elements.playlistName.value = "";
  renderPlaylistDialog();
  if (!elements.playlistDialog.open) {
    elements.playlistDialog.showModal();
  }
}

function renderPlaylistDialog() {
  if (!elements.playlistOptions) {
    return;
  }

  const text = getText().collection;
  const record = getRecordById(state.playlistDialogRecordId);
  elements.playlistDialogRecord.textContent = record
    ? interpolateText(text.playlistRecord, {
        title: record.title,
        artist: record.artist
      })
    : "";
  elements.playlistOptions.replaceChildren();

  state.playlists.forEach((playlist) => {
    const button = document.createElement("button");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const count = document.createElement("small");
    const included = Boolean(record && playlist.recordIds.includes(record.id));

    button.type = "button";
    button.className = "playlist-option";
    button.setAttribute("aria-pressed", String(included));
    name.textContent = playlist.name;
    count.textContent = interpolateText(
      included ? text.playlistContains : text.playlistAdd,
      { count: playlist.recordIds.length }
    );
    copy.append(name, count);
    button.append(copy, document.createTextNode(included ? "✓" : "+"));
    button.addEventListener("click", () => {
      if (record) {
        toggleRecordInPlaylist(playlist.id, record.id);
      }
    });
    elements.playlistOptions.appendChild(button);
  });
}

function updateHeardButton() {
  const text = getText();

  if (!state.current) {
    elements.heardButton.textContent =
      `○ ${text.recommendation.heard}`;
    elements.heardButton.dataset.shortLabel =
      text.recommendation.heardShort;
    return;
  }

  const alreadySaved = state.collection.some(
    (record) => record.id === state.current.id
  );

  elements.heardButton.textContent = alreadySaved
    ? `✓ ${text.recommendation.saved}`
    : `○ ${text.recommendation.heard}`;
  elements.heardButton.dataset.shortLabel = alreadySaved
    ? text.recommendation.savedShort
    : text.recommendation.heardShort;

  elements.heardButton.classList.toggle(
    "saved",
    alreadySaved
  );
}

function saveCurrentRecord() {
  if (!state.current) {
    return;
  }

  const alreadySaved = state.collection.some(
    (record) => record.id === state.current.id
  );

  if (!alreadySaved) {
    state.collection.unshift({
      ...state.current,
      listenedAt: new Date().toISOString()
    });

    persistCollection({ notify: true });
  }

  updateHeardButton();
  updatePersonalActions();
  renderCollection();
  syncRecommendationCycleWithCollection();
}

function syncRecommendationCycleWithCollection({
  replaceListenedCurrent = false
} = {}) {
  if (state.records.length === 0) {
    return;
  }

  state.recommendationQueue = [];
  const currentIsListened = state.collection.some(
    (record) => record.id === state.current?.id
  );

  if (
    replaceListenedCurrent &&
    currentIsListened &&
    getFilteredRecords().length > 0
  ) {
    chooseRecord(false);
    return;
  }

  syncRecommendationCycleFeedback();
}

function syncCollectionWithCatalog() {
  const validIds = new Set(state.records.map((record) => record.id));
  state.collection = state.collection.flatMap((savedRecord) => {
    const currentRecord = state.records.find(
      (record) => record.id === savedRecord.id
    );

    return currentRecord
      ? [{
          ...currentRecord,
          listenedAt: savedRecord.listenedAt
        }]
      : [];
  });

  state.favorites = state.favorites.filter((id) => validIds.has(id));
  state.ratings = state.ratings.filter((entry) => validIds.has(entry.id));
  state.playlists = state.playlists.map((playlist) => ({
    ...playlist,
    recordIds: playlist.recordIds.filter((id) => validIds.has(id))
  }));

  persistCollection();
  persistProfile();

  renderCollection();
  syncRecommendationCycleWithCollection();
}

function formatListenedDate(record) {
  if (!record?.listenedAt) {
    return "";
  }

  return new Date(record.listenedAt).toLocaleDateString(
    getText().locale,
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

function getCollectionRatingLabel(recordId) {
  const value = getRecordRating(recordId)?.value;
  const text = getText().collection;
  return {
    like: text.ratingLike,
    meh: text.ratingMeh,
    dislike: text.ratingDislike
  }[value] || "";
}

function createCollectionRecordCard(record, {
  stampMode = "listened",
  playlistId = null,
  allowFavoriteRemoval = false
} = {}) {
  const text = getText();
  const item = document.createElement("article");
  const localizedGenre = text.genres[record.genre] || record.genre;
  const formatLabel = record.type === "album"
    ? text.collection.albumFormat
    : text.collection.singleFormat;
  const quickListen = getQuickListenDestination(record);
  const ratingLabel = getCollectionRatingLabel(record.id);
  const stampText = stampMode === "favorite"
    ? text.collection.favoriteStamp
    : stampMode === "listened" && record.listenedAt
      ? `${text.collection.stamp} · ${formatListenedDate(record)}`
      : "";
  const stampClass = stampMode === "favorite" ? " is-favorite" : "";

  item.className = "collection-item";
  item.innerHTML = `
    <button class="collection-note-trigger" type="button">
      <div
        class="collection-cover${record.coverUrl ? " has-real-cover" : ""}"
        style="background-color: ${record.coverUrl
          ? "#dedbd3"
          : coverColors[record.coverClass] || "#2946a8"}"
      >
        ${record.coverUrl ? `
          <img
            class="collection-cover-image"
            src="${escapeHtml(getCoverThumbnailUrl(record, 250))}"
            alt=""
            loading="lazy"
            decoding="async"
          >
        ` : ""}
        ${stampText ? `
          <span class="played-stamp${stampClass}">${escapeHtml(stampText)}</span>
        ` : ""}
        <strong class="collection-cover-fallback">${escapeHtml(record.title)}</strong>
      </div>

      <span class="collection-meta">
        <span class="collection-format">${escapeHtml(formatLabel)}</span>
        <strong class="collection-item-title">${escapeHtml(record.title)}</strong>
        <span>${escapeHtml(record.artist)}</span>
        <span>${escapeHtml(record.year)} · ${escapeHtml(localizedGenre)}</span>
        ${ratingLabel ? `<span class="collection-rating">${escapeHtml(ratingLabel)}</span>` : ""}
        <span class="collection-open-note">${escapeHtml(text.collection.openNote)} →</span>
      </span>
    </button>

    <div class="collection-item-actions">
      ${quickListen ? `
        <a class="collection-listen-action collection-listen-link" href="#">
          ${escapeHtml(interpolateText(text.collection.quickListen, {
            platform: quickListen.platformName
          }))} ↗
        </a>
      ` : `
        <button class="collection-listen-action collection-choose-service" type="button">
          ${escapeHtml(text.collection.chooseService)} ↑
        </button>
      `}
      ${playlistId || allowFavoriteRemoval ? `
        <button class="collection-remove-action" type="button">
          ${escapeHtml(
            allowFavoriteRemoval
              ? text.collection.removeFavorite
              : text.collection.removeFromPlaylist
          )}
        </button>
      ` : ""}
    </div>
  `;

  const noteTrigger = item.querySelector(".collection-note-trigger");
  const collectionCover = item.querySelector(".collection-cover");
  const coverImage = item.querySelector(".collection-cover-image");
  const quickListenLink = item.querySelector(".collection-listen-link");
  const chooseServiceButton = item.querySelector(".collection-choose-service");
  const removeButton = item.querySelector(".collection-remove-action");

  noteTrigger.setAttribute(
    "aria-label",
    interpolateText(text.collection.openNoteLabel, {
      title: record.title,
      artist: record.artist
    })
  );
  noteTrigger.addEventListener("click", () => openListeningNoteForRecord(record));

  if (quickListenLink && quickListen) {
    configureStreamingDestination(
      quickListenLink,
      quickListen.platform,
      quickListen.url
    );
    quickListenLink.setAttribute(
      "aria-label",
      interpolateText(text.collection.quickListenLabel, {
        title: record.title,
        artist: record.artist,
        platform: quickListen.platformName
      })
    );
    quickListenLink.addEventListener("click", () => {
      rememberListeningPlatform(quickListen.platform);
    });
  }

  if (chooseServiceButton) {
    chooseServiceButton.setAttribute(
      "aria-label",
      interpolateText(text.collection.chooseServiceLabel, {
        title: record.title,
        artist: record.artist
      })
    );
    chooseServiceButton.addEventListener("click", () => {
      elements.collectionServicePreference.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
      elements.listeningPlatformButtons[0]?.focus();
    });
  }

  if (removeButton) {
    removeButton.setAttribute(
      "aria-label",
      interpolateText(
        allowFavoriteRemoval
          ? text.collection.removeFavoriteLabel
          : text.collection.removeFromPlaylistLabel,
        {
        title: record.title
        }
      )
    );
    removeButton.addEventListener("click", () => {
      if (playlistId) {
        toggleRecordInPlaylist(playlistId, record.id);
      } else if (allowFavoriteRemoval) {
        toggleFavorite(record);
      }
    });
  }

  if (coverImage) {
    const showRealCover = () => collectionCover.classList.add("has-real-cover");
    const showFallbackCover = () => collectionCover.classList.remove("has-real-cover");
    coverImage.addEventListener("load", showRealCover);
    coverImage.addEventListener("error", showFallbackCover);

    if (coverImage.complete) {
      (coverImage.naturalWidth > 0 ? showRealCover : showFallbackCover)();
    }
  }

  return item;
}

function appendEmptyCollectionMessage(message) {
  const emptyMessage = document.createElement("p");
  emptyMessage.className = "empty-collection";
  emptyMessage.textContent = message;
  elements.collectionGrid.appendChild(emptyMessage);
}

function createPlaylistCoverStack(playlist) {
  const stack = document.createElement("span");
  const records = playlist.recordIds
    .map(getRecordById)
    .filter(Boolean)
    .slice(0, 4);
  stack.className = "playlist-cover-stack";

  for (let index = 0; index < 4; index += 1) {
    const record = records[index];
    if (record?.coverUrl) {
      const image = document.createElement("img");
      image.src = getCoverThumbnailUrl(record, 250);
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      stack.appendChild(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "playlist-cover-placeholder";
      placeholder.textContent = index === 0 ? "♪" : "";
      stack.appendChild(placeholder);
    }
  }

  return stack;
}

function renderPlaylistOverview() {
  const text = getText().collection;
  elements.collectionGrid.classList.add("is-playlist-overview");

  if (state.playlists.length === 0) {
    appendEmptyCollectionMessage(text.emptyPlaylists);
    return;
  }

  state.playlists.forEach((playlist) => {
    const button = document.createElement("button");
    const name = document.createElement("strong");
    const count = document.createElement("small");
    button.type = "button";
    button.className = "playlist-overview-card";
    name.textContent = playlist.name;
    count.textContent = interpolateText(text.playlistItems, {
      count: playlist.recordIds.length
    });
    button.append(createPlaylistCoverStack(playlist), name, count);
    button.addEventListener("click", () => {
      state.activePlaylistId = playlist.id;
      collectionRenderSignature = "";
      renderCollection();
    });
    elements.collectionGrid.appendChild(button);
  });
}

function renderPlaylistDetail(playlist) {
  const text = getText().collection;
  const header = document.createElement("div");
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  const title = document.createElement("h3");
  const actions = document.createElement("div");
  const backButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  elements.collectionGrid.classList.add("is-playlist-detail");
  header.className = "playlist-detail-header";
  eyebrow.className = "eyebrow";
  eyebrow.textContent = interpolateText(text.playlistItems, {
    count: playlist.recordIds.length
  });
  title.textContent = playlist.name;
  actions.className = "playlist-detail-actions";
  backButton.type = "button";
  backButton.textContent = `← ${text.playlistBack}`;
  deleteButton.type = "button";
  deleteButton.textContent = text.playlistDelete;
  backButton.addEventListener("click", () => {
    state.activePlaylistId = null;
    collectionRenderSignature = "";
    renderCollection();
  });
  deleteButton.addEventListener("click", () => deletePlaylist(playlist.id));
  copy.append(eyebrow, title);
  actions.append(backButton, deleteButton);
  header.append(copy, actions);
  elements.collectionGrid.appendChild(header);

  const records = playlist.recordIds.map(getRecordById).filter(Boolean);
  if (records.length === 0) {
    appendEmptyCollectionMessage(text.playlistEmpty);
    return;
  }

  records.forEach((record) => {
    const listenedRecord = state.collection.find((item) => item.id === record.id);
    elements.collectionGrid.appendChild(createCollectionRecordCard(
      listenedRecord || record,
      {
        stampMode: listenedRecord ? "listened" : "none",
        playlistId: playlist.id
      }
    ));
  });
}

function renderCollection() {
  const text = getText();
  const collectionRecords = state.collection.filter(isCompleteCollectionRecord);
  const favoriteRecords = state.favorites
    .map(getRecordById)
    .filter(isCompleteCollectionRecord);
  const renderSignature = JSON.stringify([
    state.language,
    state.collectionView,
    state.activePlaylistId,
    getPreferredListeningPlatform(),
    collectionRecords.map((record) => [record.id, record.listenedAt]),
    state.favorites,
    state.ratings,
    state.playlists
  ]);

  elements.collectionCount.textContent = collectionRecords.length;
  elements.mobileCollectionCount.textContent = collectionRecords.length;
  elements.mobileCollection.setAttribute(
    "aria-label",
    `${text.nav.collection} · ${collectionRecords.length}`
  );
  elements.collectionListenedCount.textContent = collectionRecords.length;
  elements.collectionFavoritesCount.textContent = favoriteRecords.length;
  elements.collectionPlaylistsCount.textContent = state.playlists.length;
  elements.collectionTabs.forEach((tab) => {
    const isActive = tab.dataset.collectionView === state.collectionView;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  if (
    renderSignature === collectionRenderSignature &&
    elements.collectionGrid.childElementCount > 0
  ) {
    return;
  }

  collectionRenderSignature = renderSignature;
  elements.collectionGrid.replaceChildren();
  elements.collectionGrid.classList.remove(
    "is-playlist-overview",
    "is-playlist-detail"
  );

  if (state.collectionView === "playlists") {
    const activePlaylist = state.playlists.find(
      (playlist) => playlist.id === state.activePlaylistId
    );
    if (activePlaylist) {
      renderPlaylistDetail(activePlaylist);
    } else {
      state.activePlaylistId = null;
      renderPlaylistOverview();
    }
    return;
  }

  const records = state.collectionView === "favorites"
    ? favoriteRecords
    : collectionRecords;
  if (records.length === 0) {
    appendEmptyCollectionMessage(
      state.collectionView === "favorites"
        ? text.collection.emptyFavorites
        : text.collection.empty
    );
    return;
  }

  records.forEach((record) => {
    elements.collectionGrid.appendChild(createCollectionRecordCard(record, {
      stampMode: state.collectionView === "favorites" ? "favorite" : "listened",
      allowFavoriteRemoval: state.collectionView === "favorites"
    }));
  });
}

function getShareUrl(record = state.current) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("pick", record.id);
  url.searchParams.set("lang", state.language);
  return url.href;
}

function slugifyFileName(value) {
  return String(value || "to-the-last-groove")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "to-the-last-groove";
}

function loadCanvasImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function wrapCanvasText(context, text, maxWidth, maxLines = Infinity) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines);
  let lastLine = visibleLines[maxLines - 1];

  while (
    lastLine.length > 1 &&
    context.measureText(`${lastLine}…`).width > maxWidth
  ) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }

  visibleLines[maxLines - 1] = `${lastLine}…`;
  return visibleLines;
}

function drawCanvasTextLines(
  context,
  lines,
  x,
  y,
  lineHeight
) {
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

function drawPosterVinyl(context) {
  const centerX = 865;
  const centerY = 610;
  const radius = 365;
  const gradient = context.createRadialGradient(
    centerX - 90,
    centerY - 110,
    40,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "#343434");
  gradient.addColorStop(0.42, "#111111");
  gradient.addColorStop(1, "#050505");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.16)";
  context.lineWidth = 2;
  for (let radiusOffset = 42; radiusOffset < radius - 22; radiusOffset += 16) {
    context.beginPath();
    context.arc(centerX, centerY, radiusOffset, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#2e4db5";
  context.beginPath();
  context.arc(centerX, centerY, 92, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(centerX, centerY, 62, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#f1e5bd";
  context.beginPath();
  context.arc(centerX, centerY, 18, 0, Math.PI * 2);
  context.fill();
}

function drawPosterCover(context, coverImage) {
  const size = 770;
  const x = 60;
  const y = 250;

  context.save();
  context.translate(x + size / 2, y + size / 2);
  context.rotate(-0.035);
  context.shadowColor = "rgba(22, 19, 15, 0.35)";
  context.shadowBlur = 35;
  context.shadowOffsetY = 24;
  context.fillStyle = "#ded6c7";
  context.fillRect(-size / 2 - 9, -size / 2 - 9, size + 18, size + 18);
  context.shadowColor = "transparent";
  context.drawImage(coverImage, -size / 2, -size / 2, size, size);
  context.strokeStyle = "rgba(25, 24, 22, 0.36)";
  context.lineWidth = 3;
  context.strokeRect(-size / 2, -size / 2, size, size);
  context.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("No se pudo exportar la imagen."));
      }
    }, "image/png");
  });
}

async function renderSharePoster(record = state.current) {
  if (!record) {
    throw new Error("No hay una recomendación para compartir.");
  }

  const cacheKey = `${record.id}:${state.language}`;
  if (sharePosterCache.key === cacheKey && sharePosterCache.blob) {
    return sharePosterCache.blob;
  }

  await document.fonts?.ready;
  const coverUrl = record.resolvedCoverUrl || record.coverUrl;
  const coverImage = await loadCanvasImage(coverUrl);
  const canvas = elements.sharePosterCanvas;
  const context = canvas.getContext("2d");
  const text = getText();
  const roleKey = editorialRoleKeys[record.monthlyRole] || "anchor";
  const roleText = text.recommendation.roles?.[roleKey] || text.recommendation.essential;
  const roleColor = {
    anchor: "#2e4db5",
    rotation: "#286459",
    focus: "#d95335"
  }[roleKey];
  const genre = text.genres[record.genre] || record.genre;
  const editionDate = formatEditionDate(record.editionId);
  const formatLabel = record.type === "album"
    ? text.share.posterAlbum
    : text.share.posterSong;
  const shareUrl = new URL(getShareUrl(record));
  const sharePath = `${shareUrl.host}${shareUrl.pathname}`.replace(/\/$/, "");

  canvas.width = 1080;
  canvas.height = 1920;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f3efe6";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const wash = context.createLinearGradient(0, 0, 1080, 1920);
  wash.addColorStop(0, "rgba(255,255,255,0.16)");
  wash.addColorStop(1, "rgba(216,83,53,0.07)");
  context.fillStyle = wash;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(33,29,23,0.05)";
  context.lineWidth = 1;
  for (let y = 0; y < 1920; y += 10) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1080, y);
    context.stroke();
  }

  context.fillStyle = "#d95335";
  context.fillRect(0, 0, 1080, 22);
  context.fillStyle = "#171717";
  context.font = "700 47px 'Barlow Condensed', Impact, sans-serif";
  context.fillText("TO THE LAST", 62, 105);
  context.font = "900 82px 'Barlow Condensed', Impact, sans-serif";
  context.fillText("GROOVE", 318, 108);
  context.strokeStyle = "#171717";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(62, 140);
  context.lineTo(1018, 140);
  context.stroke();

  drawPosterVinyl(context);
  drawPosterCover(context, coverImage);

  context.fillStyle = roleColor;
  context.font = "800 35px 'Barlow Condensed', Impact, sans-serif";
  context.fillText(roleText.toUpperCase(), 62, 1110);
  context.textAlign = "right";
  context.fillText(formatLabel, 1018, 1110);
  context.textAlign = "left";

  context.fillStyle = "#171717";
  context.font = "900 98px 'Barlow Condensed', Impact, sans-serif";
  const titleLines = wrapCanvasText(context, record.title, 956, 3);
  let cursorY = drawCanvasTextLines(context, titleLines, 62, 1225, 88);

  cursorY += 18;
  context.fillStyle = "#2e4db5";
  context.font = "800 56px 'Barlow Condensed', Impact, sans-serif";
  const artistLines = wrapCanvasText(context, record.artist, 956, 2);
  cursorY = drawCanvasTextLines(context, artistLines, 62, cursorY, 58);

  cursorY += 14;
  context.fillStyle = "#171717";
  context.font = "700 34px 'Barlow Condensed', Impact, sans-serif";
  context.fillText(
    `${record.year} · ${genre} · ${record.duration}`,
    62,
    cursorY
  );

  if (editionDate) {
    context.textAlign = "right";
    context.fillStyle = "#69645d";
    context.font = "600 29px 'Barlow Condensed', Impact, sans-serif";
    context.fillText(
      interpolateText(text.recommendation.edition, { date: editionDate }),
      1018,
      cursorY
    );
    context.textAlign = "left";
  }

  context.fillStyle = "#171717";
  context.fillRect(0, 1690, 1080, 230);
  context.fillStyle = "#f3efe6";
  context.font = "800 32px 'Barlow Condensed', Impact, sans-serif";
  context.fillText(text.share.posterKicker, 62, 1752);
  context.fillStyle = "#d95335";
  context.font = "800 28px 'Barlow Condensed', Impact, sans-serif";
  context.fillText(text.share.posterCta, 62, 1810);
  context.fillStyle = "#ffffff";
  context.font = "700 35px 'Barlow Condensed', Impact, sans-serif";
  context.fillText(sharePath, 62, 1862);
  context.textAlign = "right";
  context.fillStyle = "#f3efe6";
  context.font = "900 112px 'Barlow Condensed', Impact, sans-serif";
  context.fillText("↗", 1018, 1847);
  context.textAlign = "left";

  const blob = await canvasToBlob(canvas);
  sharePosterCache = { key: cacheKey, blob };
  return blob;
}

function getShareFile(record, blob) {
  return new File(
    [blob],
    `${slugifyFileName(record.artist)}-${slugifyFileName(record.title)}-tlg.png`,
    { type: "image/png" }
  );
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function copyShareLink(record = state.current) {
  const url = getShareUrl(record);

  try {
    await navigator.clipboard.writeText(url);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  elements.shareStatus.textContent = getText().share.copied;
}

async function openShareDialogForRecord(record = state.current) {
  if (!record) {
    return;
  }

  elements.shareStatus.textContent = "";
  elements.sharePosterButton.disabled = true;
  elements.downloadPosterButton.disabled = true;
  if (!elements.shareDialog.open) {
    elements.shareDialog.showModal();
  }

  try {
    await renderSharePoster(record);
    elements.sharePosterButton.disabled = false;
    elements.downloadPosterButton.disabled = false;
    elements.shareStatus.textContent = getText().share.ready;
  } catch (error) {
    console.error("No se pudo preparar la pieza compartible:", error);
    elements.shareStatus.textContent = getText().share.error;
  }
}

async function shareCurrentPoster() {
  if (!state.current) {
    return;
  }

  const blob = await renderSharePoster(state.current);
  const file = getShareFile(state.current, blob);
  const shareData = {
    files: [file],
    title: state.current.title,
    text: `${interpolateText(getText().share.shareText, {
      title: state.current.title,
      artist: state.current.artist
    })}\n${getShareUrl(state.current)}`
  };

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(shareData);
      elements.shareStatus.textContent = getText().share.shared;
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  downloadBlob(blob, file.name);
  elements.shareStatus.textContent = getText().share.downloaded;
}

async function downloadCurrentPoster() {
  if (!state.current) {
    return;
  }

  const blob = await renderSharePoster(state.current);
  const file = getShareFile(state.current, blob);
  downloadBlob(blob, file.name);
  elements.shareStatus.textContent = getText().share.downloaded;
}

function changeLanguage(language) {
  if (!languageOrder.includes(language)) {
    return;
  }

  state.language = language;
  sharePosterCache = { key: null, blob: null };

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has("pick")) {
    currentUrl.searchParams.set("lang", language);
    window.history.replaceState({}, "", currentUrl);
  }

  localStorage.setItem(
    "tlg-language",
    state.language
  );

  applyTranslations();
  if (elements.shareDialog.open && state.current) {
    openShareDialogForRecord(state.current);
  }
  window.dispatchEvent(new CustomEvent(
    "tlg-language-change",
    { detail: state.language }
  ));
}

window.TLG_PROGRESS = {
  whenReady: catalogReady,
  getLanguage: () => state.language,
  getCollection: getCollectionProgress,
  getProfile: getProfileProgress,
  getAnonymousCollection: () => readProgressFromStorage(
    anonymousCollectionStorageKey
  ),
  getAnonymousProfile: () => readProfileFromStorage(
    anonymousProfileStorageKey,
    anonymousCollectionStorageKey
  ),
  clearAnonymousProfile: () => {
    localStorage.setItem(anonymousCollectionStorageKey, "[]");
    localStorage.setItem(anonymousProfileStorageKey, JSON.stringify({
      favorites: [],
      ratings: [],
      playlists: []
    }));
  },
  getUserCollection: (userId) => readProgressFromStorage(
    `tlg-collection-user-${userId}`
  ),
  getUserProfile: (userId) => readProfileFromStorage(
    `tlg-profile-user-${userId}`,
    `tlg-collection-user-${userId}`
  ),
  useUserCollection: (userId, progress) => {
    return replaceCollectionProgress(
      progress,
      `tlg-collection-user-${userId}`
    );
  },
  useAnonymousCollection: () => {
    return replaceCollectionProgress(
      readProgressFromStorage(anonymousCollectionStorageKey),
      anonymousCollectionStorageKey
    );
  },
  useUserProfile: (userId, profile) => replaceProfileProgress(profile, {
    profileStorageKey: `tlg-profile-user-${userId}`,
    collectionStorageKey: `tlg-collection-user-${userId}`
  }),
  useAnonymousProfile: () => replaceProfileProgress(
    readProfileFromStorage(
      anonymousProfileStorageKey,
      anonymousCollectionStorageKey
    ),
    {
      profileStorageKey: anonymousProfileStorageKey,
      collectionStorageKey: anonymousCollectionStorageKey
    }
  )
};

elements.formatButtons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.formatButtons.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    state.format = button.dataset.format;
    state.recommendationQueue = [];
    normalizeFilterCombination(state.lastFilterChanged);
    updateFilterAvailability();
    updateDiscoverButtonLabel();

    const cycleIsComplete = syncRecommendationCycleFeedback();

    if (state.records.length > 0 && !cycleIsComplete) {
      chooseRecord(true);
    }
  });
});

elements.discoverButton.addEventListener("click", () => {
  if (
    state.completedCycle?.filterKey ===
    getRecommendationFilterKey()
  ) {
    restartRecommendationCycle();
    return;
  }

  chooseRecord(true);
});

elements.anotherButton.addEventListener("click", () => {
  if (
    state.completedCycle?.filterKey ===
    getRecommendationFilterKey()
  ) {
    restartRecommendationCycle();
    return;
  }

  chooseRecord(true);
});

elements.heardButton.addEventListener(
  "click",
  saveCurrentRecord
);

elements.favoriteButton.addEventListener("click", () => {
  toggleFavorite();
});

elements.addToPlaylistButton.addEventListener("click", () => {
  openPlaylistDialogForRecord();
});

elements.shareRecordButton.addEventListener("click", () => {
  openShareDialogForRecord();
});

elements.sharePosterButton.addEventListener("click", () => {
  shareCurrentPoster().catch((error) => {
    console.error("No se pudo compartir la imagen:", error);
    elements.shareStatus.textContent = getText().share.error;
  });
});

elements.downloadPosterButton.addEventListener("click", () => {
  downloadCurrentPoster().catch((error) => {
    console.error("No se pudo descargar la imagen:", error);
    elements.shareStatus.textContent = getText().share.error;
  });
});

elements.copyShareLinkButton.addEventListener("click", () => {
  copyShareLink().catch((error) => {
    console.error("No se pudo copiar el enlace:", error);
    elements.shareStatus.textContent = getText().share.error;
  });
});

elements.ratingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRecordRating(button.dataset.rating);
  });
});

elements.openListeningNote.addEventListener("click", () => {
  openListeningNoteForRecord();
});

[
  [elements.spotifyLink, "spotify"],
  [elements.appleMusicLink, "appleMusic"],
  [elements.youtubeMusicLink, "youtubeMusic"],
  [elements.listeningNoteSpotify, "spotify"],
  [elements.listeningNoteAppleMusic, "appleMusic"],
  [elements.listeningNoteYouTubeMusic, "youtubeMusic"]
].forEach(([link, platform]) => {
  link.addEventListener("click", () => {
    rememberListeningPlatform(platform);
  });
});

elements.listeningPlatformButtons.forEach((button) => {
  button.addEventListener("click", () => {
    rememberListeningPlatform(
      button.dataset.listeningPlatform
    );
    renderCollection();
  });
});

elements.collectionTabs.forEach((button) => {
  button.addEventListener("click", () => {
    state.collectionView = button.dataset.collectionView;
    state.activePlaylistId = null;
    collectionRenderSignature = "";
    renderCollection();
  });
});

elements.playlistCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (createPlaylist(elements.playlistName.value)) {
    elements.playlistName.value = "";
    elements.playlistName.focus();
  }
});

elements.closePlaylistDialog.addEventListener("click", () => {
  elements.playlistDialog.close();
});

elements.playlistDialog.addEventListener("click", (event) => {
  if (event.target === elements.playlistDialog) {
    elements.playlistDialog.close();
  }
});

elements.closeShareDialog.addEventListener("click", () => {
  elements.shareDialog.close();
});

elements.shareDialog.addEventListener("click", (event) => {
  if (event.target === elements.shareDialog) {
    elements.shareDialog.close();
  }
});

elements.closeListeningNote.addEventListener("click", () => {
  elements.listeningNoteDialog.close();
});

elements.listeningNoteDialog.addEventListener("click", (event) => {
  if (event.target === elements.listeningNoteDialog) {
    elements.listeningNoteDialog.close();
  }
});

elements.listeningNoteDialog.addEventListener("close", () => {
  if (elements.collectionDialog.open) {
    renderCollection();
  }
});

elements.languageOptions.forEach((button) => {
  button.addEventListener("click", () => {
    changeLanguage(button.dataset.language);
  });
});

function openCollectionDialog() {
  renderListeningPreference();
  renderCollection();
  if (!elements.collectionDialog.open) {
    elements.collectionDialog.showModal();
  }
}

elements.openCollection.addEventListener("click", openCollectionDialog);
elements.mobileCollection.addEventListener("click", openCollectionDialog);

elements.closeCollection.addEventListener("click", () => {
  elements.collectionDialog.close();
});

elements.collectionDialog.addEventListener(
  "click",
  (event) => {
    if (event.target === elements.collectionDialog) {
      elements.collectionDialog.close();
    }
  }
);

function openAboutDialog() {
  if (!elements.aboutDialog.open) {
    elements.aboutDialog.showModal();
  }
}

elements.openAbout.addEventListener("click", openAboutDialog);
elements.openAboutFooter.addEventListener("click", openAboutDialog);

elements.closeAbout.addEventListener("click", () => {
  elements.aboutDialog.close();
});

elements.aboutDialog.addEventListener("click", (event) => {
  if (event.target === elements.aboutDialog) {
    elements.aboutDialog.close();
  }
});

elements.decadeFilter.addEventListener("change", () => {
  state.lastFilterChanged = "decade";
  state.recommendationQueue = [];
  updateFilterAvailability();
  syncRecommendationCycleFeedback();
});

elements.genreFilter.addEventListener("change", () => {
  state.lastFilterChanged = "genre";
  state.recommendationQueue = [];
  updateFilterAvailability();
  syncRecommendationCycleFeedback();
});

applyTranslations();
renderCollection();
loadCatalog();
