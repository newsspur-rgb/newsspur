import { describe, it, expect, vi } from 'vitest';
import { ampelFuerStand } from '../../src/bundestag/status.js';
import { erstelleDipClient, vorgangZuGesetz } from '../../src/bundestag/dipClient.js';
import { protokollKuerzen, debatteZusammenfassen, MAX_PROTOKOLL_ZEICHEN } from '../../src/bundestag/debatte.js';
import { bundestagLauf } from '../../src/bundestag/bundestagLauf.js';
import { erstelleSpeicherBundestagStore } from '../../src/bundestag/bundestagStore.js';
import type { DipClient } from '../../src/bundestag/dipClient.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { Plenarprotokoll } from '../../src/bundestag/typen.js';

const protokoll: Plenarprotokoll = { id: 'p1', titel: 'Protokoll der 102. Sitzung', datum: '2026-10-15', text: 'Inhalt\nBeginn: 09:00 Uhr\nRede ...' };

const gueltigeDebatte = {
  ueberblick: 'Es ging um Notfallversorgung.',
  punkte: [{ thema: 'Notfallreform', worum: 'Reform der Notaufnahmen', positionen: [{ fraktion: 'SPD', aussage: 'Dafür' }], ergebnis: 'Angenommen' }],
};

function gemini(antwort: unknown): GeminiClient & { strukturierteAntwort: ReturnType<typeof vi.fn> } {
  return { strukturierteAntwort: vi.fn(async () => antwort) };
}

describe('ampelFuerStand', () => {
  it('ordnet verkündete und durchgewunkene Gesetze als beschlossen ein', () => {
    expect(ampelFuerStand('Verkündet')).toBe('beschlossen');
    expect(ampelFuerStand('Bundesrat hat Vermittlungsausschuss nicht angerufen')).toBe('beschlossen');
  });
  it('erkennt vom Verfassungsgericht gekippte Gesetze', () => {
    expect(ampelFuerStand('Für nichtig erklärt')).toBe('gekippt');
    expect(ampelFuerStand('Für mit dem Grundgesetz unvereinbar erklärt')).toBe('gekippt');
  });
  it('erkennt gescheiterte Gesetze', () => {
    expect(ampelFuerStand('Abgelehnt')).toBe('gescheitert');
    expect(ampelFuerStand('Erledigt durch Ablauf der Wahlperiode')).toBe('gescheitert');
  });
  it('behandelt unbekannte Stände als in Beratung', () => {
    expect(ampelFuerStand('Den Ausschüssen zugewiesen')).toBe('in-beratung');
  });
});

describe('dipClient', () => {
  it('vorgangZuGesetz baut Link, Ampel und Verkündungsdatum', () => {
    const g = vorgangZuGesetz({
      id: '334569', titel: 'Gesetz X', beratungsstand: 'Verkündet', aktualisiert: '2026-10-06T09:45:50+02:00',
      verkuendung: [{ verkuendungsdatum: '2026-10-05' }],
    });
    expect(g.link).toBe('https://dip.bundestag.de/vorgang/-/334569');
    expect(g.ampel).toBe('beschlossen');
    expect(g.verkuendetAm).toBe('2026-10-05');
  });

  it('entfernt HTML-Reste aus dem Abstract', () => {
    const g = vorgangZuGesetz({ id: '1', titel: 'G', aktualisiert: 'x', abstract: '<strong>Beschlussempfehlung:</strong> Änderungen' });
    expect(g.abstract).toBe('Beschlussempfehlung: Änderungen');
  });

  it('schickt den API-Key mit und hört auf, wenn der Cursor sich nicht ändert', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ numFound: 1, cursor: 'c1', documents: [{ id: '1', titel: 'G', aktualisiert: '2026-10-16' }] }),
    })) as unknown as typeof fetch;
    const dip = erstelleDipClient('key-123', fetchImpl);
    const gesetze = await dip.gesetzeSeit('2026-10-14T00:00:00.000Z', 5);

    expect(gesetze).toHaveLength(2); // Seite 1 (kein Cursor) + Seite 2 (Cursor c1) -> danach gleicher Cursor = Ende
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toContain('f.vorgangstyp=Gesetzgebung');
    expect(url).toContain('f.aktualisiert.start=2026-10-14T00%3A00%3A00');
    expect(init.headers.Authorization).toBe('ApiKey key-123');
  });

  it('neuesteProtokolle liefert nur Protokolle mit Volltext', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ numFound: 2, documents: [{ id: 'a', titel: 'ohne', datum: 'x' }, { id: 'b', titel: 'mit', datum: 'y', text: 'Text' }] }),
    })) as unknown as typeof fetch;
    const protokolle = await erstelleDipClient('k', fetchImpl).neuesteProtokolle();
    expect(protokolle.map((p) => p.id)).toEqual(['b']);
  });
});

describe('protokollKuerzen', () => {
  it('kürzt ein langes Inhaltsverzeichnis vor "Beginn:"', () => {
    const text = 'I'.repeat(50_000) + '\nBeginn: 09:00 Uhr\nPräsidentin: Die Sitzung ist eröffnet.';
    const { text: gekuerzt, gekuerzt: abgeschnitten } = protokollKuerzen(text);
    expect(gekuerzt).toContain('Beginn: 09:00 Uhr');
    expect(gekuerzt.length).toBeLessThan(20_000);
    expect(abgeschnitten).toBe(false);
  });
  it('deckelt sehr lange Protokolle und markiert das', () => {
    const { text, gekuerzt } = protokollKuerzen('x'.repeat(MAX_PROTOKOLL_ZEICHEN + 10));
    expect(text.length).toBe(MAX_PROTOKOLL_ZEICHEN);
    expect(gekuerzt).toBe(true);
  });
});

describe('debatteZusammenfassen', () => {
  it('liefert eine Debatte mit Link zum Protokoll', async () => {
    const d = await debatteZusammenfassen(protokoll, gemini(gueltigeDebatte));
    expect(d.punkte[0].thema).toBe('Notfallreform');
    expect(d.link).toBe('https://dip.bundestag.de/plenarprotokoll/-/p1');
  });
  it('wirft bei ungültiger Gemini-Antwort', async () => {
    await expect(debatteZusammenfassen(protokoll, gemini({ ueberblick: 1 }))).rejects.toThrow(/erwartete Form/);
  });
});

describe('bundestagLauf', () => {
  function dip(protokolle: Plenarprotokoll[]): DipClient {
    return {
      gesetzeSeit: async () => [vorgangZuGesetz({ id: 'g1', titel: 'G', beratungsstand: 'Abgelehnt', aktualisiert: '2026-10-16' })],
      neuesteProtokolle: async () => protokolle,
    };
  }

  it('speichert Gesetze und fasst höchstens ein neues Protokoll zusammen', async () => {
    const store = erstelleSpeicherBundestagStore();
    const client = gemini(gueltigeDebatte);
    const ergebnis = await bundestagLauf({ dip: dip([protokoll, { ...protokoll, id: 'p0' }]), store, geminiClient: client });

    expect(ergebnis).toEqual({ gesetzeAktualisiert: 1, debatteNeu: protokoll.titel, fehler: 0 });
    expect(store.gesetze.get('g1')?.ampel).toBe('gescheitert');
    expect(client.strukturierteAntwort).toHaveBeenCalledTimes(1);
  });

  it('überspringt bereits zusammengefasste Protokolle', async () => {
    const store = erstelleSpeicherBundestagStore();
    await store.debatteSpeichern({ id: 'p1', titel: '', datum: '', ueberblick: '', punkte: [], link: '', gekuerzt: false });
    const client = gemini(gueltigeDebatte);
    await bundestagLauf({ dip: dip([protokoll, { ...protokoll, id: 'p0' }]), store, geminiClient: client });
    expect(store.debatten.has('p0')).toBe(true);
  });

  it('ruft ohne Gemini-Client keine Protokolle ab', async () => {
    const neuesteProtokolle = vi.fn(async () => [protokoll]);
    const store = erstelleSpeicherBundestagStore();
    await bundestagLauf({ dip: { ...dip([]), neuesteProtokolle }, store });
    expect(neuesteProtokolle).not.toHaveBeenCalled();
  });

  it('zählt einen Gemini-Fehler, ohne den Lauf abzubrechen', async () => {
    const store = erstelleSpeicherBundestagStore();
    const client: GeminiClient = { strukturierteAntwort: async () => { throw new Error('429'); } };
    const ergebnis = await bundestagLauf({ dip: dip([protokoll]), store, geminiClient: client });
    expect(ergebnis.fehler).toBe(1);
    expect(store.gesetze.size).toBe(1);
  });
});
