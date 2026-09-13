import { describe, it, expect, vi } from 'vitest';
import { erstelleD1KartenSpeicher } from '../../src/social/kartenSpeicher.js';

describe('erstelleD1KartenSpeicher', () => {
  it('speichert das PNG base64-codiert mit INSERT-Aufruf', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: [{ results: [] }], success: true, errors: [] }),
    })) as unknown as typeof fetch;

    const speicher = erstelleD1KartenSpeicher('acc', 'db', 'token', fetchImpl);
    await speicher.speichern('t1', Buffer.from('fake-png-bytes'));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db/query');
    const body = JSON.parse((init as any).body);
    expect(body.sql).toMatch(/INSERT INTO karten/);
    expect(body.params[0]).toBe('t1');
    expect(body.params[1]).toBe(Buffer.from('fake-png-bytes').toString('base64'));
  });

  it('wirft einen Fehler bei fehlerhafter Antwort', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const speicher = erstelleD1KartenSpeicher('acc', 'db', 'token', fetchImpl);
    await expect(speicher.speichern('t1', Buffer.from('x'))).rejects.toThrow('500');
  });
});
