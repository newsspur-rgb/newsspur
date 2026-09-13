import { describe, it, expect, vi } from 'vitest';
import { D1ThemenStore } from '../../src/store/d1Store.js';
import type { VerarbeitetesThema } from '../../src/types.js';

function verarbeitetesThema(id: string, aktualisiert: string): VerarbeitetesThema {
  return { thema: { id, artikel: [], erstellt: aktualisiert, aktualisiert }, status: 'veroeffentlicht' };
}

function fetchMitAntwort(ergebnis: unknown[]) {
  return vi.fn(async (_url: string, init: any) => ({
    ok: true,
    status: 200,
    json: async () => ({ result: [{ results: ergebnis }], success: true, errors: [] }),
  })) as unknown as typeof fetch;
}

describe('D1ThemenStore', () => {
  it('speichert ein Thema per INSERT-Aufruf mit den richtigen Werten', async () => {
    const fetchImpl = fetchMitAntwort([]);
    const store = new D1ThemenStore('acc', 'db', 'token', fetchImpl);
    await store.speichern(verarbeitetesThema('t1', '2026-01-01T00:00:00Z'));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db/query');
    expect(init.headers.Authorization).toBe('Bearer token');
    const body = JSON.parse(init.body);
    expect(body.sql).toMatch(/INSERT INTO themen/);
    expect(body.params[0]).toBe('t1');
    expect(body.params[1]).toBe('veroeffentlicht');
    expect(JSON.parse(body.params[3]).thema.id).toBe('t1');
  });

  it('liest alle Themen und parst das JSON-Feld zurueck', async () => {
    const gespeichert = verarbeitetesThema('t1', '2026-01-01T00:00:00Z');
    const fetchImpl = fetchMitAntwort([{ daten: JSON.stringify(gespeichert) }]);
    const store = new D1ThemenStore('acc', 'db', 'token', fetchImpl);

    const alle = await store.alle();
    expect(alle).toHaveLength(1);
    expect(alle[0].thema.id).toBe('t1');
  });

  it('gibt bei neuereAls den Zeitstempel als Parameter mit', async () => {
    const fetchImpl = fetchMitAntwort([]);
    const store = new D1ThemenStore('acc', 'db', 'token', fetchImpl);
    await store.neuereAls('2026-03-01T00:00:00Z');

    const [, init] = (fetchImpl as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.sql).toMatch(/WHERE aktualisiert >= \?/);
    expect(body.params).toEqual(['2026-03-01T00:00:00Z']);
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const store = new D1ThemenStore('acc', 'db', 'token', fetchImpl);
    await expect(store.alle()).rejects.toThrow('500');
  });

  it('wirft einen Fehler, wenn D1 success:false meldet', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: [], success: false, errors: [{ message: 'kaputt' }] }),
    })) as unknown as typeof fetch;
    const store = new D1ThemenStore('acc', 'db', 'token', fetchImpl);
    await expect(store.alle()).rejects.toThrow('kaputt');
  });
});
