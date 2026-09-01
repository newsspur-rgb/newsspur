import { describe, it, expect } from 'vitest';
import { unabhaengigkeitPruefen } from '../../src/filter/independence.js';
import type { Artikel, Thema } from '../../src/types.js';

const q = (id: string) => ({ id, name: id, typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const });
const art = (quelleId: string, teaser: string): Artikel => ({
  id: `a-${quelleId}`, quelle: q(quelleId), titel: 'T', teaser, url: `https://${quelleId}.de/1`, veroeffentlichtAm: new Date().toISOString(),
});
const thema = (artikel: Artikel[]): Thema => ({ id: 't', artikel, erstellt: '', aktualisiert: '' });

describe('unabhaengigkeitPruefen', () => {
  it('unzureichend bei nur einer Quelle', () => {
    expect(unabhaengigkeitPruefen(thema([art('zeit', 'Text')])).status).toBe('unzureichend');
  });

  it('ausreichend bei zwei verschiedenen Verlagen ohne Agenturbezug', () => {
    expect(unabhaengigkeitPruefen(thema([art('zeit', 'Eigener Bericht'), art('spiegel', 'Eigene Recherche')])).status).toBe('ausreichend');
  });

  it('schwach, wenn sich alle Quellen auf dieselbe Agentur berufen', () => {
    const ergebnis = unabhaengigkeitPruefen(thema([art('zeit', 'Meldung (dpa)'), art('spiegel', 'Bericht (dpa)')]));
    expect(ergebnis.status).toBe('schwach');
  });

  it('ausreichend, wenn mindestens eine Quelle nicht auf die Agentur verweist', () => {
    const ergebnis = unabhaengigkeitPruefen(thema([art('zeit', 'Meldung (dpa)'), art('spiegel', 'Eigene Recherche vor Ort')]));
    expect(ergebnis.status).toBe('ausreichend');
  });
});
