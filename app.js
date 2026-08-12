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
  collection: getSavedCollection()
};

const elements = {
  navLinks: [...document.querySelectorAll(".nav-link")],
  languageOptions: [
  ...document.querySelectorAll(".language-option")
],

  eyebrow: document.querySelector(".discovery-controls .eyebrow"),
  question: document.querySelector(".discovery-controls h1"),
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

  listenButton: document.querySelector("#listenButton"),
  heardButton: document.querySelector("#heardButton"),
  anotherButton: document.querySelector("#anotherButton"),

  openCollection: document.querySelector("#openCollection"),
  closeCollection: document.querySelector("#closeCollection"),
  collectionDialog: document.querySelector("#collectionDialog"),
  collectionGrid: document.querySelector("#collectionGrid"),
  collectionCount: document.querySelector("#collectionCount"),
  collectionEyebrow: document.querySelector(".collection-header .eyebrow"),
  collectionTitle: document.querySelector(".collection-header h2"),

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

  elements.listenButton.textContent =
    text.recommendation.listen;

  elements.anotherButton.textContent =
    text.recommendation.another;

  elements.collectionEyebrow.textContent =
    text.collection.eyebrow;

  elements.collectionTitle.textContent =
    text.collection.title;

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

  const randomIndex = Math.floor(
    Math.random() * candidates.length
  );

  const selectedRecord = candidates[randomIndex];

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

  elements.coverArt.className =
    `cover-art ${record.coverClass}`;

  elements.featuredRecord.classList.toggle(
    "is-single",
    record.type === "song"
  );

  renderCoverImage(record);
  renderStackCovers(record);

  elements.recommendationTitle.textContent =
    record.title;

  elements.recommendationArtist.textContent =
    record.artist;

  elements.recommendationDetails.textContent =
    `${record.year} · ${localizedGenre} · ${record.duration}`;

  elements.recommendationDescription.textContent =
    record.description[state.language] ||
    record.description.es;

  elements.listenButton.href =
    `https://music.youtube.com/search?q=${encodeURIComponent(
      record.searchQuery
    )}`;

  updateHeardButton();
}

function renderCoverImage(record) {
  elements.coverImage.onload = null;
  elements.coverImage.onerror = null;
  elements.coverImage.alt = "";
  elements.coverImage.removeAttribute("src");

  if (!record.coverUrl) {
    return;
  }

  const expectedUrl = record.coverUrl;

  elements.coverImage.onload = () => {
    if (elements.coverImage.src !== expectedUrl) {
      return;
    }

    elements.coverImage.alt = `${record.title} — ${record.artist}`;
    elements.coverArt.classList.add("has-real-cover");
  };

  elements.coverImage.onerror = () => {
    elements.coverArt.classList.remove("has-real-cover");
    elements.coverImage.alt = "";
  };

  elements.coverImage.src = record.coverUrl;
}

function renderStackCovers(currentRecord) {
  const uniqueRecords = [...new Map(
    state.records
      .filter((record) =>
        record.id !== currentRecord.id && record.coverUrl
      )
      .map((record) => [record.coverUrl, record])
  ).values()];

  const shuffledRecords = uniqueRecords
    .sort(() => Math.random() - 0.5)
    .slice(0, elements.stackCovers.length);

  elements.stackCovers.forEach((image, index) => {
    const stackRecord = shuffledRecords[index];
    const sleeve = image.parentElement;

    image.hidden = true;
    sleeve.classList.remove("has-real-cover");
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");

    if (!stackRecord) {
      return;
    }

    image.onload = () => {
      image.hidden = false;
      sleeve.classList.add("has-real-cover");
    };

    image.onerror = () => {
      image.hidden = true;
      sleeve.classList.remove("has-real-cover");
    };

    image.src = stackRecord.coverUrl;
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

    item.className = "collection-item";

    item.innerHTML = `
      <div
        class="collection-cover"
        style="background-color:
          ${coverColors[record.coverClass] || "#2946a8"}"
      >
        <span class="played-stamp">
          ${text.collection.stamp} · ${formattedDate}
        </span>

        <strong>${record.title}</strong>
      </div>

      <p class="collection-meta">
        <strong>${record.artist}</strong><br>
        ${record.year} · ${localizedGenre}
      </p>
    `;

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

elements.decadeFilter.addEventListener("change", () => {
  elements.filterMessage.textContent = "";
});

elements.genreFilter.addEventListener("change", () => {
  elements.filterMessage.textContent = "";
});

applyTranslations();
renderCollection();
loadCatalog();
