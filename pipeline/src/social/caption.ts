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

// Instagram erlaubt seit Dez. 2025 nur noch 5 Hashtags/Post (vorher 30) - mehr
// bringt ohnehin keine zusaetzliche Reichweite, nur noch Themen-Einordnung.
const HASHTAG_MAX = 5;

const ZUSAMMENFASSUNG_MAX_LAENGE = 300;

function kuerzen(text: string, maxLaenge: number): string {
  if (text.length <= maxLaenge) return text;
  return text.slice(0, maxLaenge - 1).trimEnd() + '…';
}

/**
 * Baut die Instagram-Caption aus Hook-Zeile, gekuerzter Zusammenfassung, Quellenlink, CTA und
 * Hashtags. "hook" (siehe hook.ts) ersetzt die Schlagzeile als zugespitzte erste Zeile, wenn
 * vorhanden - sonst (z. B. kein Gemini-Aufruf gemacht) bleibt es bei der sachlichen Schlagzeile.
 */
export function captionErstellen(zusammenfassung: ThemenZusammenfassung, quellUrl: string, hook?: string): string {
  const kategorieHashtags = relevanteKategorien(zusammenfassung.kategorieWerte).map((k) => HASHTAG[k]);
  const hashtags = [...BASIS_HASHTAGS, ...kategorieHashtags].slice(0, HASHTAG_MAX).join(' ');
  return [
    hook || zusammenfassung.schlagzeile,
    '',
    kuerzen(zusammenfassung.zusammenfassung, ZUSAMMENFASSUNG_MAX_LAENGE),
    '',
    `Quelle: ${quellUrl}`,
    '',
    'Was denkst du dazu? Schreib\'s in die Kommentare.',
    '',
    hashtags,
  ].join('\n');
}
