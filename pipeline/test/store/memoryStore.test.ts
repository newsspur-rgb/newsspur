import { describe, it, expect } from 'vitest';
import { SpeicherThemenStore } from '../../src/store/memoryStore.js';
import type { VerarbeitetesThema } from '../../src/types.js';

function verarbeitetesThema(id: string, aktualisiert: string): VerarbeitetesThema {
  return { thema: { id, artikel: [], erstellt: aktualisiert, aktualisiert }, status: 'veroeffentlicht' };
}

describe('SpeicherThemenStore', () => {
  it('speichert und liest ein Thema wieder aus', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('t1', new Date().toISOString()));
    const alle = await store.alle();
    expect(alle).toHaveLength(1);
    expect(alle[0].thema.id).toBe('t1');
  });

  it('ueberschreibt ein Thema mit derselben ID statt es zu duplizieren', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('t1', '2026-01-01T00:00:00Z'));
    await store.speichern(verarbeitetesThema('t1', '2026-01-02T00:00:00Z'));
    const alle = await store.alle();
    expect(alle).toHaveLength(1);
    expect(alle[0].thema.aktualisiert).toBe('2026-01-02T00:00:00Z');
  });

  it('liefert bei neuereAls nur seitdem aktualisierte Themen', async () => {
    const store = new SpeicherThemenStore();
    await store.speichern(verarbeitetesThema('alt', '2026-01-01T00:00:00Z'));
    await store.speichern(verarbeitetesThema('neu', '2026-06-01T00:00:00Z'));
    const ergebnis = await store.neuereAls('2026-03-01T00:00:00Z');
    expect(ergebnis.map((v) => v.thema.id)).toEqual(['neu']);
  });
});
