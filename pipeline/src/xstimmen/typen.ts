import type { Kategorie } from '../rules/kategorien.js';

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
}

/** Ein Thema, über das auf X gesprochen wird - zusammengefasst aus mehreren Tweets. */
export interface XThema {
  id: string;
  kategorie: Kategorie;
  titel: string;
  zusammenfassung: string;
  /** Passende newsspur-Meldung, falls es eine gibt. */
  themaId: string | null;
  stimmen: XStimme[];
  erstellt: string;
  aktualisiert: string;
}
