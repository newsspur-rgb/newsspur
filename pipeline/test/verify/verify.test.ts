import { describe, it, expect } from 'vitest';
import { faktenPruefen } from '../../src/verify/verify.js';
import type { Thema, ThemenZusammenfassung } from '../../src/types.js';

const thema: Thema = {
  id: 't1',
  artikel: [
    { id: 'a1', quelle: { id: 'zeit', name: 'Zeit', typ: 'zeitung', land: 'DE', sprache: 'de' }, titel: 'T', teaser: 'x', url: 'https://a.de/1', veroeffentlichtAm: '' },
    { id: 'a2', quelle: { id: 'spiegel', name: 'Spiegel', typ: 'zeitung', land: 'DE', sprache: 'de' }, titel: 'T', teaser: 'x', url: 'https://b.de/1', veroeffentlichtAm: '' },
  ],
  erstellt: '', aktualisiert: '',
};

function zusammenfassung(fakten: ThemenZusammenfassung['fakten'], sicherheit: ThemenZusammenfassung['sicherheit'] = 'hoch'): ThemenZusammenfassung {
  return {
    themaId: 't1', schlagzeile: 'S', zusammenfassung: 'Z',
    kategorieWerte: { deutschland: 50, tuerkei: 0, nahost: 0 },
    wichtigkeit: 40, wichtigkeitBegruendung: 'x', fakten, strittigePunkte: [], sicherheit,
  };
}

describe('faktenPruefen', () => {
  it('gueltig, wenn jeder Fakt eine bekannte Beleg-Quelle hat', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: ['zeit'] }, { text: 'F2', belegtDurch: ['spiegel'] }]), thema);
    expect(ergebnis.gueltig).toBe(true);
    expect(ergebnis.angepassteSicherheit).toBe('hoch');
  });

  it('ungueltig und Sicherheit niedrig, wenn ein Fakt keine Beleg-Quelle hat', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: [] }]), thema);
    expect(ergebnis.gueltig).toBe(false);
    expect(ergebnis.angepassteSicherheit).toBe('niedrig');
    expect(ergebnis.probleme).toHaveLength(1);
  });

  it('ungueltig, wenn ein Fakt auf eine unbekannte Quelle verweist', () => {
    const ergebnis = faktenPruefen(zusammenfassung([{ text: 'F1', belegtDurch: ['erfunden'] }]), thema);
    expect(ergebnis.gueltig).toBe(false);
  });
});
