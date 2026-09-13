import { describe, it, expect } from 'vitest';
import { kartePngErzeugen } from '../../src/social/renderCard.js';
import type { ThemenZusammenfassung } from '../../src/types.js';

function beispiel(overrides: Partial<ThemenZusammenfassung> = {}): ThemenZusammenfassung {
  return {
    themaId: 't1',
    schlagzeile: 'Beispiel-Schlagzeile für den Test',
    zusammenfassung: 'Text',
    kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
    wichtigkeit: 50,
    wichtigkeitBegruendung: 'x',
    fakten: [],
    strittigePunkte: [],
    sicherheit: 'hoch',
    ...overrides,
  };
}

describe('kartePngErzeugen', () => {
  it('erzeugt ein gueltiges PNG (Signatur-Bytes) mit plausibler Groesse', async () => {
    const png = await kartePngErzeugen(beispiel());
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(5000);
  });

  it('erzeugt fuer unterschiedliche Schlagzeilen unterschiedliche Bilder', async () => {
    const a = await kartePngErzeugen(beispiel({ schlagzeile: 'Kurze Schlagzeile' }));
    const b = await kartePngErzeugen(beispiel({ schlagzeile: 'Eine ganz andere, viel längere Schlagzeile zum Vergleich' }));
    expect(a.equals(b)).toBe(false);
  });
});
