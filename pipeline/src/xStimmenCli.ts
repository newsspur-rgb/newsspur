import 'dotenv/config';
import { D1ThemenStore } from './store/d1Store.js';
import { erstelleD1Abfrage } from './store/d1Abfrage.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { xTweetsSuchen } from './xstimmen/xSuche.js';
import { erstelleD1KonflikteStore, erstelleD1XStimmenStore } from './xstimmen/xStimmenStore.js';
import { KONFLIKTE, konfliktLageErstellen } from './xstimmen/konflikte.js';
import { xStimmenErstellen } from './xstimmen/xStimmen.js';

// Eigenes Gratis-Kontingent: das Standardmodell braucht der 30-Min-Nachrichtenlauf.
const X_MODELL = 'gemini-3.5-flash-lite';
/** Pause zwischen X-Suchen - X drosselt sonst die Sitzung (429). */
const PAUSE_MS = 150_000;
/** Bremst X trotzdem (429), einmal so lange warten und neu versuchen. */
const DROSSEL_WARTEN_MS = 20 * 60_000;

async function main(): Promise<void> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error('X-Stimmen braucht GEMINI_API_KEY und die Cloudflare-D1-Zugangsdaten.');
    process.exit(1);
  }

  const abfragen = erstelleD1Abfrage(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  const geminiClient = erstelleGeminiClient(GEMINI_API_KEY, fetch, undefined, X_MODELL);
  const suche = async (handles: string[], seit: string) => {
    try {
      return await xTweetsSuchen(handles, seit);
    } catch (fehler) {
      if (!String(fehler).includes('429')) throw fehler;
      console.warn(`X bremst (429) - warte ${DROSSEL_WARTEN_MS / 60_000} Min und versuche es noch einmal`);
      await new Promise((r) => setTimeout(r, DROSSEL_WARTEN_MS));
      return xTweetsSuchen(handles, seit);
    }
  };

  // Konflikte zuerst: Seiten gegenüberstellen (wichtiger als die Ländergruppen)
  const konflikteStore = erstelleD1KonflikteStore(abfragen);
  for (const [i, k] of KONFLIKTE.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
    try {
      const lage = await konfliktLageErstellen(k, suche, geminiClient);
      if (!lage) { console.log(`- Konflikt ${k.id}: keine Posts, alter Stand bleibt`); continue; }
      await konflikteStore.speichern(lage);
      console.log(`- Konflikt ${k.id}: ${lage.themen.map((t) => `${t.titel} [${t.positionen.map((p) => p.seite).join('/')}]`).join(' | ')}`);
    } catch (fehlerUrsache) {
      console.warn(`Konflikt ${k.id} fehlgeschlagen:`, fehlerUrsache);
    }
  }

  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const themen = await xStimmenErstellen({
    themenStore: new D1ThemenStore(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN),
    geminiClient,
    suche,
    store: erstelleD1XStimmenStore(abfragen),
    pauseMs: PAUSE_MS,
  });

  console.log(`${new Date().toISOString()} X-Stimmen: ${themen.length} Themen gespeichert`);
  for (const t of themen) {
    console.log(`- [${t.kategorie}] ${t.titel} (${t.stimmen.length} Tweets${t.themaId ? ', Meldung ' + t.themaId : ''})`);
  }

}

main().catch((fehler) => {
  console.error('X-Stimmen-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
