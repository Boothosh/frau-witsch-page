import { db, seiteSchuetzen, nameVon, nameVonUid, anderePerson } from "./firebase.js";
import {
  doc, setDoc, onSnapshot, runTransaction, collection,
  query, orderBy, serverTimestamp, getDocFromServer
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { SPALTEN, ZEILEN, FELDER, leeresBrett, zug, spalteVoll } from "./vier-logik.js";
import { wellenAktivieren, konfetti, vorWieLange, leeren } from "./ui.js";

wellenAktivieren();

const standRef = doc(db, "viergewinnt", "stand");
const verlaufRef = collection(db, "viergewinnt_verlauf");

let ich = null;
let nameAndere = "Sie";
let stand = null;
let verlauf = [];
let vorherigesBrett = null;
let geschrieben = new Set();
let konfettiSpiel = -1;
let sichtbar = 12;

const E = id => document.getElementById(id);

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

const zugWort = n => (n === 1 ? "1 Zug" : `${n} Züge`);
const nachZuegen = n => (n === 1 ? "Nach einem Zug." : `Nach ${n} Zügen.`);
const felder = [];
const wuerfe = [];

/* ---------- Aufbau ---------- */
seiteSchuetzen(async user => {
  ich = user;

  nameAndere = nameVonUid(anderePerson(user.uid));
  E("nameAndere").textContent = nameAndere;

  brettBauen();
  await spielSicherstellen();

  standBeobachten();
  abgleichStarten();

  onSnapshot(query(verlaufRef, orderBy("spielNr", "desc")),
    s => {
      verlauf = s.docs.map(d => d.data());
      try { siegeZeichnen(); verlaufZeichnen(); }
      catch (e) { console.error("Verlauf zeichnen fehlgeschlagen", e); }
    },
    e => console.warn("Verlauf nicht lesbar", e));

});

/* ---------- Stand empfangen ---------- */

/** Reihenfolge eines Stands: neues Spiel schlaegt alten Zug. */
const standSchluessel = d => zahlOder(d && d.spielNr, 0) * 1000 + zahlOder(d && d.zuege, 0);

/** Uebernimmt einen Stand, egal woher er kommt (Listener, Abfrage, eigener Zug).
    Aeltere Staende werden ignoriert, damit ein verspaeteter Snapshot nichts zuruecksetzt. */
function standUebernehmen(daten) {
  if (!daten) return;
  if (stand && standSchluessel(daten) < standSchluessel(stand)) return;
  stand = daten;
  try { zeichnen(); } catch (e) { console.error("Zeichnen fehlgeschlagen", e); }
  buehneZeigen();
}

let abmelden = null;
function standBeobachten() {
  if (abmelden) abmelden();
  abmelden = onSnapshot(standRef,
    s => standUebernehmen(s.data() || null),
    e => {
      buehneZeigen();
      hinweis("fehler", "Der Spielstand ist nicht erreichbar. " + fehlerText(e));
    });
}

/** Der Listener bleibt auf manchen Geraeten (Standby, Tab im Hintergrund,
    Netzwechsel) stumm haengen. Darum regelmaessig direkt beim Server
    nachfragen und den Listener neu starten, wenn er etwas verpasst hat. */
let fragtGerade = false;
async function abgleichen() {
  if (fragtGerade || document.hidden) return;
  fragtGerade = true;
  try {
    const s = await getDocFromServer(standRef);
    const daten = s.data();
    if (daten && (!stand || standSchluessel(daten) > standSchluessel(stand))) {
      standUebernehmen(daten);
      standBeobachten();
    }
  } catch (e) {
    /* offline - beim naechsten Mal wieder */
  } finally {
    fragtGerade = false;
  }
}

function abgleichStarten() {
  setInterval(abgleichen, 4000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) abgleichen(); });
  window.addEventListener("focus", abgleichen);
  window.addEventListener("online", abgleichen);
  window.addEventListener("pageshow", abgleichen);
}

function brettBauen() {
  const leiste = E("wurfleiste");
  const brett = E("brett");

  for (let s = 0; s < SPALTEN; s++) {
    const b = document.createElement("button");
    b.className = "wurf";
    b.type = "button";
    b.setAttribute("aria-label", `Stein in Spalte ${s + 1} werfen`);
    b.innerHTML = `<span aria-hidden="true">&darr;</span>`;
    b.disabled = true;                 // erst freigeben, wenn der Stand da ist
    b.addEventListener("click", () => werfen(s));
    b.addEventListener("mouseenter", () => spalteBetonen(s, true));
    b.addEventListener("mouseleave", () => spalteBetonen(s, false));
    wuerfe.push(b);
    leiste.appendChild(b);
  }

  for (let i = 0; i < FELDER; i++) {
    const f = document.createElement("div");
    f.className = "feld";
    const s = i % SPALTEN;
    f.addEventListener("click", () => werfen(s));
    f.addEventListener("mouseenter", () => spalteBetonen(s, true));
    f.addEventListener("mouseleave", () => spalteBetonen(s, false));
    felder.push(f);
    brett.appendChild(f);
  }
}

function spalteBetonen(spalte, an) {
  if (an && !binDran()) return;
  for (let z = 0; z < ZEILEN; z++) {
    felder[z * SPALTEN + spalte].classList.toggle("warm", an);
  }
}

/** Legt das Spiel an, falls es noch keins gibt, und repariert alte Staende.
    Beide UIDs stehen in der Konfiguration, es muss also niemand "beitreten". */
async function spielSicherstellen() {
  const anderer = anderePerson(ich.uid);

  try {
    await runTransaction(db, async t => {
      const s = await t.get(standRef);

      if (!s.exists()) {
        t.set(standRef, {
          spielNr: 1,
          brett: leeresBrett(),
          rot: ich.uid,
          gelb: anderer,
          namen: { [ich.uid]: nameVon(ich) },
          amZug: ich.uid,
          zuege: 0,
          gewinner: null,
          siegFelder: [],
          letzterZug: null,
          begonnen: serverTimestamp()
        });
        return;
      }

      const d = s.data();
      const aenderungen = {};

      /* Aeltere Staende hatten nur eine Farbe besetzt. Nachtragen. */
      if (!d.rot || !d.gelb) {
        const rot = d.rot || ich.uid;
        aenderungen.rot = rot;
        aenderungen.gelb = rot === ich.uid ? anderer : ich.uid;
        if (!d.amZug) aenderungen.amZug = rot;
      }

      if (!d.namen || !d.namen[ich.uid]) {
        aenderungen[`namen.${ich.uid}`] = nameVon(ich);
      }

      /* Kaputte oder fehlende Werte geradeziehen. */
      if (!Number.isFinite(d.spielNr)) aenderungen.spielNr = 1;
      if (!Number.isFinite(d.zuege)) aenderungen.zuege = 0;
      if (!Array.isArray(d.brett) || d.brett.length !== FELDER) {
        aenderungen.brett = leeresBrett();
        aenderungen.zuege = 0;
        aenderungen.gewinner = null;
        aenderungen.siegFelder = [];
        aenderungen.letzterZug = null;
      }

      if (Object.keys(aenderungen).length) t.update(standRef, aenderungen);
    });
  } catch (e) {
    console.error("Spielstand konnte nicht angelegt werden", e);
    hinweis("fehler", "Der Spielstand liess sich nicht anlegen. " + fehlerText(e));
  }
}

/* ---------- Ableitungen ---------- */
const meineFarbe = () => !stand ? 0 : (stand.rot === ich.uid ? 1 : stand.gelb === ich.uid ? 2 : 0);
const binDran = () => !!stand && !stand.gewinner && meineFarbe() !== 0 && stand.amZug === ich.uid;

/* ---------- Zeichnen ---------- */
function zeichnen() {
  if (!stand) return;

  const brett = stand.brett || leeresBrett();
  E("spielZeile").textContent = `Spiel ${stand.spielNr} · ${zugWort(stand.zuege || 0)}`;

  /* Farbpunkte */
  const meine = meineFarbe();
  E("chipIch").className = "chip " + (meine === 1 ? "rot" : meine === 2 ? "gelb" : "");
  E("chipDu").className = "chip " + (meine === 1 ? "gelb" : meine === 2 ? "rot" : "");
  E("parteiIch").classList.toggle("aktiv", binDran());
  E("parteiDu").classList.toggle("aktiv", !!stand.gelb && !stand.gewinner && stand.amZug !== ich.uid);

  /* Statuszeile */
  const dran = E("dran");
  if (stand.gewinner) { dran.textContent = "fertig"; dran.className = "dran"; }
  else if (binDran()) { dran.textContent = "du bist dran"; dran.className = "dran duBist"; }
  else { dran.textContent = nameAndere + " ist dran"; dran.className = "dran"; }

  steineZeichnen(brett);

  /* Wurfknöpfe */
  const offen = binDran();
  for (let s = 0; s < SPALTEN; s++) {
    wuerfe[s].disabled = !offen || spalteVoll(brett, s);
  }
  if (!offen) for (let s = 0; s < SPALTEN; s++) spalteBetonen(s, false);

  meldungZeichnen();

  E("neuesSpiel").hidden = !stand.gewinner;
  E("aufgeben").hidden = !!stand.gewinner || !stand.zuege;
}

function steineZeichnen(brett) {
  const vorher = vorherigesBrett;

  for (let i = 0; i < FELDER; i++) {
    const feld = felder[i];
    const wert = brett[i];
    const alt = feld.firstElementChild;

    feld.classList.toggle("letzter", stand.letzterZug === i && !stand.gewinner);

    if (!wert) { if (alt) alt.remove(); continue; }

    const farbe = wert === 1 ? "rot" : "gelb";
    const siegt = (stand.siegFelder || []).includes(i);

    if (alt) {
      alt.className = "stein " + farbe + (siegt ? " siegt" : "");
      continue;
    }

    const stein = document.createElement("div");
    stein.className = "stein " + farbe + (siegt ? " siegt" : "");

    /* Nur der gerade geworfene Stein fällt. */
    const istNeu = vorher && vorher[i] === 0 && i === stand.letzterZug;
    if (istNeu || (!vorher && false)) {
      const zeile = Math.floor(i / SPALTEN);
      stein.style.setProperty("--weg", `-${(zeile + 2) * 112}%`);
      stein.classList.add("faellt");
    }
    feld.appendChild(stein);
  }

  vorherigesBrett = brett.slice();
}

function meldungZeichnen() {
  const kasten = E("meldung");

  if (meineFarbe() === 0) {
    kasten.innerHTML = `<div class="hinweis fehler">Dieses Konto gehört zu keiner Farbe. Stimmen die UIDs in der Konfiguration?</div>`;
    return;
  }

  if (!stand.gewinner) { kasten.innerHTML = ""; return; }

  if (stand.gewinner === "unentschieden") {
    kasten.innerHTML = `<div class="gross-meldung unentschieden">
      <h2>Unentschieden</h2><p>Das Brett ist voll und keiner hatte vier.</p></div>`;
  } else if (stand.gewinner === ich.uid) {
    kasten.innerHTML = `<div class="gross-meldung gewonnen">
      <h2>Vier! Du gewinnst 🎉</h2><p>${nachZuegen(stand.zuege)}</p></div>`;
    if (konfettiSpiel !== stand.spielNr) {
      konfettiSpiel = stand.spielNr;
      setTimeout(() => konfetti(140), 300);
    }
  } else {
    kasten.innerHTML = `<div class="gross-meldung">
      <h2>${nameAndere} hat vier</h2><p>${nachZuegen(stand.zuege)} Revanche?</p></div>`;
  }

  verlaufSchreiben();
}

/* ---------- Zug ---------- */
async function werfen(spalte) {
  if (!binDran()) return;
  if (spalteVoll(stand.brett || leeresBrett(), spalte)) return;

  const meine = meineFarbe();
  const gegner = stand.rot === ich.uid ? stand.gelb : stand.rot;

  try {
    const neu = await runTransaction(db, async t => {
      const s = await t.get(standRef);
      const d = s.data();
      if (!d || d.gewinner || d.amZug !== ich.uid) return null;   // zwischenzeitlich verändert

      const ergebnis = zug(d.brett || leeresBrett(), spalte, meine);
      if (!ergebnis) return null;

      const aenderungen = {
        brett: ergebnis.brett,
        letzterZug: ergebnis.index,
        zuege: (d.zuege || 0) + 1,
        amZug: ergebnis.sieg || ergebnis.voll ? d.amZug : gegner,
        gewinner: ergebnis.sieg ? ich.uid : (ergebnis.voll ? "unentschieden" : null),
        siegFelder: ergebnis.sieg || []
      };
      t.update(standRef, { ...aenderungen, zuletzt: serverTimestamp() });
      return { ...d, ...aenderungen };
    });
    /* Transaktionen zeigen nichts lokal an - den eigenen Zug also direkt zeichnen,
       statt auf den Listener zu warten. */
    if (neu) standUebernehmen(neu);
    else abgleichen();
  } catch (e) { console.error(e); abgleichen(); }
}

E("neuesSpiel").addEventListener("click", () => neuesSpiel(true));
E("aufgeben").addEventListener("click", () => {
  if (confirm("Das laufende Spiel verwerfen und neu anfangen?")) neuesSpiel(false);
});

async function neuesSpiel(tauschen) {
  const meine = zahlOder(stand && stand.spielNr, null);

  try {
    const neu = await runTransaction(db, async t => {
      const s = await t.get(standRef);
      const d = s.data();
      if (!d) return null;

      const serverNr = zahlOder(d.spielNr, null);

      /* Nur abbrechen, wenn wirklich jemand anderes schon ein neues Spiel
         gestartet hat. Fehlende oder kaputte Nummern nicht als Konflikt
         werten - sonst liesse sich nie wieder zuruecksetzen. */
      if (meine !== null && serverNr !== null && serverNr !== meine) return null;

      /* Farben tauschen, damit nicht immer dieselbe Person anfängt. */
      const rot = tauschen ? (d.gelb || d.rot) : d.rot;
      const gelb = tauschen ? d.rot : d.gelb;

      const aenderungen = {
        spielNr: (serverNr === null ? 0 : serverNr) + 1,
        brett: leeresBrett(),
        rot, gelb,
        amZug: rot,
        zuege: 0,
        gewinner: null,
        siegFelder: [],
        letzterZug: null
      };
      t.update(standRef, { ...aenderungen, begonnen: serverTimestamp() });
      return { ...d, ...aenderungen };
    });
    if (neu) standUebernehmen(neu);
    else abgleichen();
  } catch (e) {
    console.error(e);
    hinweis("fehler", "Das neue Spiel liess sich nicht starten. " + fehlerText(e));
  }
}


async function verlaufSchreiben() {
  const nr = zahlOder(stand.spielNr, null);
  if (nr === null || geschrieben.has(nr)) return;
  geschrieben.add(nr);

  try {
    await setDoc(doc(verlaufRef, String(nr)), {
      spielNr: nr,
      gewinner: stand.gewinner,
      rot: stand.rot,
      gelb: stand.gelb,
      namen: stand.namen || {},
      zuege: stand.zuege || 0,
      brett: stand.brett,
      zeit: serverTimestamp()
    });
  } catch (e) { geschrieben.delete(nr); console.error(e); }
}

/* ---------- Siege & Verlauf ---------- */
function siegeZeichnen() {
  let meine = 0, ihre = 0;
  for (const v of verlauf) {
    if (v.gewinner === "unentschieden" || !v.gewinner) continue;
    if (v.gewinner === ich.uid) meine++; else ihre++;
  }
  E("siegeIch").textContent = meine === 1 ? "1 Sieg" : `${meine} Siege`;
  E("siegeDu").textContent = ihre === 1 ? "1 Sieg" : `${ihre} Siege`;
}

function verlaufZeichnen() {
  const liste = E("verlauf");
  leeren(liste);

  if (!verlauf.length) {
    liste.innerHTML = `<p class="leer">Noch kein Spiel zu Ende gespielt.</p>`;
    E("mehr").hidden = true;
    return;
  }

  for (const v of verlauf.slice(0, sichtbar)) {
    const un = v.gewinner === "unentschieden";
    const ichGewann = v.gewinner === ich.uid;
    const farbe = un ? "un" : (v.gewinner === v.rot ? "rot" : "gelb");
    const text = un ? "Unentschieden"
      : ichGewann ? "<b>Du</b> hast gewonnen"
      : `<b>${nameAndere}</b> hat gewonnen`;

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="v-chip ${farbe}"></span>
      <span class="v-nr">#${v.spielNr}</span>
      <span class="v-text">${text} <span style="color:var(--tinte-weich)">· ${zugWort(v.zuege)}</span></span>
      <span class="v-zeit">${v.zeit && v.zeit.toDate ? vorWieLange(v.zeit.toDate()) : ""}</span>`;
    liste.appendChild(li);
  }

  const mehr = E("mehr");
  mehr.hidden = verlauf.length <= sichtbar;
  mehr.textContent = `Mehr anzeigen (${verlauf.length - sichtbar})`;
}

E("mehr").addEventListener("click", () => { sichtbar += 20; verlaufZeichnen(); });

/* ---------- Meldungen ---------- */
function hinweis(art, text) {
  E("meldung").innerHTML = `<div class="hinweis ${art}">${text}</div>`;
}

function fehlerText(e) {
  const code = (e && e.code) || "";
  if (code === "permission-denied") {
    return "Die Firestore-Regeln lassen dieses Konto nicht durch.";
  }
  if (code === "unavailable") return "Gerade keine Verbindung.";
  return (e && e.message) || code;
}
