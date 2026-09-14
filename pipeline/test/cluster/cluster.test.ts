import { describe, it, expect, vi } from 'vitest';
import { buendeln } from '../../src/cluster/cluster.js';
import type { Artikel, Thema } from '../../src/types.js';

const qA = { id: 'quelle-a', name: 'A', typ: 'zeitung' as const, land: 'DE' as const, sprache: 'de' as const };
const qB = { id: 'quelle-b', name: 'B', typ: 'oeffentlich-rechtlich' as const, land: 'DE' as const, sprache: 'de' as const };

function art(o: Partial<Artikel>): Artikel {
  return { id: 'a', quelle: qA, titel: 'Titel', teaser: 'Teaser', url: 'https://x.de/1', veroeffentlichtAm: new Date().toISOString(), ...o };
}

describe('buendeln (Wortabgleich-Fallback, ohne embedFn)', () => {
  it('buendelt zwei Artikel mit aehnlicher Schlagzeile zu einem Thema', async () => {
    const a1 = art({ id: 'a1', url: 'https://a.de/1', quelle: qA, titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', quelle: qB, titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });
    const { neueThemen } = await buendeln([a1, a2], []);
    expect(neueThemen).toHaveLength(1);
    expect(neueThemen[0].artikel).toHaveLength(2);
  });

  it('erstellt getrennte Themen fuer unzusammenhaengende Artikel', async () => {
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident kam nach Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', titel: 'Grundsteuer in Nordrhein-Westfalen steigt deutlich', teaser: 'Die Landesregierung beschliesst neue Hebesaetze.' });
    const { neueThemen } = await buendeln([a1, a2], []);
    expect(neueThemen).toHaveLength(2);
  });

  it('haengt einen neuen Artikel an ein bestehendes Thema an', async () => {
    const jetzt = new Date().toISOString();
    const bestehend: Thema = {
      id: 'thema-1',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdbeben erschuettert Ostanatolien Region', teaser: 'Ein schweres Erdbeben traf die Region Ostanatolien.' })],
      erstellt: jetzt, aktualisiert: jetzt,
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Erdbeben in Ostanatolien Region fordert Opfer', teaser: 'Nach dem Erdbeben in der Region Ostanatolien steigt die Opferzahl.' });
    const { neueThemen, aktualisierteThemen } = await buendeln([neu], [bestehend]);
    expect(neueThemen).toHaveLength(0);
    expect(aktualisierteThemen).toHaveLength(1);
    expect(aktualisierteThemen[0].artikel).toHaveLength(2);
  });

  it('ignoriert bestehende Themen ausserhalb des 48h-Zeitfensters', async () => {
    const bestehend: Thema = {
      id: 'alt',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdbeben erschuettert Ostanatolien Region', teaser: 'Ein schweres Erdbeben traf die Region Ostanatolien.', veroeffentlichtAm: '2026-01-01T00:00:00Z' })],
      erstellt: '2026-01-01T00:00:00Z', aktualisiert: '2026-01-01T00:00:00Z',
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Erdbeben in Ostanatolien Region fordert Opfer', teaser: 'Nach dem Erdbeben in der Region Ostanatolien steigt die Opferzahl.', veroeffentlichtAm: new Date().toISOString() });
    const { neueThemen, aktualisierteThemen } = await buendeln([neu], [bestehend]);
    expect(aktualisierteThemen).toHaveLength(0);
    expect(neueThemen).toHaveLength(1);
  });
});

describe('buendeln (mit embedFn)', () => {
  it('nutzt die Embedding-Aehnlichkeit statt des Wortabgleichs', async () => {
    const vektoren = new Map<string, number[]>([
      ['Erdogan besucht Berlin. Treffen mit dem Kanzler.', [1, 0, 0]],
      ['Kanzler empfaengt Gast. Gespraech in der Hauptstadt.', [0.97, 0.03, 0]],
      ['Grundsteuer steigt. Neue Saetze im Bundesland.', [0, 1, 0]],
    ]);
    const embedFn = async (texte: string[]) => texte.map((t) => vektoren.get(t) ?? [0, 0, 1]);
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan besucht Berlin', teaser: 'Treffen mit dem Kanzler.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', titel: 'Kanzler empfaengt Gast', teaser: 'Gespraech in der Hauptstadt.' });
    const a3 = art({ id: 'a3', url: 'https://c.de/1', titel: 'Grundsteuer steigt', teaser: 'Neue Saetze im Bundesland.' });
    const { neueThemen } = await buendeln([a1, a2, a3], [], { embedFn });
    expect(neueThemen).toHaveLength(2);
    const erdoganThema = neueThemen.find((t) => t.artikel.some((a) => a.id === 'a1'));
    expect(erdoganThema?.artikel.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('speichert das Embedding an neu erstellten Themen', async () => {
    const embedFn = async (texte: string[]) => texte.map(() => [1, 0, 0]);
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan besucht Berlin', teaser: 'Treffen mit dem Kanzler.' });
    const { neueThemen } = await buendeln([a1], [], { embedFn });
    expect(neueThemen[0].embedding).toEqual([1, 0, 0]);
  });

  it('fragt embedFn nicht erneut fuer ein bestehendes Thema, das schon ein Embedding hat', async () => {
    const embedFn = vi.fn(async (texte: string[]) => texte.map(() => [0, 1, 0]));
    const jetzt = new Date().toISOString();
    const bestehend: Thema = {
      id: 'thema-1',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Grundsteuer steigt', teaser: 'Neue Saetze im Bundesland.' })],
      erstellt: jetzt,
      aktualisiert: jetzt,
      embedding: [1, 0, 0],
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Ganz anderes Thema', teaser: 'Voellig unabhaengiger Inhalt.' });
    await buendeln([neu], [bestehend], { embedFn });

    const angefragteTexte = embedFn.mock.calls[0][0] as string[];
    expect(angefragteTexte).not.toContain('Grundsteuer steigt. Neue Saetze im Bundesland.');
  });

  it('faellt auf Wortabgleich zurueck, statt abzubrechen, wenn embedFn wirft (z.B. Rate-Limit)', async () => {
    const embedFn = vi.fn(async () => {
      throw new Error('Gemini-Embedding antwortete mit Status 429');
    });
    const a1 = art({ id: 'a1', url: 'https://a.de/1', titel: 'Erdogan trifft Kanzler in Berlin', teaser: 'Der tuerkische Praesident traf den Kanzler in Berlin.' });
    const a2 = art({ id: 'a2', url: 'https://b.de/1', titel: 'Erdogan in Berlin beim Kanzler', teaser: 'Treffen zwischen Erdogan und dem Kanzler in Berlin.' });

    const { neueThemen } = await buendeln([a1, a2], [], { embedFn });

    expect(neueThemen).toHaveLength(1);
    expect(neueThemen[0].artikel).toHaveLength(2);
    expect(neueThemen[0].embedding).toBeUndefined();
  });

  it('berechnet ein fehlendes Embedding fuer ein bestehendes Thema nach und haengt es an', async () => {
    const embedFn = async (texte: string[]) => texte.map(() => [0, 0, 1]);
    const jetzt = new Date().toISOString();
    const bestehend: Thema = {
      id: 'thema-1',
      artikel: [art({ id: 'a1', url: 'https://a.de/1', titel: 'Altes Thema ohne Embedding', teaser: 'Noch nicht gecacht.' })],
      erstellt: jetzt,
      aktualisiert: jetzt,
    };
    const neu = art({ id: 'a2', url: 'https://b.de/1', titel: 'Anderes Thema', teaser: 'Unabhaengiger Inhalt.' });
    await buendeln([neu], [bestehend], { embedFn });

    expect(bestehend.embedding).toEqual([0, 0, 1]);
  });
});
