import { describe, it, expect } from 'vitest';
import { themaZusammenfassen } from '../../src/summarize/summarize.js';
import type { GeminiClient } from '../../src/summarize/geminiClient.js';
import type { Thema } from '../../src/types.js';

const thema: Thema = {
  id: 'thema-1',
  artikel: [{
    id: 'a1',
    quelle: { id: 'zeit', name: 'Zeit', typ: 'zeitung', land: 'DE', sprache: 'de' },
    titel: 'Ereignis', teaser: 'Beschreibung', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(),
  }],
  erstellt: '', aktualisiert: '',
};

const gueltigeAntwort = {
  schlagzeile: 'Ereignis', zusammenfassung: 'Etwas ist passiert.',
  kategorieWerte: { deutschland: 70, tuerkei: 0, nahost: 0 },
  wichtigkeit: 50, wichtigkeitBegruendung: 'x',
  fakten: [{ text: 'Etwas ist passiert.', belegtDurch: ['zeit'] }],
  strittigePunkte: [], sicherheit: 'hoch',
};

function client(antwort: unknown): GeminiClient {
  return { strukturierteAntwort: async () => antwort };
}

describe('themaZusammenfassen', () => {
  it('gibt eine ThemenZusammenfassung mit gesetzter themaId zurueck', async () => {
    const ergebnis = await themaZusammenfassen(thema, client(gueltigeAntwort));
    expect(ergebnis.themaId).toBe('thema-1');
    expect(ergebnis.schlagzeile).toBe('Ereignis');
    expect(ergebnis.fakten[0].belegtDurch).toEqual(['zeit']);
  });

  it('wirft einen Fehler, wenn die Antwort nicht die erwartete Form hat', async () => {
    await expect(themaZusammenfassen(thema, client({ schlagzeile: 'nur das' }))).rejects.toThrow('Form');
  });
});
