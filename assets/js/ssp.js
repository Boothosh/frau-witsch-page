import { db, auth, seiteSchuetzen, nameVon, nameVonUid, anderePerson } from "./firebase.js";
import {
  doc, setDoc, onSnapshot, runTransaction, collection,
  query, orderBy, serverTimestamp, updateDoc, deleteField
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ZEICHEN, BEZEICHNUNG, SPIELZUEGE, vergleiche } from "./symbole.js";
import { wellenAktivieren, konfetti, vorWieLange, el, leeren } from "./ui.js";

wellenAktivieren();

const standRef = doc(db, "ssp", "stand");
const verlaufRef = collection(db, "ssp_verlauf");

let ich = null;
let nameAndere = "Sie";
let stand = null;
let verlauf = [];
let geschrieben = new Set();
let konfettiRunde = -1;
let letzteAnsicht = "";
let sichtbar = 12;

/* ---------- Elemente ---------- */
const E = id => document.getElementById(id);
const wahlReihe = E("wahlReihe");

/** Liefert die Zahl, oder den Ersatzwert wenn sie fehlt oder kaputt ist. */
function zahlOder(wert, ersatz) {
  return Number.isFinite(wert) ? wert : ersatz;
}

let buehneDa = false;
function buehneZeigen() {
  if (buehneDa) return;
  buehneDa = true;
  E("laden").hidden = true;
  E("buehne").hidden = false;
}

/* ---------- Start ---------- */
seiteSchuetzen(async user => {
  ich = user;

  nameAndere = nameVonUid(anderePerson(user.uid));
  E("nameAndere").textContent = nameAndere;

  await standSicherstellen();

  onSnapshot(standRef,
    s => {
      stand = s.data() || null;
      try { zeichnen(); } catch (e) { console.error("Zeichnen fehlgeschlagen", e); }
      if (stand) buehneZeigen();
    },
    e => {
      buehneZeigen();
      E("brunnenHinweis").textContent = "Der Spielstand ist gerade nicht erreichbar.";
      console.error(e);
    });

  onSnapshot(query(verlaufRef, orderBy("runde", "desc")),
    s => {
      verlauf = s.docs.map(d => d.data());
      try { statistikZeichnen(); verlaufZeichnen(); }
      catch (e) { console.error("Verlauf zeichnen fehlgeschlagen", e); }
    },
    e => console.warn("Verlauf nicht lesbar", e));
});

async function standSicherstellen() {
  try {
    await runTransaction(db, async t => {
      const s = await t.get(standRef);
      if (!s.exists()) {
        t.set(standRef, { runde: 1, mitBrunnen: true, wahl: {}, namen: {} });
        return;
      }
      if (!Number.isFinite(s.data().runde)) t.update(standRef, { runde: 1 });
    });
  } catch (e) { console.warn("Stand konnte nicht angelegt werden", e); }
}

/* ---------- Ableitungen ---------- */
function wahlen() { return (stand && stand.wahl) || {}; }
function meineWahl() { return wahlen()[ich.uid] || null; }
function andereId() { return Object.keys(wahlen()).find(u => u !== ich.uid) || null; }
function andereWahl() { const u = andereId(); return u ? wahlen()[u] : null; }
function beideDa() { return !!meineWahl() && !!andereWahl(); }
function mitBrunnen() { return !stand || stand.mitBrunnen !== false; }

/* ---------- Zeichnen ---------- */
function zeichnen() {
  if (!stand) return;

  E("rundenZeile").textContent =
    `Runde ${stand.runde}` + (mitBrunnen() ? " · mit Brunnen" : " · ohne Brunnen");

  wahlKnoepfeZeichnen();

  const meine = meineWahl();
  const ihre = andereWahl();
  const fertig = beideDa();

  /* Ansicht nur bei echter Änderung neu animieren */
  const ansicht = `${stand.runde}|${meine}|${!!ihre}|${fertig}`;
  const neu = ansicht !== letzteAnsicht;
  letzteAnsicht = ansicht;

  /* Meine Hand */
  handSetzen(E("handIch"), meine, true, fertig, neu);
  E("standIch").textContent = meine ? "hat gewählt" : "du bist dran";
  E("standIch").classList.toggle("aktiv", !meine);

  /* Ihre Hand */
  handSetzen(E("handDu"), ihre, fertig, fertig, neu);
  E("standDu").textContent = ihre ? "hat gewählt" : "hat noch nicht gewählt";
  E("standDu").classList.toggle("aktiv", false);

  E("gegenText").textContent = fertig ? "vs" : "…";

  /* Auswahltitel */
  E("auswahlTitel").textContent =
    fertig ? "Runde gespielt." :
    meine ? `Gewählt. Jetzt ist ${nameAndere} dran.` :
    "Was nimmst du?";

  /* Brunnen-Knopf */
  const bk = E("brunnenKnopf");
  bk.textContent = mitBrunnen() ? "Ohne Brunnen spielen" : "Mit Brunnen spielen";
  const gesperrt = !!ihre;
  bk.disabled = gesperrt;
  E("brunnenHinweis").textContent = gesperrt
    ? `Geht gerade nicht – ${nameAndere} hat sich schon entschieden.`
    : "";

  E("neueRunde").hidden = !fertig;

  ergebnisZeichnen(neu);
}

function handSetzen(knoten, zug, aufdecken, fertig, neu) {
  leeren(knoten);
  knoten.classList.remove("gefuellt", "verdeckt", "aufgedeckt", "zittert", "siegt");

  if (zug && aufdecken) {
    knoten.innerHTML = ZEICHEN[zug];
    knoten.classList.add("gefuellt");
    if (neu && fertig) knoten.classList.add("aufgedeckt");
  } else if (zug) {
    knoten.appendChild(el("span", "frage", "✓"));
    knoten.classList.add("verdeckt");
  } else {
    knoten.appendChild(el("span", "frage", "?"));
  }
}

function wahlKnoepfeZeichnen() {
  const zuege = SPIELZUEGE.filter(z => z !== "brunnen" || mitBrunnen());
  const meine = meineWahl();
  const gesperrt = !!meine || beideDa();

  const schluessel = zuege.join(",") + "|" + meine + "|" + gesperrt;
  if (wahlReihe.dataset.schluessel === schluessel) return;
  wahlReihe.dataset.schluessel = schluessel;

  leeren(wahlReihe);
  for (const z of zuege) {
    const b = document.createElement("button");
    b.className = "wahl" + (meine === z ? " gewaehlt" : "");
    b.type = "button";
    b.disabled = gesperrt;
    b.innerHTML = `${ZEICHEN[z]}<span>${BEZEICHNUNG[z]}</span>`;
    b.addEventListener("click", () => waehlen(z));
    wahlReihe.appendChild(b);
  }
}

function ergebnisZeichnen(neu) {
  const kasten = E("ergebnis");

  if (!beideDa()) { kasten.hidden = true; kasten.className = "ergebnis"; return; }

  const meine = meineWahl(), ihre = andereWahl();
  const r = vergleiche(meine, ihre);

  kasten.hidden = false;
  kasten.className = "ergebnis " + (r === 1 ? "gewonnen" : r === -1 ? "verloren" : "unentschieden");
  kasten.innerHTML = r === 0
    ? `<h2>Unentschieden</h2><p>Beide ${BEZEICHNUNG[meine]}. Nochmal?</p>`
    : r === 1
      ? `<h2>Du hast gewonnen! 🎉</h2><p>${BEZEICHNUNG[meine]} schlägt ${BEZEICHNUNG[ihre]}.</p>`
      : `<h2>${nameAndere} gewinnt</h2><p>${BEZEICHNUNG[ihre]} schlägt ${BEZEICHNUNG[meine]}.</p>`;

  E(r === 1 ? "handIch" : "handDu").classList.toggle("siegt", r !== 0);

  if (r === 1 && konfettiRunde !== stand.runde && neu) {
    konfettiRunde = stand.runde;
    setTimeout(() => konfetti(130), 260);
  }

  verlaufSchreiben();
}

/* ---------- Aktionen ---------- */
async function waehlen(zug) {
  if (meineWahl() || beideDa()) return;
  try {
    await setDoc(standRef, {
      wahl: { [ich.uid]: zug },
      namen: { [ich.uid]: nameVon(ich) },
      aktualisiert: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error(e); }
}

E("brunnenKnopf").addEventListener("click", async () => {
  if (andereWahl()) return;
  const neuerWert = !mitBrunnen();
  const daten = { mitBrunnen: neuerWert };

  /* Wenn Brunnen verschwindet und ich ihn gewählt hatte, ist meine Wahl hinfällig. */
  if (!neuerWert && meineWahl() === "brunnen") {
    daten[`wahl.${ich.uid}`] = deleteField();
  }
  try { await updateDoc(standRef, daten); } catch (e) { console.error(e); }
});

E("neueRunde").addEventListener("click", async e => {
  const b = e.currentTarget;
  b.disabled = true;
  const meine = zahlOder(stand && stand.runde, null);
  try {
    await runTransaction(db, async t => {
      const s = await t.get(standRef);
      const d = s.data();
      if (!d) return;

      const serverRunde = zahlOder(d.runde, null);
      /* Nur abbrechen, wenn jemand anderes schon weitergeschaltet hat. */
      if (meine !== null && serverRunde !== null && serverRunde !== meine) return;

      t.update(standRef, {
        runde: (serverRunde === null ? 0 : serverRunde) + 1,
        wahl: {},
        aktualisiert: serverTimestamp()
      });
    });
  } catch (err) { console.error(err); }
  finally { b.disabled = false; }
});

/* Ergebnis in den Verlauf. Die Runde ist die Dokument-ID, doppelt schreiben schadet nicht. */
async function verlaufSchreiben() {
  const runde = zahlOder(stand.runde, null);
  if (runde === null || geschrieben.has(runde)) return;
  geschrieben.add(runde);

  const meine = meineWahl(), ihre = andereWahl(), du = andereId();
  const r = vergleiche(meine, ihre);

  try {
    await setDoc(doc(verlaufRef, String(runde)), {
      runde,
      wahl: { [ich.uid]: meine, [du]: ihre },
      namen: { [ich.uid]: nameVon(ich), [du]: (stand.namen && stand.namen[du]) || nameAndere },
      gewinner: r === 0 ? "unentschieden" : (r === 1 ? ich.uid : du),
      mitBrunnen: mitBrunnen(),
      zeit: serverTimestamp()
    });
  } catch (e) {
    geschrieben.delete(runde);
    console.error(e);
  }
}

/* ---------- Statistik ---------- */
function statistikZeichnen() {
  let meine = 0, ihre = 0, un = 0;
  for (const v of verlauf) {
    if (v.gewinner === "unentschieden") un++;
    else if (v.gewinner === ich.uid) meine++;
    else ihre++;
  }
  const gesamt = meine + ihre + un;

  E("statistik").innerHTML = `
    <div class="stat-kachel ich"><span class="stat-zahl">${meine}</span><span class="stat-text">für dich</span></div>
    <div class="stat-kachel"><span class="stat-zahl">${un}</span><span class="stat-text">unentschieden</span></div>
    <div class="stat-kachel du"><span class="stat-zahl">${ihre}</span><span class="stat-text">für ${nameAndere}</span></div>`;

  const balken = E("balken");
  balken.hidden = gesamt === 0;
  if (gesamt) {
    E("balkenIch").style.width = (meine / gesamt * 100) + "%";
    E("balkenUn").style.width  = (un / gesamt * 100) + "%";
    E("balkenDu").style.width  = (ihre / gesamt * 100) + "%";
  }
}

/* ---------- Verlauf ---------- */
function verlaufZeichnen() {
  const liste = E("verlauf");
  leeren(liste);

  if (!verlauf.length) {
    liste.innerHTML = `<p class="leer">Noch keine Runde gespielt. Fang an!</p>`;
    E("mehr").hidden = true;
    return;
  }

  for (const v of verlauf.slice(0, sichtbar)) {
    const meine = v.wahl[ich.uid];
    const duId = Object.keys(v.wahl).find(u => u !== ich.uid);
    const ihre = v.wahl[duId];

    const un = v.gewinner === "unentschieden";
    const ichGewann = v.gewinner === ich.uid;
    const punkt = un ? "un" : (ichGewann ? "ich" : "du");
    const text = un ? "Unentschieden" : (ichGewann ? "<b>Du</b> hast gewonnen" : `<b>${nameAndere}</b> hat gewonnen`);

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="v-punkt ${punkt}"></span>
      <span class="v-runde">#${v.runde}</span>
      <span class="v-paar">${ZEICHEN[meine] || ""}<span class="v-gegen">:</span>${ZEICHEN[ihre] || ""}</span>
      <span class="v-text">${text}</span>
      <span class="v-zeit">${v.zeit && v.zeit.toDate ? vorWieLange(v.zeit.toDate()) : ""}</span>`;
    liste.appendChild(li);
  }

  const mehr = E("mehr");
  mehr.hidden = verlauf.length <= sichtbar;
  mehr.textContent = `Mehr anzeigen (${verlauf.length - sichtbar})`;
}

E("mehr").addEventListener("click", () => { sichtbar += 20; verlaufZeichnen(); });
