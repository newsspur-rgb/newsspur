import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

/** D1-Mock: liefert je nach Tabelle im SQL feste Zeilen, mit und ohne bind(). */
function mockeDb(zeilen: Record<string, unknown[]>) {
  const fuer = (sql: string) => Object.entries(zeilen).find(([tabelle]) => sql.includes(`FROM ${tabelle} `) || sql.endsWith(`FROM ${tabelle}`))?.[1] ?? [];
  const abfrage = (sql: string, params: unknown[] = []) => ({
    all: vi.fn(async () => ({ results: fuer(sql) })),
    first: vi.fn(async () => {
      const treffer = fuer(sql) as Array<{ woche?: string }>;
      if (params.length && sql.includes('WHERE woche')) return treffer.find((z) => z.woche === params[0]) ?? null;
      return treffer[0] ?? null;
    }),
  });
  return {
    prepare: vi.fn((sql: string) => ({ ...abfrage(sql), bind: vi.fn((...params: unknown[]) => abfrage(sql, params)) })),
  } as any;
}

const env = (db: unknown) => ({ DB: db as any, ASSETS: {} as any, REELS: {} as any });

describe('Worker /api/bundestag', () => {
  it('liefert Gesetze und Debatten als JSON', async () => {
    const db = mockeDb({
      bundestag_gesetze: [{ daten: JSON.stringify({ id: 'g1', ampel: 'beschlossen' }) }],
      bundestag_debatten: [{ daten: JSON.stringify({ id: 'p1', punkte: [] }) }],
    });
    const response = await worker.fetch(new Request('https://newsspur.de/api/bundestag'), env(db));
    const daten = (await response.json()) as any;
    expect(daten.gesetze[0].ampel).toBe('beschlossen');
    expect(daten.debatten[0].id).toBe('p1');
  });
});

describe('Worker /api/weitblick', () => {
  const db = () => mockeDb({
    weitblick: [
      { woche: '2026-W42', daten: JSON.stringify({ woche: '2026-W42' }) },
      { woche: '2026-W41', daten: JSON.stringify({ woche: '2026-W41' }) },
    ],
  });

  it('liefert ohne Parameter die neueste Woche und die Wochenliste', async () => {
    const response = await worker.fetch(new Request('https://newsspur.de/api/weitblick'), env(db()));
    const daten = (await response.json()) as any;
    expect(daten.weitblick.woche).toBe('2026-W42');
    expect(daten.wochen).toEqual(['2026-W42', '2026-W41']);
  });

  it('liefert eine bestimmte Woche per ?woche=', async () => {
    const response = await worker.fetch(new Request('https://newsspur.de/api/weitblick?woche=2026-W41'), env(db()));
    expect(((await response.json()) as any).weitblick.woche).toBe('2026-W41');
  });

  it('liefert weitblick: null, solange noch keiner erstellt wurde', async () => {
    const response = await worker.fetch(new Request('https://newsspur.de/api/weitblick'), env(mockeDb({})));
    expect(((await response.json()) as any).weitblick).toBeNull();
  });
});
