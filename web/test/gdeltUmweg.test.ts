import { describe, it, expect, vi } from 'vitest';
import { gdeltUmwegAntwort } from '../src/gdeltUmweg.js';

describe('gdeltUmwegAntwort', () => {
  it('weist Anfragen ohne richtiges Geheimwort ab', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const antwort = await gdeltUmwegAntwort(new Request('https://newsspur.de/api/intern/gdelt?query=x', { headers: { 'X-Newsspur-Schluessel': 'falsch' } }), 'geheim', fetchImpl);
    expect(antwort.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reicht nur erlaubte Parameter an GDELT weiter', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"articles":[]}', { status: 200 })) as unknown as typeof fetch;
    const request = new Request('https://newsspur.de/api/intern/gdelt?query=Merz&timespan=60min&url=https://boese.example', {
      headers: { 'X-Newsspur-Schluessel': 'geheim' },
    });
    const antwort = await gdeltUmwegAntwort(request, 'geheim', fetchImpl);
    expect(antwort.status).toBe(200);
    const ziel = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(ziel.origin).toBe('https://api.gdeltproject.org');
    expect(ziel.searchParams.get('query')).toBe('Merz');
    expect(ziel.searchParams.has('url')).toBe(false);
  });
});
