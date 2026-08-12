const translations = window.TLG_TRANSLATIONS;

const languageOrder = ["es", "en", "fr"];
const coverColors = {
  "cover-blue": "#2946a8",
  "cover-red": "#d95838",
  "cover-green": "#28574e",
  "cover-yellow": "#c89117",
  "cover-purple": "#67284d"
};

const state = {
  language: getSavedLanguage(),
  format: "album",
  records: [],
  current: null,
  recommendationQueue: [],
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

  featuredRecord: document.querySelector("#featuredRecord"),
  stackCovers: [...document.querySelectorAll(".stack-cover")],
  coverArt: document.querySelector("#coverArt"),
  coverImage: document.querySelector("#coverImage"),
  coverArtist: document.querySelector("#coverArtist"),
  coverTitle: document.querySelector("#coverTitle"),
  coverYear: document.querySelector("#coverYear"),
  catalogueNumber: document.querySelector("#catalogueNumber"),

  staffPick: document.querySelector(".staff-pick"),
  recommendationTitle: document.querySelector("#recommendationTitle"),
  recommendationArtist: document.querySelector("#recommendationArtist"),
  recommendationDetails: document.querySelector("#recommendationDetails"),
  recommendationDescription: document.querySelector(
    "#recommendationDescription"
  ),
  recognitionBlock: document.querySelector("#recognitionBlock"),
  recognitionEyebrow: document.querySelector("#recognitionEyebrow"),
  recognitionLink: document.querySelector("#recognitionLink"),
  recognitionText: document.querySelector("#recognitionText"),
  recognitionSource: document.querySelector("#recognitionSource"),
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

function getSavedLanguage() {
  const savedLanguage = localStorage.getItem("tlg-language");

  return languageOrder.includes(savedLanguage)
    ? savedLanguage
    : "es";
}

function getSavedCollection() {
  try {
    return JSON.parse(
      localStorage.getItem("tlg-collection") || "[]"
    );
  } catch (error) {
    console.error("No se pudo recuperar la colección:", error);
    return [];
  }
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

  elements.discoverButton.textContent =
    text.discovery.button;

  elements.staffPick.textContent =
    text.recommendation.essential;

  elements.platformLabel.textContent =
    text.recommendation.listenOn;

  elements.anotherButton.textContent =
    text.recommendation.another;

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
    const [albumResponse, songResponse] = await Promise.all([
      fetch("data/albums.json"),
      fetch("data/songs.json")
    ]);

    if (!albumResponse.ok || !songResponse.ok) {
      throw new Error("No se pudieron cargar los archivos JSON.");
    }

    const albums = await albumResponse.json();
    const songs = await songResponse.json();

    state.records = [...albums, ...songs];

    syncCollectionWithCatalog();

    chooseRecord(false);
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

function getFilteredRecords() {
  const selectedDecade = elements.decadeFilter.value;
  const selectedGenre = elements.genreFilter.value;

  return state.records.filter((record) => {
    const matchesFormat =
      state.format === "surprise" ||
      record.type === state.format;

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

function chooseRecord(animate = true) {
  const availableRecords = getFilteredRecords();
  const text = getText();

  if (availableRecords.length === 0) {
    elements.filterMessage.textContent =
      text.discovery.noResults;
    return;
  }

  elements.filterMessage.textContent = "";

  let candidates = availableRecords.filter(
    (record) => record.id !== state.current?.id
  );

  if (candidates.length === 0) {
    candidates = availableRecords;
  }

  const queuedIndex = state.recommendationQueue.findIndex(
    (queuedRecord) => candidates.some(
      (candidate) => candidate.id === queuedRecord.id
    )
  );

  const selectedRecord = queuedIndex >= 0
    ? state.recommendationQueue.splice(queuedIndex, 1)[0]
    : candidates[Math.floor(Math.random() * candidates.length)];

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

  renderCoverImage(record);
  renderRecognition(record);
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

  const platformQuery = `${record.artist} ${record.title}`;
  const encodedSearch = encodeURIComponent(platformQuery);
  const accessibleTitle = `${record.title} — ${record.artist}`;

  elements.spotifyLink.href =
    `https://open.spotify.com/search/${encodedSearch}`;

  elements.appleMusicLink.href =
    `https://music.apple.com/search?term=${encodedSearch}`;

  elements.youtubeMusicLink.href =
    `https://music.youtube.com/search?q=${encodedSearch}`;

  elements.spotifyLink.setAttribute(
    "aria-label",
    `${text.recommendation.listenOn} Spotify: ${accessibleTitle}`
  );

  elements.appleMusicLink.setAttribute(
    "aria-label",
    `${text.recommendation.listenOn} Apple Music: ${accessibleTitle}`
  );

  elements.youtubeMusicLink.setAttribute(
    "aria-label",
    `${text.recommendation.listenOn} YouTube Music: ${accessibleTitle}`
  );

  updateHeardButton();
}

function renderRecognition(record) {
  const recognition = record.recognition;
  const text = getText();

  if (!recognition?.url) {
    elements.recognitionBlock.hidden = true;
    return;
  }

  const localizedTitle =
    recognition.title?.[state.language] ||
    recognition.title?.es ||
    recognition.title ||
    "";

  const template =
    text.recommendation[recognition.type] ||
    text.recommendation.selection;

  const recognitionText = template
    .replace("{rank}", recognition.rank ?? "")
    .replace("{title}", localizedTitle);

  elements.recognitionEyebrow.textContent =
    text.recommendation.recognitionEyebrow;
  elements.recognitionText.textContent = recognitionText;
  elements.recognitionSource.textContent =
    `${recognition.source} · ${recognition.year} ↗`;
  elements.recognitionLink.href = recognition.url;
  elements.recognitionLink.setAttribute(
    "aria-label",
    `${text.accessibility.recognitionSource}: ${recognitionText}, ${recognition.source}, ${recognition.year}`
  );
  elements.recognitionBlock.hidden = false;
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
  elements.listeningNoteCoverImage.src = state.current.coverUrl;
  elements.listeningNoteCoverImage.style.objectPosition =
    editorial.headerPosition || "center";
  elements.listeningNoteListenForTitle.textContent =
    text.editorial.listenFor;
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
  const entryQuery = encodeURIComponent(
    `${state.current.artist} ${entryTitle}`
  );
  const entryDescription = `${entryTitle} — ${state.current.artist}`;

  elements.listeningNoteEntryTrack.textContent = entryTitle;
  elements.listeningNoteEntryReason.textContent =
    content.entryPoint?.reason || "";
  elements.listeningNoteListenLabel.textContent =
    text.editorial.listenNow;
  elements.listeningNoteListenLabel.hidden = !entryTitle;
  elements.listeningNotePlatforms.hidden = !entryTitle;

  elements.listeningNoteSpotify.href =
    `https://open.spotify.com/search/${entryQuery}`;
  elements.listeningNoteAppleMusic.href =
    `https://music.apple.com/search?term=${entryQuery}`;
  elements.listeningNoteYouTubeMusic.href =
    `https://music.youtube.com/search?q=${entryQuery}`;

  elements.listeningNoteSpotify.setAttribute(
    "aria-label",
    `${text.editorial.listenNow} — Spotify: ${entryDescription}`
  );
  elements.listeningNoteAppleMusic.setAttribute(
    "aria-label",
    `${text.editorial.listenNow} — Apple Music: ${entryDescription}`
  );
  elements.listeningNoteYouTubeMusic.setAttribute(
    "aria-label",
    `${text.editorial.listenNow} — YouTube Music: ${entryDescription}`
  );

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

  if (!record.coverUrl) {
    elements.coverImage.alt = "";
    elements.coverImage.removeAttribute("src");
    elements.coverArt.classList.remove("has-real-cover");
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
    return;
  }

  const expectedUrl = record.coverUrl;
  const pendingImage = new Image();

  elements.coverArt.classList.add("is-loading");
  elements.coverArt.setAttribute("aria-busy", "true");

  const revealCover = () => {
    if (renderCoverImage.currentRequest !== requestId) {
      return;
    }

    elements.coverImage.src = expectedUrl;
    elements.coverImage.alt = `${record.title} — ${record.artist}`;
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.classList.add("has-real-cover");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
  };

  pendingImage.onload = () => {
    if (typeof pendingImage.decode === "function") {
      pendingImage.decode()
        .catch(() => {})
        .finally(revealCover);
    } else {
      revealCover();
    }
  };

  pendingImage.onerror = () => {
    if (renderCoverImage.currentRequest !== requestId) {
      return;
    }

    elements.coverImage.alt = "";
    elements.coverImage.removeAttribute("src");
    elements.coverArt.classList.remove("is-loading");
    elements.coverArt.classList.remove("has-real-cover");
    elements.coverArt.removeAttribute("aria-busy");
    scheduleFixedStackCovers();
    prepareRecommendationQueue();
  };

  pendingImage.decoding = "async";
  pendingImage.fetchPriority = "high";
  pendingImage.src = expectedUrl;
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

  const candidates = getFilteredRecords().filter(
    (record) => record.id !== state.current.id
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
    const randomIndex = Math.floor(
      Math.random() * remainingCandidates.length
    );
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
      text.recommendation.heard;
    return;
  }

  const alreadySaved = state.collection.some(
    (record) => record.id === state.current.id
  );

  elements.heardButton.textContent = alreadySaved
    ? `✓ ${text.recommendation.saved}`
    : text.recommendation.heard;

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

    localStorage.setItem(
      "tlg-collection",
      JSON.stringify(state.collection)
    );
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

  localStorage.setItem(
    "tlg-collection",
    JSON.stringify(state.collection)
  );

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
}

elements.formatButtons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.formatButtons.forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    state.format = button.dataset.format;

    if (state.records.length > 0) {
      chooseRecord(true);
    }
  });
});

elements.discoverButton.addEventListener(
  "click",
  () => chooseRecord(true)
);

elements.anotherButton.addEventListener(
  "click",
  () => chooseRecord(true)
);

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
  elements.filterMessage.textContent = "";
});

elements.genreFilter.addEventListener("change", () => {
  elements.filterMessage.textContent = "";
});

applyTranslations();
renderCollection();
loadCatalog();
