import { describe, it, expect } from 'vitest';
import { sprechtextErstellen } from '../../src/reel/skript.js';
import type { ThemenZusammenfassung } from '../../src/types.js';

function beispiel(overrides: Partial<ThemenZusammenfassung> = {}): ThemenZusammenfassung {
  return {
    themaId: 't1',
    schlagzeile: 'Eine Schlagzeile',
    zusammenfassung: 'Erster Satz. Zweiter Satz. Dritter Satz.',
    kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
    wichtigkeit: 80,
    wichtigkeitBegruendung: 'x',
    fakten: [],
    strittigePunkte: [],
    sicherheit: 'hoch',
    ...overrides,
  };
}

describe('sprechtextErstellen', () => {
  it('beginnt mit der Schlagzeile, gefolgt von Kernsaetzen der Zusammenfassung', () => {
    const text = sprechtextErstellen(beispiel());
    expect(text.startsWith('Eine Schlagzeile.')).toBe(true);
    expect(text).toContain('Erster Satz.');
  });

  it('bricht ab, bevor die Zeichen-Obergrenze ueberschritten wird', () => {
    const langerSatz = 'x'.repeat(500) + '.';
    const text = sprechtextErstellen(beispiel({ zusammenfassung: langerSatz }));
    expect(text.length).toBeLessThan(500);
    expect(text).not.toContain('x'.repeat(500));
  });
});
