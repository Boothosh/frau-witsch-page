/* Spielregeln für 4 Gewinnt. Klassisches Brett: 7 Spalten, 6 Zeilen.
   Das Brett ist eine flache Liste mit 42 Feldern, Index = zeile * 7 + spalte.
   Zeile 0 ist oben. 0 = leer, 1 = Rot, 2 = Gelb. */

export const SPALTEN = 7;
export const ZEILEN = 6;
export const FELDER = SPALTEN * ZEILEN;

export const leeresBrett = () => new Array(FELDER).fill(0);

/** Unterste freie Zeile einer Spalte, oder -1 wenn die Spalte voll ist. */
export function freieZeile(brett, spalte) {
  for (let z = ZEILEN - 1; z >= 0; z--) {
    if (brett[z * SPALTEN + spalte] === 0) return z;
  }
  return -1;
}

export const spalteVoll = (brett, spalte) => freieZeile(brett, spalte) === -1;

export const brettVoll = brett => brett.every(f => f !== 0);

/** Alle vier Richtungen, in denen vier in einer Reihe liegen können. */
const RICHTUNGEN = [
  [0, 1],   // waagerecht
  [1, 0],   // senkrecht
  [1, 1],   // diagonal nach rechts unten
  [1, -1]   // diagonal nach links unten
];

/**
 * Prüft, ob der Stein auf `index` eine Viererreihe vollendet.
 * Gibt die Indizes der Siegerreihe zurück, sonst null.
 */
export function pruefeSieg(brett, index) {
  const spieler = brett[index];
  if (!spieler) return null;

  const z0 = Math.floor(index / SPALTEN);
  const s0 = index % SPALTEN;

  for (const [dz, ds] of RICHTUNGEN) {
    const reihe = [index];

    for (const richtung of [1, -1]) {
      let z = z0 + dz * richtung;
      let s = s0 + ds * richtung;
      while (
        z >= 0 && z < ZEILEN && s >= 0 && s < SPALTEN &&
        brett[z * SPALTEN + s] === spieler
      ) {
        reihe.push(z * SPALTEN + s);
        z += dz * richtung;
        s += ds * richtung;
      }
    }

    if (reihe.length >= 4) {
      /* Bei mehr als vier die zusammenhängende Reihe sauber sortiert zurückgeben. */
      return reihe.sort((a, b) => a - b);
    }
  }
  return null;
}

/** Legt einen Stein und liefert das Ergebnis des Zugs. */
export function zug(brett, spalte, spieler) {
  const z = freieZeile(brett, spalte);
  if (z === -1) return null;

  const neu = brett.slice();
  const index = z * SPALTEN + spalte;
  neu[index] = spieler;

  const sieg = pruefeSieg(neu, index);
  return {
    brett: neu,
    index,
    zeile: z,
    sieg,
    voll: !sieg && brettVoll(neu)
  };
}
