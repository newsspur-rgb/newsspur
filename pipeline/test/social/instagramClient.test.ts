import { describe, it, expect, vi } from 'vitest';
import { erstelleInstagramClient } from '../../src/social/instagramClient.js';

describe('erstelleInstagramClient', () => {
  it('erstellt zuerst einen Media-Container und veroeffentlicht ihn danach', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push(url);
      if (url.includes('/media?')) {
        const body = JSON.parse(init.body);
        expect(body).toEqual({ image_url: 'https://newsspur.de/karte/t1.png', caption: 'Test-Caption' });
        return { ok: true, status: 200, json: async () => ({ id: 'creation-123' }) };
      }
      if (url.includes('/media_publish?')) {
        const body = JSON.parse(init.body);
        expect(body).toEqual({ creation_id: 'creation-123' });
        return { ok: true, status: 200, json: async () => ({ id: 'post-456' }) };
      }
      throw new Error('unerwartete URL: ' + url);
    }) as unknown as typeof fetch;

    const client = erstelleInstagramClient('token', 'ig-user', fetchImpl);
    const ergebnis = await client.bildPosten('https://newsspur.de/karte/t1.png', 'Test-Caption');

    expect(ergebnis).toEqual({ postId: 'post-456' });
    expect(calls).toHaveLength(2);
  });

  it('wirft einen Fehler, wenn die Media-Erstellung fehlschlaegt', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400 })) as unknown as typeof fetch;
    const client = erstelleInstagramClient('token', 'ig-user', fetchImpl);
    await expect(client.bildPosten('https://x.de/a.png', 'c')).rejects.toThrow('400');
  });
});
