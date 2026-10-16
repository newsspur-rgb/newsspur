import { landNameAusGdelt, type NeutralesLand } from './neutraleLaender.js';

const GDELT_BASIS_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';

export interface WeltArtikel {
  land: string;
  medium: string;
  titel: string;
  url: string;
}

interface GdeltRoh {
  url?: string;
  title?: string;
  domain?: string;
  sourcecountry?: string;
}

/**
 * Sucht in GDELT nach Berichten aus den angegebenen neutralen Laendern (letzte 7 Tage).
 * GDELT liefert nur Schlagzeilen, keine Volltexte. Pro Medium wird nur ein Artikel behalten,
 * damit ein einzelnes Portal den Abgleich nicht dominiert.
 */
/** GDELT lehnt laengere Abfragen ab ("query too long") - 10 Laender-Filter pro Abfrage passen (getestet 2026-10-16). */
export const LAENDER_PRO_ABFRAGE = 10;

async function abfragen(query: string, fetchImpl: typeof fetch): Promise<GdeltRoh[]> {
  const url = `${GDELT_BASIS_URL}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&format=json&timespan=7d&sort=hybridrel`;
  const antwort = await fetchImpl(url, { signal: AbortSignal.timeout(45_000) });
  if (!antwort.ok) throw new Error(`GDELT antwortete mit Status ${antwort.status}`);
  const text = await antwort.text();
  // Bei Ueberlastung oder zu langer Abfrage antwortet GDELT mit Status 200 und Klartext statt JSON.
  if (!text.trim().startsWith('{')) throw new Error(`GDELT lieferte kein JSON: ${text.slice(0, 80)}`);
  return (JSON.parse(text) as { articles?: GdeltRoh[] }).articles ?? [];
}

export async function weltpresseSuchen(
  suchbegriffe: string[],
  laender: NeutralesLand[],
  fetchImpl: typeof fetch = fetch,
  pauseMs = 7_000,
): Promise<WeltArtikel[]> {
  const begriffe = suchbegriffe.map((b) => (b.includes(' ') ? `"${b}"` : b)).join(' ');
  const gesehen = new Set<string>();
  const ergebnis: WeltArtikel[] = [];

  for (let i = 0; i < laender.length; i += LAENDER_PRO_ABFRAGE) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
    const filter = laender.slice(i, i + LAENDER_PRO_ABFRAGE).map((l) => `sourcecountry:${l.fips}`).join(' OR ');
    for (const a of await abfragen(`${begriffe} (${filter})`, fetchImpl)) {
      if (!a.url || !a.title || !a.domain || gesehen.has(a.domain)) continue;
      gesehen.add(a.domain);
      ergebnis.push({ land: landNameAusGdelt(a.sourcecountry ?? ''), medium: a.domain, titel: a.title.trim(), url: a.url });
    }
  }
  return ergebnis;
}
