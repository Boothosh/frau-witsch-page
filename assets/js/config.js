// Zentrale Konfiguration. Nur diese Datei muss angepasst werden.

export const firebaseConfig = {
  apiKey: "AIzaSyBW2nzkTPGNrGIgZYv9CPyePSyUMt1ncyE",
  authDomain: "frau-witsch.firebaseapp.com",
  projectId: "frau-witsch",
  storageBucket: "frau-witsch.firebasestorage.app",
  messagingSenderId: "152963100853",
  appId: "1:152963100853:web:02257d5aecaaacea5d0efc"
};

// Die beiden einzigen Konten, die auf die Seite dürfen.
// Absichtlich die Firebase-UIDs und nicht die Mailadressen: die Datei liegt
// in einem öffentlichen Repo, und eine UID verrät niemandem etwas.
// Zu finden in der Konsole unter Authentication -> Users.
// Muss identisch in firebase/firestore.rules und firebase/storage.rules stehen.
export const ERLAUBTE_UIDS = [
  "jMFLUhdCBxSegtVn0Jv8feuNMc02",
  "J3ktYPx5tKOw3BJ0SklyBM888Gu1"
];

// Anzeigenamen pro UID.
export const NAMEN = {
  "jMFLUhdCBxSegtVn0Jv8feuNMc02": "Max",
  "J3ktYPx5tKOw3BJ0SklyBM888Gu1": "Frau von und zu Check"
};

// Wer auf der Startseite begrüßt wird, wenn niemand eingeloggt ist.
export const SEITEN_TITEL = "Frau von und zu Check";

// Bild der Woche: Titel, die aus dem Dateinamen falsch rekonstruiert werden,
// kannst du hier überschreiben. Schlüssel = Dateiname ohne Endung.
export const TITEL_AUSNAHMEN = {
  // "Michaela_am_Meer": "Michaela am Meer"
};

// Zugverbindung. IDs aus dem Fahrplan der SBB (transport.opendata.ch).
// Achtung: "Freiburg" alleine trifft Fribourg in der Schweiz, daher feste IDs.
export const ZUG = {
  vonId: "8014350",   // Freiburg(Breisgau) Hbf
  vonName: "Freiburg im Breisgau",
  nachId: "8503000",  // Zürich HB
  nachName: "Zürich HB"
};
