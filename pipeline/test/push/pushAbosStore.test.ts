import { describe, it, expect, vi } from 'vitest';
import { D1PushAbosStore } from '../../src/push/pushAbosStore.js';

function fetchMitAntwort(ergebnis: unknown[]) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: [{ results: ergebnis }], success: true, errors: [] }),
  })) as unknown as typeof fetch;
}

describe('D1PushAbosStore', () => {
  it('liest alle Abos und wandelt die 0/1-Spalten in booleans um', async () => {
    const fetchImpl = fetchMitAntwort([
      { endpoint: 'https://push.example/e1', p256dh: 'p', auth: 'a', deutschland: 1, tuerkei: 0, nahost: 0, nur_eilmeldungen: 1 },
    ]);
    const store = new D1PushAbosStore('acc', 'db', 'token', fetchImpl);

    const alle = await store.alle();
    expect(alle).toEqual([
      { endpoint: 'https://push.example/e1', p256dh: 'p', auth: 'a', deutschland: true, tuerkei: false, nahost: false, nurEilmeldungen: true },
    ]);
  });

  it('loescht ein Abo per DELETE-Statement mit dem Endpoint als Parameter', async () => {
    const fetchImpl = fetchMitAntwort([]);
    const store = new D1PushAbosStore('acc', 'db', 'token', fetchImpl);

    await store.entfernen('https://push.example/e1');

    const [, init] = (fetchImpl as any).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.sql).toMatch(/DELETE FROM push_abos WHERE endpoint = \?/);
    expect(body.params).toEqual(['https://push.example/e1']);
  });
});
