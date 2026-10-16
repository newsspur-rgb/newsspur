export type GesetzAmpel = 'beschlossen' | 'gescheitert' | 'gekippt' | 'in-beratung';

export interface Gesetz {
  id: string;
  titel: string;
  abstract?: string;
  beratungsstand: string;
  ampel: GesetzAmpel;
  initiative: string[];
  sachgebiet: string[];
  datum?: string;
  verkuendetAm?: string;
  aktualisiert: string;
  link: string;
}

export interface Plenarprotokoll {
  id: string;
  titel: string;
  datum: string;
  text: string;
}

export interface DebattenPosition {
  fraktion: string;
  aussage: string;
}

export interface DebattenPunkt {
  thema: string;
  worum: string;
  positionen: DebattenPosition[];
  ergebnis: string;
}

export interface Debatte {
  id: string;
  titel: string;
  datum: string;
  ueberblick: string;
  punkte: DebattenPunkt[];
  link: string;
  /** true, wenn das Protokoll fuer Gemini gekuerzt werden musste. */
  gekuerzt: boolean;
}
