import type { Artikel } from './types.js';
import { feeds } from './sources/feeds.js';
import { feedAbrufen } from './sources/fetchRss.js';
import { buendeln } from './cluster/cluster.js';
import { unabhaengigkeitPruefen } from './filter/independence.js';

// Zeigt die schluessellosen Pipeline-Stufen (Sammeln -> Buendeln -> Filtern) auf
// den echten Feeds von heute. Der KI-Teil (Gemini) bleibt aussen vor.
// Aufruf: npm run pipeline:demo

async function main(): Promise<void> {
  console.log(`Rufe ${feeds.length} RSS-Feeds ab ...\n`);
  const ergebnisse = await Promise.allSettled(feeds.map((f) => feedAbrufen(f)));

  const artikel: Artikel[] = [];
  ergebnisse.forEach((e, i) => {
    if (e.status === 'fulfilled') {
      artikel.push(...e.value);
      console.log(`  ok   ${feeds[i].quelle.id.padEnd(16)} ${e.value.length} Artikel`);
    } else {
      console.warn(`  FEHL ${feeds[i].quelle.id.padEnd(16)} ${e.reason}`);
    }
  });

  console.log(`\n${artikel.length} Artikel gesammelt. Buendele (Wortabgleich, ohne KI) ...\n`);
  const { neueThemen } = await buendeln(artikel, []);

  const mehrfach = neueThemen
    .map((thema) => ({ thema, pruefung: unabhaengigkeitPruefen(thema) }))
    .filter((x) => x.thema.artikel.length > 1)
    .sort((a, b) => b.thema.artikel.length - a.thema.artikel.length);

  console.log(`${neueThemen.length} Themen, davon ${mehrfach.length} mit mehreren Artikeln:\n`);
  for (const { thema, pruefung } of mehrfach) {
    const quellen = [...new Set(thema.artikel.map((a) => a.quelle.id))].join(', ');
    console.log(`• ${thema.artikel[0].titel}`);
    console.log(`  ${thema.artikel.length} Artikel | Quellen: ${quellen} | Unabhaengigkeit: ${pruefung.status}`);
  }

  const wuerdenLaufen = mehrfach.filter((x) => x.pruefung.status !== 'unzureichend').length;
  console.log(`\n=> ${wuerdenLaufen} Themen wuerden an Gemini zur Zusammenfassung gehen.`);
}

main().catch((fehler) => {
  console.error('Demo-Lauf fehlgeschlagen:', fehler);
  process.exit(1);
});
