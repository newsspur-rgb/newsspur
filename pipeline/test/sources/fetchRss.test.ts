import { describe, it, expect, vi } from 'vitest';
import { feedAbrufen } from '../../src/sources/fetchRss.js';
import type { Feed } from '../../src/types.js';

const testQuelle = { id: 'test-quelle', name: 'Test Quelle', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };

const beispielRss2 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Erdogan besucht Berlin</title>
      <link>https://example.com/erdogan-berlin</link>
      <description>Der tuerkische Praesident traf den Kanzler.</description>
      <pubDate>Mon, 01 Sep 2026 09:15:00 GMT</pubDate>
      <enclosure url="https://example.com/bild.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Grundsteuer in NRW steigt</title>
      <link>https://example.com/grundsteuer</link>
      <description>Die Landesregierung beschliesst neue Saetze.</description>
      <pubDate>Mon, 01 Sep 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

function fakeFetch(xml: string, status = 200): typeof fetch {
  return vi.fn(async () => ({ ok: status < 400, status, text: async () => xml })) as unknown as typeof fetch;
}

describe('feedAbrufen', () => {
  it('parst RSS-2.0-Items zu Artikeln', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    const artikel = await feedAbrufen(feed, fakeFetch(beispielRss2));
    expect(artikel).toHaveLength(2);
    expect(artikel[0].titel).toBe('Erdogan besucht Berlin');
    expect(artikel[0].url).toBe('https://example.com/erdogan-berlin');
    expect(artikel[0].teaser).toContain('Praesident');
    expect(artikel[0].bildUrl).toBe('https://example.com/bild.jpg');
    expect(artikel[0].quelle).toEqual(testQuelle);
    expect(artikel[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('erzeugt fuer dieselbe URL immer dieselbe Artikel-ID', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    const [erst] = await feedAbrufen(feed, fakeFetch(beispielRss2));
    const [zweit] = await feedAbrufen(feed, fakeFetch(beispielRss2));
    expect(erst.id).toBe(zweit.id);
  });

  it('wirft einen Fehler bei fehlerhafter HTTP-Antwort', async () => {
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    await expect(feedAbrufen(feed, fakeFetch('', 503))).rejects.toThrow('503');
  });

  it('ueberspringt Items ohne Titel oder Link', async () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><item><description>Kein Titel</description></item></channel></rss>`;
    const feed: Feed = { quelle: testQuelle, url: 'https://example.com/rss' };
    expect(await feedAbrufen(feed, fakeFetch(xml))).toHaveLength(0);
  });
});
