import type { Sicherheit, Thema, ThemenZusammenfassung } from '../types.js';

export interface Pruefergebnis {
  gueltig: boolean;
  angepassteSicherheit: Sicherheit;
  probleme: string[];
}

export function faktenPruefen(zusammenfassung: ThemenZusammenfassung, thema: Thema): Pruefergebnis {
  const bekannt = new Set(thema.artikel.map((a) => a.quelle.id));
  const probleme: string[] = [];

  for (const fakt of zusammenfassung.fakten) {
    if (fakt.belegtDurch.length === 0) {
      probleme.push(`Fakt ohne Beleg: "${fakt.text}"`);
      continue;
    }
    const unbekannt = fakt.belegtDurch.find((id) => !bekannt.has(id));
    if (unbekannt) {
      probleme.push(`Fakt "${fakt.text}" verweist auf unbekannte Quelle "${unbekannt}"`);
    }
  }

  return {
    gueltig: probleme.length === 0,
    angepassteSicherheit: probleme.length > 0 ? 'niedrig' : zusammenfassung.sicherheit,
    probleme,
  };
}
