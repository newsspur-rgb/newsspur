import type { ThemenZusammenfassung } from '../types.js';
import { relevanteKategorien, type Kategorie } from '../rules/kategorien.js';

const HASHTAG: Record<Kategorie, string> = {
  deutschland: '#Deutschland',
  tuerkei: '#Türkiye',
  nahost: '#Nahost',
};

// Immer dabei, unabhaengig von der Kategorie - sonst hat ein Post ganz ohne
// Hashtags dagestanden, wenn keine der drei Kategorien die 40er-Schwelle riss.
const BASIS_HASHTAGS = ['#NEWSSPUR', '#Nachrichten'];

const ZUSAMMENFASSUNG_MAX_LAENGE = 300;

function kuerzen(text: string, maxLaenge: number): string {
  if (text.length <= maxLaenge) return text;
  return text.slice(0, maxLaenge - 1).trimEnd() + '…';
}

/** Baut die Instagram-Caption aus Schlagzeile, gekuerzter Zusammenfassung, Quellenlink und Hashtags. */
export function captionErstellen(zusammenfassung: ThemenZusammenfassung, quellUrl: string): string {
  const kategorieHashtags = relevanteKategorien(zusammenfassung.kategorieWerte).map((k) => HASHTAG[k]);
  const hashtags = [...BASIS_HASHTAGS, ...kategorieHashtags].join(' ');
  return [
    zusammenfassung.schlagzeile,
    '',
    kuerzen(zusammenfassung.zusammenfassung, ZUSAMMENFASSUNG_MAX_LAENGE),
    '',
    `Quelle: ${quellUrl}`,
    '',
    hashtags,
  ].join('\n');
}
