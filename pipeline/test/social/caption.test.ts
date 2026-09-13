import { describe, it, expect } from 'vitest';
import { captionErstellen } from '../../src/social/caption.js';
import type { ThemenZusammenfassung } from '../../src/types.js';

function beispiel(overrides: Partial<ThemenZusammenfassung> = {}): ThemenZusammenfassung {
  return {
    themaId: 't1',
    schlagzeile: 'Eine Schlagzeile',
    zusammenfassung: 'Eine kurze Zusammenfassung.',
    kategorieWerte: { deutschland: 90, tuerkei: 20, nahost: 0 },
    wichtigkeit: 50,
    wichtigkeitBegruendung: 'x',
    fakten: [],
    strittigePunkte: [],
    sicherheit: 'hoch',
    ...overrides,
  };
}

describe('captionErstellen', () => {
  it('enthaelt Schlagzeile, Zusammenfassung und Hashtags relevanter Kategorien', () => {
    const caption = captionErstellen(beispiel());
    expect(caption).toContain('Eine Schlagzeile');
    expect(caption).toContain('Eine kurze Zusammenfassung.');
    expect(caption).toContain('#Deutschland');
    expect(caption).not.toContain('#Nahost');
  });

  it('kuerzt eine sehr lange Zusammenfassung', () => {
    const lang = 'x'.repeat(500);
    const caption = captionErstellen(beispiel({ zusammenfassung: lang }));
    expect(caption).toContain('…');
    expect(caption.length).toBeLessThan(500 + 100);
  });
});
