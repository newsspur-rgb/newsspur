import { describe, it, expect } from 'vitest';
import { abosFuerThema } from '../../src/push/auswahl.js';
import type { ThemenZusammenfassung } from '../../src/types.js';
import type { PushAbo } from '../../src/push/types.js';

function zusammenfassung(overrides: Partial<ThemenZusammenfassung> = {}): ThemenZusammenfassung {
  return {
    themaId: 't1',
    schlagzeile: 'Beispiel',
    zusammenfassung: 'Text',
    kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
    wichtigkeit: 80,
    wichtigkeitBegruendung: 'x',
    fakten: [],
    strittigePunkte: [],
    sicherheit: 'hoch',
    ...overrides,
  };
}

function abo(overrides: Partial<PushAbo> = {}): PushAbo {
  return {
    endpoint: 'https://push.example/e1',
    p256dh: 'p',
    auth: 'a',
    deutschland: true,
    tuerkei: false,
    nahost: false,
    nurEilmeldungen: false,
    ...overrides,
  };
}

describe('abosFuerThema', () => {
  it('waehlt ein Abo mit passendem Kategorie-Toggle bei ausreichender Wichtigkeit', () => {
    const ergebnis = abosFuerThema([abo()], zusammenfassung());
    expect(ergebnis).toHaveLength(1);
  });

  it('ignoriert Themen unterhalb der Basis-Wichtigkeitsschwelle', () => {
    const ergebnis = abosFuerThema([abo()], zusammenfassung({ wichtigkeit: 50 }));
    expect(ergebnis).toEqual([]);
  });

  it('ignoriert Abos ohne passendes Kategorie-Toggle', () => {
    const ergebnis = abosFuerThema([abo({ deutschland: false, tuerkei: true })], zusammenfassung());
    expect(ergebnis).toEqual([]);
  });

  it('Nur-Eilmeldungen-Abo bekommt nichts unterhalb der Eil-Schwelle, obwohl sicherheit hoch ist', () => {
    const ergebnis = abosFuerThema([abo({ nurEilmeldungen: true })], zusammenfassung({ wichtigkeit: 80 }));
    expect(ergebnis).toEqual([]);
  });

  it('Nur-Eilmeldungen-Abo bekommt nichts bei sicherheit != hoch, obwohl Wichtigkeit hoch ist', () => {
    const ergebnis = abosFuerThema([abo({ nurEilmeldungen: true })], zusammenfassung({ wichtigkeit: 95, sicherheit: 'mittel' }));
    expect(ergebnis).toEqual([]);
  });

  it('Nur-Eilmeldungen-Abo bekommt einen Push, wenn beide Bedingungen erfuellt sind', () => {
    const ergebnis = abosFuerThema([abo({ nurEilmeldungen: true })], zusammenfassung({ wichtigkeit: 95, sicherheit: 'hoch' }));
    expect(ergebnis).toHaveLength(1);
  });
});
