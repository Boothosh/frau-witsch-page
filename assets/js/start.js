import { beiAnmeldung, nameVon, auth, db, signOut } from "./firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { SEITEN_TITEL } from "./config.js";
import { wellenAktivieren } from "./ui.js";

wellenAktivieren();

const SYMBOLE = {
  ssp: `<svg viewBox="0 0 32 32" fill="none">
    <circle cx="9" cy="10" r="5.2" fill="#D4503C"/>
    <rect x="17" y="4.4" width="11" height="11" rx="2.6" fill="#FFFCF4" stroke="#D4503C" stroke-width="2"/>
    <path d="M6 28 17 19M17 28 6 19" stroke="#D4503C" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="24.5" cy="24.5" r="3.4" fill="none" stroke="#D4503C" stroke-width="2"/>
  </svg>`,
  vier: `<svg viewBox="0 0 32 32" fill="none">
    <rect x="2.5" y="4.5" width="27" height="23" rx="4" fill="#FFFCF4" stroke="#3E5F8A" stroke-width="2"/>
    <circle cx="10" cy="11.5" r="3.1" fill="#3E5F8A"/>
    <circle cx="22" cy="11.5" r="3.1" fill="#DCE4F0"/>
    <circle cx="10" cy="20.5" r="3.1" fill="#DCE4F0"/>
    <circle cx="22" cy="20.5" r="3.1" fill="#3E5F8A"/>
  </svg>`,
  bild: `<svg viewBox="0 0 32 32" fill="none">
    <rect x="3" y="5.5" width="26" height="21" rx="4" fill="#FFFCF4" stroke="#C08D20" stroke-width="2"/>
    <circle cx="11" cy="12.5" r="2.6" fill="#E0A42B"/>
    <path d="M4.5 23.5 12 16l5.5 5 4-3.5 6 6" stroke="#C08D20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  zug: `<svg viewBox="0 0 32 32" fill="none">
    <path d="M7.5 3.5h17a3 3 0 0 1 3 3v13a4 4 0 0 1-4 4H8.5a4 4 0 0 1-4-4v-13a3 3 0 0 1 3-3Z" fill="#FFFCF4" stroke="#5C7644" stroke-width="2"/>
    <path d="M6 10.5h20v5H6z" fill="#E2EAD4"/>
    <circle cx="11" cy="19.5" r="1.7" fill="#5C7644"/>
    <circle cx="21" cy="19.5" r="1.7" fill="#5C7644"/>
    <path d="M11 24.5 7.5 29M21 24.5 24.5 29" stroke="#5C7644" stroke-width="2" stroke-linecap="round"/>
  </svg>`
};

const KACHELN = [
  { id: "ssp",  href: "schere-stein-papier.html", titel: "Schere, Stein, Papier", ton: "var(--stift-hell)" },
  { id: "vier", href: "vier-gewinnt.html",        titel: "4 Gewinnt",             ton: "var(--blau-hell)" },
  { id: "bild", href: "bild-der-woche.html",      titel: "Bild der Woche",        ton: "var(--gelb-hell)" },
  { id: "zug",  href: "zug.html",                 titel: "Nach Zürich",           ton: "var(--gruen-hell)" }
];

function tageszeitText(h) {
  if (h < 5)  return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
}

function kachelBauen(k) {
  const a = document.createElement("a");
  a.className = "kachel";
  a.href = k.href;
  a.style.setProperty("--ton", k.ton);
  a.innerHTML = `
    <div class="kachel-bild">${SYMBOLE[k.id]}</div>
    <h2>${k.titel}</h2>
    <span class="kachel-pfeil" aria-hidden="true">&rarr;</span>`;
  return a;
}

function plakette(kachel, text, ruhig) {
  let p = kachel.querySelector(".plakette");
  if (!text) { if (p) p.remove(); return; }
  if (!p) {
    p = document.createElement("span");
    p.className = "plakette";
    kachel.appendChild(p);
  }
  p.textContent = text;
  p.classList.toggle("ruhig", !!ruhig);
}

/* Zeigt auf den Spielkacheln, ob jemand am Zug ist. */
function spielStandBeobachten(user, kachelVon) {
  onSnapshot(doc(db, "ssp", "stand"), s => {
    const k = kachelVon("ssp");
    if (!k) return;
    const d = s.data();
    const wahl = (d && d.wahl) || {};
    const ichHabe = !!wahl[user.uid];
    const andereHaben = Object.keys(wahl).some(u => u !== user.uid);
    if (!ichHabe && andereHaben) plakette(k, "Du bist dran");
    else if (!ichHabe) plakette(k, "Neue Runde", true);
    else if (!andereHaben) plakette(k, "Warten", true);
    else plakette(k, "Ergebnis da");
  }, () => {});

  onSnapshot(doc(db, "viergewinnt", "stand"), s => {
    const k = kachelVon("vier");
    if (!k) return;
    const d = s.data();
    if (!d || !d.brett) { plakette(k, "Neues Spiel", true); return; }
    if (d.gewinner) plakette(k, "Spiel vorbei", true);
    else if (d.amZug === user.uid) plakette(k, "Du bist dran");
    else plakette(k, "Warten", true);
  }, () => {});
}

/* ---------- Ablauf ---------- */
const laden = document.getElementById("laden");
const inhalt = document.getElementById("inhalt");
const anrede = document.getElementById("anrede");
const tageszeit = document.getElementById("tageszeit");
const abgemeldet = document.getElementById("abgemeldet");
const angemeldet = document.getElementById("angemeldet");
const gitter = document.getElementById("gitter");

tageszeit.textContent = tageszeitText(new Date().getHours());

beiAnmeldung(user => {
  laden.hidden = true;
  inhalt.hidden = false;

  const name = user ? nameVon(user) : SEITEN_TITEL;
  anrede.innerHTML =
    `Hallo <span class="name">${name}</span>! <span class="winkt">👋</span>`;

  if (!user) {
    abgemeldet.hidden = false;
    angemeldet.hidden = true;
    return;
  }

  abgemeldet.hidden = true;
  angemeldet.hidden = false;

  if (!gitter.childElementCount) {
    const karten = new Map();
    for (const k of KACHELN) {
      const el = kachelBauen(k);
      karten.set(k.id, el);
      gitter.appendChild(el);
    }
    spielStandBeobachten(user, id => karten.get(id));
  }

  document.getElementById("fussMail").textContent = "Angemeldet als " + user.email;
});

document.getElementById("abmelden").addEventListener("click", async e => {
  e.currentTarget.disabled = true;
  await signOut(auth);
  location.href = "index.html";
});
