import type { KategorieWerte } from '../types.js';

export const KATEGORIE_SCHWELLE = 40;

export type Kategorie = 'deutschland' | 'tuerkei' | 'nahost';

const ALLE: Kategorie[] = ['deutschland', 'tuerkei', 'nahost'];

export function gehoertZuKategorie(werte: KategorieWerte, kategorie: Kategorie, schwelle = KATEGORIE_SCHWELLE): boolean {
  return werte[kategorie] >= schwelle;
}

export function relevanteKategorien(werte: KategorieWerte, schwelle = KATEGORIE_SCHWELLE): Kategorie[] {
  return ALLE.filter((k) => gehoertZuKategorie(werte, k, schwelle));
}
