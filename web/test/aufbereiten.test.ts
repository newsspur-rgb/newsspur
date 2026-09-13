import { describe, it, expect } from 'vitest';
import { themaZuApi } from '../src/aufbereiten.js';
import type { VerarbeitetesThema } from '../src/pipelineTypen.js';

function beispielThema(): VerarbeitetesThema {
  return {
    thema: {
      id: 't1',
      aktualisiert: '2026-09-13T12:00:00.000Z',
      artikel: [
        { id: 'a1', quelle: { id: 'zeit', name: 'Zeit Online', typ: 'zeitung' } },
        { id: 'a2', quelle: { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' } },
        { id: 'a3', quelle: { id: 'trt', name: 'TRT Haber', typ: 'staatsnah' } },
      ],
    },
    status: 'veroeffentlicht',
    zusammenfassung: {
      schlagzeile: 'Beispiel-Schlagzeile',
      zusammenfassung: 'Eine kurze Zusammenfassung.',
      kategorieWerte: { deutschland: 90, tuerkei: 20, nahost: 0 },
      wichtigkeit: 70,
      sicherheit: 'hoch',
      fakten: [{ text: 'Ein Fakt.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: ['Ein strittiger Punkt.'],
    },
  };
}

describe('themaZuApi', () => {
  it('gibt null zurueck, wenn keine Zusammenfassung vorliegt', () => {
    const thema = beispielThema();
    delete thema.zusammenfassung;
    expect(themaZuApi(thema)).toBeNull();
  });

  it('loest belegtDurch-Quellen-IDs zu Klarnamen auf', () => {
    const ergebnis = themaZuApi(beispielThema());
    expect(ergebnis?.fakten[0].belegtDurch).toEqual(['Zeit Online', 'Tagesschau']);
  });

  it('dedupliziert Quellen und markiert staatsnahe mit flag', () => {
    const ergebnis = themaZuApi(beispielThema());
    expect(ergebnis?.quellen).toEqual([
      { name: 'Zeit Online', typ: 'Zeitung', flag: false },
      { name: 'Tagesschau', typ: 'Öffentlich-rechtlich', flag: false },
      { name: 'TRT Haber', typ: 'Staatsnah', flag: true },
    ]);
  });

  it('uebernimmt Schlagzeile, Kategorie-Werte und Sicherheit unveraendert', () => {
    const ergebnis = themaZuApi(beispielThema());
    expect(ergebnis?.schlagzeile).toBe('Beispiel-Schlagzeile');
    expect(ergebnis?.kategorieWerte).toEqual({ deutschland: 90, tuerkei: 20, nahost: 0 });
    expect(ergebnis?.sicherheit).toBe('hoch');
  });
});
