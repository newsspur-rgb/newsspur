import type { Gesetz } from '../bundestag/typen.js';
import type { Kategorie } from './neutraleLaender.js';
import type { WeltArtikel } from './gdeltWelt.js';

export type WeltUrteil = 'deckungsgleich' | 'teilweise' | 'widerspruechlich' | 'kaum-berichtet';

export interface Weltblick {
  urteil: WeltUrteil;
  laender: string[];
  /** Was die neutralen Medien uebereinstimmend berichten (max. 5 Zeilen). */
  uebereinstimmung: string;
  abweichungen: string[];
  belege: WeltArtikel[];
}

export interface WeitblickEntwicklung {
  titel: string;
  kategorie: Kategorie;
  /** Kurzfassung aus den newsspur-Meldungen der Woche (max. 5 Zeilen). */
  kurz: string;
  themaIds: string[];
  weltblick: Weltblick;
}

export interface Weitblick {
  /** ISO-Woche, z. B. "2026-W42". */
  woche: string;
  von: string;
  bis: string;
  erstellt: string;
  einleitung: string;
  entwicklungen: WeitblickEntwicklung[];
  gesetze: Gesetz[];
}
