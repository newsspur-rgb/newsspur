import { describe, it, expect, vi } from 'vitest';
import { gdeltAbrufen } from '../../src/sources/fetchGdelt.js';
import type { GdeltAbfrage } from '../../src/sources/gdeltAbfragen.js';

const abfrage: GdeltAbfrage = { kategorie: 'nahost', suchbegriff: 'Gaza OR Israel' };

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

describe('gdeltAbrufen', () => {
  it('mappt GDELT-Artikel auf das Artikel-Format', async () => {
    const antwort = {
      articles: [
        { url: 'https://news.example/1', title: 'Bericht aus Gaza', seendate: '20260901T091500Z', socialimage: 'https://news.example/1.jpg', domain: 'news.example', language: 'English', sourcecountry: 'United States' },
      ],
    };
    const artikel = await gdeltAbrufen(abfrage, 30, fakeFetch(antwort));
    expect(artikel).toHaveLength(1);
    expect(artikel[0].titel).toBe('Bericht aus Gaza');
    expect(artikel[0].url).toBe('https://news.example/1');
    expect(artikel[0].teaser).toBe('Bericht aus Gaza');
    expect(artikel[0].bildUrl).toBe('https://news.example/1.jpg');
    expect(artikel[0].veroeffentlichtAm).toBe('2026-09-01T09:15:00Z');
    expect(artikel[0].quelle.id).toBe('gdelt-news.example');
    expect(artikel[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('liefert eine leere Liste, wenn keine Artikel enthalten sind', async () => {
    expect(await gdeltAbrufen(abfrage, 30, fakeFetch({}))).toEqual([]);
  });

  it('ueberspringt Eintraege ohne URL oder Titel', async () => {
    const antwort = { articles: [{ title: 'Ohne URL', seendate: '20260901T091500Z', domain: 'x.example' }] };
    expect(await gdeltAbrufen(abfrage, 30, fakeFetch(antwort))).toHaveLength(0);
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    await expect(gdeltAbrufen(abfrage, 30, fakeFetch(null, 429))).rejects.toThrow('429');
  });
});
