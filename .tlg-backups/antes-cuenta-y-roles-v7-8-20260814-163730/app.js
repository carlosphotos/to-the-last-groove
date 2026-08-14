const translations = window.TLG_TRANSLATIONS;
const catalogVersion = "7.7";

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
let activeCollectionStorageKey = anonymousCollectionStorageKey;
let resolveCatalogReady;
const catalogReady = new Promise((resolve) => {
  resolveCatalogReady = resolve;
});

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
  collection: getSavedCollection()
};

const coverPreloadImages = new Map();
const maxPreloadedCovers = 50;
const recommendationQueueSize = 3;
let fixedStackScheduled = false;

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

  platformLabel: document.querySelector("#platformLabel"),
  spotifyLink: document.querySelector("#spotifyLink"),
  appleMusicLink: document.querySelector("#appleMusicLink"),
  youtubeMusicLink: document.querySelector("#youtubeMusicLink"),
  heardButton: document.querySelector("#heardButton"),
  anotherButton: document.querySelector("#anotherButton"),

  openCollection: document.querySelector("#openCollection"),
  closeCollection: document.querySelector("#closeCollection"),
  collectionDialog: document.querySelector("#collectionDialog"),
  collectionGrid: document.querySelector("#collectionGrid"),
  collectionCount: document.querySelector("#collectionCount"),
  collectionEyebrow: document.querySelector(".collection-header .eyebrow"),
  collectionTitle: document.querySelector(".collection-header h2"),

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

  state.collection = [...uniqueProgress.values()].map((entry) => {
    const currentRecord = state.records.find(
      (record) => record.id === entry.id
    );

    return currentRecord
      ? { ...currentRecord, listenedAt: entry.listenedAt }
      : entry;
  });

  persistCollection();
  updateHeardButton();
  renderCollection();
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

  elements.platformLabel.textContent =
    text.recommendation.listenOn;

  updateAnotherButtonLabel();

  elements.collectionEyebrow.textContent =
    text.collection.eyebrow;

  elements.collectionTitle.textContent =
    text.collection.title;

  elements.closeCollection.setAttribute(
    "aria-label",
    text.collection.closeLabel
  );

  elements.closeListeningNote.setAttribute(
    "aria-label",
    text.accessibility.closeListeningNote
  );

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
}

async function loadCatalog() {
  try {
    const [
      albumResponse,
      songResponse,
      editorialResponse
    ] = await Promise.all([
      fetch(`data/albums.json?v=${catalogVersion}`),
      fetch(`data/songs.json?v=${catalogVersion}`),
      fetch(`data/editorial-notes.json?v=${catalogVersion}`)
    ]);

    if (
      !albumResponse.ok ||
      !songResponse.ok ||
      !editorialResponse.ok
    ) {
      throw new Error("No se pudieron cargar los archivos JSON.");
    }

    const albums = await albumResponse.json();
    const songs = await songResponse.json();
    const editorialNotes = await editorialResponse.json();
    const editorialById = new Map(
      editorialNotes.map((note) => [note.id, note.editorial])
    );

    state.records = [...albums, ...songs].map((record) => ({
      ...record,
      editorial: record.editorial || editorialById.get(record.id)
    }));

    syncCollectionWithCatalog();
    normalizeFilterCombination(state.lastFilterChanged);
    updateFilterAvailability();

    chooseRecord(false);
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
  const availableDecades = new Set(
    formatRecords
      .filter((record) => (
        selectedGenre === "all" ||
        record.genre === selectedGenre
      ))
      .map((record) => record.decade)
  );
  const availableGenres = new Set(
    formatRecords
      .filter((record) => (
        selectedDecade === "all" ||
        record.decade === selectedDecade
      ))
      .map((record) => record.genre)
  );

  const decadeOptions = [
    new Option(text.discovery.allDecades, "all"),
    ...filterOptionValues.decades
      .filter((value) => availableDecades.has(value))
      .map((value) => new Option(value, value))
  ];
  const genreOptions = [
    new Option(text.discovery.allGenres, "all"),
    ...filterOptionValues.genres
      .filter((value) => availableGenres.has(value))
      .map((value) => new Option(text.genres[value] || value, value))
  ];

  elements.decadeFilter.replaceChildren(...decadeOptions);
  elements.genreFilter.replaceChildren(...genreOptions);
  elements.decadeFilter.value = availableDecades.has(selectedDecade)
    ? selectedDecade
    : "all";
  elements.genreFilter.value = availableGenres.has(selectedGenre)
    ? selectedGenre
    : "all";
}

function getFilteredRecords() {
  const selectedDecade = elements.decadeFilter.value;
  const selectedGenre = elements.genreFilter.value;
  const listenedIds = new Set(
    state.collection.map((record) => record.id)
  );

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
      matchesGenre &&
      !listenedIds.has(record.id)
    );
  });
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
  const availableRecords = getFilteredRecords();
  const total = availableRecords.length;

  if (total === 0) {
    elements.recommendationCycle.hidden = true;
    return;
  }

  const seenIds = getSeenRecommendationIds(filterKey);
  const current = availableRecords.filter(
    (record) => seenIds.has(record.id)
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
  const availableRecords = getFilteredRecords();
  const seenIds = getSeenRecommendationIds(filterKey);
  const hasUnseenRecords = availableRecords.some(
    (record) => !seenIds.has(record.id)
  );

  if (availableRecords.length > 0 && !hasUnseenRecords) {
    markRecommendationCycleComplete(
      filterKey,
      availableRecords.length
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

function configureStreamingLink(
  element,
  service,
  ariaLabel
) {
  const url = service?.url;

  element.hidden = !url;

  if (!url) {
    element.removeAttribute("href");
    element.removeAttribute("aria-label");
    return false;
  }

  element.href = url;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
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
  const availableRecords = getFilteredRecords();
  const text = getText();
  const filterKey = getRecommendationFilterKey();
  const seenIds = getSeenRecommendationIds(filterKey);

  if (availableRecords.length === 0) {
    clearRecommendationCycleFeedback();
    elements.filterMessage.textContent =
      text.discovery.noResults;
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
      availableRecords.length
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
      availableRecords.length
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
      `${text.recommendation.listenOn} Spotify: ${accessibleTitle}`
    ),
    configureStreamingLink(
      elements.appleMusicLink,
      record.streaming?.appleMusic,
      `${text.recommendation.listenOn} Apple Music: ${accessibleTitle}`
    ),
    configureStreamingLink(
      elements.youtubeMusicLink,
      record.streaming?.youtubeMusic,
      `${text.recommendation.listenOn} YouTube Music: ${accessibleTitle}`
    )
  ];
  elements.platformLabel.hidden =
    !availablePlatforms.some(Boolean);

  updateHeardButton();
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

function renderListeningNote() {
  const editorialData = getEditorialContent();

  if (!editorialData || !state.current) {
    return false;
  }

  const text = getText();
  const { editorial, content } = editorialData;
  const minutes = editorial.readTime || 1;

  elements.listeningNoteEyebrow.textContent =
    text.editorial.eyebrow;
  elements.listeningNoteReadTime.textContent =
    text.editorial.readTime.replace("{minutes}", minutes);
  elements.listeningNoteTitle.textContent = state.current.title;
  elements.listeningNoteArtist.textContent = state.current.artist;
  elements.listeningNoteCoverImage.src =
    state.current.resolvedCoverUrl ||
    state.current.coverUrl ||
    state.current.coverSourceUrl ||
    "";
  elements.listeningNoteCoverImage.style.objectPosition =
    editorial.headerPosition || "center";
  elements.listeningNoteListenForTitle.textContent =
    text.editorial.listenFor;
  const showEntryPoint = state.current.type === "album";
  elements.listeningNoteEntrySection.hidden = !showEntryPoint;
  elements.listeningNoteEntryTitle.textContent =
    text.editorial.entryPoint;
  elements.listeningNoteSourcesTitle.textContent =
    text.editorial.sources;

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
    `${state.current.title} — ${state.current.artist}`;

  elements.listeningNoteEntryTrack.textContent = entryTitle;
  const entryReason = content.entryPoint?.reason || "";
  elements.listeningNoteEntryReason.textContent = entryReason;
  elements.listeningNoteEntryReason.hidden = !entryReason;
  elements.listeningNoteListenLabel.textContent =
    text.editorial.listenNow;
  const listeningPlatforms = [
    configureStreamingLink(
      elements.listeningNoteSpotify,
      state.current.streaming?.spotify,
      `${text.editorial.listenNow} — Spotify: ${entryDescription}`
    ),
    configureStreamingLink(
      elements.listeningNoteAppleMusic,
      state.current.streaming?.appleMusic,
      `${text.editorial.listenNow} — Apple Music: ${entryDescription}`
    ),
    configureStreamingLink(
      elements.listeningNoteYouTubeMusic,
      state.current.streaming?.youtubeMusic,
      `${text.editorial.listenNow} — YouTube Music: ${entryDescription}`
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

  return true;
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
  renderCollection();
}

function syncCollectionWithCatalog() {
  state.collection = state.collection.map((savedRecord) => {
    const currentRecord = state.records.find(
      (record) => record.id === savedRecord.id
    );

    return currentRecord
      ? {
          ...currentRecord,
          listenedAt: savedRecord.listenedAt
        }
      : savedRecord;
  });

  persistCollection();

  renderCollection();
}

function renderCollection() {
  const text = getText();

  elements.collectionCount.textContent =
    state.collection.length;

  elements.collectionGrid.innerHTML = "";

  if (state.collection.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "empty-collection";
    emptyMessage.textContent = text.collection.empty;

    elements.collectionGrid.appendChild(emptyMessage);
    return;
  }

  state.collection.forEach((record) => {
    const item = document.createElement("article");
    const date = new Date(record.listenedAt);

    const formattedDate = date.toLocaleDateString(
      text.locale,
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

    const localizedGenre =
      text.genres[record.genre] || record.genre;
    const formatLabel = record.type === "album"
      ? text.collection.albumFormat
      : text.collection.singleFormat;

    item.className = "collection-item";

    item.innerHTML = `
      <div
        class="collection-cover"
        style="background-color:
          ${coverColors[record.coverClass] || "#2946a8"}"
      >
        ${record.coverUrl ? `
          <img
            class="collection-cover-image"
            src="${getCoverThumbnailUrl(record, 250)}"
            alt=""
            loading="lazy"
            decoding="async"
          >
        ` : ""}

        <span class="played-stamp">
          ${text.collection.stamp} · ${formattedDate}
        </span>

        <strong class="collection-cover-fallback">
          ${record.title}
        </strong>
      </div>

      <div class="collection-meta">
        <span class="collection-format">${formatLabel}</span>
        <strong class="collection-item-title">${record.title}</strong>
        <span>${record.artist}</span>
        <span>${record.year} · ${localizedGenre}</span>
      </div>
    `;

    const collectionCover = item.querySelector(
      ".collection-cover"
    );
    const coverImage = item.querySelector(
      ".collection-cover-image"
    );

    if (coverImage) {
      const showRealCover = () => {
        collectionCover.classList.add("has-real-cover");
      };

      const showFallbackCover = () => {
        collectionCover.classList.remove("has-real-cover");
      };

      coverImage.addEventListener("load", showRealCover);
      coverImage.addEventListener("error", showFallbackCover);

      if (coverImage.complete) {
        if (coverImage.naturalWidth > 0) {
          showRealCover();
        } else {
          showFallbackCover();
        }
      }
    }

    elements.collectionGrid.appendChild(item);
  });
}

function changeLanguage(language) {
  if (!languageOrder.includes(language)) {
    return;
  }

  state.language = language;

  localStorage.setItem(
    "tlg-language",
    state.language
  );

  applyTranslations();
  window.dispatchEvent(new CustomEvent(
    "tlg-language-change",
    { detail: state.language }
  ));
}

window.TLG_PROGRESS = {
  whenReady: catalogReady,
  getLanguage: () => state.language,
  getCollection: getCollectionProgress,
  getAnonymousCollection: () => readProgressFromStorage(
    anonymousCollectionStorageKey
  ),
  getUserCollection: (userId) => readProgressFromStorage(
    `tlg-collection-user-${userId}`
  ),
  useUserCollection: (userId, progress) => {
    replaceCollectionProgress(
      progress,
      `tlg-collection-user-${userId}`
    );
  },
  useAnonymousCollection: () => {
    replaceCollectionProgress(
      readProgressFromStorage(anonymousCollectionStorageKey),
      anonymousCollectionStorageKey
    );
  }
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

elements.openListeningNote.addEventListener("click", () => {
  if (
    renderListeningNote() &&
    !elements.listeningNoteDialog.open
  ) {
    elements.listeningNoteDialog.showModal();
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

elements.languageOptions.forEach((button) => {
  button.addEventListener("click", () => {
    changeLanguage(button.dataset.language);
  });
});

elements.openCollection.addEventListener("click", () => {
  renderCollection();
  elements.collectionDialog.showModal();
});

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
