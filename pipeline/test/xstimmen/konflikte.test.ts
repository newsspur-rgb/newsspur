import { describe, it, expect, vi } from 'vitest';
import { KONFLIKTE, alleHandles, listenIds, seiteVon, konfliktLageErstellen, konfliktPromptErstellen } from '../../src/xstimmen/konflikte.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { Tweet } from '../../src/xstimmen/xSuche.js';

const JETZT = new Date('2026-10-17T12:00:00Z');
const RU_UA = KONFLIKTE.find((k) => k.id === 'russland-ukraine')!;

function tweet(id: string, autor: string, zeit = '2026-10-17T08:00:00.000Z'): Tweet {
  return { id, autor, text: 'Text ' + id, zeit, likes: 1, url: `https://x.com/${autor}/status/${id}`, istVideo: false };
}

describe('Konflikt-Definitionen', () => {
  it('jede Suchanfrage bleibt bei max. 16 Konten, IDs sind eindeutig', () => {
    for (const k of KONFLIKTE) expect(alleHandles(k).length).toBeLessThanOrEqual(16);
    expect(new Set(KONFLIKTE.map((k) => k.id)).size).toBe(KONFLIKTE.length);
  });

  it('ordnet Konten ihrer Seite zu', () => {
    expect(seiteVon(RU_UA, 'zelenskyyua')).toEqual({ seite: 'Ukraine', konto: 'Selenskyj' });
    expect(seiteVon(RU_UA, 'niemand')).toBeNull();
  });

  it('kennt den Gaza-Konflikt mit drei offiziellen Seiten + unabhängigen Stimmen', () => {
    const gaza = KONFLIKTE.find((k) => k.id === 'gaza')!;
    expect(gaza.seiten.map((s) => s.name)).toEqual(['Israel', 'Palästinenser', 'UN/Helfer', 'Unabhängige Stimmen']);
    expect(seiteVon(gaza, 'IDF')).toEqual({ seite: 'Israel', konto: 'Israelische Armee' });
  });

  it('Prompt nennt Seite und Konto je Post', () => {
    expect(konfliktPromptErstellen(RU_UA, [tweet('7', 'mfa_russia')])).toContain('[7] Russland – Russisches Außenministerium');
  });

  it('kennt alle 11 Konflikte mit mindestens drei Seiten (inkl. unabhängige Stimmen), keine doppelten IDs', () => {
    expect(KONFLIKTE).toHaveLength(11);
    for (const k of KONFLIKTE) {
      expect(k.seiten.length).toBeGreaterThanOrEqual(3);
      expect(k.seiten.at(-1)!.name).toBe('Unabhängige Stimmen');
    }
    expect(new Set(KONFLIKTE.map((k) => k.id)).size).toBe(KONFLIKTE.length);
    for (const id of ['sudan', 'israel-libanon', 'pakistan-indien', 'kongo-ruanda', 'armenien-aserbaidschan']) {
      expect(KONFLIKTE.some((k) => k.id === id)).toBe(true);
    }
  });

  it('Israel-Seite nutzt in Gaza/Iran-USA-Israel/Israel-Libanon dieselbe X-Liste statt Handles, unabhängige Stimmen überall', () => {
    for (const id of ['gaza', 'iran-usa-israel', 'israel-libanon']) {
      const k = KONFLIKTE.find((x) => x.id === id)!;
      expect(listenIds(k)).toEqual(['2111528805231632864', '2111818418999468119']);
      expect(alleHandles(k)).not.toContain('IDF'); // Israel-Handles kommen über die Liste, nicht die from:-Suche
    }
    expect(listenIds(RU_UA)).toEqual(['2111818418999468119']);
  });
});

describe('konfliktLageErstellen', () => {
  it('übernimmt nur Verlaufs-Einträge mit echtem Tweet und bekannter Seite', async () => {
    const suche = vi.fn().mockResolvedValue([tweet('1', 'mfa_russia'), tweet('2', 'ZelenskyyUa'), tweet('1', 'mfa_russia')]);
    const geminiClient: GeminiClient = {
      strukturierteAntwort: vi.fn().mockResolvedValue({
        themen: [
          {
            titel: 'Angriff auf Charkiw', lage: 'Neutral.', widerspruch: 'Ziel umstritten.',
            verlauf: [
              { seite: 'Russland', aussage: 'Militärisches Ziel.', tweetIds: ['1'] },
              { seite: 'Ukraine', aussage: 'Wohnhaus getroffen.', tweetIds: ['2', '999'] },
              { seite: 'Mars', aussage: 'x', tweetIds: ['1'] },
              { seite: 'Deutschland', aussage: 'erfunden', tweetIds: ['999'] },
            ],
          },
          { titel: 'Leer', lage: '', widerspruch: '', verlauf: [{ seite: 'Ukraine', aussage: 'x', tweetIds: [] }] },
        ],
      }),
    };
    const lage = await konfliktLageErstellen(RU_UA, suche, geminiClient, JETZT);
    expect(suche.mock.calls[0][0]).toContain('ZelenskyyUa');
    expect(lage!.themen).toHaveLength(1);
    expect(lage!.themen[0].verlauf.map((e) => e.seite)).toEqual(['Russland', 'Ukraine']);
    expect(lage!.themen[0].verlauf[1].belege).toEqual([
      { autor: 'ZelenskyyUa', konto: 'Selenskyj', text: 'Text 2', url: 'https://x.com/ZelenskyyUa/status/2', zeit: '2026-10-17T08:00:00.000Z', istVideo: false },
    ]);
    expect(lage!.aktualisiert).toBe('2026-10-17T12:00:00.000Z');
  });

  it('ordnet den Verlauf chronologisch (älteste zuerst), auch wenn dieselbe Seite mehrfach vorkommt', async () => {
    const suche = vi.fn().mockResolvedValue([
      tweet('1', 'mfa_russia', '2026-10-17T10:00:00.000Z'),
      tweet('2', 'ZelenskyyUa', '2026-10-17T06:00:00.000Z'),
      tweet('3', 'mfa_russia', '2026-10-17T08:00:00.000Z'),
    ]);
    const geminiClient: GeminiClient = {
      strukturierteAntwort: vi.fn().mockResolvedValue({
        themen: [{
          titel: 'T', lage: 'L', widerspruch: '',
          verlauf: [
            { seite: 'Russland', aussage: 'zuerst', tweetIds: ['1'] },
            { seite: 'Ukraine', aussage: 'antwort', tweetIds: ['2'] },
            { seite: 'Russland', aussage: 'nochmal', tweetIds: ['3'] },
          ],
        }],
      }),
    };
    const lage = await konfliktLageErstellen(RU_UA, suche, geminiClient, JETZT);
    expect(lage!.themen[0].verlauf.map((e) => e.aussage)).toEqual(['antwort', 'nochmal', 'zuerst']);
  });

  it('gibt Vorschaubild/Video-Kennzeichen eines Tweets an den Beleg weiter', async () => {
    const videoTweet: Tweet = { ...tweet('1', 'mfa_russia'), istVideo: true, posterUrl: 'https://pbs.twimg.com/x.jpg' };
    const suche = vi.fn().mockResolvedValue([videoTweet]);
    const geminiClient: GeminiClient = {
      strukturierteAntwort: vi.fn().mockResolvedValue({
        themen: [{ titel: 'T', lage: 'L', widerspruch: '', verlauf: [{ seite: 'Russland', aussage: 'a', tweetIds: ['1'] }] }],
      }),
    };
    const lage = await konfliktLageErstellen(RU_UA, suche, geminiClient, JETZT);
    expect(lage!.themen[0].verlauf[0].belege[0]).toMatchObject({ istVideo: true, posterUrl: 'https://pbs.twimg.com/x.jpg' });
  });

  it('holt bei einer Seite mit X-Liste auch deren Tweets und baut sie mit ein', async () => {
    const gaza = KONFLIKTE.find((k) => k.id === 'gaza')!;
    const suche = vi.fn().mockResolvedValue([tweet('h1', 'WAFANewsEnglish')]);
    const listeSuche = vi.fn().mockResolvedValue([tweet('l1', 'IDF')]);
    const geminiClient: GeminiClient = {
      strukturierteAntwort: vi.fn().mockResolvedValue({
        themen: [
          {
            titel: 'T', lage: 'L', widerspruch: '',
            verlauf: [
              { seite: 'Israel', aussage: 'a', tweetIds: ['l1'] },
              { seite: 'Palästinenser', aussage: 'b', tweetIds: ['h1'] },
            ],
          },
        ],
      }),
    };
    const lage = await konfliktLageErstellen(gaza, suche, geminiClient, JETZT, listeSuche);
    expect(listeSuche).toHaveBeenCalledWith('2111528805231632864', expect.any(String));
    expect(listeSuche).toHaveBeenCalledWith('2111818418999468119', expect.any(String));
    expect(suche.mock.calls[0][0]).not.toContain('IDF'); // Israel kommt nur über die Liste
    expect(lage!.themen[0].verlauf.map((e) => e.seite).sort()).toEqual(['Israel', 'Palästinenser']);
  });

  it('liefert null ohne Tweets (alter Stand bleibt), ohne Gemini zu fragen', async () => {
    const geminiClient: GeminiClient = { strukturierteAntwort: vi.fn() };
    expect(await konfliktLageErstellen(RU_UA, vi.fn().mockResolvedValue([]), geminiClient, JETZT)).toBeNull();
    expect(geminiClient.strukturierteAntwort).not.toHaveBeenCalled();
  });
});
