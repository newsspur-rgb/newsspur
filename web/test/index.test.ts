import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';

function mockeDb(zeile: { png_base64: string } | null) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => zeile),
      })),
    })),
  } as any;
}

describe('Worker /karte/:id.png', () => {
  it('liefert ein PNG mit korrektem Content-Type, wenn die Karte existiert', async () => {
    const png = Buffer.from([1, 2, 3, 4]);
    const env = { DB: mockeDb({ png_base64: png.toString('base64') }), ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(new Request('https://newsspur.de/karte/abc123.png'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });

  it('liefert 404, wenn keine Karte fuer die ID existiert', async () => {
    const env = { DB: mockeDb(null), ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(new Request('https://newsspur.de/karte/unbekannt.png'), env);
    expect(response.status).toBe(404);
  });
});

function mockeReels(objekt: { body: ReadableStream } | null) {
  return { get: vi.fn(async () => objekt) } as any;
}

describe('Worker /reel/:id.mp4', () => {
  it('liefert das Video mit korrektem Content-Type, wenn es existiert', async () => {
    const stream = new ReadableStream();
    const env = { DB: {} as any, ASSETS: {} as any, REELS: mockeReels({ body: stream }) };
    const response = await worker.fetch(new Request('https://newsspur.de/reel/abc123.mp4'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(env.REELS.get).toHaveBeenCalledWith('abc123.mp4');
  });

  it('liefert 404, wenn kein Reel fuer die ID existiert', async () => {
    const env = { DB: {} as any, ASSETS: {} as any, REELS: mockeReels(null) };
    const response = await worker.fetch(new Request('https://newsspur.de/reel/unbekannt.mp4'), env);
    expect(response.status).toBe(404);
  });
});

function mockeReaktionDb(opts: { themaExistiert: boolean; neueAnzahl: number }) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT 1 FROM themen')) {
            return opts.themaExistiert ? { '1': 1 } : null;
          }
          return { anzahl: opts.neueAnzahl };
        }),
      })),
    })),
  } as any;
}

describe('Worker POST /api/reaktion', () => {
  it('zaehlt ein bekanntes Emoji fuer ein existierendes Thema hoch', async () => {
    const env = { DB: mockeReaktionDb({ themaExistiert: true, neueAnzahl: 3 }), ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/reaktion', {
        method: 'POST',
        body: JSON.stringify({ themaId: 't1', emoji: '😱' }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ emoji: '😱', anzahl: 3 });
  });

  it('lehnt ein Emoji ausserhalb der Whitelist ab', async () => {
    const env = { DB: mockeReaktionDb({ themaExistiert: true, neueAnzahl: 1 }), ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/reaktion', {
        method: 'POST',
        body: JSON.stringify({ themaId: 't1', emoji: '💩' }),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it('lehnt eine Reaktion auf ein unbekanntes Thema ab', async () => {
    const env = { DB: mockeReaktionDb({ themaExistiert: false, neueAnzahl: 1 }), ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/reaktion', {
        method: 'POST',
        body: JSON.stringify({ themaId: 'unbekannt', emoji: '😱' }),
      }),
      env,
    );
    expect(response.status).toBe(404);
  });
});

describe('Worker GET /api/push/public-key', () => {
  it('liefert den konfigurierten VAPID-Public-Key', async () => {
    const env = { DB: {} as any, ASSETS: {} as any, REELS: {} as any, VAPID_PUBLIC_KEY: 'abc123' };
    const response = await worker.fetch(new Request('https://newsspur.de/api/push/public-key'), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ publicKey: 'abc123' });
  });

  it('liefert 503, wenn kein Public Key konfiguriert ist', async () => {
    const env = { DB: {} as any, ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(new Request('https://newsspur.de/api/push/public-key'), env);
    expect(response.status).toBe(503);
  });
});

function mockeAboDb() {
  const run = vi.fn(async () => ({}));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as any, bind, run };
}

describe('Worker POST /api/push/abo', () => {
  it('speichert ein gueltiges Abo per Upsert', async () => {
    const { db, bind } = mockeAboDb();
    const env = { DB: db, ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/push/abo', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://push.example/e1',
          keys: { p256dh: 'p', auth: 'a' },
          praeferenzen: { deutschland: true, tuerkei: false, nahost: false, nurEilmeldungen: false },
        }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(bind).toHaveBeenCalledWith('https://push.example/e1', 'p', 'a', 1, 0, 0, 0, expect.any(String));
  });

  it('lehnt ein Abo ohne keys ab', async () => {
    const { db } = mockeAboDb();
    const env = { DB: db, ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/push/abo', {
        method: 'POST',
        body: JSON.stringify({ endpoint: 'https://push.example/e1', praeferenzen: {} }),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe('Worker DELETE /api/push/abo', () => {
  it('loescht ein Abo per Endpoint', async () => {
    const { db, bind } = mockeAboDb();
    const env = { DB: db, ASSETS: {} as any, REELS: {} as any };
    const response = await worker.fetch(
      new Request('https://newsspur.de/api/push/abo', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://push.example/e1' }),
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(bind).toHaveBeenCalledWith('https://push.example/e1');
  });
});
