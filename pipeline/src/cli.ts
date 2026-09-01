import 'dotenv/config';
import type { Artikel } from './types.js';
import { feeds } from './sources/feeds.js';
import { feedAbrufen } from './sources/fetchRss.js';
import { gdeltAbrufen } from './sources/fetchGdelt.js';
import { gdeltAbfragen } from './sources/gdeltAbfragen.js';
import { SpeicherThemenStore } from './store/memoryStore.js';
import { erstelleGeminiClient } from './summarize/geminiClient.js';
import { erstelleGeminiEmbedFn } from './cluster/embed.js';
import { pipelineLauf } from './pipeline.js';

async function sammle(
  aufgaben: { name: string; lauf: () => Promise<Artikel[]> }[],
): Promise<Artikel[]> {
  const ergebnisse = await Promise.allSettled(aufgaben.map((a) => a.lauf()));
  const artikel: Artikel[] = [];
  ergebnisse.forEach((e, i) => {
    if (e.status === 'fulfilled') {
      artikel.push(...e.value);
      console.log(`  ok   ${aufgaben[i].name}: ${e.value.length} Artikel`);
    } else {
      console.warn(`  FEHL ${aufgaben[i].name}: ${e.reason}`);
    }
  });
  return artikel;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY fehlt. Bitte pipeline/.env aus .env.example anlegen.');
    process.exit(1);
  }

  console.log(`RSS-Feeds (${feeds.length}):`);
  const rss = await sammle(feeds.map((f) => ({ name: f.quelle.id, lauf: () => feedAbrufen(f) })));

  console.log(`GDELT-Abfragen (${gdeltAbfragen.length}):`);
  const gdelt = await sammle(gdeltAbfragen.map((a) => ({ name: a.kategorie, lauf: () => gdeltAbrufen(a) })));

  const alle = [...rss, ...gdelt];
  console.log(`\n${alle.length} Artikel gesammelt. Starte Pipeline ...\n`);

  const store = new SpeicherThemenStore();
  const ergebnis = await pipelineLauf(alle, {
    store,
    geminiClient: erstelleGeminiClient(apiKey),
    embedFn: erstelleGeminiEmbedFn(apiKey),
  });

  console.log('Ergebnis:', ergebnis, '\n');
  for (const t of await store.alle()) {
    const titel = t.zusammenfassung?.schlagzeile ?? t.thema.artikel[0]?.titel ?? '(ohne Titel)';
    console.log(`[${t.status}] ${titel}`);
    if (t.zusammenfassung) {
      const k = t.zusammenfassung.kategorieWerte;
      console.log(`   Kategorien D:${k.deutschland} T:${k.tuerkei} N:${k.nahost} | Wichtigkeit ${t.zusammenfassung.wichtigkeit} | Sicherheit ${t.zusammenfassung.sicherheit}`);
    }
    if (t.grund) console.log(`   Grund: ${t.grund}`);
  }
}

main().catch((fehler) => {
  console.error('Pipeline-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
