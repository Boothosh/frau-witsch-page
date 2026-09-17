/* Aus dem Dateinamen wieder einen lesbaren Titel machen.
   Beim Hochladen werden Leerzeichen zu "_" und die Umlaute zu ae, oe, ue.
   Zurueck geht das nicht eindeutig: "teuer" und "Tuer" sehen danach gleich aus.
   Deshalb ein paar Regeln, eine kleine Ausnahmeliste und in config.js
   die Moeglichkeit, einzelne Titel von Hand zu setzen. */

/* Nach diesen Buchstaben ist "ue" fast immer echt: Quelle, Bauer, teuer, Silhouette. */
const KEIN_UE_NACH = new Set(["q", "a", "e", "o"]);

/* Woerter, in denen ae/oe echt sind und kein Umlaut gemeint war. */
const UNANGETASTET = [
  "michaela", "michael", "raphael", "israel", "aero", "aegis",
  "poesie", "poet", "poem", "koeffizient", "koexist", "aloe", "oeuvre"
];

const GROSS = { ae: "Ä", oe: "Ö", ue: "Ü" };
const KLEIN = { ae: "ä", oe: "ö", ue: "ü" };

export function titelAusDateiname(dateiname, ausnahmen = {}) {
  const ohneEndung = dateiname.replace(/\.[^.]+$/, "");

  if (Object.prototype.hasOwnProperty.call(ausnahmen, ohneEndung)) {
    return ausnahmen[ohneEndung];
  }

  /* Geschuetzte Woerter zwischenparken, damit sie nichts abbekommen. */
  const parkplatz = [];
  let text = ohneEndung;
  for (const wort of UNANGETASTET) {
    text = text.replace(new RegExp(wort, "gi"), treffer => {
      parkplatz.push(treffer);
      return "@@" + (parkplatz.length - 1) + "@@";
    });
  }

  text = text.replace(/([AaOoUu])([Ee])/g, (ganz, erster, zweiter, pos, quelle) => {
    const paar = (erster + zweiter).toLowerCase();

    if (paar === "ue") {
      const davor = (quelle[pos - 1] || "").toLowerCase();
      if (KEIN_UE_NACH.has(davor)) return ganz;
    }

    /* Grossbuchstabe nur, wenn auch der erste Buchstabe gross war. */
    return erster === erster.toUpperCase() ? GROSS[paar] : KLEIN[paar];
  });

  text = text.replace(/@@(\d+)@@/g, (_, i) => parkplatz[Number(i)]);

  text = text.replace(/_+/g, " ").replace(/\s+/g, " ").trim();

  /* Fuehrende Sortiernummern wie "01_" oder "3-" gehoeren nicht in den Titel.
     Hoechstens drei Ziffern, damit Jahreszahlen wie "2024 Silvester" bleiben. */
  return text.replace(/^\d{1,3}[ _-]+(?=\S)/, "");
}
