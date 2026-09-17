import { auth, signInWithEmailAndPassword, istErlaubt, beiAnmeldung, signOut } from "./firebase.js";
import { wellenAktivieren } from "./ui.js";

wellenAktivieren();

const formular = document.getElementById("formular");
const mail = document.getElementById("mail");
const pw = document.getElementById("pw");
const knopf = document.getElementById("absenden");
const meldung = document.getElementById("meldung");

/* Wohin nach dem Anmelden? */
const weiter = new URLSearchParams(location.search).get("weiter");
const ZIELE = new Set([
  "index.html", "schere-stein-papier.html", "vier-gewinnt.html",
  "bild-der-woche.html", "zug.html"
]);
const ziel = ZIELE.has(weiter) ? weiter : "index.html";

/* Schon angemeldet? Dann direkt weiter. */
beiAnmeldung(user => { if (user) location.replace(ziel); });

function zeigen(text, art = "fehler") {
  meldung.innerHTML = `<div class="hinweis ${art}">${text}</div>`;
  if (art === "fehler") {
    formular.classList.remove("ruettel");
    void formular.offsetWidth;
    formular.classList.add("ruettel");
  }
}

const TEXTE = {
  "auth/invalid-email": "Diese E-Mail-Adresse sieht nicht richtig aus.",
  "auth/invalid-credential": "E-Mail oder Passwort stimmt nicht.",
  "auth/wrong-password": "E-Mail oder Passwort stimmt nicht.",
  "auth/user-not-found": "E-Mail oder Passwort stimmt nicht.",
  "auth/user-disabled": "Dieses Konto ist gesperrt.",
  "auth/too-many-requests": "Zu viele Versuche. Warte einen Moment und probier es nochmal.",
  "auth/network-request-failed": "Keine Verbindung. Ist das Internet da?"
};

document.getElementById("pwAuge").addEventListener("click", e => {
  const offen = pw.type === "password";
  pw.type = offen ? "text" : "password";
  e.currentTarget.classList.toggle("offen", offen);
  e.currentTarget.setAttribute("aria-label", offen ? "Passwort verbergen" : "Passwort anzeigen");
  pw.focus();
});

formular.addEventListener("submit", async e => {
  e.preventDefault();
  meldung.innerHTML = "";

  const m = mail.value.trim();
  if (!m || !pw.value) { zeigen("Bitte beides ausfüllen."); return; }

  knopf.disabled = true;
  knopf.classList.add("laedt");

  try {
    const { user } = await signInWithEmailAndPassword(auth, m, pw.value);

    if (!istErlaubt(user)) {
      await signOut(auth);
      zeigen("Dieses Konto ist für die Seite nicht freigeschaltet.");
      return;
    }

    zeigen("Passt, einen Moment …", "gut");
    location.replace(ziel);

  } catch (err) {
    zeigen(TEXTE[err.code] || "Da ist etwas schiefgelaufen. Probier es nochmal.");
    pw.select();
  } finally {
    knopf.disabled = false;
    knopf.classList.remove("laedt");
  }
});
