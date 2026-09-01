import { describe, it, expect } from 'vitest';
import { nahostSonderregelPruefen } from '../../src/rules/nahostRegel.js';
import type { Artikel, Thema, ThemenZusammenfassung } from '../../src/types.js';

const q = (id: string) => ({ id, name: id, typ: 'zeitung' as const, land: 'INT' as const, sprache: 'en' as const });
const art = (id: string, quelleId: string): Artikel => ({ id, quelle: q(quelleId), titel: 'T', teaser: 'x', url: `https://${id}.x/1`, veroeffentlichtAm: '' });
const thema = (artikel: Artikel[]): Thema => ({ id: 't', artikel, erstellt: '', aktualisiert: '' });

function zf(over: Partial<ThemenZusammenfassung>): ThemenZusammenfassung {
  return {
    themaId: 't', schlagzeile: 'S', zusammenfassung: 'Neutrale Lage.',
    kategorieWerte: { deutschland: 0, tuerkei: 0, nahost: 80 },
    wichtigkeit: 70, wichtigkeitBegruendung: 'x', fakten: [], strittigePunkte: [], sicherheit: 'hoch',
    ...over,
  };
}

describe('nahostSonderregelPruefen', () => {
  it('nicht betroffen, wenn nahost-Wert unter 40', () => {
    const ergebnis = nahostSonderregelPruefen(zf({ kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 10 } }), thema([art('a1', 'x')]));
    expect(ergebnis.betroffen).toBe(false);
    expect(ergebnis.zurueckhalten).toBe(false);
  });

  it('betroffen, aber nicht zurueckgehalten ohne sensible Angabe', () => {
    const ergebnis = nahostSonderregelPruefen(zf({ zusammenfassung: 'Diplomatische Gespraeche wurden fortgesetzt.' }), thema([art('a1', 'x')]));
    expect(ergebnis).toEqual({ betroffen: true, zurueckhalten: false });
  });

  it('zurueckgehalten bei Opferzahlen ohne beide Seiten', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Bei dem Angriff gab es mehrere Tote und Verletzte.' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'reuters-gdelt')]),
    );
    expect(ergebnis.zurueckhalten).toBe(true);
  });

  it('nicht zurueckgehalten bei Opferzahlen, wenn beide Seiten vertreten sind', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Bei dem Angriff gab es mehrere Tote.' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'times-of-israel')]),
    );
    expect(ergebnis.zurueckhalten).toBe(false);
  });

  it('zurueckgehalten bei sensibler Angabe und niedriger Sicherheit', () => {
    const ergebnis = nahostSonderregelPruefen(
      zf({ zusammenfassung: 'Es gab Tote.', sicherheit: 'niedrig' }),
      thema([art('a1', 'al-jazeera'), art('a2', 'times-of-israel')]),
    );
    expect(ergebnis.zurueckhalten).toBe(true);
  });
});
