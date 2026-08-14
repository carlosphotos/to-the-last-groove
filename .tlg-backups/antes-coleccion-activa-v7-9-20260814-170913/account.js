const FIREBASE_SDK_VERSION = "12.16.0";
const progressApi = window.TLG_PROGRESS;
const translations = window.TLG_TRANSLATIONS;
const firebaseConfig = window.TLG_FIREBASE_CONFIG;

const elements = {
  panel: document.querySelector("#collectionSync"),
  headerAccount: document.querySelector("#headerAccount"),
  headerAccountAvatar: document.querySelector("#headerAccountAvatar"),
  headerAccountLabel: document.querySelector("#headerAccountLabel"),
  avatar: document.querySelector("#collectionSyncAvatar"),
  eyebrow: document.querySelector("#collectionSyncEyebrow"),
  title: document.querySelector("#collectionSyncTitle"),
  description: document.querySelector("#collectionSyncDescription"),
  signIn: document.querySelector("#collectionSignIn"),
  signOut: document.querySelector("#collectionSignOut"),
  status: document.querySelector("#collectionSyncStatus")
};

let auth;
let database;
let authSdk;
let firestoreSdk;
let googleProvider;
let activeUser = null;
let unsubscribeFromProgress = null;
let saveTimer = null;
let syncedCount = 0;
let interfaceState = "connecting";

function hasFirebaseConfig(config) {
  const required = [
    "apiKey", "authDomain", "projectId", "appId"
  ];

  return Boolean(
    config && required.every((key) => String(config[key] || "").trim())
  );
}

function getText() {
  const language = progressApi?.getLanguage?.() || "es";
  return translations?.[language]?.account || translations.es.account;
}

function interpolate(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function normalizeProgress(entries) {
  const unique = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!/^(album|song)-\d{3}$/.test(entry?.id || "")) {
      return;
    }

    const parsedDate = Date.parse(entry.listenedAt || "");
    const listenedAt = Number.isFinite(parsedDate)
      ? new Date(parsedDate).toISOString()
      : new Date().toISOString();
    const previous = unique.get(entry.id);

    if (!previous || listenedAt < previous.listenedAt) {
      unique.set(entry.id, { id: entry.id, listenedAt });
    }
  });

  return [...unique.values()]
    .sort((first, second) => second.listenedAt.localeCompare(first.listenedAt))
    .slice(0, 200);
}

function mergeProgress(...collections) {
  return normalizeProgress(collections.flat());
}

function progressSignature(entries) {
  return normalizeProgress(entries)
    .map((entry) => `${entry.id}|${entry.listenedAt}`)
    .sort()
    .join("\n");
}

function renderAccount() {
  const text = getText();
  const signedIn = Boolean(activeUser);
  const hasAvatar = Boolean(signedIn && activeUser?.photoURL);
  const headerLabel = signedIn
    ? text.headerAccount
    : text.headerSignIn;

  if (elements.headerAccount) {
    elements.headerAccount.classList.toggle("is-signed-in", signedIn);
    elements.headerAccount.classList.toggle("has-avatar", hasAvatar);
    elements.headerAccount.setAttribute("aria-label", headerLabel);
    elements.headerAccount.title = headerLabel;
    elements.headerAccountLabel.textContent = headerLabel;
    elements.headerAccountAvatar.hidden = !hasAvatar;

    if (hasAvatar) {
      elements.headerAccountAvatar.src = activeUser.photoURL;
    } else {
      elements.headerAccountAvatar.removeAttribute("src");
    }
  }

  elements.panel.classList.toggle("is-signed-in", signedIn);
  elements.panel.classList.toggle("has-avatar", hasAvatar);
  elements.eyebrow.textContent = text.eyebrow;
  elements.signOut.textContent = text.signOut;
  elements.signIn.hidden = signedIn;
  elements.signOut.hidden = !signedIn;
  elements.signIn.disabled = interfaceState === "connecting";
  elements.avatar.hidden = !hasAvatar;

  if (hasAvatar) {
    elements.avatar.src = activeUser.photoURL;
  } else {
    elements.avatar.removeAttribute("src");
  }

  if (signedIn) {
    const name = activeUser.displayName || activeUser.email || "Google";
    elements.title.textContent = text.signedInTitle;
    elements.description.textContent = interpolate(
      text.signedInDescription,
      { name }
    );
    elements.status.textContent = interfaceState === "error"
      ? text.error
      : interpolate(
          text.synced,
          { count: String(syncedCount) }
        );
    return;
  }

  elements.title.textContent = text.signedOutTitle;
  elements.description.textContent = text.signedOutDescription;
  elements.signIn.textContent = interfaceState === "connecting"
    ? text.connecting
    : text.signIn;
  elements.status.textContent = interfaceState === "error"
    ? text.error
    : "";
}

async function writeRemoteProgress(user, progress) {
  if (!user || !database) {
    return;
  }

  const normalized = normalizeProgress(progress);
  const userDocument = firestoreSdk.doc(
    database,
    "users",
    user.uid
  );

  await firestoreSdk.setDoc(userDocument, {
    schemaVersion: 1,
    collection: normalized,
    updatedAt: firestoreSdk.serverTimestamp()
  }, { merge: true });

  syncedCount = normalized.length;
  renderAccount();
}

function scheduleRemoteSave(progress) {
  if (!activeUser) {
    return;
  }

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    writeRemoteProgress(activeUser, progress).catch(handleSyncError);
  }, 350);
}

function handleSyncError(error) {
  console.error("No se pudo sincronizar la colección:", error);
  interfaceState = "error";
  renderAccount();
}

async function connectUserProgress(user) {
  await progressApi.whenReady;

  const userDocument = firestoreSdk.doc(database, "users", user.uid);
  const snapshot = await firestoreSdk.getDoc(userDocument);
  const remoteProgress = snapshot.exists()
    ? snapshot.data().collection
    : [];
  const mergedProgress = mergeProgress(
    progressApi.getAnonymousCollection(),
    progressApi.getUserCollection(user.uid),
    remoteProgress
  );

  progressApi.useUserCollection(user.uid, mergedProgress);
  await writeRemoteProgress(user, mergedProgress);

  unsubscribeFromProgress?.();
  unsubscribeFromProgress = firestoreSdk.onSnapshot(
    userDocument,
    (nextSnapshot) => {
      if (!nextSnapshot.exists() || !activeUser) {
        return;
      }

      const incoming = normalizeProgress(
        nextSnapshot.data().collection
      );
      const local = progressApi.getCollection();
      const merged = mergeProgress(local, incoming);

      if (progressSignature(merged) !== progressSignature(local)) {
        progressApi.useUserCollection(activeUser.uid, merged);
      }
      if (progressSignature(merged) !== progressSignature(incoming)) {
        scheduleRemoteSave(merged);
      }

      syncedCount = merged.length;
      interfaceState = "ready";
      renderAccount();
    },
    handleSyncError
  );
}

async function handleAuthState(user) {
  activeUser = user;
  unsubscribeFromProgress?.();
  unsubscribeFromProgress = null;
  window.clearTimeout(saveTimer);

  if (!user) {
    await progressApi.whenReady;
    progressApi.useAnonymousCollection();
    syncedCount = progressApi.getCollection().length;
    interfaceState = "ready";
    renderAccount();
    return;
  }

  interfaceState = "connecting";
  renderAccount();

  try {
    await connectUserProgress(user);
    interfaceState = "ready";
    renderAccount();
  } catch (error) {
    handleSyncError(error);
  }
}

async function signInWithGoogle() {
  if (!auth || interfaceState === "connecting") {
    return;
  }

  interfaceState = "connecting";
  renderAccount();
  auth.languageCode = progressApi.getLanguage();

  try {
    const prefersRedirect = window.matchMedia("(max-width: 700px)").matches;

    if (prefersRedirect) {
      await authSdk.signInWithRedirect(auth, googleProvider);
    } else {
      await authSdk.signInWithPopup(auth, googleProvider);
    }
  } catch (error) {
    if (error.code === "auth/popup-blocked") {
      await authSdk.signInWithRedirect(auth, googleProvider);
      return;
    }
    handleSyncError(error);
  }
}

async function signOutUser() {
  if (!activeUser) {
    return;
  }

  try {
    await writeRemoteProgress(activeUser, progressApi.getCollection());
    await authSdk.signOut(auth);
  } catch (error) {
    handleSyncError(error);
  }
}

async function initializeFirebase() {
  elements.headerAccount.hidden = false;
  elements.panel.hidden = false;
  renderAccount();

  try {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
    const [appSdk, loadedAuthSdk, loadedFirestoreSdk] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`)
    ]);

    authSdk = loadedAuthSdk;
    firestoreSdk = loadedFirestoreSdk;
    const firebaseApp = appSdk.initializeApp(firebaseConfig);
    auth = authSdk.getAuth(firebaseApp);
    database = firestoreSdk.getFirestore(firebaseApp);
    googleProvider = new authSdk.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    await authSdk.setPersistence(
      auth,
      authSdk.browserLocalPersistence
    );

    authSdk.onAuthStateChanged(auth, handleAuthState);
    await authSdk.getRedirectResult(auth);
  } catch (error) {
    handleSyncError(error);
  }
}

elements.signIn?.addEventListener("click", signInWithGoogle);
elements.signOut?.addEventListener("click", signOutUser);
elements.headerAccount?.addEventListener("click", () => {
  document.querySelector("#openCollection")?.click();

  if (!activeUser) {
    requestAnimationFrame(() => elements.signIn?.focus());
  }
});

window.addEventListener("tlg-progress-change", (event) => {
  syncedCount = normalizeProgress(event.detail).length;
  scheduleRemoteSave(event.detail);
  renderAccount();
});

window.addEventListener("tlg-language-change", renderAccount);

if (progressApi && elements.panel && hasFirebaseConfig(firebaseConfig)) {
  initializeFirebase();
} else if (firebaseConfig) {
  console.error("La configuración de Firebase está incompleta.");
}
