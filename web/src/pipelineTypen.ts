// Spiegelt nur das Noetige aus pipeline/src/types.ts (VerarbeitetesThema).
// Bewusst dupliziert statt cross-package importiert, damit dieser Worker
// unabhaengig gebaut/deployed werden kann.

export type Sicherheit = 'hoch' | 'mittel' | 'niedrig';

export interface KategorieWerte {
  deutschland: number;
  tuerkei: number;
  nahost: number;
}

export interface Quelle {
  id: string;
  name: string;
  typ: 'oeffentlich-rechtlich' | 'zeitung' | 'agentur' | 'staatsnah' | 'unabhaengig';
}

export interface Artikel {
  id: string;
  quelle: Quelle;
  url: string;
  bildUrl?: string;
}

export interface Fakt {
  text: string;
  belegtDurch: string[];
}

export interface ThemenZusammenfassung {
  schlagzeile: string;
  zusammenfassung: string;
  kategorieWerte: KategorieWerte;
  wichtigkeit: number;
  fakten: Fakt[];
  strittigePunkte: string[];
  sicherheit: Sicherheit;
}

export interface VerarbeitetesThema {
  thema: { id: string; artikel: Artikel[]; aktualisiert: string };
  zusammenfassung?: ThemenZusammenfassung;
  status: 'wartet' | 'zurueckgehalten' | 'veroeffentlicht';
}
