import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { firebaseConfig, ERLAUBTE_UIDS, NAMEN } from "./config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

await setPersistence(auth, browserLocalPersistence);

export function istErlaubt(user) {
  return !!user && ERLAUBTE_UIDS.includes(user.uid);
}

export function nameVon(user) {
  return user ? nameVonUid(user.uid) : "";
}

/** Anzeigename zu einer UID. */
export function nameVonUid(uid) {
  return NAMEN[uid] || "Sie";
}

/** Die UID der jeweils anderen Person. */
export function anderePerson(meineUid) {
  return ERLAUBTE_UIDS.find(u => u !== meineUid) || null;
}

/** Ruft cb(user) auf, sobald der Auth-Status feststeht. Nicht erlaubte Konten fliegen raus. */
export function beiAnmeldung(cb) {
  return onAuthStateChanged(auth, async user => {
    if (user && !istErlaubt(user)) {
      await signOut(auth);
      cb(null);
      return;
    }
    cb(user);
  });
}

/** Schützt eine Unterseite: ohne Login geht es zurück zum Anmeldeformular. */
export function seiteSchuetzen(cb) {
  return beiAnmeldung(user => {
    if (!user) {
      location.replace("login.html?weiter=" + encodeURIComponent(location.pathname.split("/").pop()));
      return;
    }
    cb(user);
  });
}

export { signInWithEmailAndPassword, signOut, onAuthStateChanged };
