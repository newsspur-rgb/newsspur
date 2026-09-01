import { describe, it, expect } from 'vitest';
import { promptErstellen } from '../../src/summarize/prompt.js';
import type { Artikel } from '../../src/types.js';

const quelle = { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

describe('promptErstellen', () => {
  it('enthaelt Kennung, Schlagzeile und Anriss jeder Quelle', () => {
    const artikel: Artikel[] = [{ id: 'a1', quelle, titel: 'Test-Schlagzeile', teaser: 'Test-Anriss', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString() }];
    const prompt = promptErstellen(artikel);
    expect(prompt).toContain('"tagesschau"');
    expect(prompt).toContain('Test-Schlagzeile');
    expect(prompt).toContain('Test-Anriss');
  });

  it('weist die KI an, keine Fakten zu erfinden', () => {
    expect(promptErstellen([]).toLowerCase()).toContain('erfinde keine');
  });
});
