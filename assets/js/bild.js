import { db, storage, seiteSchuetzen } from "./firebase.js";
import { doc, onSnapshot, runTransaction, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ref, listAll, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { TITEL_AUSNAHMEN } from "./config.js";
import { titelAusDateiname } from "./titel.js";
import { wochenSchluessel, wochenDifferenz } from "./ui.js";

/* Ordner im Firebase Storage, in dem die Bilder liegen. */
const ORDNER = "bilder";
const BILDENDUNGEN = /\.(jpe?g|png|webp|gif|avif|heic)$/i;

const standRef = doc(db, "bild", "stand");
const E = id => document.getElementById(id);

let dateien = [];

/* Was beim Suchen gefunden wurde - fuer die Meldung, wenn nichts da ist. */
let befund = { dateien: 0, ordner: 0 };

seiteSchuetzen(async () => {
  try {
    dateien = await dateienLaden();
  } catch (e) {
    fertig();
    hinweis("fehler", speicherFehler(e));
    return;
  }

  if (!dateien.length) {
    fertig();
    hinweis("info", `<b>Hier ist noch nichts.</b><div class="hilfe">
      Sobald Bilder im Speicher liegen, ist hier jede Woche ein anderes
      zu sehen.<br>
      <span style="opacity:.75">Gesucht wurde in <code>${ORDNER}/</code> und im
      ganzen Speicher. Gefunden: ${befund.dateien} ${befund.dateien === 1 ? "Datei" : "Dateien"},
      ${befund.ordner} ${befund.ordner === 1 ? "Ordner" : "Ordner"}.</span></div>`);
    return;
  }

  /* Wenn seit dem letzten Aufruf eine Woche vergangen ist, weiterschalten. */
  await wocheWeiterschalten(dateien.length);

  onSnapshot(standRef, s => {
    const d = s.data();
    if (!d) return;
    zeigen(((d.index % dateien.length) + dateien.length) % dateien.length);
  }, e => {
    fertig();
    hinweis("fehler", "Der Wochenstand konnte nicht gelesen werden. " + e.message);
  });
});

/* ---------- Bilder aus dem Storage holen ---------- */

/**
 * Sucht zuerst in "bilder/", sonst im ganzen Bucket. Unterordner werden
 * mitgenommen. So ist es egal, ob die Bilder direkt im Stamm liegen, in
 * einem anders geschriebenen Ordner oder eine Ebene tiefer.
 */
async function dateienLaden() {
  befund = { dateien: 0, ordner: 0 };

  for (const start of [ORDNER, ""]) {
    const treffer = await durchsuchen(ref(storage, start));
    if (treffer.length) return sortiert(treffer);
  }
  return [];
}

async function durchsuchen(verzeichnis, tiefe = 0) {
  const ergebnis = await listAll(verzeichnis);

  befund.dateien += ergebnis.items.length;
  befund.ordner += ergebnis.prefixes.length;

  let treffer = ergebnis.items.filter(i => BILDENDUNGEN.test(i.name));

  if (tiefe < 3) {
    for (const unterordner of ergebnis.prefixes) {
      treffer = treffer.concat(await durchsuchen(unterordner, tiefe + 1));
    }
  }
  return treffer;
}

function sortiert(dateien) {
  return dateien.sort((a, b) =>
    a.name.localeCompare(b.name, "de", { numeric: true }));
}

function speicherFehler(e) {
  const code = (e && e.code) || "";
  if (code === "storage/unauthorized") {
    return "Keine Berechtigung für den Speicher. Sind die aktuellen Regeln aus " +
           "<code>firebase/storage.rules</code> in der Firebase-Konsole " +
           "veröffentlicht?";
  }
  if (code === "storage/unknown" || code === "storage/retry-limit-exceeded") {
    return "Der Speicher ist nicht erreichbar. Ist Firebase Storage im Projekt eingerichtet?";
  }
  return "Die Bilder konnten nicht geladen werden. " + (e.message || code);
}

/* ---------- Wochenschaltung ---------- */
async function wocheWeiterschalten(anzahl) {
  const jetzt = wochenSchluessel();

  try {
    await runTransaction(db, async t => {
      const s = await t.get(standRef);

      if (!s.exists()) {
        t.set(standRef, { index: 0, woche: jetzt, aktualisiert: serverTimestamp() });
        return;
      }

      const d = s.data();
      if (d.woche === jetzt) return;                 // diese Woche schon erledigt

      if (!(wochenDifferenz(d.woche, jetzt) > 0)) {  // Uhr verstellt o. Ä.
        t.update(standRef, { woche: jetzt });
        return;
      }

      /* Immer nur ein Bild weiter, ganz gleich wie lange niemand
         hergeschaut hat. Sonst wuerden die uebersprungenen Bilder
         nie jemand zu sehen bekommen. */
      const aktuell = Number.isFinite(d.index) ? d.index : -1;

      t.update(standRef, {
        index: (((aktuell + 1) % anzahl) + anzahl) % anzahl,
        woche: jetzt,
        aktualisiert: serverTimestamp()
      });
    });
  } catch (e) {
    console.warn("Wochenstand konnte nicht aktualisiert werden", e);
  }
}

/* ---------- Anzeige ---------- */
async function zeigen(index) {
  const datei = dateien[index];
  const titel = titelAusDateiname(datei.name, TITEL_AUSNAHMEN);

  E("titel").textContent = titel;
  E("zaehler").textContent = `Bild ${index + 1} von ${dateien.length}`;
  E("wochenZeile").textContent = "Kalenderwoche " + wochenSchluessel().split("-W")[1];
  E("rahmen").hidden = false;
  fertig();

  const bild = E("bild");
  bild.alt = titel;

  try {
    const url = await getDownloadURL(datei);
    bild.classList.remove("da");
    bild.onload = () => {
      bild.classList.add("da");
      E("schimmer").classList.add("weg");
    };
    bild.onerror = () => hinweis("fehler", "Das Bild konnte nicht geladen werden.");
    bild.src = url;
  } catch (e) {
    hinweis("fehler", speicherFehler(e));
  }

  countdownZeigen();
}

function countdownZeigen() {
  const jetzt = new Date();
  /* Naechster Montag, 0 Uhr. */
  const naechster = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  naechster.setDate(naechster.getDate() + ((8 - (naechster.getDay() || 7)) % 7 || 7));

  const tage = Math.round((naechster - new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())) / 86400000);

  const p = E("naechstes");
  p.hidden = false;
  p.textContent = tage === 1
    ? "Morgen gibt es das nächste Bild."
    : `Das nächste Bild gibt es in ${tage} Tagen.`;
}

function fertig() { E("laden").hidden = true; }

function hinweis(art, html) {
  E("meldung").innerHTML = `<div class="hinweis ${art}">${html}</div>`;
}
