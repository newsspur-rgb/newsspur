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

describe('erstelleInstagramClient.reelPosten', () => {
  const keineWartezeit = async () => {};

  it('erstellt einen Reel-Container, wartet auf FINISHED und veroeffentlicht dann', async () => {
    let statusAbfragen = 0;
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      if (url.includes('/media?')) {
        const body = JSON.parse(init.body);
        expect(body).toEqual({ media_type: 'REELS', video_url: 'https://newsspur.de/reel/t1.mp4', caption: 'Test-Caption' });
        return { ok: true, status: 200, json: async () => ({ id: 'creation-123' }) };
      }
      if (url.includes('status_code')) {
        statusAbfragen += 1;
        const statusCode = statusAbfragen < 2 ? 'IN_PROGRESS' : 'FINISHED';
        return { ok: true, status: 200, json: async () => ({ status_code: statusCode }) };
      }
      if (url.includes('/media_publish?')) {
        expect(url).toContain('creation_id=creation-123');
        return { ok: true, status: 200, json: async () => ({ id: 'post-789' }) };
      }
      throw new Error('unerwartete URL: ' + url);
    }) as unknown as typeof fetch;

    const client = erstelleInstagramClient('token', 'ig-user', fetchImpl, keineWartezeit);
    const ergebnis = await client.reelPosten('https://newsspur.de/reel/t1.mp4', 'Test-Caption');

    expect(ergebnis).toEqual({ postId: 'post-789' });
    expect(statusAbfragen).toBe(2);
  });

  it('wirft einen Fehler, wenn die Verarbeitung mit ERROR endet', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/media?')) return { ok: true, status: 200, json: async () => ({ id: 'creation-123' }) };
      if (url.includes('status_code')) return { ok: true, status: 200, json: async () => ({ status_code: 'ERROR' }) };
      throw new Error('unerwartete URL: ' + url);
    }) as unknown as typeof fetch;

    const client = erstelleInstagramClient('token', 'ig-user', fetchImpl, keineWartezeit);
    await expect(client.reelPosten('https://x.de/a.mp4', 'c')).rejects.toThrow('ERROR');
  });

  it('wirft einen Fehler, wenn nach allen Versuchen kein FINISHED erreicht wird', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/media?')) return { ok: true, status: 200, json: async () => ({ id: 'creation-123' }) };
      if (url.includes('status_code')) return { ok: true, status: 200, json: async () => ({ status_code: 'IN_PROGRESS' }) };
      throw new Error('unerwartete URL: ' + url);
    }) as unknown as typeof fetch;

    const client = erstelleInstagramClient('token', 'ig-user', fetchImpl, keineWartezeit);
    await expect(client.reelPosten('https://x.de/a.mp4', 'c')).rejects.toThrow('Zeitlimit');
  });
});
