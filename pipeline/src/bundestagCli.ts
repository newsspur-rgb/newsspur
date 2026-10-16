import 'dotenv/config';
import { erstelleDipClient, OEFFENTLICHER_DIP_KEY } from './bundestag/dipClient.js';
import { erstelleD1BundestagStore, erstelleSpeicherBundestagStore, type BundestagStore } from './bundestag/bundestagStore.js';
import { bundestagLauf } from './bundestag/bundestagLauf.js';
import { erstelleD1Abfrage } from './store/d1Abfrage.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';

async function main(): Promise<void> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY, DIP_API_KEY } = process.env;
  const nurGesetze = process.argv.includes('--nur-gesetze');

  let store: BundestagStore;
  const speicher = erstelleSpeicherBundestagStore();
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_D1_DATABASE_ID && CLOUDFLARE_API_TOKEN) {
    console.log('Speicher: Cloudflare D1 (dauerhaft)');
    store = erstelleD1BundestagStore(erstelleD1Abfrage(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN));
  } else {
    console.log('Speicher: In-Memory (nur dieser Lauf, keine Cloudflare-Zugangsdaten gefunden)');
    store = speicher;
  }

  const geminiClient = GEMINI_API_KEY && !nurGesetze ? erstelleGeminiClient(GEMINI_API_KEY) : undefined;
  console.log(`Debatten-Zusammenfassung: ${geminiClient ? 'aktiv' : 'uebersprungen'}`);

  const ergebnis = await bundestagLauf({
    dip: erstelleDipClient(DIP_API_KEY || OEFFENTLICHER_DIP_KEY),
    store,
    geminiClient,
  });
  console.log('Ergebnis:', ergebnis);

  if (store === speicher) {
    for (const g of [...speicher.gesetze.values()].slice(0, 15)) {
      console.log(`[${g.ampel}] ${g.beratungsstand} | ${g.titel.slice(0, 90)}`);
    }
    for (const d of speicher.debatten.values()) console.log(JSON.stringify(d, null, 2));
  }
}

main().catch((fehler) => {
  console.error('Bundestag-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
