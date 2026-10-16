import { describe, it, expect, vi } from 'vitest';
import { isoWoche, wochenThemen, weitblickErstellen, MIN_LAENDER, type WeitblickStore } from '../../src/weitblick/weitblick.js';
import { neutraleLaenderFuer } from '../../src/weitblick/neutraleLaender.js';
import { weltpresseSuchen, type WeltArtikel } from '../../src/weitblick/gdeltWelt.js';
import { SpeicherThemenStore } from '../../src/store/memoryStore.js';
import { erstelleSpeicherBundestagStore } from '../../src/bundestag/bundestagStore.js';
import { vorgangZuGesetz } from '../../src/bundestag/dipClient.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { VerarbeitetesThema } from '../../src/types.js';
import type { Weitblick } from '../../src/weitblick/typen.js';

const JETZT = new Date('2026-10-18T16:00:00Z');

function thema(id: string, schlagzeile: string, wichtigkeit: number, status: VerarbeitetesThema['status'] = 'veroeffentlicht'): VerarbeitetesThema {
  return {
    thema: { id, artikel: [], erstellt: '2026-10-15T10:00:00Z', aktualisiert: '2026-10-15T10:00:00Z' },
    status,
    zusammenfassung: {
      themaId: id, schlagzeile, zusammenfassung: 'Text', kategorieWerte: { deutschland: 80, tuerkei: 0, nahost: 0 },
      wichtigkeit, wichtigkeitBegruendung: '', fakten: [], strittigePunkte: [], sicherheit: 'hoch',
    },
  };
}

function artikel(laender: string[]): WeltArtikel[] {
  return laender.map((land, i) => ({ land, medium: `m${i}.com`, titel: `Titel ${i}`, url: `https://m${i}.com` }));
}

describe('isoWoche', () => {
  it('berechnet die ISO-Kalenderwoche', () => {
    expect(isoWoche(new Date('2026-10-18T12:00:00Z'))).toBe('2026-W42');
    expect(isoWoche(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });
});

describe('wochenThemen', () => {
  it('nimmt nur veröffentlichte Themen, sortiert nach Wichtigkeit, ohne doppelte Schlagzeilen', () => {
    const ergebnis = wochenThemen([
      thema('a', 'Klein', 10),
      thema('b', 'Groß', 90),
      thema('c', 'groß', 80),
      thema('d', 'Zurückgehalten', 99, 'zurueckgehalten'),
    ]);
    expect(ergebnis.map((t) => t.thema.id)).toEqual(['b', 'a']);
  });
});

describe('neutraleLaenderFuer', () => {
  it('schließt bei Nahost Länder mit klarer Parteinahme aus', () => {
    const nahost = neutraleLaenderFuer('nahost').map((l) => l.fips);
    expect(nahost).not.toContain('MY');
    expect(neutraleLaenderFuer('deutschland').map((l) => l.fips)).toContain('MY');
  });
});

describe('weltpresseSuchen', () => {
  it('baut die Länderfilter-Abfrage und behält nur einen Artikel pro Medium', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ articles: [
        { url: 'https://a.in/1', title: 'Merz in Kyiv', domain: 'a.in', sourcecountry: 'India' },
        { url: 'https://a.in/2', title: 'Merz again', domain: 'a.in', sourcecountry: 'India' },
        { url: 'https://b.br/1', title: 'Merz visita', domain: 'b.br', sourcecountry: 'Brazil' },
      ] }),
    })) as unknown as typeof fetch;
    const ergebnis = await weltpresseSuchen(['Merz', 'Ukraine visit'], neutraleLaenderFuer('deutschland'), fetchImpl, 0);

    expect(ergebnis.map((a) => a.land)).toEqual(['Indien', 'Brasilien']);
    const url = decodeURIComponent((fetchImpl as any).mock.calls[0][0]);
    expect(url).toContain('Merz "Ukraine visit" (sourcecountry:IN OR');
    expect(url).toContain('timespan=7d');
  });

  it('teilt die 20 Länder auf Abfragen mit höchstens 10 Länder-Filtern auf', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => '{}' })) as unknown as typeof fetch;
    await weltpresseSuchen(['x'], neutraleLaenderFuer('deutschland'), fetchImpl, 0);
    const urls = (fetchImpl as any).mock.calls.map((c: any[]) => decodeURIComponent(c[0]));
    expect(urls).toHaveLength(2);
    for (const url of urls) expect(url.match(/sourcecountry:/g)).toHaveLength(10);
  });

  it('wirft, wenn GDELT einen Klartext-Drosselhinweis statt JSON liefert', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => 'Please limit requests to one every 5 seconds' })) as unknown as typeof fetch;
    await expect(weltpresseSuchen(['x'], neutraleLaenderFuer('deutschland'), fetchImpl)).rejects.toThrow(/kein JSON/);
  });
});

describe('weitblickErstellen', () => {
  const auswahl = {
    einleitung: 'Eine bewegte Woche.',
    entwicklungen: [
      { titel: 'Merz in Kiew', kategorie: 'deutschland', kurz: 'Merz reiste nach Kiew.', themaIds: ['b', 'erfunden'], suchbegriffe: ['Merz', 'Kyiv'] },
      { titel: 'Kleines Thema', kategorie: 'tuerkei', kurz: 'Etwas.', themaIds: ['a'], suchbegriffe: ['Ankara'] },
    ],
  };
  const abgleich = {
    bewertungen: [{ nummer: 1, urteil: 'deckungsgleich', uebereinstimmung: 'Alle berichten über den Besuch.', abweichungen: [] }],
  };

  async function lauf(weltSuche = vi.fn(async (begriffe: string[]) => (begriffe[0] === 'Merz' ? artikel(['Indien', 'Brasilien', 'Kenia']) : artikel(['Japan'])))) {
    const themenStore = new SpeicherThemenStore();
    await themenStore.speichern(thema('a', 'Klein', 10));
    await themenStore.speichern(thema('b', 'Groß', 90));
    const bundestagStore = erstelleSpeicherBundestagStore();
    await bundestagStore.gesetzSpeichern(vorgangZuGesetz({ id: 'g1', titel: 'Verkündet', beratungsstand: 'Verkündet', aktualisiert: '2026-10-16T10:00:00Z' }));
    await bundestagStore.gesetzSpeichern(vorgangZuGesetz({ id: 'g2', titel: 'Läuft', beratungsstand: 'Überwiesen', aktualisiert: '2026-10-16T10:00:00Z' }));
    const antworten = [auswahl, abgleich];
    const geminiClient: GeminiClient & { strukturierteAntwort: ReturnType<typeof vi.fn> } = {
      strukturierteAntwort: vi.fn(async () => antworten.shift()),
    };
    const gespeichert: Weitblick[] = [];
    const weitblickStore: WeitblickStore = { speichern: async (w) => { gespeichert.push(w); } };
    const ergebnis = await weitblickErstellen({ themenStore, bundestagStore, geminiClient, weltSuche, weitblickStore, pauseMs: 0, jetzt: JETZT });
    return { ergebnis, geminiClient, weltSuche, gespeichert };
  }

  it('gleicht nur Entwicklungen mit genug neutralen Ländern per Gemini ab', async () => {
    const { ergebnis, geminiClient } = await lauf();
    expect(geminiClient.strukturierteAntwort).toHaveBeenCalledTimes(2);
    const abgleichPrompt = geminiClient.strukturierteAntwort.mock.calls[1][0] as string;
    expect(abgleichPrompt).toContain('FALL 1: Merz in Kiew');
    expect(abgleichPrompt).not.toContain('Kleines Thema');

    expect(ergebnis.entwicklungen[0].weltblick.urteil).toBe('deckungsgleich');
    expect(ergebnis.entwicklungen[0].weltblick.laender).toEqual(['Indien', 'Brasilien', 'Kenia']);
    expect(ergebnis.entwicklungen[1].weltblick.urteil).toBe('kaum-berichtet');
    expect(MIN_LAENDER).toBe(3);
  });

  it('entfernt erfundene Themen-Kennungen und nimmt nur abgeschlossene Gesetze', async () => {
    const { ergebnis, gespeichert } = await lauf();
    expect(ergebnis.entwicklungen[0].themaIds).toEqual(['b']);
    expect(ergebnis.gesetze.map((g) => g.id)).toEqual(['g1']);
    expect(ergebnis.woche).toBe('2026-W42');
    expect(gespeichert).toHaveLength(1);
  });

  it('läuft weiter, wenn eine Weltpresse-Suche scheitert, und spart dann den Abgleich', async () => {
    const weltSuche = vi.fn(async () => { throw new Error('429'); });
    const { ergebnis, geminiClient } = await lauf(weltSuche);
    expect(geminiClient.strukturierteAntwort).toHaveBeenCalledTimes(1);
    expect(ergebnis.entwicklungen.every((e) => e.weltblick.urteil === 'kaum-berichtet')).toBe(true);
  });

  it('wirft, wenn es in der Woche keine Meldungen gab', async () => {
    await expect(weitblickErstellen({
      themenStore: new SpeicherThemenStore(),
      geminiClient: { strukturierteAntwort: async () => auswahl },
      weltSuche: async () => [],
      weitblickStore: { speichern: async () => {} },
      jetzt: JETZT,
    })).rejects.toThrow(/Keine veroeffentlichten/);
  });
});
