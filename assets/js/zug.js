import { seiteSchuetzen } from "./firebase.js";
import { ZUG } from "./config.js";
import { wellenAktivieren, uhrzeit, wochentag, datumKurz, leeren } from "./ui.js";

wellenAktivieren();

/* Freier Fahrplan der SBB, ohne Schlüssel und ohne Anmeldung.
   Deckt auch deutsche Bahnhöfe ab, deshalb feste Stations-IDs aus config.js. */
const BASIS = "https://transport.opendata.ch/v1";

/* Nur Zuege, damit keine Tram durch Basel im Ticket landet. */
const VERKEHRSMITTEL = ["ice_tgv_rjx", "ec_ic", "ir", "re_d", "s_sn_r"];

const FERNVERKEHR = /^(ICE|IC|EC|TGV|RJX?|EN|NJ)$/i;

const E = id => document.getElementById(id);

seiteSchuetzen(() => { laden(); });

E("neuLaden").addEventListener("click", () => laden(true));

async function laden(erneut = false) {
  if (erneut) {
    E("ticket").hidden = true;
    E("leiste").hidden = true;
    E("laden").hidden = false;
  }
  E("meldung").innerHTML = "";

  try {
    const verbindung = await besteVerbindung();
    if (!verbindung) {
      fertig();
      hinweis("info", "Gerade finde ich keine Verbindung. Versuch es später noch einmal.");
      return;
    }
    zeichnen(verbindung);
  } catch (e) {
    fertig();
    hinweis("fehler",
      "Der Fahrplan ist nicht erreichbar. " +
      "Vielleicht ist gerade kein Netz da oder der Dienst hat eine Pause. " +
      "<br><span style='opacity:.7'>" + (e.message || "") + "</span>");
  }
}

/* ---------- Abfrage ---------- */
function anfrage(datum, zeit) {
  const p = new URLSearchParams({
    from: ZUG.vonId,
    to: ZUG.nachId,
    date: datum,
    time: zeit,
    limit: "8",
    isArrivalTime: "0"
  });
  const mittel = VERKEHRSMITTEL.map(m => "transportations[]=" + m).join("&");
  return fetch(`${BASIS}/connections?${p}&${mittel}`, { headers: { Accept: "application/json" } })
    .then(r => {
      if (!r.ok) throw new Error("Fahrplan antwortet mit " + r.status);
      return r.json();
    });
}

function alsDatum(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Holt die Verbindungen ab jetzt. Wenn heute nichts mehr fährt,
 * wird der nächste Tag abgefragt. Ausgewählt wird die Verbindung,
 * die am frühesten in Zürich ankommt.
 */
async function besteVerbindung() {
  const jetzt = new Date();

  let daten = await anfrage(alsDatum(jetzt), uhrzeit(jetzt));
  let treffer = brauchbare(daten, jetzt);

  if (!treffer.length) {
    const morgen = new Date(jetzt);
    morgen.setDate(morgen.getDate() + 1);
    daten = await anfrage(alsDatum(morgen), "00:00");
    treffer = brauchbare(daten, jetzt);
  }

  if (!treffer.length) return null;

  /* Verbindungen mit widerspruechlichen Etappenzeiten lieber auslassen. */
  const stimmige = treffer.filter(istStimmig);
  const auswahl = stimmige.length ? stimmige : treffer;

  auswahl.sort((a, b) =>
    a.to.arrivalTimestamp - b.to.arrivalTimestamp ||
    b.from.departureTimestamp - a.from.departureTimestamp);

  return auswahl[0];
}

function zeitWert(s) { return s ? new Date(s).getTime() : null; }

/**
 * Der Fahrplan liefert gelegentlich Etappen, die nicht zusammenpassen:
 * ein Anschluss faehrt scheinbar ab, bevor der Zug davor angekommen ist,
 * oder die letzte Etappe endet nicht zur Gesamtankunft. Im Ticket saehe das
 * schlicht falsch aus, also sortieren wir solche Verbindungen aus.
 */
function istStimmig(c) {
  const fahrten = (c.sections || []).filter(s => s.journey);
  if (!fahrten.length) return true;

  let vorherigeAnkunft = null;
  for (const s of fahrten) {
    const ab = zeitWert(s.departure && s.departure.departure);
    const an = zeitWert(s.arrival && s.arrival.arrival);

    if (ab && an && an < ab) return false;
    if (vorherigeAnkunft && ab && ab < vorherigeAnkunft) return false;
    vorherigeAnkunft = an || vorherigeAnkunft;
  }

  const letzte = fahrten[fahrten.length - 1];
  const ende = zeitWert(letzte.arrival && letzte.arrival.arrival);
  if (ende && c.to.arrivalTimestamp &&
      Math.abs(ende / 1000 - c.to.arrivalTimestamp) > 60) return false;

  return true;
}

function brauchbare(daten, jetzt) {
  const ab = Math.floor(jetzt.getTime() / 1000);
  return ((daten && daten.connections) || []).filter(c =>
    c && c.from && c.to &&
    c.from.departureTimestamp >= ab &&
    c.to.arrivalTimestamp);
}

/* Punkte ohne Zeit sind Betriebsstellen wie Tunnel, keine Halte. */
function echteHalte(passList) {
  return (passList || []).filter(h => h.departure || h.arrival);
}

/* ---------- Anzeige ---------- */
function zeichnen(c) {
  const ab = new Date(c.from.departureTimestamp * 1000);
  const an = new Date(c.to.arrivalTimestamp * 1000);

  E("abZeit").textContent = uhrzeit(ab);
  E("anZeit").textContent = uhrzeit(an);
  E("abOrt").textContent = ZUG.vonName;
  E("anOrt").textContent = ZUG.nachName;
  E("abGleis").textContent = c.from.platform ? "Gleis " + c.from.platform : "";
  E("anGleis").textContent = c.to.platform ? "Gleis " + c.to.platform : "";

  /* Tag im Kopf, mit Hinweis wenn es erst morgen losgeht */
  const heute = new Date();
  const gleicherTag = ab.toDateString() === heute.toDateString();
  const morgenDatum = new Date(heute); morgenDatum.setDate(morgenDatum.getDate() + 1);
  const istMorgen = ab.toDateString() === morgenDatum.toDateString();

  E("tag").innerHTML =
    `${wochentag(ab)}, ${datumKurz(ab)}` +
    (gleicherTag ? "" : `<span class="morgen">${istMorgen ? "morgen" : "später"}</span>`);

  E("dauer").textContent = dauerText(c.duration, c);
  E("umstiege").textContent = c.transfers === 0 ? "keine" : c.transfers;

  const fahrten = (c.sections || []).filter(s => s.journey);
  const halteGesamt = fahrten.reduce((n, s) => n + Math.max(0, echteHalte(s.journey.passList).length - 1), 0);
  E("halte").textContent = halteGesamt;

  abschnitteZeichnen(c.sections || []);

  E("stand").textContent = "Stand " + uhrzeit(new Date());
  fertig();
  E("ticket").hidden = false;
  E("leiste").hidden = false;
}

/** "00d02:08:00" wird zu "2 Std. 8 Min." */
function dauerText(roh, c) {
  let minuten = null;

  const m = /^(\d+)d(\d{2}):(\d{2})/.exec(roh || "");
  if (m) minuten = Number(m[1]) * 1440 + Number(m[2]) * 60 + Number(m[3]);
  else if (c) minuten = Math.round((c.to.arrivalTimestamp - c.from.departureTimestamp) / 60);

  if (minuten == null) return "–";
  const std = Math.floor(minuten / 60);
  const rest = minuten % 60;
  if (!std) return `${rest} Min.`;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

function abschnitteZeichnen(sections) {
  const ziel = E("abschnitte");
  leeren(ziel);

  let vorherigeAnkunft = null;

  for (const s of sections) {
    /* Fußweg zwischen zwei Zügen */
    if (!s.journey) {
      const dauer = s.walk && s.walk.duration ? Math.round(s.walk.duration / 60) : null;
      const p = document.createElement("p");
      p.className = "umstieg";
      p.textContent = dauer ? `${dauer} Min. Fußweg` : "Fußweg";
      ziel.appendChild(p);
      continue;
    }

    const abZeit = s.departure && s.departure.departure ? new Date(s.departure.departure) : null;

    /* Umsteigezeit zwischen zwei Zügen */
    if (vorherigeAnkunft && abZeit) {
      const min = Math.round((abZeit - vorherigeAnkunft) / 60000);
      if (min > 0) {
        const p = document.createElement("p");
        p.className = "umstieg";
        p.textContent = `${min} Min. Umsteigezeit`;
        ziel.appendChild(p);
      }
    }

    ziel.appendChild(abschnittBauen(s));

    if (s.arrival && s.arrival.arrival) vorherigeAnkunft = new Date(s.arrival.arrival);
  }
}

function abschnittBauen(s) {
  const j = s.journey;
  const kategorie = (j.category || "").trim();
  const nummer = String(j.number || "").replace(/^0+/, "");
  const linie = (kategorie + " " + nummer).trim() || j.name || "Zug";

  const vonName = s.departure && s.departure.station ? s.departure.station.name : "";
  const nachName = s.arrival && s.arrival.station ? s.arrival.station.name : "";
  const abZeit = s.departure && s.departure.departure ? uhrzeit(new Date(s.departure.departure)) : "";
  const anZeit = s.arrival && s.arrival.arrival ? uhrzeit(new Date(s.arrival.arrival)) : "";
  const abGleis = s.departure && s.departure.platform;

  const d = document.createElement("details");
  d.className = "abschnitt";

  const zusammen = document.createElement("summary");
  zusammen.innerHTML = `
    <span class="zugnummer ${FERNVERKEHR.test(kategorie) ? "fern" : ""}">${linie}</span>
    <span class="ab-strecke">
      <b>${vonName}</b> nach <b>${nachName}</b><br>
      <span class="ab-zeiten">ab ${abZeit}${abGleis ? " (Gl. " + abGleis + ")" : ""} &middot; an ${anZeit}</span>
    </span>
    <span class="pfeil-auf" aria-hidden="true">&#9662;</span>`;
  d.appendChild(zusammen);

  const halte = echteHalte(j.passList);
  if (halte.length > 1) {
    const liste = document.createElement("ul");
    liste.className = "halte-liste";

    halte.forEach((h, i) => {
      const li = document.createElement("li");
      const erstesOderLetztes = i === 0 || i === halte.length - 1;
      if (erstesOderLetztes) li.className = "wichtig";

      const zeitRoh = h.departure || h.arrival;
      const zeit = zeitRoh ? uhrzeit(new Date(zeitRoh)) : "";

      const name = document.createElement("span");
      name.textContent = (h.station && h.station.name) || "";
      const z = document.createElement("span");
      z.className = "halte-zeit";
      z.textContent = zeit;

      li.append(name, z);
      liste.appendChild(li);
    });

    d.appendChild(liste);
  }

  return d;
}

/* ---------- Kleinkram ---------- */
function fertig() { E("laden").hidden = true; }

function hinweis(art, html) {
  E("meldung").innerHTML = `<div class="hinweis ${art}">${html}</div>`;
}
