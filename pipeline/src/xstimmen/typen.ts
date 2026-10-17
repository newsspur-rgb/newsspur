import type { XGruppe } from './konten.js';

/** Ein Tweet als Beleg, mit der Kernaussage auf Deutsch. */
export interface XStimme {
  autor: string;
  /** Anzeigename des Kontos, z. B. "Bundeskanzler" */
  konto: string;
  kernaussage: string;
  text: string;
  url: string;
  zeit: string;
  likes: number;
  posterUrl?: string;
  istVideo: boolean;
}

/** Ein Thema, über das auf X gesprochen wird - zusammengefasst aus mehreren Tweets. */
export interface XThema {
  id: string;
  /** Ländergruppe, z. B. deutschland, usa, eu */
  kategorie: XGruppe;
  titel: string;
  zusammenfassung: string;
  /** Passende newsspur-Meldung, falls es eine gibt. */
  themaId: string | null;
  stimmen: XStimme[];
  erstellt: string;
  aktualisiert: string;
}
