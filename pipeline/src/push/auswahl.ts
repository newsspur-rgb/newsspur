import type { ThemenZusammenfassung } from '../types.js';
import { relevanteKategorien, type Kategorie } from '../rules/kategorien.js';
import type { PushAbo } from './types.js';

/** Grob geschaetzt, da noch keine echte Wichtigkeits-Verteilung aus Live-Laeufen vorliegt - leicht nachjustierbar. */
export const WICHTIGKEIT_SCHWELLE_BASIS = 70;
export const WICHTIGKEIT_SCHWELLE_EIL = 90;

const KATEGORIE_FELD: Record<Kategorie, keyof PushAbo> = {
  deutschland: 'deutschland',
  tuerkei: 'tuerkei',
  nahost: 'nahost',
};

/** Waehlt die Abos aus, die fuer dieses Thema einen Push bekommen sollen (reine Funktion, kein Netzwerk). */
export function abosFuerThema(abos: PushAbo[], zusammenfassung: ThemenZusammenfassung): PushAbo[] {
  if (zusammenfassung.wichtigkeit < WICHTIGKEIT_SCHWELLE_BASIS) return [];

  const kategorien = relevanteKategorien(zusammenfassung.kategorieWerte);
  if (kategorien.length === 0) return [];

  return abos.filter((abo) => {
    if (abo.nurEilmeldungen) {
      if (zusammenfassung.sicherheit !== 'hoch') return false;
      if (zusammenfassung.wichtigkeit < WICHTIGKEIT_SCHWELLE_EIL) return false;
    }
    return kategorien.some((k) => abo[KATEGORIE_FELD[k]]);
  });
}
