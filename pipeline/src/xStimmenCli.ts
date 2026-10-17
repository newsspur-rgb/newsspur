import 'dotenv/config';
import { D1ThemenStore } from './store/d1Store.js';
import { erstelleD1Abfrage } from './store/d1Abfrage.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { xTweetsSuchen } from './xstimmen/xSuche.js';
import { erstelleD1XStimmenStore } from './xstimmen/xStimmenStore.js';
import { xStimmenErstellen } from './xstimmen/xStimmen.js';

// Eigenes Gratis-Kontingent: das Standardmodell braucht der 30-Min-Nachrichtenlauf.
const X_MODELL = 'gemini-3.5-flash-lite';

async function main(): Promise<void> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error('X-Stimmen braucht GEMINI_API_KEY und die Cloudflare-D1-Zugangsdaten.');
    process.exit(1);
  }

  const abfragen = erstelleD1Abfrage(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  const themen = await xStimmenErstellen({
    themenStore: new D1ThemenStore(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN),
    geminiClient: erstelleGeminiClient(GEMINI_API_KEY, fetch, undefined, X_MODELL),
    suche: (handles, seit) => xTweetsSuchen(handles, seit),
    store: erstelleD1XStimmenStore(abfragen),
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
