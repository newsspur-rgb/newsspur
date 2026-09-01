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
});
