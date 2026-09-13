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
    const env = { DB: mockeDb({ png_base64: png.toString('base64') }), ASSETS: {} as any };
    const response = await worker.fetch(new Request('https://newsspur.de/karte/abc123.png'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });

  it('liefert 404, wenn keine Karte fuer die ID existiert', async () => {
    const env = { DB: mockeDb(null), ASSETS: {} as any };
    const response = await worker.fetch(new Request('https://newsspur.de/karte/unbekannt.png'), env);
    expect(response.status).toBe(404);
  });
});
