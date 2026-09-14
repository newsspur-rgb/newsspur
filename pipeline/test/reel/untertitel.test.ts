import { describe, it, expect } from 'vitest';
import { assErstellen } from '../../src/reel/untertitel.js';

describe('assErstellen', () => {
  it('enthaelt alle Woerter des Sprechtexts', () => {
    const ass = assErstellen('Erdogan trifft den Kanzler in Berlin', 7);
    for (const wort of ['Erdogan', 'trifft', 'den', 'Kanzler', 'in', 'Berlin']) {
      expect(ass).toContain(wort);
    }
  });

  it('hebt in jeder Zeile genau ein Wort rot hervor', () => {
    const ass = assErstellen('Ein Zwei Drei Vier Fuenf Sechs', 6);
    const treffer = ass.match(/\{\\c&H0F1DE1&\}/g) ?? [];
    // 6 Woerter => 6 Zeilen, in jeder genau ein rot hervorgehobenes Wort
    expect(treffer.length).toBe(6);
  });

  it('erzeugt aufsteigende Start-/End-Zeitstempel ueber die volle Dauer', () => {
    const ass = assErstellen('Wort eins zwei drei', 4);
    const zeilen = ass.split('\n').filter((z) => z.startsWith('Dialogue:'));
    expect(zeilen.length).toBe(4);
    expect(zeilen[0]).toMatch(/Dialogue: 0,0:00:00\.00,/);
  });

  it('gibt eine leere Events-Sektion ohne Fehler zurueck, wenn der Text leer ist', () => {
    expect(() => assErstellen('', 5)).not.toThrow();
  });
});
