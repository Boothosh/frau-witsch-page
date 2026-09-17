/* Kleine Helfer, die überall gebraucht werden. */

/** Welle beim Klick auf .knopf */
export function wellenAktivieren(wurzel = document) {
  wurzel.addEventListener("click", e => {
    const knopf = e.target.closest(".knopf");
    if (!knopf || knopf.disabled) return;
    const r = knopf.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const w = document.createElement("span");
    w.className = "welle";
    w.style.width = w.style.height = d + "px";
    w.style.left = (e.clientX - r.left - d / 2) + "px";
    w.style.top = (e.clientY - r.top - d / 2) + "px";
    knopf.appendChild(w);
    setTimeout(() => w.remove(), 620);
  });
}

/* ---------- Konfetti ---------- */
const FARBEN = ["#D4503C", "#6E8B52", "#3E5F8A", "#E0A42B", "#E27C4A", "#B0553F"];

export function konfetti(menge = 110) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let leinwand = document.getElementById("konfetti");
  if (!leinwand) {
    leinwand = document.createElement("canvas");
    leinwand.id = "konfetti";
    document.body.appendChild(leinwand);
  }
  const ctx = leinwand.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const groesse = () => {
    leinwand.width = innerWidth * dpr;
    leinwand.height = innerHeight * dpr;
    leinwand.style.width = innerWidth + "px";
    leinwand.style.height = innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();

  const teile = Array.from({ length: menge }, () => ({
    x: innerWidth * (.2 + Math.random() * .6),
    y: -20 - Math.random() * innerHeight * .35,
    b: 6 + Math.random() * 7,
    h: 8 + Math.random() * 10,
    vx: (Math.random() - .5) * 3.4,
    vy: 2.4 + Math.random() * 3.4,
    dreh: Math.random() * Math.PI * 2,
    vdreh: (Math.random() - .5) * .28,
    farbe: FARBEN[(Math.random() * FARBEN.length) | 0],
    rund: Math.random() < .3
  }));

  let laeuft = true;
  setTimeout(() => { laeuft = false; }, 4200);

  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let sichtbar = false;

    for (const t of teile) {
      t.x += t.vx;
      t.y += t.vy;
      t.vy += 0.045;
      t.vx *= 0.995;
      t.dreh += t.vdreh;

      if (t.y < innerHeight + 40) sichtbar = true;

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.dreh);
      ctx.fillStyle = t.farbe;
      if (t.rund) {
        ctx.beginPath();
        ctx.arc(0, 0, t.b / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-t.b / 2, -t.h / 2, t.b, t.h);
      }
      ctx.restore();
    }

    if (sichtbar && laeuft) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------- Datum & Zeit ---------- */
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function uhrzeit(d) {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function datumKurz(d) {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function wochentag(d) {
  return WOCHENTAGE[d.getDay()];
}

/** "vor 3 Minuten", "gestern" usw. */
export function vorWieLange(d) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  const t = Math.floor(s / 86400);
  if (t === 1) return "gestern";
  if (t < 7) return `vor ${t} Tagen`;
  return datumKurz(d);
}

/** ISO-Kalenderwoche, z.B. "2026-W38" */
export function wochenSchluessel(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const jahresStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const woche = Math.ceil(((x - jahresStart) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(woche).padStart(2, "0")}`;
}

/** Wie viele Kalenderwochen liegen zwischen zwei Schlüsseln? */
export function wochenDifferenz(vonSchluessel, bisSchluessel) {
  const zuDatum = s => {
    const [j, w] = s.split("-W").map(Number);
    const d = new Date(Date.UTC(j, 0, 4));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1) + (w - 1) * 7);
    return d;
  };
  return Math.round((zuDatum(bisSchluessel) - zuDatum(vonSchluessel)) / (7 * 86400000));
}

/* ---------- Kleinkram ---------- */
export function el(tag, klasse, text) {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (text != null) n.textContent = text;
  return n;
}

export function leeren(knoten) {
  while (knoten.firstChild) knoten.removeChild(knoten.firstChild);
}
