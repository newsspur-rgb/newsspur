import { describe, it, expect, vi } from 'vitest';
import { bundestagSuchen, bundestagSucheAntwort, suchAmpel } from '../src/bundestagSuche.js';

function dipFetch(proFilter: Record<string, unknown[]>) {
  return vi.fn(async (url: string) => {
    const filter = new URL(url).searchParams.has('f.deskriptor') ? 'deskriptor' : 'titel';
    return { ok: true, json: async () => ({ documents: proFilter[filter] ?? [] }) };
  }) as unknown as typeof fetch;
}

describe('suchAmpel', () => {
  it('ordnet Anfragen, Beschlüsse und Ablehnungen ein', () => {
    expect(suchAmpel('Beantwortet')).toBe('beantwortet');
    expect(suchAmpel('Angenommen')).toBe('beschlossen');
    expect(suchAmpel('Abgelehnt')).toBe('gescheitert');
    expect(suchAmpel('Überwiesen')).toBe('in-beratung');
  });
});

describe('bundestagSuchen', () => {
  it('fragt Schlagwort und Titel mit den vier Vorgangstypen ab, entfernt Doppelte, sortiert neueste zuerst', async () => {
    const fetchImpl = dipFetch({
      deskriptor: [{ id: '1', titel: 'Alt', vorgangstyp: 'Antrag', beratungsstand: 'Abgelehnt', aktualisiert: '2026-01-01' }],
      titel: [
        { id: '1', titel: 'Alt', vorgangstyp: 'Antrag', beratungsstand: 'Abgelehnt', aktualisiert: '2026-01-01' },
        { id: '2', titel: 'Neu', vorgangstyp: 'Gesetzgebung', beratungsstand: 'Verkündet', aktualisiert: '2026-10-01' },
      ],
    });
    const treffer = await bundestagSuchen('Schuldenbremse', fetchImpl);

    expect(treffer.map((t) => t.id)).toEqual(['2', '1']);
    expect(treffer[0]).toMatchObject({ ampel: 'beschlossen', typ: 'Gesetzgebung', link: 'https://dip.bundestag.de/vorgang/-/2' });
    const url = new URL((fetchImpl as any).mock.calls[0][0]);
    expect(url.searchParams.getAll('f.vorgangstyp')).toEqual(['Gesetzgebung', 'Antrag', 'Kleine Anfrage', 'Große Anfrage']);
    expect(url.searchParams.get('f.deskriptor')).toBe('Schuldenbremse');
  });
});

describe('bundestagSucheAntwort', () => {
  it('lehnt zu kurze Suchbegriffe ab', async () => {
    const antwort = await bundestagSucheAntwort(new Request('https://newsspur.de/api/bundestag/suche?q=ab'), dipFetch({}));
    expect(antwort.status).toBe(400);
  });

  it('liefert 502, wenn der Bundestag nicht erreichbar ist', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const antwort = await bundestagSucheAntwort(new Request('https://newsspur.de/api/bundestag/suche?q=Rente'), fetchImpl);
    expect(antwort.status).toBe(502);
  });

  it('liefert Treffer als JSON', async () => {
    const fetchImpl = dipFetch({ titel: [{ id: '9', titel: 'Rentenpaket', aktualisiert: '2026-10-01' }] });
    const antwort = await bundestagSucheAntwort(new Request('https://newsspur.de/api/bundestag/suche?q=Rente'), fetchImpl);
    const daten = (await antwort.json()) as any;
    expect(daten.treffer[0].titel).toBe('Rentenpaket');
  });
});
