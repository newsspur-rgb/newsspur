import { describe, it, expect, vi } from 'vitest';
import { kartePngErzeugen } from '../../src/social/renderCard.js';
import type { ThemenZusammenfassung } from '../../src/types.js';

// Kleinstmoegliches gueltiges PNG (1x1 Pixel), damit resvg das eingebettete Bild echt rendern kann.
const EIN_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function beispiel(overrides: Partial<ThemenZusammenfassung> = {}): ThemenZusammenfassung {
  return {
    themaId: 't1',
    schlagzeile: 'Beispiel-Schlagzeile für den Test',
    zusammenfassung: 'Text',
    kategorieWerte: { deutschland: 90, tuerkei: 0, nahost: 0 },
    wichtigkeit: 50,
    wichtigkeitBegruendung: 'x',
    fakten: [],
    strittigePunkte: [],
    sicherheit: 'hoch',
    ...overrides,
  };
}

describe('kartePngErzeugen', () => {
  it('erzeugt ein gueltiges PNG (Signatur-Bytes) mit plausibler Groesse', async () => {
    const png = await kartePngErzeugen(beispiel());
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.length).toBeGreaterThan(5000);
  });

  it('erzeugt fuer unterschiedliche Schlagzeilen unterschiedliche Bilder', async () => {
    const a = await kartePngErzeugen(beispiel({ schlagzeile: 'Kurze Schlagzeile' }));
    const b = await kartePngErzeugen(beispiel({ schlagzeile: 'Eine ganz andere, viel längere Schlagzeile zum Vergleich' }));
    expect(a.equals(b)).toBe(false);
  });

  it('erzeugt mit echtem Foto ein anderes, weiterhin gueltiges PNG', async () => {
    const fetchOk = vi.fn(
      async () => new Response(EIN_PIXEL_PNG, { status: 200, headers: { 'content-type': 'image/png' } }),
    );
    const ohneFoto = await kartePngErzeugen(beispiel());
    const mitFoto = await kartePngErzeugen(beispiel(), { url: 'https://quelle.example/bild.png', quelle: 'Test-Quelle' }, fetchOk as unknown as typeof fetch);

    expect(mitFoto.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(mitFoto.equals(ohneFoto)).toBe(false);
    expect(fetchOk).toHaveBeenCalledWith('https://quelle.example/bild.png', expect.anything());
  });

  it('faellt bei einem Foto-Ladefehler auf die reine Text-Karte zurueck', async () => {
    const fetchFehler = vi.fn(async () => new Response('nicht gefunden', { status: 404 }));
    const zusammenfassung = beispiel();
    const textKarte = await kartePngErzeugen(zusammenfassung);
    const mitFehlgeschlagenemFoto = await kartePngErzeugen(
      zusammenfassung,
      { url: 'https://quelle.example/kaputt.png', quelle: 'Test-Quelle' },
      fetchFehler as unknown as typeof fetch,
    );

    expect(mitFehlgeschlagenemFoto.equals(textKarte)).toBe(true);
  });
});
