import type { ThemenZusammenfassung } from '../types.js';
import { relevanteKategorien, type Kategorie } from '../rules/kategorien.js';

const HASHTAG: Record<Kategorie, string> = {
  deutschland: '#Deutschland',
  tuerkei: '#Türkiye',
  nahost: '#Nahost',
};

const ZUSAMMENFASSUNG_MAX_LAENGE = 300;

function kuerzen(text: string, maxLaenge: number): string {
  if (text.length <= maxLaenge) return text;
  return text.slice(0, maxLaenge - 1).trimEnd() + '…';
}

/** Baut die Instagram-Caption aus Schlagzeile, gekuerzter Zusammenfassung und Kategorie-Hashtags. */
export function captionErstellen(zusammenfassung: ThemenZusammenfassung): string {
  const hashtags = relevanteKategorien(zusammenfassung.kategorieWerte)
    .map((k) => HASHTAG[k])
    .join(' ');
  const teile = [
    zusammenfassung.schlagzeile,
    '',
    kuerzen(zusammenfassung.zusammenfassung, ZUSAMMENFASSUNG_MAX_LAENGE),
  ];
  if (hashtags) teile.push('', hashtags);
  return teile.join('\n');
}
