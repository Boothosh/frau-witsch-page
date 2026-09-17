/* Die vier Handzeichen als SVG, damit sie überall gleich aussehen. */

export const SPIELZUEGE = ["schere", "stein", "papier", "brunnen"];

export const BEZEICHNUNG = {
  schere: "Schere",
  stein: "Stein",
  papier: "Papier",
  brunnen: "Brunnen"
};

export const ZEICHEN = {
  stein: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M16 9.5 33 7l8.5 12.5-3 15.5L22 41 8 31.5 7.5 17.5 16 9.5Z"
          fill="#CBBEA6" stroke="#8C7C66" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M16 9.5 20 22l-12.5-4.5M20 22l18-2.5M20 22l2 19" stroke="#8C7C66" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`,

  papier: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M10 6h20l9 9v27H10V6Z" fill="#FFFCF4" stroke="#A3937B" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M30 6v9h9" stroke="#A3937B" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M16 23h16M16 30h16M16 37h10" stroke="#DCCFB8" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  schere: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M13 6 33 33M35 6 15 33" stroke="#6E7A86" stroke-width="3" stroke-linecap="round"/>
    <circle cx="13.5" cy="38.5" r="5.5" fill="#F7DBD3" stroke="#D4503C" stroke-width="2.6"/>
    <circle cx="34.5" cy="38.5" r="5.5" fill="#F7DBD3" stroke="#D4503C" stroke-width="2.6"/>
  </svg>`,

  brunnen: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <ellipse cx="24" cy="24" rx="18" ry="18" fill="#D6C8AE" stroke="#8C7C66" stroke-width="2.2"/>
    <ellipse cx="24" cy="24" rx="11.5" ry="11.5" fill="#5E86AE" stroke="#3E5F8A" stroke-width="2"/>
    <path d="M15.5 21.5c2.6-2.4 5.1 2.4 8 0s5.4 2.4 8.3 0" stroke="#DCE4F0" stroke-width="2" stroke-linecap="round"/>
    <path d="M17 28.5c2.4-2.2 4.7 2.2 7.4 0s4.9 2.2 7.3 0" stroke="#DCE4F0" stroke-width="1.7" stroke-linecap="round" opacity=".7"/>
  </svg>`
};

/* Wer schlägt wen. Brunnen: Stein und Schere fallen hinein, Papier deckt ihn ab. */
export const SCHLAEGT = {
  schere:  ["papier"],
  stein:   ["schere"],
  papier:  ["stein", "brunnen"],
  brunnen: ["stein", "schere"]
};

/** 1 = a gewinnt, -1 = b gewinnt, 0 = unentschieden */
export function vergleiche(a, b) {
  if (a === b) return 0;
  if (SCHLAEGT[a] && SCHLAEGT[a].includes(b)) return 1;
  return -1;
}
