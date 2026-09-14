export type Sprache = 'de' | 'tr' | 'ar' | 'en';
export type VerlagTyp = 'oeffentlich-rechtlich' | 'zeitung' | 'agentur' | 'staatsnah' | 'unabhaengig';
export type Land = 'DE' | 'TR' | 'INT';

export interface Quelle {
  id: string;
  name: string;
  typ: VerlagTyp;
  land: Land;
  sprache: Sprache;
}

export interface Feed {
  quelle: Quelle;
  url: string;
}

export interface Artikel {
  id: string;
  quelle: Quelle;
  titel: string;
  teaser: string;
  url: string;
  bildUrl?: string;
  veroeffentlichtAm: string;
}

export interface Thema {
  id: string;
  artikel: Artikel[];
  erstellt: string;
  aktualisiert: string;
  /** Embedding-Vektor des stabilen Vergleichstexts (siehe cluster.ts themenText) - einmal
   *  berechnet und dauerhaft gespeichert, damit nicht jeder Lauf alle wartenden Themen neu embedded. */
  embedding?: number[];
}

export type Sicherheit = 'hoch' | 'mittel' | 'niedrig';

export interface KategorieWerte {
  deutschland: number;
  tuerkei: number;
  nahost: number;
}

export interface Fakt {
  text: string;
  belegtDurch: string[];
}

export interface ThemenZusammenfassung {
  themaId: string;
  schlagzeile: string;
  zusammenfassung: string;
  kategorieWerte: KategorieWerte;
  wichtigkeit: number;
  wichtigkeitBegruendung: string;
  fakten: Fakt[];
  strittigePunkte: string[];
  sicherheit: Sicherheit;
}

export type Verarbeitungsstatus = 'wartet' | 'zurueckgehalten' | 'veroeffentlicht';

export interface VerarbeitetesThema {
  thema: Thema;
  zusammenfassung?: ThemenZusammenfassung;
  status: Verarbeitungsstatus;
  grund?: string;
}
