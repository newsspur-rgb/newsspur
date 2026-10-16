import { describe, it, expect, vi } from 'vitest';
import { blueskyStimmenSammeln, passtZurSchrift, postUrl, SPRACHRAEUME } from '../../src/weitblick/bluesky.js';

function post(text: string, likes = 0, handle = 'a.bsky.social') {
  return { uri: `at://did:plc:x/app.bsky.feed.post/rk${likes}`, author: { handle }, record: { text }, likeCount: likes };
}

describe('passtZurSchrift', () => {
  it('verlangt bei Arabisch/Russisch/Chinesisch die passende Schrift', () => {
    expect(passtZurSchrift('Trump cut off intelligence to Ukraine', 'ar')).toBe(false);
    expect(passtZurSchrift('ترامب يقطع المعلومات عن أوكرانيا', 'ar')).toBe(true);
    expect(passtZurSchrift('Meine Analyse der Ukraine', 'ru')).toBe(false);
    expect(passtZurSchrift('Трамп и Украина сегодня', 'ru')).toBe(true);
    expect(passtZurSchrift('Zelensky is a genius', 'zh')).toBe(false);
  });
  it('lässt lateinische Sprachen durch', () => {
    expect(passtZurSchrift('Ataques da Ucrânia', 'pt')).toBe(true);
  });
});

describe('postUrl', () => {
  it('baut den Bluesky-Link aus URI und Handle', () => {
    expect(postUrl('at://did:plc:abc/app.bsky.feed.post/3mxz', 'x.bsky.social')).toBe('https://bsky.app/profile/x.bsky.social/post/3mxz');
  });
});

describe('blueskyStimmenSammeln', () => {
  it('fasst Sprachen zu Sprachräumen zusammen und lässt Räume mit zu wenig Posts weg', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const lang = new URL(url).searchParams.get('lang');
      const posts = lang === 'tr' ? [post('a', 1), post('b', 5)] : lang === 'az' ? [post('c', 3)] : lang === 'ru' ? [post('d')] : [];
      return { ok: true, json: async () => ({ posts }) };
    }) as unknown as typeof fetch;

    const ergebnis = await blueskyStimmenSammeln(['Erdogan'], { tr: 'Erdoğan' }, '2026-10-11T00:00:00Z', fetchImpl, 0);

    expect(ergebnis.map((r) => r.sprachraum)).toEqual(['Turkvölker']); // Russisch hat nur 1 Post
    expect(ergebnis[0].posts.map((p) => p.likes)).toEqual([5, 3, 1]); // nach Likes sortiert
    const anfragen = (fetchImpl as any).mock.calls.length;
    expect(anfragen).toBe(SPRACHRAEUME.reduce((n, r) => n + r.sprachen.length, 0));
    const url = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(url.searchParams.get('since')).toBe('2026-10-11T00:00:00Z');
    const qProSprache = Object.fromEntries((fetchImpl as any).mock.calls.map((c: any[]) => {
      const u = new URL(c[0]); return [u.searchParams.get('lang'), u.searchParams.get('q')];
    }));
    expect(qProSprache.tr).toBe('Erdoğan'); // übersetzter Suchtext
    expect(qProSprache.ru).toBe('Erdogan'); // Fallback: englische Begriffe
  });

  it('ignoriert fehlgeschlagene Sprachen', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const lang = new URL(url).searchParams.get('lang');
      if (lang === 'en') return { ok: false, status: 500 };
      return { ok: true, json: async () => ({ posts: lang === 'de' ? [post('x'), post('y'), post('z')] : [] }) };
    }) as unknown as typeof fetch;
    const ergebnis = await blueskyStimmenSammeln(['x'], {}, '2026-10-11T00:00:00Z', fetchImpl, 0);
    expect(ergebnis.map((r) => r.sprachraum)).toEqual(['Deutsch']);
  });
});
