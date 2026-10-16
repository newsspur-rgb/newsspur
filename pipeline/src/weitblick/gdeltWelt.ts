import { landNameAusGdelt, type NeutralesLand } from './neutraleLaender.js';
import { gdeltZiel } from '../sources/gdeltZugang.js';

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

/** GDELT drosselt geteilte IPs (z. B. GitHub-Server) oft mit 429 - dann mit wachsender Pause erneut versuchen. */
const DROSSEL_PAUSEN_MS = [30_000, 60_000, 90_000];

async function abfragen(query: string, fetchImpl: typeof fetch, drosselPausenMs = DROSSEL_PAUSEN_MS): Promise<GdeltRoh[]> {
  const { basisUrl, headers } = gdeltZiel();
  const url = `${basisUrl}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&format=json&timespan=7d&sort=hybridrel`;
  const holen = async () => {
    const antwort = await fetchImpl(url, { headers, signal: AbortSignal.timeout(45_000) });
    return { antwort, text: await antwort.text() };
  };
  // Drosselung kommt als 429 oder als Status 200 mit Klartext "Please limit requests ..."
  const gedrosselt = (a: Response, t: string) => a.status === 429 || t.startsWith('Please limit');
  let { antwort, text } = await holen();
  for (const pause of drosselPausenMs) {
    if (!gedrosselt(antwort, text)) break;
    await new Promise((r) => setTimeout(r, pause));
    ({ antwort, text } = await holen());
  }
  if (!antwort.ok) throw new Error(`GDELT antwortete mit Status ${antwort.status}`);
  // Bei Ueberlastung oder zu langer Abfrage antwortet GDELT mit Status 200 und Klartext statt JSON.
  if (!text.trim().startsWith('{')) throw new Error(`GDELT lieferte kein JSON: ${text.slice(0, 80)}`);
  return (JSON.parse(text) as { articles?: GdeltRoh[] }).articles ?? [];
}

export async function weltpresseSuchen(
  suchbegriffe: string[],
  laender: NeutralesLand[],
  fetchImpl: typeof fetch = fetch,
  pauseMs = 7_000,
  drosselPausenMs = DROSSEL_PAUSEN_MS,
): Promise<WeltArtikel[]> {
  const begriffe = suchbegriffe.map((b) => (b.includes(' ') ? `"${b}"` : b)).join(' ');
  const gesehen = new Set<string>();
  const ergebnis: WeltArtikel[] = [];

  for (let i = 0; i < laender.length; i += LAENDER_PRO_ABFRAGE) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
    const filter = laender.slice(i, i + LAENDER_PRO_ABFRAGE).map((l) => `sourcecountry:${l.fips}`).join(' OR ');
    for (const a of await abfragen(`${begriffe} (${filter})`, fetchImpl, drosselPausenMs)) {
      if (!a.url || !a.title || !a.domain || gesehen.has(a.domain)) continue;
      gesehen.add(a.domain);
      ergebnis.push({ land: landNameAusGdelt(a.sourcecountry ?? ''), medium: a.domain, titel: a.title.trim(), url: a.url });
    }
  }
  return ergebnis;
}
