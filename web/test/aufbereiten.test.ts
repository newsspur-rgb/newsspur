import { describe, it, expect } from 'vitest';
import { themaZuApi } from '../src/aufbereiten.js';
import type { VerarbeitetesThema } from '../src/pipelineTypen.js';

function beispielThema(): VerarbeitetesThema {
  return {
    thema: {
      id: 't1',
      aktualisiert: '2026-09-13T12:00:00.000Z',
      artikel: [
        {
          id: 'a1',
          quelle: { id: 'zeit', name: 'Zeit Online', typ: 'zeitung' },
          url: 'https://zeit.de/artikel-a1',
          bildUrl: 'https://zeit.de/artikel-a1.jpg',
        },
        {
          id: 'a2',
          quelle: { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' },
          url: 'https://tagesschau.de/artikel-a2',
        },
        { id: 'a3', quelle: { id: 'trt', name: 'TRT Haber', typ: 'staatsnah' }, url: 'https://trthaber.com/artikel-a3' },
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
      { name: 'Zeit Online', typ: 'Zeitung', flag: false, url: 'https://zeit.de/artikel-a1' },
      { name: 'Tagesschau', typ: 'Öffentlich-rechtlich', flag: false, url: 'https://tagesschau.de/artikel-a2' },
      { name: 'TRT Haber', typ: 'Staatsnah', flag: true, url: 'https://trthaber.com/artikel-a3' },
    ]);
  });

  it('nimmt das Bild des ersten Artikels mit bildUrl samt Quellenname', () => {
    const ergebnis = themaZuApi(beispielThema());
    expect(ergebnis?.bildUrl).toBe('https://zeit.de/artikel-a1.jpg');
    expect(ergebnis?.bildQuelle).toBe('Zeit Online');
  });

  it('laesst bildUrl/bildQuelle weg, wenn kein Artikel ein Bild hat', () => {
    const thema = beispielThema();
    delete thema.thema.artikel[0].bildUrl;
    expect(themaZuApi(thema)?.bildUrl).toBeUndefined();
    expect(themaZuApi(thema)?.bildQuelle).toBeUndefined();
  });

  it('uebernimmt Schlagzeile, Kategorie-Werte und Sicherheit unveraendert', () => {
    const ergebnis = themaZuApi(beispielThema());
    expect(ergebnis?.schlagzeile).toBe('Beispiel-Schlagzeile');
    expect(ergebnis?.kategorieWerte).toEqual({ deutschland: 90, tuerkei: 20, nahost: 0 });
    expect(ergebnis?.sicherheit).toBe('hoch');
  });
});
