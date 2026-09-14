import type { VerarbeitetesThema, KategorieWerte, Sicherheit } from './pipelineTypen.js';

export interface ApiFakt {
  text: string;
  belegtDurch: string[];
}

export interface ApiQuelle {
  name: string;
  typ: string;
  flag: boolean;
  url: string;
}

export interface ApiThema {
  id: string;
  schlagzeile: string;
  zusammenfassung: string;
  kategorieWerte: KategorieWerte;
  wichtigkeit: number;
  sicherheit: Sicherheit;
  aktualisiert: string;
  fakten: ApiFakt[];
  strittigePunkte: string[];
  quellen: ApiQuelle[];
  bildUrl?: string;
  bildQuelle?: string;
  reaktionen?: Record<string, number>;
}

const TYP_LABEL: Record<string, string> = {
  'oeffentlich-rechtlich': 'Öffentlich-rechtlich',
  zeitung: 'Zeitung',
  agentur: 'Agentur',
  staatsnah: 'Staatsnah',
  unabhaengig: 'Unabhängig',
};

function quellenAufloesen(thema: VerarbeitetesThema['thema']): ApiQuelle[] {
  const gesehen = new Map<string, ApiQuelle>();
  for (const artikel of thema.artikel) {
    if (!gesehen.has(artikel.quelle.id)) {
      gesehen.set(artikel.quelle.id, {
        name: artikel.quelle.name,
        typ: TYP_LABEL[artikel.quelle.typ] ?? artikel.quelle.typ,
        flag: artikel.quelle.typ === 'staatsnah',
        url: artikel.url,
      });
    }
  }
  return [...gesehen.values()];
}

function bildAufloesen(thema: VerarbeitetesThema['thema']): { bildUrl?: string; bildQuelle?: string } {
  const artikel = thema.artikel.find((a) => a.bildUrl);
  return { bildUrl: artikel?.bildUrl, bildQuelle: artikel?.quelle.name };
}

function faktenAufloesen(thema: VerarbeitetesThema): ApiFakt[] {
  const nameNachId = new Map(thema.thema.artikel.map((a) => [a.quelle.id, a.quelle.name]));
  return (thema.zusammenfassung?.fakten ?? []).map((f) => ({
    text: f.text,
    belegtDurch: f.belegtDurch.map((id) => nameNachId.get(id) ?? id),
  }));
}

/** Wandelt ein gespeichertes VerarbeitetesThema in die schlanke API-Antwortform um. Gibt null zurueck, falls keine Zusammenfassung vorliegt (sollte bei status=veroeffentlicht nicht vorkommen). */
export function themaZuApi(thema: VerarbeitetesThema): ApiThema | null {
  if (!thema.zusammenfassung) return null;
  return {
    id: thema.thema.id,
    schlagzeile: thema.zusammenfassung.schlagzeile,
    zusammenfassung: thema.zusammenfassung.zusammenfassung,
    kategorieWerte: thema.zusammenfassung.kategorieWerte,
    wichtigkeit: thema.zusammenfassung.wichtigkeit,
    sicherheit: thema.zusammenfassung.sicherheit,
    aktualisiert: thema.thema.aktualisiert,
    fakten: faktenAufloesen(thema),
    strittigePunkte: thema.zusammenfassung.strittigePunkte,
    quellen: quellenAufloesen(thema.thema),
    ...bildAufloesen(thema.thema),
  };
}
