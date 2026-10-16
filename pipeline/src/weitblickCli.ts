import 'dotenv/config';
import { D1ThemenStore } from './store/d1Store.js';
import { erstelleD1Abfrage } from './store/d1Abfrage.js';
import { erstelleD1BundestagStore } from './bundestag/bundestagStore.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { weltpresseSuchen } from './weitblick/gdeltWelt.js';
import { blueskyStimmenSammeln } from './weitblick/bluesky.js';
import { erstelleD1WeitblickStore } from './weitblick/weitblickStore.js';
import { weitblickErstellen } from './weitblick/weitblick.js';

const WEITBLICK_MODELL = 'gemini-3.5-flash-lite';

async function main(): Promise<void> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_D1_DATABASE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error('Weitblick braucht GEMINI_API_KEY und die Cloudflare-D1-Zugangsdaten (liest die Meldungen der Woche).');
    process.exit(1);
  }

  const abfragen = erstelleD1Abfrage(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN);
  const weitblick = await weitblickErstellen({
    themenStore: new D1ThemenStore(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN),
    bundestagStore: erstelleD1BundestagStore(abfragen),
    // Eigenes Gratis-Kontingent: das Standardmodell braucht der 30-Min-Nachrichtenlauf (sonst 429).
    geminiClient: erstelleGeminiClient(GEMINI_API_KEY, fetch, undefined, WEITBLICK_MODELL),
    weltSuche: weltpresseSuchen,
    stimmenSuche: blueskyStimmenSammeln,
    weitblickStore: erstelleD1WeitblickStore(abfragen),
  });

  console.log(`Weitblick ${weitblick.woche} gespeichert: ${weitblick.einleitung}`);
  for (const e of weitblick.entwicklungen) {
    console.log(`- [${e.kategorie}] ${e.titel} | Weltpresse: ${e.weltblick.urteil} (${e.weltblick.laender.join(', ') || 'keine'})`);
    console.log(`    Bluesky: ${(e.stimmung ?? []).map((s) => `${s.sprachraum}=${s.ton}`).join(', ') || 'keine Stimmung'}`);
  }
  console.log(`Gesetze der Woche: ${weitblick.gesetze.length}`);
}

main().catch((fehler) => {
  console.error('Weitblick-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
