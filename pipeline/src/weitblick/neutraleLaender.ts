import type { KategorieWerte } from '../types.js';

export type Kategorie = keyof KategorieWerte;

export interface NeutralesLand {
  /** FIPS-Code, so wie GDELT ihn im Filter "sourcecountry:" erwartet. */
  fips: string;
  /** Name, wie GDELT ihn im Feld "sourcecountry" zurueckgibt. */
  gdeltName: string;
  name: string;
}

/**
 * Salims Methode: Medien aus weit entfernten Laendern ohne eigenes Interesse am Ereignis lesen
 * und schauen, wo sie uebereinstimmen. Bewusst KEINE USA, EU, Russland, China, Tuerkei oder
 * Nahost-Staaten im Pool - die sind bei den drei Kategorien fast immer selbst Partei.
 */
export const NEUTRALE_LAENDER: NeutralesLand[] = [
  { fips: 'IN', gdeltName: 'India', name: 'Indien' },
  { fips: 'ID', gdeltName: 'Indonesia', name: 'Indonesien' },
  { fips: 'BR', gdeltName: 'Brazil', name: 'Brasilien' },
  { fips: 'SF', gdeltName: 'South Africa', name: 'Südafrika' },
  { fips: 'PA', gdeltName: 'Paraguay', name: 'Paraguay' },
  { fips: 'PP', gdeltName: 'Papua New Guinea', name: 'Papua-Neuguinea' },
  { fips: 'MX', gdeltName: 'Mexico', name: 'Mexiko' },
  { fips: 'KE', gdeltName: 'Kenya', name: 'Kenia' },
  { fips: 'NI', gdeltName: 'Nigeria', name: 'Nigeria' },
  { fips: 'MY', gdeltName: 'Malaysia', name: 'Malaysia' },
  { fips: 'RP', gdeltName: 'Philippines', name: 'Philippinen' },
  { fips: 'TH', gdeltName: 'Thailand', name: 'Thailand' },
  { fips: 'VM', gdeltName: 'Vietnam', name: 'Vietnam' },
  { fips: 'CI', gdeltName: 'Chile', name: 'Chile' },
  { fips: 'CO', gdeltName: 'Colombia', name: 'Kolumbien' },
  { fips: 'AR', gdeltName: 'Argentina', name: 'Argentinien' },
  { fips: 'NZ', gdeltName: 'New Zealand', name: 'Neuseeland' },
  { fips: 'JA', gdeltName: 'Japan', name: 'Japan' },
  { fips: 'KS', gdeltName: 'South Korea', name: 'Südkorea' },
  { fips: 'GH', gdeltName: 'Ghana', name: 'Ghana' },
];

/** Laender, die je Kategorie zusaetzlich ausgeschlossen werden, weil sie dort klar Partei ergreifen. */
const AUSSCHLUSS: Record<Kategorie, string[]> = {
  deutschland: [],
  tuerkei: [],
  nahost: ['MY', 'ID'],
};

export function neutraleLaenderFuer(kategorie: Kategorie): NeutralesLand[] {
  return NEUTRALE_LAENDER.filter((l) => !AUSSCHLUSS[kategorie].includes(l.fips));
}

export function landNameAusGdelt(gdeltName: string): string {
  return NEUTRALE_LAENDER.find((l) => l.gdeltName === gdeltName)?.name ?? gdeltName;
}
