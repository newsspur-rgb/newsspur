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
  it('enthaelt Schlagzeile, Zusammenfassung, Quellenlink und Hashtags relevanter Kategorien', () => {
    const caption = captionErstellen(beispiel(), 'https://quelle.example/artikel-1');
    expect(caption).toContain('Eine Schlagzeile');
    expect(caption).toContain('Eine kurze Zusammenfassung.');
    expect(caption).toContain('Quelle: https://quelle.example/artikel-1');
    expect(caption).toContain('#Deutschland');
    expect(caption).not.toContain('#Nahost');
  });

  it('enthaelt immer die Basis-Hashtags, auch wenn keine Kategorie die Schwelle reisst', () => {
    const caption = captionErstellen(
      beispiel({ kategorieWerte: { deutschland: 10, tuerkei: 5, nahost: 0 } }),
      'https://quelle.example/artikel-1',
    );
    expect(caption).toContain('#NEWSSPUR');
    expect(caption).toContain('#Nachrichten');
  });

  it('kuerzt eine sehr lange Zusammenfassung', () => {
    const lang = 'x'.repeat(500);
    const caption = captionErstellen(beispiel({ zusammenfassung: lang }), 'https://quelle.example/artikel-1');
    expect(caption).toContain('…');
    expect(caption.length).toBeLessThan(500 + 200);
  });
});
