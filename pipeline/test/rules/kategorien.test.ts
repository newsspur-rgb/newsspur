import { describe, it, expect } from 'vitest';
import { gehoertZuKategorie, relevanteKategorien } from '../../src/rules/kategorien.js';

describe('Kategorie-Regeln', () => {
  it('gehoertZuKategorie ist true ab Wert 40', () => {
    expect(gehoertZuKategorie({ deutschland: 40, tuerkei: 39, nahost: 0 }, 'deutschland')).toBe(true);
    expect(gehoertZuKategorie({ deutschland: 40, tuerkei: 39, nahost: 0 }, 'tuerkei')).toBe(false);
  });

  it('relevanteKategorien liefert alle Kategorien >= Schwelle (Erdogan-in-Berlin-Fall)', () => {
    expect(relevanteKategorien({ deutschland: 90, tuerkei: 95, nahost: 10 }).sort()).toEqual(['deutschland', 'tuerkei']);
  });

  it('relevanteKategorien kann leer sein', () => {
    expect(relevanteKategorien({ deutschland: 10, tuerkei: 5, nahost: 0 })).toEqual([]);
  });
});
