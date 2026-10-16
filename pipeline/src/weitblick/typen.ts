import type { Gesetz } from '../bundestag/typen.js';
import type { Kategorie } from './neutraleLaender.js';
import type { WeltArtikel } from './gdeltWelt.js';
import type { BlueskyPost } from './bluesky.js';

export type WeltUrteil = 'deckungsgleich' | 'teilweise' | 'widerspruechlich' | 'kaum-berichtet';

export interface Weltblick {
  urteil: WeltUrteil;
  laender: string[];
  /** Was die neutralen Medien uebereinstimmend berichten (max. 5 Zeilen). */
  uebereinstimmung: string;
  abweichungen: string[];
  belege: WeltArtikel[];
}

export type StimmungsTon = 'zustimmend' | 'ablehnend' | 'gemischt' | 'neutral';

/** Bluesky-Stimmung in einem Sprachraum - nicht repraesentativ. */
export interface SprachStimmung {
  sprachraum: string;
  anzahlPosts: number;
  zusammenfassung: string;
  ton: StimmungsTon;
  beispiele: BlueskyPost[];
}

export interface WeitblickEntwicklung {
  titel: string;
  kategorie: Kategorie;
  /** Kurzfassung aus den newsspur-Meldungen der Woche (max. 5 Zeilen). */
  kurz: string;
  themaIds: string[];
  weltblick: Weltblick;
  stimmung?: SprachStimmung[];
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
