import { describe, it, expect, vi } from 'vitest';
import { pipelineLauf } from '../src/pipeline.js';
import { SpeicherThemenStore } from '../src/store/memoryStore.js';
import { gehoertZuKategorie } from '../src/rules/kategorien.js';
import type { Artikel } from '../src/types.js';
import type { GeminiClient } from '../src/summarize/geminiClient.js';

const qA = { id: 'zeit', name: 'Zeit', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };
const qB = { id: 'tagesschau', name: 'Tagesschau', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

function art(o: Partial<Artikel>): Artikel {
  return { id: 'a', quelle: qA, titel: 't', teaser: 'te', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(), ...o };
}
function fakeGemini(antwort: unknown): GeminiClient {
  return { strukturierteAntwort: vi.fn(async () => antwort) };
}

describe('pipelineLauf', () => {
  it('veroeffentlicht ein Thema mit >=2 Quellen und gueltiger Zusammenfassung, mehrfach kategorisiert', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini });

    expect(ergebnis.veroeffentlicht).toBe(1);
    expect(ergebnis.zurueckgehalten).toBe(0);
    const alle = await store.alle();
    expect(alle[0].status).toBe('veroeffentlicht');
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'deutschland')).toBe(true);
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'tuerkei')).toBe(true);
    expect(gehoertZuKategorie(alle[0].zusammenfassung!.kategorieWerte, 'nahost')).toBe(false);
  });

  it('haelt ein Thema mit nur einer Quelle zurueck, ohne Gemini aufzurufen', async () => {
    const store = new SpeicherThemenStore();
    const gemini = fakeGemini({});
    const ergebnis = await pipelineLauf([art({ id: 'a1', url: 'https://a.de/1', quelle: qA })], { store, geminiClient: gemini });
    expect(ergebnis.zurueckgehalten).toBe(1);
    expect(ergebnis.veroeffentlicht).toBe(0);
    expect(gemini.strukturierteAntwort).not.toHaveBeenCalled();
  });

  it('haelt ein Thema zurueck, wenn ein Fakt keine Beleg-Quelle hat', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Ereignis X Bericht', teaser: 'Beschreibung X ausfuehrlich' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Ereignis X passiert Bericht', teaser: 'Beschreibung X sehr ausfuehrlich' });
    const gemini = fakeGemini({
      schlagzeile: 'Ereignis X', zusammenfassung: 'Etwas ist passiert.',
      kategorieWerte: { deutschland: 60, tuerkei: 0, nahost: 0 },
      wichtigkeit: 50, wichtigkeitBegruendung: 'x',
      fakten: [{ text: 'Unbelegter Fakt', belegtDurch: [] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini });

    expect(ergebnis.zurueckgehalten).toBe(1);
    const alle = await store.alle();
    expect(alle[0].zusammenfassung?.sicherheit).toBe('niedrig');
  });

  it('ueberspringt ein Thema bei einem Gemini-Fehler, statt den ganzen Lauf abzubrechen', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Ereignis Y Bericht', teaser: 'Beschreibung Y ausfuehrlich' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Ereignis Y passiert Bericht', teaser: 'Beschreibung Y sehr ausfuehrlich' });
    const gemini: GeminiClient = { strukturierteAntwort: vi.fn(async () => { throw new Error('Gemini antwortete mit Status 503'); }) };

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini });

    expect(ergebnis.fehler).toBe(1);
    expect(ergebnis.veroeffentlicht).toBe(0);
    expect(await store.alle()).toHaveLength(0);
  });

  it('ruft socialPoster nach erfolgreicher Veroeffentlichung auf', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const socialPoster = vi.fn(async () => {});

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, socialPoster });

    expect(ergebnis.veroeffentlicht).toBe(1);
    expect(socialPoster).toHaveBeenCalledTimes(1);
  });

  it('bricht die Pipeline nicht ab, wenn socialPoster fehlschlaegt', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const socialPoster = vi.fn(async () => { throw new Error('Instagram-API antwortete mit Status 500'); });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, socialPoster });

    expect(ergebnis.veroeffentlicht).toBe(1);
    const alle = await store.alle();
    expect(alle[0].status).toBe('veroeffentlicht');
  });

  it('ruft pushBenachrichtiger fuer ein veroeffentlichtes Thema auf', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const pushBenachrichtiger = vi.fn(async () => {});

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, pushBenachrichtiger });

    expect(ergebnis.veroeffentlicht).toBe(1);
    expect(pushBenachrichtiger).toHaveBeenCalledTimes(1);
  });

  it('bricht die Pipeline nicht ab, wenn pushBenachrichtiger fehlschlaegt', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const pushBenachrichtiger = vi.fn(async () => { throw new Error('web-push antwortete mit Status 500'); });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, pushBenachrichtiger });

    expect(ergebnis.veroeffentlicht).toBe(1);
    const alle = await store.alle();
    expect(alle[0].status).toBe('veroeffentlicht');
  });

  it('ruft reelPoster fuer ein veroeffentlichtes Thema auf', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const reelPoster = vi.fn(async () => {});

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, reelPoster });

    expect(ergebnis.veroeffentlicht).toBe(1);
    expect(reelPoster).toHaveBeenCalledTimes(1);
  });

  it('bricht die Pipeline nicht ab, wenn reelPoster fehlschlaegt', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const gemini = fakeGemini({
      schlagzeile: 'Erdogan trifft Kanzler in Berlin',
      zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
      kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
      wichtigkeit: 80, wichtigkeitBegruendung: 'Staatsbesuch',
      fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
      strittigePunkte: [], sicherheit: 'hoch',
    });
    const reelPoster = vi.fn(async () => { throw new Error('Reel-Erzeugung fehlgeschlagen'); });

    const ergebnis = await pipelineLauf([a1, a2], { store, geminiClient: gemini, reelPoster });

    expect(ergebnis.veroeffentlicht).toBe(1);
    const alle = await store.alle();
    expect(alle[0].status).toBe('veroeffentlicht');
  });

  it('postet mit socialPostLimit nur die wichtigste(n) Meldung(en), erst nach dem ganzen Lauf', async () => {
    const store = new SpeicherThemenStore();
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const a3 = art({ id: 'a3', url: 'https://a.de/2', quelle: qA, titel: 'Schweres Erdbeben erschuettert Grossstadt', teaser: 'Ein schweres Erdbeben hat eine Grossstadt getroffen, viele Verletzte.' });
    const a4 = art({ id: 'a4', url: 'https://b.de/2', quelle: qB, titel: 'Erdbeben trifft Grossstadt schwer', teaser: 'Ein schweres Erdbeben erschuetterte die Grossstadt, zahlreiche Verletzte gemeldet.' });

    const gemini: GeminiClient = {
      strukturierteAntwort: vi.fn(async (prompt: unknown) => {
        const istErdbeben = typeof prompt === 'string' && prompt.includes('Erdbeben');
        return istErdbeben
          ? {
              schlagzeile: 'Schweres Erdbeben erschuettert Grossstadt', zusammenfassung: 'Ein Erdbeben hat die Grossstadt getroffen.',
              kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
              wichtigkeit: 95, wichtigkeitBegruendung: 'Katastrophe',
              fakten: [{ text: 'Ein Erdbeben erschuetterte die Grossstadt.', belegtDurch: ['zeit', 'tagesschau'] }],
              strittigePunkte: [], sicherheit: 'hoch',
            }
          : {
              schlagzeile: 'Erdogan trifft Kanzler in Berlin', zusammenfassung: 'Der tuerkische Praesident traf den Bundeskanzler in Berlin.',
              kategorieWerte: { deutschland: 90, tuerkei: 95, nahost: 5 },
              wichtigkeit: 60, wichtigkeitBegruendung: 'Staatsbesuch',
              fakten: [{ text: 'Erdogan traf den Kanzler in Berlin.', belegtDurch: ['zeit', 'tagesschau'] }],
              strittigePunkte: [], sicherheit: 'hoch',
            };
      }),
    };
    let gepostet: string | undefined;
    const socialPoster = vi.fn(async (_thema: unknown, zusammenfassung: { schlagzeile: string }) => {
      gepostet = zusammenfassung.schlagzeile;
    });

    const ergebnis = await pipelineLauf([a1, a2, a3, a4], { store, geminiClient: gemini, socialPoster, socialPostLimit: 1 });

    expect(ergebnis.veroeffentlicht).toBe(2);
    expect(socialPoster).toHaveBeenCalledTimes(1);
    expect(gepostet).toBe('Schweres Erdbeben erschuettert Grossstadt');
  });
});
