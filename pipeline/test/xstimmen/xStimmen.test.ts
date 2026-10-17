import { describe, it, expect, vi } from 'vitest';
import { tweetsParsen, kontenAbfrage, xTweetsSuchen } from '../../src/xstimmen/xSuche.js';
import { xStimmenErstellen } from '../../src/xstimmen/xStimmen.js';
import { erstelleSpeicherXStimmenStore } from '../../src/xstimmen/xStimmenStore.js';
import { kontoName } from '../../src/xstimmen/konten.js';
import { SpeicherThemenStore } from '../../src/store/memoryStore.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { VerarbeitetesThema } from '../../src/types.js';
import type { Tweet } from '../../src/xstimmen/xSuche.js';

const JETZT = new Date('2026-10-17T12:00:00Z');

const ROH = JSON.stringify([
  { id: '1', author: 'bundeskanzler', text: 'Die Frühstartrente kommt. https://t.co/abc', created_at: 'Fri Oct 16 10:50:00 +0000 2026', likes: 1162 },
  { id: '2', author: 'AfD', text: 'Wir fordern &amp; verlangen X', created_at: 'Fri Oct 16 07:00:00 +0000 2026', likes: 2334 },
  { id: '3', author: 'kaputt' },
]);

function tweet(id: string, autor: string, zeit = '2026-10-17T08:00:00.000Z'): Tweet {
  return { id, autor, text: 'Text ' + id, zeit, likes: 10, url: `https://x.com/${autor}/status/${id}` };
}

function meldung(id: string): VerarbeitetesThema {
  return {
    thema: { id, artikel: [], erstellt: '2026-10-17T06:00:00Z', aktualisiert: '2026-10-17T06:00:00Z' },
    status: 'veroeffentlicht',
    zusammenfassung: {
      themaId: id, schlagzeile: 'Frühstartrente beschlossen', zusammenfassung: '', kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
      wichtigkeit: 80, wichtigkeitBegruendung: '', fakten: [], strittigePunkte: [], sicherheit: 'hoch',
    },
  };
}

describe('tweetsParsen', () => {
  it('liest OpenCLI-JSON, baut Links, entfernt t.co-Links und unvollständige Einträge', () => {
    const t = tweetsParsen('Update available\n' + ROH);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual({
      id: '1', autor: 'bundeskanzler', text: 'Die Frühstartrente kommt.', zeit: '2026-10-16T10:50:00.000Z', likes: 1162,
      url: 'https://x.com/bundeskanzler/status/1',
    });
    expect(t[1].text).toBe('Wir fordern & verlangen X');
  });

  it('wirft bei OpenCLI-Fehlerobjekt mit Hinweis auf Chrome', () => {
    expect(() => tweetsParsen('ok: false')).toThrow();
    expect(() => tweetsParsen('{"ok":false,"error":{"message":"Navigation rejected."}}')).toThrow(/Chrome/);
  });
});

describe('kontenAbfrage / xTweetsSuchen', () => {
  it('baut eine from:-Abfrage ohne Antworten und Retweets', () => {
    expect(kontenAbfrage(['a', 'b'], '2026-10-16T00:00:00Z')).toBe('since:2026-10-16 -filter:replies -filter:nativeretweets (from:a OR from:b)');
  });

  it('filtert Tweets vor dem Zeitpunkt heraus', async () => {
    const ausfuehren = vi.fn().mockResolvedValue(ROH);
    const t = await xTweetsSuchen(['bundeskanzler'], '2026-10-16T08:00:00.000Z', ausfuehren);
    expect(t.map((x) => x.id)).toEqual(['1']);
    expect(ausfuehren.mock.calls[0][0]).toContain('live');
  });
});

describe('kontoName', () => {
  it('liefert Anzeigenamen, sonst @handle', () => {
    expect(kontoName('deutschland', 'BUNDESKANZLER')).toBe('Bundeskanzler');
    expect(kontoName('deutschland', 'unbekannt')).toBe('@unbekannt');
  });
});

describe('xStimmenErstellen', () => {
  it('speichert Themen nur mit echten Tweets, prüft Meldungs-IDs und setzt bestehende Themen fort', async () => {
    const themenStore = new SpeicherThemenStore();
    await themenStore.speichern(meldung('m1'));
    const store = erstelleSpeicherXStimmenStore();
    await store.speichern({
      id: 'x-alt', kategorie: 'deutschland', titel: 'Alt', zusammenfassung: 'z', themaId: 'm1',
      stimmen: [{ autor: 'spdde', konto: 'SPD', kernaussage: 'k', text: 't', url: 'https://x.com/spdde/status/9', zeit: '2026-10-17T01:00:00.000Z', likes: 1 }],
      erstellt: '2026-10-17T01:00:00.000Z', aktualisiert: '2026-10-17T01:00:00.000Z',
    });

    const suche = vi.fn(async (handles: string[]) =>
      handles.includes('bundeskanzler') ? [tweet('1', 'bundeskanzler'), tweet('2', 'AfD'), tweet('1', 'bundeskanzler')] : [],
    );
    const geminiClient: GeminiClient = {
      strukturierteAntwort: vi.fn().mockResolvedValue({
        themen: [
          { titel: 'Rente', zusammenfassung: 'Kanzler lobt, AfD kritisiert.', bestehendeId: 'x-alt', themaId: 'm1', stimmen: [{ tweetId: '1', kernaussage: 'A' }, { tweetId: '2', kernaussage: 'B' }] },
          { titel: 'Erfunden', zusammenfassung: '…', bestehendeId: '', themaId: 'gibtsnicht', stimmen: [{ tweetId: '999', kernaussage: 'X' }] },
          { titel: 'Neu', zusammenfassung: 'Nur AfD.', bestehendeId: 'falsch', themaId: 'gibtsnicht', stimmen: [{ tweetId: '2', kernaussage: 'C' }] },
        ],
      }),
    };

    const ergebnis = await xStimmenErstellen({ themenStore, geminiClient, suche, store, jetzt: JETZT, pauseMs: 0 });

    expect(suche).toHaveBeenCalledTimes(7);
    expect(geminiClient.strukturierteAntwort).toHaveBeenCalledTimes(1); // nur Deutschland hatte Tweets
    expect(ergebnis).toHaveLength(2);
    const [fortgesetzt, neu] = ergebnis;
    expect(fortgesetzt.id).toBe('x-alt');
    expect(fortgesetzt.erstellt).toBe('2026-10-17T01:00:00.000Z');
    expect(fortgesetzt.stimmen.map((s) => s.url)).toEqual([
      'https://x.com/bundeskanzler/status/1', 'https://x.com/AfD/status/2', 'https://x.com/spdde/status/9',
    ]);
    expect(fortgesetzt.stimmen[0].konto).toBe('Bundeskanzler');
    expect(neu.id).toBe('x-deutschland-202610171200-3');
    expect(neu.themaId).toBeNull();
    expect(store.alle.size).toBe(2);
  });

  it('läuft weiter, wenn die X-Suche einer Kategorie scheitert', async () => {
    const suche = vi.fn().mockRejectedValue(new Error('Chrome zu'));
    const geminiClient: GeminiClient = { strukturierteAntwort: vi.fn() };
    const ergebnis = await xStimmenErstellen({
      themenStore: new SpeicherThemenStore(), geminiClient, suche, store: erstelleSpeicherXStimmenStore(), jetzt: JETZT, pauseMs: 0,
    });
    expect(ergebnis).toEqual([]);
    expect(geminiClient.strukturierteAntwort).not.toHaveBeenCalled();
  });
});
