import { describe, it, expect, vi } from 'vitest';
import { erstelleD1ReelTagStore } from '../../src/reel/reelTagStore.js';

function fetchMitAntwort(ergebnis: unknown[]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: [{ results: ergebnis }], success: true, errors: [] }),
  })) as unknown as typeof fetch;
}

describe('erstelleD1ReelTagStore', () => {
  it('gesendetHeute ist false, wenn keine Zeile fuer das Datum existiert', async () => {
    const store = erstelleD1ReelTagStore('acc', 'db', 'token', fetchMitAntwort([]));
    expect(await store.gesendetHeute('2026-09-14')).toBe(false);
  });

  it('gesendetHeute ist true, wenn eine Zeile fuer das Datum existiert', async () => {
    const store = erstelleD1ReelTagStore('acc', 'db', 'token', fetchMitAntwort([{ datum: '2026-09-14' }]));
    expect(await store.gesendetHeute('2026-09-14')).toBe(true);
  });

  it('markieren schickt einen INSERT mit Datum und Thema-ID', async () => {
    const fetchImpl = fetchMitAntwort([]);
    const store = erstelleD1ReelTagStore('acc', 'db', 'token', fetchImpl);
    await store.markieren('2026-09-14', 't1');

    const [, init] = (fetchImpl as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.sql).toMatch(/INSERT INTO reel_gesendet_heute/);
    expect(body.params).toEqual(['2026-09-14', 't1']);
  });
});
